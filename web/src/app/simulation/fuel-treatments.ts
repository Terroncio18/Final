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
export const WETTING = {
  retainedFraction: 0.3,
  dryingTimeMin: 60,
  stepMin: 5,
  maxMoisture: 3,
  /**
   * Added moisture below which the water is taken as dried off: 0.1 points of
   * fine fuel moisture, which moves Rothermel's rate by well under 1 %. From
   * then on the cell is its plain fuel again and costs the model nothing more
   * (§11.36); before this, a drop was followed in five-minute steps to the end
   * of the run.
   */
  driedMoisture: 0.001,
} as const;
type Drop = { minute: number; litresM2: number };
type Removal = { minute: number; remaining: number };
export interface TreatedFuel {
  readonly bed: FuelBed;
  readonly moisture1h: number;
  readonly remaining: number;
  readonly until: number;
}

/** Sparse dose histories. Fuel inputs and the land-cover grid remain immutable. */
export class FuelTreatments {
  private readonly histories = new Map<number, { drops: Drop[]; removals: Removal[] }>();
  /** Per cell, the state from each quantised minute: it depends on nothing else. */
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
    for (const measure of measures.filter(physicalMeasure)) {
      const schedule = crewSchedule(centre, measure);
      const footprint = schedule?.cells ?? countermeasureCells(centre, measure);
      for (let i = 0; i < footprint.length; i++) {
        const cell = footprint[i];
        const from = schedule?.minutes[i] ?? measure.startMin ?? 0;
        if (schedule && from > (crewStops.get(measure.id) ?? Infinity)) continue;
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
    for (const history of this.histories.values()) {
      history.drops.sort((a, b) => a.minute - b.minute);
      history.removals.sort((a, b) => a.minute - b.minute);
    }
  }

  public has(cell: number): boolean {
    return this.histories.has(cell);
  }

  /** Every cell with a treatment, whenever it comes. */
  public cells(): IterableIterator<number> {
    return this.histories.keys();
  }

  public at(cell: number, minute: number): TreatedFuel | undefined {
    const history = this.histories.get(cell),
      model = this.models[this.fuels?.[cell] ?? 1];
    if (!history || !model) return undefined;
    const first = Math.min(
      history.drops[0]?.minute ?? Infinity,
      history.removals[0]?.minute ?? Infinity,
    );
    if (minute < first) return undefined;
    const settled = this.dried.get(cell);
    if (settled && minute >= settled.from && minute < settled.state.until) return settled.state;
    const remainingAt = (time: number) =>
      Math.min(1, ...history.removals.filter((r) => r.minute <= time).map((r) => r.remaining));
    const remaining = remainingAt(minute);
    // Piecewise-constant moisture for exact FIFO integration of each interval.
    const tick = Math.floor(minute / WETTING.stepMin) * WETTING.stepMin;
    const lastEvent = Math.max(
      first,
      ...history.drops.filter((d) => d.minute <= minute).map((d) => d.minute),
      ...history.removals.filter((r) => r.minute <= minute).map((r) => r.minute),
    );
    const from = history.drops.length ? Math.max(tick, lastEvent) : lastEvent;
    let states = this.cache.get(cell);
    const saved = states?.get(from);
    if (saved && minute < saved.until) return saved;
    let until = Math.min(
      history.drops.find((d) => d.minute > minute)?.minute ?? Infinity,
      history.removals.find((r) => r.minute > minute)?.minute ?? Infinity,
      history.drops.some((d) => d.minute <= minute) ? tick + WETTING.stepMin : Infinity,
    );
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
          ? (drop.litresM2 * WETTING.retainedFraction) / (fineKgM2 * remainingAt(drop.minute))
          : 0;
      excess = Math.min(
        Math.max(0, WETTING.maxMoisture - this.moistures.dead1),
        excess + increment,
      );
      previous = drop.minute;
    }
    excess *= Math.exp(-(from - previous) / WETTING.dryingTimeMin);
    // Dried off, and no other drop to come: plain fuel until the next removal.
    const dry = excess < WETTING.driedMoisture && !history.drops.some((d) => d.minute > minute);
    if (dry) {
      excess = 0;
      until = history.removals.find((r) => r.minute > minute)?.minute ?? Infinity;
    }
    const moisture1h = this.moistures.dead1 + excess;
    const reduced: FuelModel = {
      ...model,
      particles: model.particles.map((p) => ({ ...p, load: p.load * remaining })),
    };
    const state = {
      bed: fuelBed(reduced, { ...this.moistures, dead1: moisture1h }),
      moisture1h,
      remaining,
      until,
    };
    if (dry) this.dried.set(cell, { from, state });
    else {
      if (!states) this.cache.set(cell, (states = new Map()));
      states.set(from, state);
    }
    return state;
  }

  public next(cell: number, minute: number): number {
    const h = this.histories.get(cell);
    if (!h) return Infinity;
    return Math.min(
      h.drops.find((d) => d.minute > minute)?.minute ?? Infinity,
      h.removals.find((r) => r.minute > minute)?.minute ?? Infinity,
    );
  }
}
