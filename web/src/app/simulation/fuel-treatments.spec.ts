import { describe, expect, it, vi } from 'vitest';
vi.mock('./domain', () => ({ GRID: 16, CELL_M: 30, domainAround: () => [0, 0, 16, 16] }));
import { FuelTreatments, WETTING } from './fuel-treatments';
import {
  countermeasureCells,
  parseCountermeasures,
  liquidCapacity,
  type Countermeasure,
} from './countermeasures';
import { fuelBed, FUEL_MODELS } from './rothermel';
import { spread } from './fire-spread';
const moistures = { dead1: 0.05, dead10: 0.06, dead100: 0.07, live: 1 };
const centre = [8, 8] as const,
  cell = 8 * 16 + 8;
const water = (patch: Partial<Countermeasure> = {}): Countermeasure => ({
  id: 'water',
  kind: 'helicopter',
  points: [[8.5, 7.5]],
  widthM: 30,
  strength: 0,
  durationMin: 0,
  startMin: 30,
  litresPerPass: 100,
  passes: 2,
  passIntervalMin: 15,
  ...patch,
});
describe('water and dry fuel treatment', () => {
  it('conserves dose over the raster footprint, wets only at each pass and dries afterwards', () => {
    const m = water(),
      field = new FuelTreatments(centre, [m], moistures);
    const footprint = countermeasureCells(centre, m),
      kgFine = 0.74 * 0.22417;
    const expected = ((100 / (footprint.length * 900)) * WETTING.retainedFraction) / kgFine;
    expect(field.at(cell, 29)).toBeUndefined();
    expect(field.at(cell, 30)!.moisture1h).toBeCloseTo(moistures.dead1 + expected, 10);
    expect(field.at(cell, 40)!.moisture1h).toBeLessThan(field.at(cell, 30)!.moisture1h);
    expect(field.at(cell, 45)!.moisture1h).toBeCloseTo(
      moistures.dead1 + expected * Math.exp(-15 / 60) + expected,
      10,
    );
    expect(field.at(cell, 60)!.moisture1h).toBeLessThan(field.at(cell, 45)!.moisture1h);
    expect(field.at(cell, 30)!.bed.loadTonHa).toBe(fuelBed(FUEL_MODELS[1], moistures).loadTonHa);
  });
  it('dilutes an equal volume over a larger diameter and caps excess water', () => {
    const small = new FuelTreatments(centre, [water()], moistures);
    const large = new FuelTreatments(centre, [water({ widthM: 180 })], moistures);
    expect(small.at(cell, 30)!.moisture1h).toBeGreaterThan(large.at(cell, 30)!.moisture1h);
    const saturated = new FuelTreatments(
      centre,
      [water({ litresPerPass: 1350, passes: 20, passIntervalMin: 1 })],
      moistures,
    );
    expect(saturated.at(cell, 50)!.moisture1h).toBeLessThanOrEqual(WETTING.maxMoisture);
  });
  it('removes dry fuel mass without setting fuel to zero or mutating the original model', () => {
    const original = JSON.stringify(FUEL_MODELS[1]);
    const m = water({
      kind: 'clearing',
      points: [
        [8.5, 7],
        [8.5, 8],
      ],
      litresPerPass: undefined,
      passes: undefined,
      passIntervalMin: undefined,
      fuelRemaining: 0.2,
    });
    const field = new FuelTreatments(centre, [m], moistures);
    expect(field.at(cell, 29)).toBeUndefined();
    const after = field.at(cell, 30)!;
    expect(after.bed.loadTonHa).toBeCloseTo(fuelBed(FUEL_MODELS[1], moistures).loadTonHa * 0.2, 10);
    expect(after.bed.r0).toBeGreaterThan(0);
    expect(after.moisture1h).toBe(moistures.dead1);
    expect(JSON.stringify(FUEL_MODELS[1])).toBe(original);
  });
  it('enforces aircraft capacity, whole pass counts, minute intervals and nonzero remaining fuel', () => {
    for (const kind of ['helicopter', 'amphibious', 'retardant'] as const) {
      const points =
        kind === 'retardant'
          ? ([
              [8, 7],
              [8, 8],
            ] as const)
          : ([[8.5, 7.5]] as const);
      expect(
        typeof parseCountermeasures([
          water({ kind, points, litresPerPass: liquidCapacity(kind) + 1 }),
        ]),
      ).toBe('string');
      expect(
        Array.isArray(
          parseCountermeasures([water({ kind, points, litresPerPass: liquidCapacity(kind) })]),
        ),
      ).toBe(true);
    }
    for (const patch of [
      { passes: 1.5 },
      { passes: 21 },
      { litresPerPass: 0 },
      { passIntervalMin: 0 },
      { passIntervalMin: NaN },
      { fuelRemaining: 0 },
    ])
      expect(typeof parseCountermeasures([water(patch)])).toBe('string');
  });
  it('recalculates propagation from moisture and preserves earlier arrivals with wind and water', async () => {
    const input = {
      elevation: new Float32Array(256).fill(100),
      bed: fuelBed(FUEL_MODELS[1], moistures),
      midflame: 0,
      towardsDeg: 90,
      ignitions: [8 * 16 + 2],
      horizon: 500,
      fuelMoistures: moistures,
    };
    const before = await spread(input);
    const after = await spread({
      ...input,
      countermeasures: { centre, measures: [water({ litresPerPass: 1350 })] },
    });
    for (let i = 0; i < 256; i++)
      if (before.arrival[i] < 30) expect(after.arrival[i]).toBe(before.arrival[i]);
    for (const key of Object.keys(before.series) as (keyof typeof before.series)[])
      expect(after.series[key].slice(0, 30)).toEqual(before.series[key].slice(0, 30));
    expect(after.arrival[cell]).toBeGreaterThan(before.arrival[cell]);
    expect(after.fuelTreatments!.at(cell, 30)!.moisture1h).toBeGreaterThan(moistures.dead1);
  });
});
