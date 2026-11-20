import { CELL_M } from './domain';
import {
  countermeasureCells,
  crewSchedule,
  physicalMeasure,
  type Countermeasure,
} from './countermeasures';
import { fuelBed, FUEL_MODELS, type FuelBed, type FuelModel, type Moistures } from './rothermel';
import type { Point } from './point';

/** Explicit scenario assumptions, not calibrated aircraft suppression performance. */
const WETTING = {
  retainedFraction: 0.3,
  dryingTimeMin: 60,
  stepMin: 5,
  maxMoisture: 3,
  // Treat added moisture below 0.001 (0.1 percentage points) as dry: its spread-rate effect is
  // below 1%, allowing the plain-fuel fast path.
  driedMoisture: 0.001,
} as const;
type Drop = { minute: number; litresM2: number };
type Removal = { minute: number; remaining: number };
interface History {
  readonly drops: Drop[];
  readonly removals: Removal[];
}
interface TreatedFuel {
  readonly bed: FuelBed;
  readonly moisture1h: number;
  readonly remaining: number;
  readonly until: number;
}

function firstEvent(history: History): number {
  return Math.min(history.drops[0]?.minute ?? Infinity, history.removals[0]?.minute ?? Infinity);
}

function lastEventBy(history: History, first: number, minute: number): number {
  return Math.max(
    first,
    ...history.drops.filter((d) => d.minute <= minute).map((d) => d.minute),
    ...history.removals.filter((r) => r.minute <= minute).map((r) => r.minute),
  );
}

function remainingAt(history: History, time: number): number {
  return Math.min(1, ...history.removals.filter((r) => r.minute <= time).map((r) => r.remaining));
}

function nextRemoval(history: History, minute: number): number {
  return history.removals.find((r) => r.minute > minute)?.minute ?? Infinity;
}

function intervalEnd(history: History, minute: number): number {
  const tick = Math.floor(minute / WETTING.stepMin) * WETTING.stepMin;
  return Math.min(
    history.drops.find((d) => d.minute > minute)?.minute ?? Infinity,
    nextRemoval(history, minute),
    history.drops.some((d) => d.minute <= minute) ? tick + WETTING.stepMin : Infinity,
  );
}

/** Fine dead fuel moisture added by the drops up to `from`, each drying since it fell. */
function addedMoisture(history: History, model: FuelModel, from: number, dead1: number): number {
  // tons/acre -> kg/m². Only fine dead fuel is wetted; live tissue is unchanged.
  const fineKgM2 = model.particles
    .filter((p) => p.kind === 'dead1')
    .reduce((sum, p) => sum + p.load * 0.22417, 0);
  let excess = 0,
    previous = 0;
  for (const drop of history.drops) {
    if (drop.minute > from) break;
    excess *= Math.exp(-(drop.minute - previous) / WETTING.dryingTimeMin);
    const increment =
      fineKgM2 > 0
        ? (drop.litresM2 * WETTING.retainedFraction) /
          (fineKgM2 * remainingAt(history, drop.minute))
        : 0;
    excess = Math.min(Math.max(0, WETTING.maxMoisture - dead1), excess + increment);
    previous = drop.minute;
  }
  return excess * Math.exp(-(from - previous) / WETTING.dryingTimeMin);
}

/** Sparse dose histories. Fuel inputs and the land-cover grid remain immutable. */
export class FuelTreatments {
  private readonly histories = new Map<number, History>();

  private readonly cache = new Map<number, Map<number, TreatedFuel>>();
  /** Per cell, the plain-fuel state once its water has dried off, and since when. */
  private readonly dried = new Map<number, { from: number; state: TreatedFuel }>();
  public constructor(
    centre: Point,
    measures: readonly Countermeasure[],
    private readonly moistures: Moistures,
    private readonly fuels?: Uint8Array,
    private readonly models: Readonly<Record<number, FuelModel>> = FUEL_MODELS,
    crewStops: ReadonlyMap<string, number> = new Map(),
  ) {
    for (const measure of measures.filter(physicalMeasure))
      this.record(centre, measure, crewStops.get(measure.id) ?? Infinity);
    for (const history of this.histories.values()) {
      history.drops.sort((a, b) => a.minute - b.minute);
      history.removals.sort((a, b) => a.minute - b.minute);
    }
  }

  public has(cell: number): boolean {
    return this.histories.has(cell);
  }

  public cells(): IterableIterator<number> {
    return this.histories.keys();
  }

  // This is called for every treated-cell step; cache interval states and calculate only on a
  // miss.
  public at(cell: number, minute: number): TreatedFuel | undefined {
    const history = this.histories.get(cell),
      model = this.models[this.fuels?.[cell] ?? 1];
    if (!history || !model) return undefined;
    const first = firstEvent(history);
    if (minute < first) return undefined;
    const settled = this.dried.get(cell);
    if (settled && minute >= settled.from && minute < settled.state.until) return settled.state;
    // Piecewise-constant moisture for exact FIFO integration of each interval.
    const tick = Math.floor(minute / WETTING.stepMin) * WETTING.stepMin;
    const lastEvent = lastEventBy(history, first, minute);
    const from = history.drops.length ? Math.max(tick, lastEvent) : lastEvent;
    const saved = this.cache.get(cell)?.get(from);
    if (saved && minute < saved.until) return saved;
    return this.settle(cell, model, history, minute, from);
  }

  public next(cell: number, minute: number): number {
    const h = this.histories.get(cell);
    if (!h) return Infinity;
    return Math.min(
      h.drops.find((d) => d.minute > minute)?.minute ?? Infinity,
      h.removals.find((r) => r.minute > minute)?.minute ?? Infinity,
    );
  }

  private settle(
    cell: number,
    model: FuelModel,
    history: History,
    minute: number,
    from: number,
  ): TreatedFuel {
    const excess = addedMoisture(history, model, from, this.moistures.dead1);

    const dry = excess < WETTING.driedMoisture && !history.drops.some((d) => d.minute > minute);
    const remaining = remainingAt(history, minute);
    const moisture1h = this.moistures.dead1 + (dry ? 0 : excess);
    const reduced: FuelModel = {
      ...model,
      particles: model.particles.map((p) => ({ ...p, load: p.load * remaining })),
    };
    const state = {
      bed: fuelBed(reduced, { ...this.moistures, dead1: moisture1h }),
      moisture1h,
      remaining,
      until: dry ? nextRemoval(history, minute) : intervalEnd(history, minute),
    };
    if (dry) this.dried.set(cell, { from, state });
    else {
      let states = this.cache.get(cell);
      if (!states) this.cache.set(cell, (states = new Map()));
      states.set(from, state);
    }
    return state;
  }

  private record(centre: Point, measure: Countermeasure, stop: number): void {
    const schedule = crewSchedule(centre, measure);
    const footprint = schedule?.cells ?? countermeasureCells(centre, measure);
    for (let i = 0; i < footprint.length; i++) {
      const cell = footprint[i];
      const from = schedule?.minutes[i] ?? measure.startMin ?? 0;
      if (schedule && from > stop) continue;
      let history = this.histories.get(cell);
      if (!history) this.histories.set(cell, (history = { drops: [], removals: [] }));
      if (measure.fuelRemaining !== undefined)
        history.removals.push({
          minute: from,
          remaining: measure.fuelRemaining,
        });
      if (measure.litresPerPass !== undefined) {
        for (let pass = 0; pass < measure.passes!; pass++)
          history.drops.push({
            minute: from + pass * measure.passIntervalMin!,
            litresM2: measure.litresPerPass / (footprint.length * CELL_M * CELL_M),
          });
      }
    }
  }
}
