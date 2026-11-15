import { CELL_M } from './domain';
import { countermeasureCells, physicalMeasure, type Countermeasure } from './countermeasures';
import { fuelBed, FUEL_MODELS, type FuelBed, type FuelModel, type Moistures } from './rothermel';
import type { Point } from './point';

/** Explicit scenario assumptions, not calibrated aircraft suppression performance. */
export const WETTING = {
  retainedFraction: 0.3,
  dryingTimeMin: 60,
  stepMin: 5,
  maxMoisture: 3,
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
  private readonly cells = new Map<number, { drops: Drop[]; removals: Removal[] }>();
  private readonly cache = new Map<number, { from: number; state: TreatedFuel }>();
  constructor(
    centre: Point,
    measures: readonly Countermeasure[],
    private readonly moistures: Moistures,
    private readonly fuels?: Uint8Array,
    private readonly models: Readonly<Record<number, FuelModel>> = FUEL_MODELS,
  ) {
    for (const measure of measures.filter(physicalMeasure)) {
      const footprint = countermeasureCells(centre, measure);
      for (const cell of footprint) {
        let history = this.cells.get(cell);
        if (!history) this.cells.set(cell, (history = { drops: [], removals: [] }));
        if (measure.fuelRemaining !== undefined)
          history.removals.push({
            minute: measure.startMin ?? 0,
            remaining: measure.fuelRemaining,
          });
        if (measure.litresPerPass !== undefined) {
          for (let pass = 0; pass < measure.passes!; pass++)
            history.drops.push({
              minute: (measure.startMin ?? 0) + pass * measure.passIntervalMin!,
              litresM2: measure.litresPerPass / (footprint.length * CELL_M * CELL_M),
            });
        }
      }
    }
    for (const history of this.cells.values()) {
      history.drops.sort((a, b) => a.minute - b.minute);
      history.removals.sort((a, b) => a.minute - b.minute);
    }
  }

  has(cell: number): boolean {
    return this.cells.has(cell);
  }

  at(cell: number, minute: number): TreatedFuel | undefined {
    const history = this.cells.get(cell),
      model = this.models[this.fuels?.[cell] ?? 1];
    if (!history || !model) return undefined;
    const first = Math.min(
      history.drops[0]?.minute ?? Infinity,
      history.removals[0]?.minute ?? Infinity,
    );
    if (minute < first) return undefined;
    const saved = this.cache.get(cell);
    if (saved && minute >= saved.from && minute < saved.state.until) return saved.state;
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
    const until = Math.min(
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
    this.cache.set(cell, { from, state });
    return state;
  }

  next(cell: number, minute: number): number {
    const h = this.cells.get(cell);
    if (!h) return Infinity;
    return Math.min(
      h.drops.find((d) => d.minute > minute)?.minute ?? Infinity,
      h.removals.find((r) => r.minute > minute)?.minute ?? Infinity,
    );
  }
}
