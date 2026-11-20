import { CELL_M, GRID } from './domain';
import type { SpreadWind } from './wind';
import { FuelTreatments } from './fuel-treatments';
import {
  emberFlight,
  emberRandom,
  emberIgnitionProbability,
  parseSpotting,
  type SpottingOptions,
  type SpotIgnition,
} from './spotting';
import {
  compileCountermeasures,
  treatedTravel,
  treatmentFactor,
  type Countermeasure,
  physicalMeasure,
  crewSchedule,
  parseCountermeasures,
  MOP_UP_MAX_FLAME_M,
} from './countermeasures';
import type { Point } from './point';
import { ignitionDistances } from './fire-distances';
import { activeFront } from './fire-display';
import {
  effectiveWind,
  firelineIntensity,
  byramIntensity,
  flameLength,
  lengthToBreadth,
  M_PER_FT,
  windFactor,
  type FuelBed,
  type Moistures,
  FUEL_MODELS,
} from './rothermel';

/**
 * What a simulation needs to run. All of it is data, none of it is a service:
 * the same inputs give the same fire, which is what makes a link reproduce a
 * simulation and not merely describe one.
 */
interface SpreadInput {
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
  readonly windChanges?: readonly SpreadWind[];
  readonly fuelMoistures?: Moistures;
  readonly spotting?: SpottingOptions;
  readonly wind10mKmh?: number;
  readonly temperatureC?: number;
  /** The cells the fire starts in, as indices into the grid. */
  readonly ignitions: readonly number[];
  /** How long to simulate, in minutes. */
  readonly horizon: number;
  /** Interventions activate at startMin; durations are relative to deployment. */
  readonly countermeasures?: {
    readonly centre: Point;
    readonly measures: readonly Countermeasure[];
    /** Already known safety stops, for replaying a forecast with fixed history. */
    readonly crewStops?: ReadonlyMap<string, number>;
  };
}

export interface SpreadResult {
  /** Minutes until the fire reaches each cell; Infinity where it never does. */
  readonly arrival: Float32Array;
  readonly horizon: number;
  /** Terrestrial cells with a known, burnable fuel model. */
  readonly burnable: number;
  /**
   * Heat released per unit area by each cell's untreated fuel, BTU/ft²: the
   * H·w of Byram's intensity. Zero where nothing burns. For the drawing, which
   * multiplies it by the speed the front really crosses the cell at.
   */
  readonly heat: Float32Array;
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
  readonly fuelTreatments?: FuelTreatments;
  readonly spotIgnitions?: readonly SpotIgnition[];
  readonly crewStops?: ReadonlyMap<string, number>;
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
    return { offset: Math.round(dx * t) + Math.round(dy * t) * GRID, share: end - start, end };
  });
});

// At an exact grid corner the ray touches both adjacent cells. Do not cut
// diagonally through a one-cell firebreak, even if the touched length is zero.
const CORNERS = STEPS.map(([dx, dy]) => {
  const offsets: { offset: number; fraction: number }[] = [];
  if (!dx || !dy) return offsets;
  for (let i = 0; i < Math.abs(dx); i++) {
    const t = (i + 0.5) / Math.abs(dx);
    const y = dy * t;
    if (Math.abs(y - Math.floor(y) - 0.5) > 1e-9) continue;
    const x = dx * t;
    offsets.push({
      offset: Math.round(x - Math.sign(dx) * 1e-7) + Math.round(y + Math.sign(dy) * 1e-7) * GRID,
      fraction: t,
    });
    offsets.push({
      offset: Math.round(x + Math.sign(dx) * 1e-7) + Math.round(y - Math.sign(dy) * 1e-7) * GRID,
      fraction: t,
    });
  }
  return offsets;
});

/** A binary heap of (time, cell), in typed arrays that grow by doubling. */
class Heap {
  private keys = new Float64Array(1 << 16);
  private cells = new Int32Array(1 << 16);
  public size = 0;

  /** Where pop() leaves the smallest. */
  public key = 0;
  public cell = 0;

  public push(key: number, cell: number): void {
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
  public pop(): void {
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
  const plan = input.countermeasures;
  const crews = plan ? crewVisits(plan) : new Map<number, CrewVisit[]>();
  const stops = new Map(plan?.crewStops);
  for (const [id, minute] of stops)
    if (!validStop(plan, id, minute)) throw new Error('Parada de brigada incorrecta.');
  // Fix only the earliest new stop: later stops may disappear when an earlier
  // one removes future treatments. Each rerun fixes at least one more crew.
  for (;;) {
    let stop: { id: string; minute: number } | undefined;
    const result = await spreadRun(input, onProgress, crews, stops, (id, minute) => {
      stop ??= { id, minute };
    });
    if (!stop) return crews.size ? { ...result, crewStops: stops } : result;
    stops.set(stop.id, stop.minute);
  }
}

interface CrewVisit {
  readonly id: string;
  readonly activation: number;
  readonly workStart: number;
  readonly workEnd: number;
}

type PlannedMeasures = NonNullable<SpreadInput['countermeasures']>;

/** Per cell, the crews that will work it and when. Throws on a plan the model refuses. */
function crewVisits(plan: PlannedMeasures): Map<number, CrewVisit[]> {
  const parsed = parseCountermeasures(plan.measures);
  if (typeof parsed === 'string') throw new Error(parsed);
  const crews = new Map<number, CrewVisit[]>();
  for (const m of parsed) {
    const schedule = crewSchedule(plan.centre, m);
    if (!schedule) continue;
    for (let i = 0; i < schedule.cells.length; i++) {
      const cell = schedule.cells[i];
      let visits = crews.get(cell);
      if (!visits) crews.set(cell, (visits = []));
      visits.push({
        id: m.id,
        activation: schedule.minutes[i],
        workStart: schedule.workStart,
        workEnd: schedule.workEnd,
      });
    }
  }
  return crews;
}

/** A stop is a real minute, on a measure of this plan that has a crew. */
function validStop(plan: PlannedMeasures | undefined, id: string, minute: number): boolean {
  return (
    Number.isFinite(minute) &&
    minute >= 0 &&
    (plan?.measures.some((m) => m.id === id && m.crewSize !== undefined) ?? false)
  );
}

/** The incoming triangles of frontIntensity, restricted to this cell's neighbourhood. */
function crewEntryIntensity(
  arrival: Float32Array,
  cell: number,
  heat: number,
  incomingSpeed: number,
): number {
  const time = arrival[cell];
  const x = cell % GRID,
    y = Math.floor(cell / GRID);
  const local = new Float32Array(9).fill(Infinity);
  let previous = -Infinity;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (x + dx < 0 || x + dx >= GRID || y + dy < 0 || y + dy >= GRID) continue;
      const t = arrival[cell + dy * GRID + dx];
      // Only the incoming, already reached side may decide a stop. A future
      // vertex could move after that stop removes a barrier, changing history.
      if (t <= time) local[(dy + 1) * 3 + dx + 1] = t;
      if (t < time) previous = Math.max(previous, t);
    }
  if (!(heat > 0)) return 0;
  // A triangle's pace is constant between vertex times. Sampling inside the
  // last interval before entry gives its exact left limit, without degenerating
  // the contour into a zero-length segment at the vertex. Heat is read at entry.
  let hottest = 0;
  let found = false;
  for (const segment of activeFront(local, 3, (previous + time) / 2)) {
    if (segment.ahead !== 4) continue;
    found = true;
    const speed = segment.pace > 0 ? CELL_M / segment.pace : Infinity;
    hottest = Math.max(hottest, byramIntensity(heat, speed));
  }
  // A one-cell fuel corridor has no finite triangle. Its arriving path still
  // measures the front's speed, including any wait in the destination cell.
  return found ? hottest : byramIntensity(heat, incomingSpeed);
}

type CompiledMeasures = ReturnType<typeof compileCountermeasures>;
type TreatmentWindow = NonNullable<Parameters<typeof treatmentFactor>[0]>[number];

interface LocalBed {
  readonly bed: FuelBed;
  readonly phiWind: number;
  readonly r0: number;
}

/** What a run reads besides the grid, checked and built before any cell is visited. */
interface RunSetup {
  readonly treatments: CompiledMeasures | undefined;
  readonly fuelTreatments: FuelTreatments | undefined;
  /** Read for every step of every cell: a byte per cell, not a map lookup. */
  readonly treatedFuel: Uint8Array | undefined;
  /** The same for the cells with a timed multiplier or a late barrier. */
  readonly timed: Uint8Array | undefined;
  /** When each mopped-up cell's fire is put out (§11.40); Infinity elsewhere. */
  readonly mopped: Float32Array | undefined;
  readonly spotting: boolean;
  readonly physical: boolean;
  readonly winds: readonly SpreadWind[];
  readonly beds: ReadonlyMap<number, LocalBed>;
}

/** Per cell: head rate, heading and eccentricity of the ellipse. */
interface HeadField {
  /** m/min, 0 where nothing burns. */
  readonly rate: Float32Array;
  /** Unit vector of the heading, east... */
  readonly headE: Float32Array;
  /** ... and north. */
  readonly headN: Float32Array;
  readonly ecc: Float32Array;
  /** kW/m at the head rate. */
  readonly intensity: Float32Array;
  /** BTU/ft², untreated. */
  readonly heat: Float32Array;
  burnable: number;
  baseSum: number;
}

/** One wind of the sequence, as the ellipses read it. */
interface WindField {
  readonly start: number;
  readonly east: number;
  readonly north: number;
  readonly uniform: number;
  readonly models: ReadonlyMap<number, number>;
}

// ---- Each step: its length and its direction, worked out once. ----
const STEP_OFFSET = STEPS.map(([dx, dy]) => dy * GRID + dx);
const STEP_LENGTH = STEPS.map(([dx, dy]) => Math.hypot(dx, dy) * CELL_M);
const STEP_E = STEPS.map(([dx, dy]) => dx / Math.hypot(dx, dy));
// A step down the grid is a step south.
const STEP_N = STEPS.map(([dx, dy]) => -dy / Math.hypot(dx, dy));

/** Two cells across, for the slope's central differences. */
const SPAN = 2 * CELL_M;

/**
 * One run of the solver, with the crew stops already known.
 *
 * Split in the stages it goes through (docs/estil.md §4), measured before and
 * after on the 1024² grid: the inner loop is still one step, one segment at a
 * time, over typed arrays read from a single object.
 */
async function spreadRun(
  input: SpreadInput,
  onProgress: ((share: number) => void) | undefined,
  crews: ReadonlyMap<number, readonly CrewVisit[]>,
  crewStops: ReadonlyMap<string, number>,
  stopCrew: (id: string, minute: number) => void,
): Promise<SpreadResult> {
  const { horizon } = input;
  const setup = prepareRun(input, crewStops);
  const field = await headField(input, setup);
  const winds = windFields(input, setup);
  const ellipses =
    setup.winds.length > 0 || setup.physical ? new Ellipses(input, setup, field, winds) : null;
  const fire = new Propagation(input, setup, field, winds, ellipses, crews);
  const { ignitions, timedIgnitions } = fire.ignite();
  await fire.burn(onProgress);
  const { arrival } = fire;
  // Read each cell's ellipse at arrival, before overwriting the baseline arrays.
  if (ellipses) ellipsesAtArrival(input, setup, field, ellipses, winds, arrival);
  // Statistics describe the treatment active when the front arrives, not T=0.
  if (setup.treatments) treatmentsAtArrival(setup.treatments, field, arrival);
  const stop = fire.crewStop(crewStops);
  if (stop) stopCrew(stop.id, stop.minute);
  return {
    arrival,
    horizon,
    burnable: field.burnable,
    heat: field.heat,
    ...(setup.fuelTreatments ? { fuelTreatments: setup.fuelTreatments } : {}),
    ...(setup.spotting
      ? {
          spotIgnitions: [...fire.spots.values()]
            .filter((s) => arrival[s.cell] === s.minute)
            .sort((a, b) => a.minute - b.minute),
        }
      : {}),
    ...measure(
      arrival,
      field.rate,
      field.headE,
      field.headN,
      field.intensity,
      ignitions,
      horizon,
      timedIgnitions,
    ),
    baseRate: field.burnable ? field.baseSum / field.burnable : 0,
  };
}

/** Checks the input, in the order the errors have always come out, and compiles the plan. */
function prepareRun(input: SpreadInput, crewStops: ReadonlyMap<string, number>): RunSetup {
  checkGrid(input);
  const plan = input.countermeasures;
  const treatments = plan?.measures.length
    ? compileCountermeasures(plan.centre, plan.measures, crewStops)
    : undefined;
  const spotting = checkSpotting(input);
  const physical = plan?.measures.some(physicalMeasure) ?? false;
  if ((physical || spotting) && !validMoistures(input.fuelMoistures))
    throw new Error('Falta la humitat inicial del combustible.');
  const fuelTreatments = physical ? treatedFuels(input, crewStops) : undefined;
  const masks = treatmentMasks(treatments, fuelTreatments);
  const winds = input.windChanges ?? [];
  if (winds.length > 100 || winds.some(invalidWind))
    throw new Error('Seqüència de vent incorrecta.');
  return {
    treatments,
    fuelTreatments,
    ...masks,
    spotting,
    physical,
    winds,
    beds: localBeds(input),
  };
}

function checkGrid(input: SpreadInput): void {
  const count = GRID * GRID;
  if (input.elevation.length !== count || (input.fuels && input.fuels.length !== count)) {
    throw new Error('Mida de la graella incorrecta.');
  }
}

/** The water and the clearings of a plan, over moistures already checked. */
function treatedFuels(input: SpreadInput, crewStops: ReadonlyMap<string, number>) {
  const plan = input.countermeasures!;
  return new FuelTreatments(
    plan.centre,
    plan.measures,
    input.fuelMoistures!,
    input.fuels,
    FUEL_MODELS,
    crewStops,
  );
}

/** Whether embers fly; throws when they should and the weather to carry them is missing. */
function checkSpotting(input: SpreadInput): boolean {
  if (input.spotting && typeof parseSpotting(input.spotting) === 'string')
    throw new Error('Configuració de brases incorrecta.');
  const spotting = input.spotting?.enabled ?? false;
  if (
    spotting &&
    (!input.fuelMoistures ||
      !Number.isFinite(input.wind10mKmh) ||
      input.wind10mKmh! < 0 ||
      !Number.isFinite(input.temperatureC))
  )
    throw new Error('Falten dades meteorològiques per a les brases.');
  return spotting;
}

function validMoistures(moistures: Moistures | undefined): boolean {
  return (
    moistures !== undefined && !Object.values(moistures).some((v) => !Number.isFinite(v) || v < 0)
  );
}

function invalidWind(w: SpreadWind, i: number, winds: readonly SpreadWind[]): boolean {
  return (
    !Number.isFinite(w.startMin) ||
    w.startMin < 0 ||
    w.startMin > 720 ||
    (i > 0 && w.startMin <= winds[i - 1].startMin) ||
    !Number.isFinite(w.speedKmh) ||
    w.speedKmh < 0 ||
    !Number.isFinite(w.towardsDeg) ||
    !Number.isFinite(w.midflame) ||
    w.midflame < 0 ||
    Object.values(w.fuelMidflame).some((v) => !Number.isFinite(v) || v < 0)
  );
}

/** The plan as one byte or one number per cell, for the loops that read it every step. */
function treatmentMasks(
  treatments: CompiledMeasures | undefined,
  fuelTreatments: FuelTreatments | undefined,
): Pick<RunSetup, 'treatedFuel' | 'timed' | 'mopped'> {
  const count = GRID * GRID;
  const treatedFuel = fuelTreatments ? new Uint8Array(count) : undefined;
  if (treatedFuel) for (const cell of fuelTreatments!.cells()) treatedFuel[cell] = 1;
  const timed = treatments?.temporary.size ? new Uint8Array(count) : undefined;
  if (timed) for (const cell of treatments!.temporary.keys()) timed[cell] = 1;
  const mopped = treatments?.mopUp.size ? new Float32Array(count).fill(Infinity) : undefined;
  if (mopped) for (const [cell, minute] of treatments!.mopUp) mopped[cell] = minute;
  return { treatedFuel, timed, mopped };
}

function localBeds(input: SpreadInput): Map<number, LocalBed> {
  const beds = new Map<number, LocalBed>();
  for (const [id, value] of Object.entries(input.fuelBeds ?? {})) {
    beds.set(Number(id), {
      bed: value.bed,
      phiWind: windFactor(value.bed, value.midflame),
      r0: value.bed.r0 * M_PER_FT,
    });
  }
  return beds;
}

/** The untreated bed of a cell: its own model's, or the uniform one. */
function plainBed(input: SpreadInput, setup: RunSetup, cell: number): FuelBed {
  const model = input.fuels?.[cell];
  return model === undefined ? input.bed : setup.beds.get(model)!.bed;
}

/** The slope's rise to the east, central differences clamped at the edge. */
function slopeEast(elevation: Float32Array, row: number, column: number): number {
  const west = Math.max(column - 1, 0);
  const east = Math.min(column + 1, GRID - 1);
  return (elevation[row * GRID + east] - elevation[row * GRID + west]) / SPAN;
}

/** The same to the north. Rows run south, so north is minus the row gradient. */
function slopeNorth(elevation: Float32Array, row: number, column: number): number {
  const up = Math.max(row - 1, 0) * GRID;
  const down = Math.min(row + 1, GRID - 1) * GRID;
  return -(elevation[down + column] - elevation[up + column]) / SPAN;
}

/** The baseline ellipse of every cell, for the wind at T=0 and the untreated fuel. */
async function headField(input: SpreadInput, setup: RunSetup): Promise<HeadField> {
  const count = GRID * GRID;
  const field: HeadField = {
    rate: new Float32Array(count),
    headE: new Float32Array(count),
    headN: new Float32Array(count),
    ecc: new Float32Array(count),
    intensity: new Float32Array(count),
    heat: new Float32Array(count),
    burnable: 0,
    baseSum: 0,
  };
  const towards = (input.towardsDeg * Math.PI) / 180;
  const wind = { east: Math.sin(towards), north: Math.cos(towards) };
  const { bed, midflame } = input;
  const uniform = { bed, phiWind: windFactor(bed, midflame), r0: bed.r0 * M_PER_FT };
  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      const index = row * GRID + column;
      const local = burningBed(input, setup, uniform, index);
      if (!local) continue;
      const factor = setup.treatments?.permanent[index] ?? 1;
      field.burnable += 1;
      field.baseSum += local.r0 * factor;
      headCell(field, input.elevation, row, column, local, factor, wind);
    }
    if (row % 256 === 0) await breathe();
  }
  return field;
}

/** The bed a cell burns with, or undefined where nothing does. */
function burningBed(
  input: SpreadInput,
  setup: RunSetup,
  uniform: LocalBed,
  index: number,
): LocalBed | undefined {
  // The sea. Terrarium gives the sea floor as negative elevation and the
  // surface as zero; neither burns (§12.8).
  if (input.elevation[index] <= 0) return undefined;
  const model = input.fuels?.[index];
  if (model === 0) return undefined;
  const local = model === undefined ? uniform : setup.beds.get(model);
  if (!local) throw new Error('Falta combustible conegut en una cel·la terrestre.');
  return setup.treatments?.blocked[index] ? undefined : local;
}

/** One cell of the baseline: slope and wind added as vectors (Rothermel 1983). */
function headCell(
  field: HeadField,
  elevation: Float32Array,
  row: number,
  column: number,
  local: LocalBed,
  factor: number,
  wind: { readonly east: number; readonly north: number },
): void {
  const index = row * GRID + column;
  const { bed, phiWind, r0 } = local;
  // The gradient points uphill.
  const gradE = slopeEast(elevation, row, column);
  const gradN = slopeNorth(elevation, row, column);
  const tan2 = gradE * gradE + gradN * gradN;
  const tan = Math.sqrt(tan2);

  const phiSlope = bed.slopeK * tan2;
  // φs along the uphill direction plus φw along the wind's.
  const sumE = phiWind * wind.east + (tan > 0 ? (phiSlope * gradE) / tan : 0);
  const sumN = phiWind * wind.north + (tan > 0 ? (phiSlope * gradN) / tan : 0);
  const phi = Math.hypot(sumE, sumN);

  field.rate[index] = r0 * (1 + phi) * factor;
  field.intensity[index] = firelineIntensity(bed, field.rate[index]);
  field.heat[index] = bed.heatPerArea;
  if (phi > 0) {
    field.headE[index] = sumE / phi;
    field.headN[index] = sumN / phi;
    const ratio = lengthToBreadth(effectiveWind(bed, phi));
    field.ecc[index] = Math.sqrt(ratio * ratio - 1) / ratio;
  }
}

function windFields(input: SpreadInput, setup: RunSetup): WindField[] {
  return setup.winds.map((w) => ({
    start: w.startMin,
    east: Math.sin((w.towardsDeg * Math.PI) / 180),
    north: Math.cos((w.towardsDeg * Math.PI) / 180),
    uniform: windFactor(input.bed, w.midflame),
    models: new Map(
      [...setup.beds].map(([id, local]) => {
        const midflame = w.fuelMidflame[id];
        if (midflame === undefined) throw new Error('Falta el vent d’un model de combustible.');
        return [id, windFactor(local.bed, midflame)] as const;
      }),
    ),
  }));
}

/** The wind in force at a minute, as an index into the sequence; -1 before the first. */
function epochAt(winds: readonly WindField[], minute: number): number {
  for (let i = winds.length - 1; i >= 0; i--) if (winds[i].start <= minute) return i;
  return -1;
}

/** The midflame wind a cell's model feels in an epoch, ft/min. */
function midflameAt(
  input: SpreadInput,
  winds: readonly SpreadWind[],
  epoch: number,
  model: number | undefined,
): number {
  if (epoch >= 0)
    return model === undefined ? winds[epoch].midflame : winds[epoch].fuelMidflame[model];
  return model === undefined ? input.midflame : input.fuelBeds![model].midflame;
}

/**
 * The time-dependent ellipse, for a run whose wind changes or whose fuel is
 * treated. One cached ellipse per cell bounds memory independently of wind
 * changes. Its epoch can move forward or back when a long edge straddles a
 * transition.
 */
class Ellipses {
  public readonly rate: Float32Array;
  public readonly east: Float32Array;
  public readonly north: Float32Array;
  public readonly ecc: Float32Array;
  private readonly epoch: Int16Array;
  private readonly fuel = new Map<number, FuelBed>();
  private readonly baseWind: { readonly east: number; readonly north: number };

  public constructor(
    private readonly input: SpreadInput,
    private readonly setup: RunSetup,
    private readonly field: HeadField,
    private readonly winds: readonly WindField[],
  ) {
    const count = GRID * GRID;
    this.epoch = new Int16Array(count).fill(-2);
    this.rate = new Float32Array(count);
    this.east = new Float32Array(count);
    this.north = new Float32Array(count);
    this.ecc = new Float32Array(count);
    const towards = (input.towardsDeg * Math.PI) / 180;
    this.baseWind = { east: Math.sin(towards), north: Math.cos(towards) };
  }

  /** Brings a cell's cached ellipse to an epoch and to its fuel at a minute. */
  public update(cell: number, epoch: number, minute: number): void {
    const changed = this.setup.fuelTreatments?.at(cell, minute)?.bed;
    if (this.epoch[cell] === epoch && this.fuel.get(cell) === changed) return;
    this.epoch[cell] = epoch;
    if (changed) this.fuel.set(cell, changed);
    else this.fuel.delete(cell);
    if (epoch < 0 && !changed) {
      this.rate[cell] = this.field.rate[cell];
      this.east[cell] = this.field.headE[cell];
      this.north[cell] = this.field.headN[cell];
      this.ecc[cell] = this.field.ecc[cell];
      return;
    }
    this.recompute(cell, epoch, changed);
  }

  /** Minutes to cross a distance of a cell in a direction, through every change on the way. */
  public travel(cell: number, distance: number, start: number, east: number, north: number) {
    let remaining = distance,
      now = start;
    const windows = this.setup.treatments?.temporary.get(cell);
    while (remaining > 0) {
      if (now >= this.input.horizon) return Infinity;
      const epoch = epochAt(this.winds, now);
      this.update(cell, epoch, now);
      const cosine = east * this.east[cell] + north * this.north[cell];
      const along = (this.rate[cell] * (1 - this.ecc[cell])) / (1 - this.ecc[cell] * cosine);
      const treatment = windows?.find((w) => now < w.until);
      const speed = along * (treatment?.factor ?? 1);
      const until = this.changeAfter(cell, epoch, now, treatment);
      if (speed > 0 && remaining <= speed * (until - now)) return now - start + remaining / speed;
      if (until === Infinity) return Infinity;
      remaining -= speed * (until - now);
      now = until;
    }
    return now - start;
  }

  /** The next minute the wind, a timed treatment or the cell's fuel changes. */
  private changeAfter(
    cell: number,
    epoch: number,
    now: number,
    treatment: TreatmentWindow | undefined,
  ): number {
    const fuel = this.setup.fuelTreatments;
    return Math.min(
      this.winds[epoch + 1]?.start ?? Infinity,
      treatment?.until ?? Infinity,
      fuel?.at(cell, now)?.until ?? fuel?.next(cell, now) ?? Infinity,
    );
  }

  private recompute(cell: number, epoch: number, changed: FuelBed | undefined): void {
    const { input, setup } = this;
    const model = input.fuels?.[cell];
    const w = epoch >= 0 ? this.winds[epoch] : this.baseWind;
    const localBed = changed ?? plainBed(input, setup, cell);
    const phiWind = windFactor(localBed, midflameAt(input, setup.winds, epoch, model));
    const row = Math.floor(cell / GRID),
      column = cell % GRID;
    const gradE = slopeEast(input.elevation, row, column);
    const gradN = slopeNorth(input.elevation, row, column);
    const tan = Math.hypot(gradE, gradN);
    const slope = localBed.slopeK * tan;
    const sumE = phiWind * w.east + slope * gradE;
    const sumN = phiWind * w.north + slope * gradN;
    const phi = Math.hypot(sumE, sumN);
    this.rate[cell] = localBed.r0 * M_PER_FT * (1 + phi) * (setup.treatments?.permanent[cell] ?? 1);
    this.east[cell] = phi ? sumE / phi : 0;
    this.north[cell] = phi ? sumN / phi : 0;
    const ratio = phi ? lengthToBreadth(effectiveWind(localBed, phi)) : 1;
    this.ecc[cell] = Math.sqrt(1 - 1 / (ratio * ratio));
  }
}

/** Rounds a minute upwards to the stored precision: a seed never ignites early. */
function ceilFloat32(minute: number): number {
  const stored = new Float32Array([minute]);
  if (stored[0] < minute) new Uint32Array(stored.buffer)[0] += 1;
  return stored[0];
}

/** Dijkstra, with time as the distance. */
class Propagation {
  public readonly arrival = new Float32Array(GRID * GRID).fill(Infinity);
  public readonly spots = new Map<number, SpotIgnition>();
  private readonly entrySpeed: Map<number, number> | undefined;
  private readonly heap = new Heap();
  /** With the wind changing, every segment takes the time-dependent path. */
  private readonly windy: boolean;
  /** The speed the last step entered its destination at, for the crews. */
  private incoming = 0;

  public constructor(
    private readonly input: SpreadInput,
    private readonly setup: RunSetup,
    private readonly field: HeadField,
    private readonly winds: readonly WindField[],
    private readonly ellipses: Ellipses | null,
    private readonly crews: ReadonlyMap<number, readonly CrewVisit[]>,
  ) {
    this.entrySpeed = crews.size ? new Map<number, number>() : undefined;
    this.windy = setup.winds.length > 0;
  }

  /** Lights the ignitions and the backfires; says which ones, for the statistics. */
  public ignite() {
    const { rate } = this.field;
    const treatments = this.setup.treatments;
    // Backfire burns real cells; sea, unburnable land and barriers cannot be lit.
    const extraIgnitions = treatments?.ignitions.filter((cell) => rate[cell] > 0) ?? [];
    if (treatments?.ignitions.length && !extraIgnitions.length)
      throw new Error('El contrafoc no toca cap cel·la amb combustible.');
    const ignitions = [...new Set([...this.input.ignitions, ...extraIgnitions])];
    for (const cell of ignitions) {
      if (!Number.isInteger(cell) || cell < 0 || cell >= rate.length || rate[cell] === 0) {
        throw new Error('Una ignició cau en una cel·la sense combustible.');
      }
      this.arrival[cell] = 0;
      this.heap.push(0, cell);
    }
    return { ignitions, timedIgnitions: this.igniteTimed() };
  }

  public async burn(onProgress: ((share: number) => void) | undefined): Promise<void> {
    const { arrival, heap } = this;
    let done = 0;
    let sliceStart = performance.now();
    while (heap.size) {
      heap.pop();
      const time = heap.key;
      const cell = heap.cell;
      // An older, slower entry for a cell that has since been reached sooner.
      if (time > arrival[cell]) continue;
      if (this.setup.spotting) this.spotFrom(cell, time);
      this.relax(cell, time);
      done += 1;
      if ((done & 4095) === 0 && performance.now() - sliceStart > 14) {
        // The time reached so far is the honest measure of progress: the fire
        // is computed in the order it burns.
        onProgress?.(Math.min(time / this.input.horizon, 1));
        await breathe();
        sliceStart = performance.now();
      }
    }
  }

  /** The first crew the front catches with flames too long to work by (§11.40). */
  public crewStop(crewStops: ReadonlyMap<string, number>) {
    const { arrival } = this;
    let firstStop: { id: string; minute: number } | undefined;
    for (const [cell, visits] of this.crews) {
      const time = arrival[cell];
      if (!Number.isFinite(time) || time >= (firstStop?.minute ?? Infinity)) continue;
      const visit = visits.find(
        (v) =>
          !crewStops.has(v.id) && time >= v.workStart && time < v.workEnd && time < v.activation,
      );
      if (visit && this.tooHotForCrew(cell, time)) firstStop = { id: visit.id, minute: time };
    }
    return firstStop;
  }

  /** The backfires lit when they are deployed, where they can still burn. */
  private igniteTimed() {
    const { rate } = this.field;
    const treatments = this.setup.treatments;
    const timedIgnitions = (treatments?.timedIgnitions ?? []).filter(
      ({ cell, minute }) =>
        minute <= this.input.horizon &&
        rate[cell] > 0 &&
        treatmentFactor(treatments?.temporary.get(cell), minute) > 0,
    );
    for (const { cell, minute } of timedIgnitions) {
      // Its deployment minute, even when playback stops between whole minutes.
      const time = ceilFloat32(minute);
      if (time < this.arrival[cell]) {
        this.arrival[cell] = time;
        this.heap.push(time, cell);
      }
    }
    return timedIgnitions;
  }

  private tooHotForCrew(cell: number, time: number): boolean {
    const entryHeat =
      this.setup.fuelTreatments?.at(cell, time)?.bed.heatPerArea ?? this.field.heat[cell];
    const entry = crewEntryIntensity(
      this.arrival,
      cell,
      entryHeat,
      this.entrySpeed?.get(cell) ?? 0,
    );
    return flameLength(entry) > MOP_UP_MAX_FLAME_M;
  }

  /** Embers from a cell as it ignites: where they land, and whether they light it. */
  private spotFrom(cell: number, time: number): void {
    const candidate = emberFlight(
      cell,
      time,
      this.sourceIntensity(cell, time),
      FUEL_MODELS[this.input.fuels?.[cell] ?? 1].id >= 4,
      this.input.spotting!.seed,
      (t) => this.emberWind(t),
    );
    if (candidate && this.spotLands(candidate)) this.trySpot(cell, candidate);
  }

  private sourceIntensity(cell: number, time: number): number {
    const { input, setup, ellipses } = this;
    const sourceBed = setup.fuelTreatments?.at(cell, time)?.bed ?? plainBed(input, setup, cell);
    if (ellipses) ellipses.update(cell, epochAt(this.winds, time), time);
    const sourceRate =
      (ellipses ? ellipses.rate[cell] : this.field.rate[cell]) *
      treatmentFactor(setup.treatments?.temporary.get(cell), time);
    return firelineIntensity(sourceBed, sourceRate);
  }

  private emberWind(t: number) {
    const epoch = epochAt(this.winds, t),
      w = epoch >= 0 ? this.setup.winds[epoch] : undefined;
    return {
      speedKmh: w?.speedKmh ?? this.input.wind10mKmh!,
      towardsDeg: w?.towardsDeg ?? this.input.towardsDeg,
      until: this.winds[epoch + 1]?.start ?? Infinity,
    };
  }

  /** An ember that falls in time, ahead of the front, on fuel that can burn then. */
  private spotLands(candidate: SpotIgnition): boolean {
    return (
      candidate.minute <= this.input.horizon &&
      candidate.minute < this.arrival[candidate.cell] &&
      this.field.rate[candidate.cell] > 0 &&
      treatmentFactor(this.setup.treatments?.temporary.get(candidate.cell), candidate.minute) > 0
    );
  }

  private trySpot(cell: number, candidate: SpotIgnition): void {
    const { input } = this;
    const targetModel = FUEL_MODELS[input.fuels?.[candidate.cell] ?? 1];
    const target = this.setup.fuelTreatments?.at(candidate.cell, candidate.minute);
    const fineKgM2 =
      targetModel.particles
        .filter((p) => p.kind === 'dead1')
        .reduce((sum, p) => sum + p.load * 0.22417, 0) * (target?.remaining ?? 1);
    const probability = emberIgnitionProbability(
      target?.moisture1h ?? input.fuelMoistures!.dead1,
      targetModel.extinction,
      fineKgM2,
      input.temperatureC!,
    );
    // Written as a negation so that a NaN probability lights nothing, as before.
    if (!(emberRandom(input.spotting!.seed, cell, 3) < probability)) return;
    const minute = ceilFloat32(candidate.minute);
    this.arrival[candidate.cell] = minute;
    this.entrySpeed?.delete(candidate.cell);
    this.heap.push(minute, candidate.cell);
    this.spots.set(candidate.cell, { ...candidate, minute });
  }

  /** Every step out of a cell just reached. */
  private relax(cell: number, time: number): void {
    const { rate } = this.field;
    const column = cell % GRID;
    const row = (cell - column) / GRID;
    for (let step = 0; step < STEPS.length; step += 1) {
      const [dx, dy] = STEPS[step];
      const nextColumn = column + dx;
      const nextRow = row + dy;
      if (nextColumn < 0 || nextColumn >= GRID || nextRow < 0 || nextRow >= GRID) continue;
      const next = cell + STEP_OFFSET[step];
      if (rate[next] === 0) continue;
      if (CORNERS[step].some(({ offset }) => rate[cell + offset] === 0)) continue;
      // Match the stored float precision so heap entries are not falsely stale.
      this.reach(cell, time, next, Math.fround(time + this.stepTravel(cell, time, step, next)));
    }
  }

  /** Minutes along one step, segment by segment; every crossed cell has to burn. */
  private stepTravel(cell: number, time: number, step: number, next: number): number {
    const { rate } = this.field;
    const { timed } = this.setup;
    let travel = 0;
    this.incoming = 0;
    for (const segment of PATHS[step]) {
      const at = cell + segment.offset;
      if (rate[at] === 0) return Infinity;
      const distance = STEP_LENGTH[step] * segment.share;
      const elapsed = this.segmentTravel(at, step, distance, time + travel);
      travel += elapsed;
      if (this.entrySpeed && at === next) this.incoming = elapsed > 0 ? distance / elapsed : 0;
      if (!Number.isFinite(travel)) return travel;
      if (timed && this.cornerClosed(cell, step, segment.end, time + travel)) return Infinity;
    }
    return travel;
  }

  /**
   * Minutes across one segment. Only a cell whose fuel was treated, or a run
   * whose wind changes, needs the time-dependent path; the rest of the grid
   * keeps the baseline ellipse, which is exactly what that path would read for it.
   */
  private segmentTravel(at: number, step: number, distance: number, start: number): number {
    const { treatedFuel, timed, treatments } = this.setup;
    if (this.windy || treatedFuel?.[at] === 1)
      return this.ellipses!.travel(at, distance, start, STEP_E[step], STEP_N[step]);
    const { rate, headE, headN, ecc } = this.field;
    const cosine = STEP_E[step] * headE[at] + STEP_N[step] * headN[at];
    const along = (rate[at] * (1 - ecc[at])) / (1 - ecc[at] * cosine);
    return timed?.[at] === 1
      ? treatedTravel(distance, along, start, treatments!.temporary.get(at))
      : distance / along;
  }

  /** A timed barrier closed at the grid corner the step passes through. */
  private cornerClosed(cell: number, step: number, end: number, now: number): boolean {
    const { timed, treatments } = this.setup;
    return CORNERS[step].some(
      ({ offset, fraction }) =>
        timed![cell + offset] === 1 &&
        Math.abs(fraction - end) < 1e-9 &&
        treatmentFactor(treatments!.temporary.get(cell + offset), now) === 0,
    );
  }

  private reach(cell: number, time: number, next: number, reached: number): void {
    const { mopped } = this.setup;
    // Fire that left a cell before its mop-up but would only get across
    // after it was put out on the way: the step half in the source cell is
    // done, the rest was waiting —for wet fuel to dry, say— and the crew got
    // there first. The barrier window alone would let it through.
    if (mopped && time <= mopped[cell] && reached > mopped[cell]) return;
    if (reached < this.arrival[next] && reached <= this.input.horizon) {
      this.arrival[next] = reached;
      if (this.entrySpeed && this.crews.has(next)) this.entrySpeed.set(next, this.incoming);
      this.heap.push(reached, next);
    }
  }
}

/** Each burned cell's ellipse as it was when the front got there. */
function ellipsesAtArrival(
  input: SpreadInput,
  setup: RunSetup,
  field: HeadField,
  ellipses: Ellipses,
  winds: readonly WindField[],
  arrival: Float32Array,
): void {
  for (let cell = 0; cell < arrival.length; cell++) {
    const time = arrival[cell];
    if (!Number.isFinite(time)) continue;
    ellipses.update(cell, epochAt(winds, time), time);
    field.rate[cell] = ellipses.rate[cell];
    field.headE[cell] = ellipses.east[cell];
    field.headN[cell] = ellipses.north[cell];
    field.intensity[cell] = firelineIntensity(
      setup.fuelTreatments?.at(cell, time)?.bed ?? plainBed(input, setup, cell),
      field.rate[cell],
    );
  }
}

function treatmentsAtArrival(
  treatments: CompiledMeasures,
  field: HeadField,
  arrival: Float32Array,
): void {
  for (const [cell, windows] of treatments.temporary) {
    const factor = treatmentFactor(windows, arrival[cell]);
    field.rate[cell] *= factor;
    field.intensity[cell] *= factor;
  }
}

/** What measure() reads per cell, besides the arrival. */
interface CellFigures {
  readonly rate: Float32Array;
  readonly headE: Float32Array;
  readonly headN: Float32Array;
  readonly intensity: Float32Array;
}

/** Per minute, what the cells reached in it add up to. */
interface MinuteTotals {
  readonly cells: Float64Array;
  readonly edges: Float64Array;
  readonly fastest: Float32Array;
  readonly hottest: Float32Array;
  readonly sumE: Float64Array;
  readonly sumN: Float64Array;
  reachedEdge: number;
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
  timedIgnitions: readonly { cell: number; minute: number }[] = [],
) {
  const minutes = Math.floor(horizon) + 1;
  const farthest = farthestByMinute(arrival, ignitions, horizon, timedIgnitions, minutes);
  const totals = totalsByMinute(arrival, { rate, headE, headN, intensity }, horizon, minutes);
  return { series: series(totals, farthest, minutes), reachedEdge: totals.reachedEdge };
}

/** Per minute, the farthest a cell reached in it is from its nearest ignition, in cells. */
function farthestByMinute(
  arrival: Float32Array,
  ignitions: readonly number[],
  horizon: number,
  timedIgnitions: readonly { cell: number; minute: number }[],
  minutes: number,
): Float32Array {
  const farthest = new Float32Array(minutes);
  // Each epoch uses only ignitions already deployed. Future backfires must not
  // change past run statistics. One distance field at a time bounds memory.
  const epochs = [...new Set([0, ...timedIgnitions.map((i) => i.minute)])].sort((a, b) => a - b);
  for (let epoch = 0; epoch < epochs.length; epoch++) {
    const from = epochs[epoch],
      until = epochs[epoch + 1] ?? Infinity;
    const active = [
      ...ignitions,
      ...timedIgnitions.filter((i) => i.minute <= from).map((i) => i.cell),
    ];
    farthestInEpoch(farthest, arrival, active, from, until, horizon);
  }
  return farthest;
}

/** The same for the cells reached within one epoch, from the ignitions active in it. */
function farthestInEpoch(
  farthest: Float32Array,
  arrival: Float32Array,
  active: readonly number[],
  from: number,
  until: number,
  horizon: number,
): void {
  const starts = active.map((cell) => [cell % GRID, Math.floor(cell / GRID)] as const);
  const distances = active.length > 32 ? ignitionDistances(active) : null;
  for (let i = 0; i < arrival.length; i++) {
    const t = arrival[i];
    if (t < from || t >= until || t > horizon) continue;
    let nearest = distances ? Math.sqrt(distances[i]) : Infinity;
    if (!distances)
      for (const [x, y] of starts)
        nearest = Math.min(nearest, Math.hypot((i % GRID) - x, Math.floor(i / GRID) - y));
    const minute = Math.ceil(t);
    farthest[minute] = Math.max(farthest[minute], nearest);
  }
}

function totalsByMinute(
  arrival: Float32Array,
  figures: CellFigures,
  horizon: number,
  minutes: number,
): MinuteTotals {
  const totals: MinuteTotals = {
    cells: new Float64Array(minutes),
    edges: new Float64Array(minutes + 1),
    fastest: new Float32Array(minutes),
    hottest: new Float32Array(minutes),
    sumE: new Float64Array(minutes),
    sumN: new Float64Array(minutes),
    reachedEdge: Infinity,
  };
  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      const index = row * GRID + column;
      const time = arrival[index];
      cellEdges(totals.edges, arrival, horizon, row, column);
      if (time > horizon) continue;
      reachedCell(totals, figures, index, Math.ceil(time));
      if (onBorder(row, column) && time < totals.reachedEdge) totals.reachedEdge = time;
    }
  }
  return totals;
}

/** The east and south sides of a cell, and its west and north ones on the border. */
function cellEdges(
  edges: Float64Array,
  arrival: Float32Array,
  horizon: number,
  row: number,
  column: number,
): void {
  const index = row * GRID + column;
  const time = arrival[index];
  edge(edges, horizon, time, column + 1 < GRID ? arrival[index + 1] : Infinity);
  edge(edges, horizon, time, row + 1 < GRID ? arrival[index + GRID] : Infinity);
  if (column === 0) edge(edges, horizon, time, Infinity);
  if (row === 0) edge(edges, horizon, time, Infinity);
}

/** An edge between two cells is fire line from the first arrival to the second. */
function edge(edges: Float64Array, horizon: number, a: number, b: number): void {
  if (a === b) return;
  const first = Math.min(a, b);
  const second = Math.max(a, b);
  if (first > horizon) return;
  edges[Math.ceil(first)] += 1;
  if (second <= horizon) edges[Math.ceil(second)] -= 1;
}

function reachedCell(totals: MinuteTotals, figures: CellFigures, index: number, minute: number) {
  totals.cells[minute] += 1;
  if (figures.rate[index] > totals.fastest[minute]) totals.fastest[minute] = figures.rate[index];
  if (figures.intensity[index] > totals.hottest[minute])
    totals.hottest[minute] = figures.intensity[index];
  totals.sumE[minute] += figures.headE[index];
  totals.sumN[minute] += figures.headN[index];
}

function onBorder(row: number, column: number): boolean {
  return row === 0 || column === 0 || row === GRID - 1 || column === GRID - 1;
}

/** The running sums of the totals, as the series the timeline reads. */
function series(totals: MinuteTotals, farthest: Float32Array, minutes: number) {
  const { cells, edges, sumE, sumN } = totals;
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
        ? Number.NaN
        : ((Math.atan2(sumE[minute], sumN[minute]) * 180) / Math.PI + 360) % 360;
  }
  return {
    area,
    perimeter,
    rate: totals.fastest,
    heading,
    intensity: totals.hottest,
    run,
  };
}
