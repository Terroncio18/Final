import { describe, expect, it, vi } from 'vitest';
vi.mock('./domain', () => ({ GRID: 16, CELL_M: 30 }));
import { spread } from './fire-spread';
import {
  FUEL_MODELS,
  firelineIntensity,
  flameLength,
  fuelBed,
  windFactor,
  type FuelBed,
} from './rothermel';

const fast = fuelBed(FUEL_MODELS[1], { dead1: 0.08, dead10: 0.08, dead100: 0.08, live: 1 });
const slow: FuelBed = { ...fast, r0: fast.r0 / 20 };
const fuelBeds = { 1: { bed: fast, midflame: 0 }, 8: { bed: slow, midflame: 0 } };
const elevation = new Float32Array(256).fill(100);
const run = (fuels: Uint8Array, ignitions = [8 * 16 + 2]) =>
  spread({
    elevation,
    fuels,
    fuelBeds,
    bed: fast,
    midflame: 0,
    towardsDeg: 0,
    ignitions,
    horizon: 10000,
  });

describe('heterogeneous fire spread', () => {
  it('uses each cell’s fuel and integrates slow strips crossed by long steps', async () => {
    const clear = new Uint8Array(256).fill(1);
    const striped = clear.slice();
    for (let y = 0; y < 16; y++) striped[y * 16 + 5] = 8;
    const a = await run(clear),
      b = await run(striped);
    const target = 8 * 16 + 10;
    expect(b.arrival[target]).toBeGreaterThan(a.arrival[target] * 2);
    expect(b.baseRate).toBeLessThan(a.baseRate);
  });
  it('cannot jump a one-cell non-burnable strip in any long direction', async () => {
    const fuels = new Uint8Array(256).fill(1);
    for (let y = 0; y < 16; y++) fuels[y * 16 + 5] = 0;
    const result = await run(fuels);
    expect(result.burnable).toBe(240);
    for (let y = 0; y < 16; y++)
      for (let x = 5; x < 16; x++) expect(result.arrival[y * 16 + x]).toBe(Infinity);
  });
  it('does not squeeze through diagonally touching barriers', async () => {
    const fuels = new Uint8Array(256).fill(1);
    for (let y = 0; y < 16; y++) fuels[y * 16 + y] = 0;
    const result = await run(fuels, [1]);
    expect(result.arrival[16]).toBe(Infinity);
  });
  it('rejects unknown land and ignition without fuel', async () => {
    const fuels = new Uint8Array(256).fill(1);
    fuels[10] = 255;
    await expect(run(fuels)).rejects.toThrow('combustible conegut');
    fuels[10] = 0;
    await expect(run(fuels, [10])).rejects.toThrow('ignició');
  });
  it('all thirteen Anderson models produce finite physical parameters', () => {
    expect(Object.keys(FUEL_MODELS)).toHaveLength(13);
    for (const model of Object.values(FUEL_MODELS)) {
      const bed = fuelBed(model, { dead1: 0.08, dead10: 0.08, dead100: 0.08, live: 1 });
      expect(bed.r0).toBeGreaterThan(0);
      expect(Number.isFinite(bed.r0)).toBe(true);
      expect(bed.loadTonHa).toBeGreaterThan(0);
    }
  });
  it('matches Anderson reference rates for the dead-only models within 10 percent', () => {
    for (const id of [1, 3, 6, 8, 9, 11, 12, 13]) {
      const model = FUEL_MODELS[id];
      const bed = fuelBed(model, { dead1: 0.08, dead10: 0.08, dead100: 0.08, live: 1 });
      const chainsPerHour = (bed.r0 * (1 + windFactor(bed, 5 * 88)) * 60) / 66;
      expect(
        Math.abs(chainsPerHour / model.reference - 1),
        `model ${id}: ${chainsPerHour}`,
      ).toBeLessThan(0.1);
    }
  });
  it('gives the flame lengths Anderson prints for the dead-only models, within a foot', () => {
    // Anderson (1982), same reference conditions as the rates above; feet.
    const printed: Record<number, number> = {
      1: 4,
      3: 12,
      6: 6,
      8: 1,
      9: 2.6,
      11: 3.5,
      12: 8,
      13: 10.5,
    };
    for (const [id, feet] of Object.entries(printed)) {
      const bed = fuelBed(FUEL_MODELS[Number(id)], {
        dead1: 0.08,
        dead10: 0.08,
        dead100: 0.08,
        live: 1,
      });
      const rate = (bed.r0 * (1 + windFactor(bed, 5 * 88))) / 3.28084;
      const length = flameLength(firelineIntensity(bed, rate)) * 3.28084;
      expect(Math.abs(length - feet), `model ${id}: ${length} ft`).toBeLessThan(1);
    }
  });
  it('reports the run from the ignition and a head intensity for the cells reached', async () => {
    const result = await run(new Uint8Array(256).fill(1));
    const { run: reach, intensity } = result.series;
    // From column 2 the far side of a 16-cell row is 13 cells away, at 30 m.
    expect(reach[reach.length - 1]).toBeGreaterThan(0.39);
    expect(Math.max(...intensity)).toBeGreaterThan(0);
    expect([...reach].every((value, i, all) => i === 0 || value >= all[i - 1])).toBe(true);
  });
});
