import { describe, expect, it, vi } from 'vitest';
vi.mock('./domain', () => ({ GRID: 16, CELL_M: 30, domainAround: () => [0, 0, 16, 16] }));
import { spread, type SpreadInput } from './fire-spread';
import { fuelBed, FUEL_MODELS } from './rothermel';
import type { Countermeasure } from './countermeasures';
import { ignitionDistances } from './fire-distances';

const bed = fuelBed(FUEL_MODELS[1], { dead1: 0.08, dead10: 0.08, dead100: 0.08, live: 1 });
const input: SpreadInput = {
  elevation: new Float32Array(256).fill(100),
  fuels: new Uint8Array(256).fill(1),
  fuelBeds: { 1: { bed, midflame: 0 } },
  bed,
  midflame: 0,
  towardsDeg: 0,
  ignitions: [8 * 16 + 2],
  horizon: 1000,
};
const line = (patch: Partial<Countermeasure> = {}): Countermeasure => ({
  id: 'line',
  kind: 'firebreak',
  points: [
    [7.5, 16],
    [7.5, 0],
  ],
  widthM: 30,
  strength: 0,
  durationMin: 0,
  ...patch,
});
const run = (measures: readonly Countermeasure[]) =>
  spread({ ...input, countermeasures: { centre: [8, 8], measures } });

describe('countermeasures in the propagation solver', () => {
  it('computes exact nearest-ignition distances for dense backfires in linear grid work', () => {
    for (const seeds of [
      [],
      [0],
      [0, 255, 120],
      Array.from({ length: 64 }, (_, i) => (i * 37) % 256),
    ]) {
      const field = ignitionDistances(seeds);
      for (let i = 0; i < 256; i++) {
        const expected = Math.min(
          ...seeds.map(
            (s) => ((i % 16) - (s % 16)) ** 2 + (Math.floor(i / 16) - Math.floor(s / 16)) ** 2,
          ),
        );
        expect(field[i]).toBe(expected);
      }
    }
  });
  it('preserves the baseline exactly for an empty plan, including all statistics', async () => {
    expect(await run([])).toEqual(await spread(input));
  });
  it('does not jump a continuous barrier and does not mutate original fuels', async () => {
    const before = input.fuels!.slice();
    const result = await run([line()]);
    for (let row = 0; row < 16; row++)
      for (let col = 8; col < 16; col++) expect(result.arrival[row * 16 + col]).toBe(Infinity);
    expect(result.arrival[8 * 16 + 3]).toBeLessThan(Infinity);
    expect(input.fuels).toEqual(before);
  });
  it('does not cross a diagonal defense line', async () => {
    const result = await run([
      line({
        kind: 'defense-line',
        points: [
          [0, 16],
          [16, 0],
        ],
      }),
    ]);
    expect(result.arrival[2 * 16 + 12]).toBe(Infinity);
  });
  it('slows the front in clearing and is deterministic', async () => {
    const m = line({ kind: 'clearing', strength: 0.75 });
    const base = await run([]),
      changed = await run([m]);
    expect(changed.arrival[8 * 16 + 12]).toBeGreaterThan(base.arrival[8 * 16 + 12]);
    expect(changed).toEqual(await run([m]));
  });
  it('temporary treatment slows only while active; expired water cannot block a later front', async () => {
    const base = await run([]);
    const expired = await run([line({ kind: 'water-line', strength: 0.9, durationMin: 1 })]);
    expect(expired.arrival).toEqual(base.arrival);
    const wet = await run([line({ kind: 'water-line', strength: 0.9, durationMin: 500 })]);
    expect(wet.arrival[8 * 16 + 12]).toBeGreaterThan(base.arrival[8 * 16 + 12]);
    expect(wet.arrival[8 * 16 + 12]).toBeLessThan(Infinity);
  });
  it('counts backfire as actual burned area at T=0, on the far side of a barrier', async () => {
    const result = await run([
      line(),
      line({
        id: 'back',
        kind: 'backfire',
        points: [
          [12.5, 9.5],
          [12.5, 5.5],
        ],
      }),
    ]);
    expect(result.arrival[8 * 16 + 12]).toBe(0);
    expect(result.series.area[0]).toBeGreaterThan(0.09);
    expect(result.arrival[8 * 16 + 7]).toBe(Infinity);
  });
  it('rejects an original ignition covered by a barrier, instead of silently losing it', async () => {
    await expect(
      run([
        line({
          points: [
            [2.5, 16],
            [2.5, 0],
          ],
        }),
      ]),
    ).rejects.toThrow('ignició');
  });
  it('rejects malformed plans and out-of-domain vertices', async () => {
    await expect(run([line({ widthM: NaN })])).rejects.toThrow('amplada');
    await expect(
      run([
        line({
          points: [
            [7, 20],
            [7, 0],
          ],
        }),
      ]),
    ).rejects.toThrow('domini');
  });
});
