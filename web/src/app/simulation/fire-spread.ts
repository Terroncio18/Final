import { CELL_M, GRID } from './domain';
import {
  compileCountermeasures,
  treatedTravel,
  treatmentFactor,
  type Countermeasure,
} from './countermeasures';
import type { Point } from './point';
import { ignitionDistances } from './fire-distances';
import {
  effectiveWind,
  firelineIntensity,
  lengthToBreadth,
  M_PER_FT,
  windFactor,
  type FuelBed,
} from './rothermel';

/**
 * What a simulation needs to run. All of it is data, none of it is a service:
 * the same inputs give the same fire, which is what makes a link reproduce a
 * simulation and not merely describe one.
 */
export interface SpreadInput {
  /** Metres above sea level, GRID × GRID, rows from north to south. */
  readonly elevation: Float32Array;
  readonly bed: FuelBed;
  /** Midflame wind, ft/min. */
  readonly midflame: number;
  /** Anderson 1–13, 0 non-burnable, 255 unknown. Same grid as elevation. */
  readonly fuels?: Uint8Array;
  readonly fuelBeds?: Readonly<Record<number, { bed: FuelBed; midflame: number }>>;
  /** Where the wind blows **towards**, degrees from north, clockwise. */
  readonly towardsDeg: number;
  /** The cells the fire starts in, as indices into the grid. */
  readonly ignitions: readonly number[];
  /** How long to simulate, in minutes. */
  readonly horizon: number;
  /** Prepared at T=0; temporary effects expire in simulated minutes. */
  readonly countermeasures?: {
    readonly centre: Point;
    readonly measures: readonly Countermeasure[];
  };
}

export interface SpreadResult {
  /** Minutes until the fire reaches each cell; Infinity where it never does. */
  readonly arrival: Float32Array;
  readonly horizon: number;
  /** Terrestrial cells with a known, burnable fuel model. */
  readonly burnable: number;
  /**
   * One entry per minute, from 0 to the horizon inclusive. Worked out once,
   * so moving the timeline reads a number instead of scanning a million cells.
   */
  readonly series: {
    /** Burned so far, hectares. */
    readonly area: Float32Array;
    /** Length of the fire's edge, kilometres. */
    readonly perimeter: Float32Array;
    /** Fastest head rate of spread among the cells reached that minute, m/min. */
    readonly rate: Float32Array;
    /** Mean heading of the cells reached that minute, degrees; NaN with none. */
    readonly heading: Float32Array;
    /** Highest head-fire intensity among the cells reached that minute, kW/m. */
    readonly intensity: Float32Array;
    /** Farthest the fire has got from the ignition nearest to it, kilometres. */
    readonly run: Float32Array;
  };
  /** When the fire first touches the edge of the domain, or Infinity. */
  readonly reachedEdge: number;
  /** Mean no-wind, no-slope rate over burnable cells, m/min. */
  readonly baseRate: number;
}

/** How many cells away a single step may land, along either axis. */
const REACH = 5;

/**
 * The steps a fire can take from a cell: every direction that can be written
 * with whole cells up to REACH away, once each.
 *
 * Eight neighbours would be the obvious choice and it is the wrong one twice
 * over. A fire that should be round comes out an octagon, because every path
 * is made of steps at 0 or 45 degrees. And a wind-driven fire comes out far
 * too thin: its ellipse is narrow, the fastest way to a point on the flank
 * leaves the heading by ten or twenty degrees, and with no step in that
 * direction the path zigzags and arrives late. Measured on flat ground with a
 * 22 km/h wind over twelve hours, against the area of the exact ellipse:
 *
 *   reach 2 (16 steps)    874 ha   -35 %
 *   reach 3 (32 steps)   1070 ha   -21 %
 *   reach 4 (48 steps)   1181 ha   -13 %
 *   reach 5 (80 steps)   1245 ha    -8 %   <- in use
 *
 * (the ellipse is 1352 ha). The head of the fire is right at every reach, to
 * within a cell; what improves is the flank. Each line costs a few tens of
 * milliseconds more, so the limit is not the time: past five the steps are
 * longer than the terrain features they would be jumping over.
 *
 * A step several cells long could jump a line of cells that do not burn, so
 * every crossed cell has to burn too; travel time includes its own fuel.
 */
const STEPS: readonly (readonly [number, number])[] = (() => {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));
  const steps: [number, number][] = [];
  for (let dy = -REACH; dy <= REACH; dy += 1) {
    for (let dx = -REACH; dx <= REACH; dx += 1) {
      if ((dx || dy) && gcd(dx, dy) === 1) steps.push([dx, dy]);
    }
  }
  return steps;
})();

/** Exact fractions of a centre-to-centre ray inside each grid cell. */
const PATHS = STEPS.map(([dx, dy]) => {
  const cuts = new Set([0, 1]);
  for (const delta of [dx, dy]) {
    for (let i = 0; i < Math.abs(delta); i++) cuts.add((i + 0.5) / Math.abs(delta));
  }
  const times = [...cuts].sort((a, b) => a - b);
  return times.slice(1).map((end, i) => {
    const start = times[i],
      t = (start + end) / 2;
    return { offset: Math.round(dx * t) + Math.round(dy * t) * GRID, share: end - start };
  });
});

// At an exact grid corner the ray touches both adjacent cells. Do not cut
// diagonally through a one-cell firebreak, even if the touched length is zero.
const CORNERS = STEPS.map(([dx, dy]) => {
  const offsets: number[] = [];
  if (!dx || !dy) return offsets;
  for (let i = 0; i < Math.abs(dx); i++) {
    const t = (i + 0.5) / Math.abs(dx);
    const y = dy * t;
    if (Math.abs(y - Math.floor(y) - 0.5) > 1e-9) continue;
    const x = dx * t;
    offsets.push(
      Math.round(x - Math.sign(dx) * 1e-7) + Math.round(y + Math.sign(dy) * 1e-7) * GRID,
    );
    offsets.push(
      Math.round(x + Math.sign(dx) * 1e-7) + Math.round(y - Math.sign(dy) * 1e-7) * GRID,
    );
  }
  return offsets;
});

/** A binary heap of (time, cell), in typed arrays that grow by doubling. */
class Heap {
  private keys = new Float64Array(1 << 16);
  private cells = new Int32Array(1 << 16);
  size = 0;

  push(key: number, cell: number): void {
    if (this.size === this.keys.length) {
      const keys = new Float64Array(this.size * 2);
      keys.set(this.keys);
      this.keys = keys;
      const cells = new Int32Array(this.size * 2);
      cells.set(this.cells);
      this.cells = cells;
    }
    let i = this.size++;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= key) break;
      this.keys[i] = this.keys[parent];
      this.cells[i] = this.cells[parent];
      i = parent;
    }
    this.keys[i] = key;
    this.cells[i] = cell;
  }

  /** Removes the smallest and leaves it in `key` and `cell`. */
  key = 0;
  cell = 0;
  pop(): void {
    this.key = this.keys[0];
    this.cell = this.cells[0];
    const last = --this.size;
    const key = this.keys[last];
    const cell = this.cells[last];
    let i = 0;
    for (;;) {
      let child = 2 * i + 1;
      if (child >= last) break;
      if (child + 1 < last && this.keys[child + 1] < this.keys[child]) child += 1;
      if (this.keys[child] >= key) break;
      this.keys[i] = this.keys[child];
      this.cells[i] = this.cells[child];
      i = child;
    }
    this.keys[i] = key;
    this.cells[i] = cell;
  }
}

/** Gives the page a turn, so a long computation does not freeze it. */
function breathe(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Spreads a fire over the domain and says when it reaches each cell.
 *
 * **A minimum travel time, and not a cellular automaton that ticks.** Each
 * cell has a rate of spread in every direction —Rothermel's rate for its
 * slope and the wind, drawn out into an ellipse— and the fire reaches a cell
 * by whichever path gets there first. That is Dijkstra's shortest path with
 * time for distance, the idea behind Finney's Minimum Travel Time (2002), and
 * it has two properties a ticking automaton does not: the answer does not
 * depend on a time step, and it is the same every time it is run.
 *
 * What comes out is one number per cell, the minute the fire arrives. The
 * whole evolution is in that grid: the fire at any time T is the cells whose
 * number is below T, so the timeline is a threshold and not a re-run.
 *
 * Per cell, the three things that shape the ellipse:
 * - **The slope** pushes the fire uphill, by φs = slopeK · tan².
 * - **The wind** pushes it downwind by φw, depending on each cell's fuel.
 * - The two are **added as vectors** (Rothermel 1983): a wind across a slope
 *   gives a fire that runs at an angle to both. The length of the sum sets
 *   the head rate, and the wind that would give that sum on flat ground sets
 *   how narrow the ellipse is.
 *
 * It runs on the page's own thread, in slices, and reports how far it has
 * got. A million cells take a second or two, which is not worth a worker and
 * its build configuration yet.
 */
export async function spread(
  input: SpreadInput,
  onProgress?: (share: number) => void,
): Promise<SpreadResult> {
  const { elevation, bed, horizon } = input;
  const count = GRID * GRID;
  if (elevation.length !== count || (input.fuels && input.fuels.length !== count)) {
    throw new Error('Mida de la graella incorrecta.');
  }
  const treatments = input.countermeasures?.measures.length
    ? compileCountermeasures(input.countermeasures.centre, input.countermeasures.measures)
    : undefined;
  const beds = new Map<number, { bed: FuelBed; phiWind: number; r0: number }>();
  for (const [id, value] of Object.entries(input.fuelBeds ?? {})) {
    beds.set(Number(id), {
      bed: value.bed,
      phiWind: windFactor(value.bed, value.midflame),
      r0: value.bed.r0 * M_PER_FT,
    });
  }

  // ---- Per cell: head rate, heading and eccentricity of the ellipse. ----
  const rate = new Float32Array(count); // m/min, 0 where nothing burns
  const headE = new Float32Array(count); // unit vector of the heading, east
  const headN = new Float32Array(count); // ... and north
  const ecc = new Float32Array(count);
  const intensity = new Float32Array(count); // kW/m at the head rate

  const towards = (input.towardsDeg * Math.PI) / 180;
  const windE = Math.sin(towards);
  const windN = Math.cos(towards);
  const uniform = { bed, phiWind: windFactor(bed, input.midflame), r0: bed.r0 * M_PER_FT };
  const span = 2 * CELL_M;

  let burnable = 0;
  let baseSum = 0;
  for (let row = 0; row < GRID; row += 1) {
    const up = Math.max(row - 1, 0) * GRID;
    const down = Math.min(row + 1, GRID - 1) * GRID;
    for (let column = 0; column < GRID; column += 1) {
      const index = row * GRID + column;
      // The sea. Terrarium gives the sea floor as negative elevation and the
      // surface as zero; neither burns (§12.8).
      if (elevation[index] <= 0) continue;
      const model = input.fuels?.[index];
      if (model === 0) continue;
      const local = model === undefined ? uniform : beds.get(model);
      if (!local) throw new Error('Falta combustible conegut en una cel·la terrestre.');
      if (treatments?.blocked[index]) continue;
      const { bed, phiWind, r0 } = local;
      const factor = treatments?.permanent[index] ?? 1;
      burnable += 1;
      baseSum += r0 * factor;

      const west = Math.max(column - 1, 0);
      const east = Math.min(column + 1, GRID - 1);
      // The gradient points uphill. Rows run south, so north is minus that.
      const gradE = (elevation[row * GRID + east] - elevation[row * GRID + west]) / span;
      const gradN = -(elevation[down + column] - elevation[up + column]) / span;
      const tan2 = gradE * gradE + gradN * gradN;
      const tan = Math.sqrt(tan2);

      const phiSlope = bed.slopeK * tan2;
      // φs along the uphill direction plus φw along the wind's.
      const sumE = phiWind * windE + (tan > 0 ? (phiSlope * gradE) / tan : 0);
      const sumN = phiWind * windN + (tan > 0 ? (phiSlope * gradN) / tan : 0);
      const phi = Math.hypot(sumE, sumN);

      rate[index] = r0 * (1 + phi) * factor;
      intensity[index] = firelineIntensity(bed, rate[index]);
      if (phi > 0) {
        headE[index] = sumE / phi;
        headN[index] = sumN / phi;
        const ratio = lengthToBreadth(effectiveWind(bed, phi));
        ecc[index] = Math.sqrt(ratio * ratio - 1) / ratio;
      }
    }
    if (row % 256 === 0) await breathe();
  }

  // ---- Each step: its length and its direction, worked out once. ----
  const stepOffset = STEPS.map(([dx, dy]) => dy * GRID + dx);
  const stepLength = STEPS.map(([dx, dy]) => Math.hypot(dx, dy) * CELL_M);
  const stepE = STEPS.map(([dx, dy]) => dx / Math.hypot(dx, dy));
  // A step down the grid is a step south.
  const stepN = STEPS.map(([dx, dy]) => -dy / Math.hypot(dx, dy));

  // ---- Dijkstra, with time as the distance. ----
  const arrival = new Float32Array(count).fill(Infinity);
  const heap = new Heap();
  // Backfire burns real cells; sea, unburnable land and barriers cannot be lit.
  const extraIgnitions = treatments?.ignitions.filter((cell) => rate[cell] > 0) ?? [];
  if (treatments?.ignitions.length && !extraIgnitions.length)
    throw new Error('El contrafoc no toca cap cel·la amb combustible.');
  const ignitions = [...new Set([...input.ignitions, ...extraIgnitions])];
  for (const cell of ignitions) {
    if (!Number.isInteger(cell) || cell < 0 || cell >= count || rate[cell] === 0) {
      throw new Error('Una ignició cau en una cel·la sense combustible.');
    }
    arrival[cell] = 0;
    heap.push(0, cell);
  }

  let done = 0;
  let sliceStart = performance.now();
  while (heap.size) {
    heap.pop();
    const time = heap.key;
    const cell = heap.cell;
    // An older, slower entry for a cell that has since been reached sooner.
    if (time > arrival[cell]) continue;

    const column = cell % GRID;
    const row = (cell - column) / GRID;

    for (let step = 0; step < STEPS.length; step += 1) {
      const [dx, dy] = STEPS[step];
      const nextColumn = column + dx;
      const nextRow = row + dy;
      if (nextColumn < 0 || nextColumn >= GRID || nextRow < 0 || nextRow >= GRID) continue;
      const next = cell + stepOffset[step];
      const rateNext = rate[next];
      if (rateNext === 0) continue;
      if (CORNERS[step].some((offset) => rate[cell + offset] === 0)) continue;
      let travel = 0;
      for (const segment of PATHS[step]) {
        const at = cell + segment.offset;
        if (rate[at] === 0) {
          travel = Infinity;
          break;
        }
        const cosine = stepE[step] * headE[at] + stepN[step] * headN[at];
        const along = (rate[at] * (1 - ecc[at])) / (1 - ecc[at] * cosine);
        const distance = stepLength[step] * segment.share;
        travel += treatments
          ? treatedTravel(distance, along, time + travel, treatments.temporary.get(at))
          : distance / along;
      }
      // Match the stored float precision so heap entries are not falsely stale.
      const reached = Math.fround(time + travel);
      if (reached < arrival[next] && reached <= horizon) {
        arrival[next] = reached;
        heap.push(reached, next);
      }
    }

    done += 1;
    if ((done & 4095) === 0 && performance.now() - sliceStart > 14) {
      // The time reached so far is the honest measure of progress: the fire
      // is computed in the order it burns.
      onProgress?.(Math.min(time / horizon, 1));
      await breathe();
      sliceStart = performance.now();
    }
  }

  // Statistics describe the treatment active when the front arrives, not T=0.
  if (treatments)
    for (const [cell, windows] of treatments.temporary) {
      const factor = treatmentFactor(windows, arrival[cell]);
      rate[cell] *= factor;
      intensity[cell] *= factor;
    }
  return {
    arrival,
    horizon,
    burnable,
    ...measure(arrival, rate, headE, headN, intensity, ignitions, horizon),
    baseRate: burnable ? baseSum / burnable : 0,
  };
}

/**
 * The figures of a fire, minute by minute, out of its arrival times.
 *
 * - **Area** is a count of cells, each 0,09 ha.
 * - **Perimeter** is counted on the grid's edges —each side between a burned
 *   cell and an unburned one— and then multiplied by π/4. A line drawn in
 *   steps is longer than the line it stands for, by 4/π on average over every
 *   direction, and without the correction a round fire would report the
 *   perimeter of the square around it.
 * - **Rate and heading** are those of the cells the fire reaches in that
 *   minute: what the front is doing then, not an average of the whole fire.
 * - **Intensity** is Byram's, at the head rate of each cell reached that
 *   minute, and the highest of them: the hardest stretch of the front.
 * - **Run** is how far the fire has got from the ignition nearest to each
 *   cell, in a straight line, and the farthest so far.
 */
function measure(
  arrival: Float32Array,
  rate: Float32Array,
  headE: Float32Array,
  headN: Float32Array,
  intensity: Float32Array,
  ignitions: readonly number[],
  horizon: number,
) {
  const minutes = Math.floor(horizon) + 1;
  const cells = new Float64Array(minutes);
  const edges = new Float64Array(minutes + 1);
  const fastest = new Float32Array(minutes);
  const hottest = new Float32Array(minutes);
  const farthest = new Float32Array(minutes);
  const starts = ignitions.map((cell) => [cell % GRID, Math.floor(cell / GRID)] as const);
  // A backfire can seed thousands of cells. Avoid O(burned cells × seeds).
  const distances = ignitions.length > 32 ? ignitionDistances(ignitions) : null;
  const sumE = new Float64Array(minutes);
  const sumN = new Float64Array(minutes);
  let reachedEdge = Infinity;

  /** An edge between two cells is fire line from the first arrival to the second. */
  const edge = (a: number, b: number) => {
    if (a === b) return;
    const first = Math.min(a, b);
    const second = Math.max(a, b);
    if (first > horizon) return;
    edges[Math.ceil(first)] += 1;
    if (second <= horizon) edges[Math.ceil(second)] -= 1;
  };

  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      const index = row * GRID + column;
      const time = arrival[index];

      edge(time, column + 1 < GRID ? arrival[index + 1] : Infinity);
      edge(time, row + 1 < GRID ? arrival[index + GRID] : Infinity);
      if (column === 0) edge(time, Infinity);
      if (row === 0) edge(time, Infinity);

      if (time > horizon) continue;
      const minute = Math.ceil(time);
      cells[minute] += 1;
      if (rate[index] > fastest[minute]) fastest[minute] = rate[index];
      if (intensity[index] > hottest[minute]) hottest[minute] = intensity[index];
      let nearest = distances ? Math.sqrt(distances[index]) : Infinity;
      if (!distances)
        for (const [x, y] of starts) nearest = Math.min(nearest, Math.hypot(column - x, row - y));
      if (nearest > farthest[minute]) farthest[minute] = nearest;
      sumE[minute] += headE[index];
      sumN[minute] += headN[index];
      if (
        (row === 0 || column === 0 || row === GRID - 1 || column === GRID - 1) &&
        time < reachedEdge
      ) {
        reachedEdge = time;
      }
    }
  }

  const area = new Float32Array(minutes);
  const perimeter = new Float32Array(minutes);
  const heading = new Float32Array(minutes);
  const hectaresPerCell = (CELL_M * CELL_M) / 10_000;
  const run = new Float32Array(minutes);
  let burned = 0;
  let open = 0;
  let reach = 0;
  for (let minute = 0; minute < minutes; minute += 1) {
    burned += cells[minute];
    open += edges[minute];
    reach = Math.max(reach, farthest[minute]);
    run[minute] = (reach * CELL_M) / 1000;
    area[minute] = burned * hectaresPerCell;
    perimeter[minute] = (open * CELL_M * (Math.PI / 4)) / 1000;
    heading[minute] =
      sumE[minute] === 0 && sumN[minute] === 0
        ? NaN
        : ((Math.atan2(sumE[minute], sumN[minute]) * 180) / Math.PI + 360) % 360;
  }

  return {
    series: { area, perimeter, rate: fastest, heading, intensity: hottest, run },
    reachedEdge,
  };
}
