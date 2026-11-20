import { describe, expect, it, vi } from 'vitest';
vi.mock('./domain', () => ({ GRID: 16, CELL_M: 30, domainAround: () => [0, 0, 16, 16] }));
import { spread } from './fire-spread';
import { fuelBed, FUEL_MODELS } from './rothermel';
import {
  compileCountermeasures,
  treatedTravel,
  treatmentFactor,
  type Countermeasure,
} from './countermeasures';
const bed = fuelBed(FUEL_MODELS[1], { dead1: 0.08, dead10: 0.08, dead100: 0.08, live: 1 });
const input: Parameters<typeof spread>[0] = {
  elevation: new Float32Array(256).fill(100),
  bed,
  midflame: 0,
  towardsDeg: 0,
  ignitions: [8 * 16 + 2],
  horizon: 1000,
};
const measure = (patch: Partial<Countermeasure> = {}): Countermeasure => ({
  id: 'live',
  kind: 'firebreak',
  points: [
    [7.5, 16],
    [7.5, 0],
  ],
  widthM: 30,
  strength: 0,
  durationMin: 0,
  startMin: 30,
  ...patch,
});
const run = (measures: readonly Countermeasure[]) =>
  spread({ ...input, countermeasures: { centre: [8, 8], measures } });

describe('interventions during a running simulation', () => {
  it('does not round a fractional backfire deployment into the past', async () => {
    const startMin = 120.000001;
    const result = await run([
      measure({ startMin: 0 }),
      measure({
        id: 'back',
        kind: 'backfire',
        points: [
          [12.5, 10],
          [12.5, 6],
        ],
        startMin,
      }),
    ]);
    expect(result.arrival[8 * 16 + 12]).toBeGreaterThanOrEqual(startMin);
    expect(result.series.area[120]).toBe(result.series.area[119]);
  });
  it('does not change any arrival or statistic before deployment, for every intervention kind', async () => {
    const baseline = await run([]);
    for (const kind of [
      'firebreak',
      'defense-line',
      'clearing',
      'water-line',
      'retardant',
      'helicopter',
      'amphibious',
      'backfire',
    ] as const) {
      const temporal = ['water-line', 'retardant', 'helicopter', 'amphibious'].includes(kind);
      const plan = measure({
        kind,
        strength: 0.8,
        durationMin: temporal ? 60 : 0,
        points: ['helicopter', 'amphibious'].includes(kind)
          ? [[7.5, 8.5]]
          : [
              [7.5, 16],
              [7.5, 0],
            ],
      });
      const changed = await run([plan]);
      for (let i = 0; i < 256; i++)
        if (baseline.arrival[i] < 30) expect(changed.arrival[i], kind).toBe(baseline.arrival[i]);
      for (const key of Object.keys(baseline.series) as (keyof typeof baseline.series)[])
        expect(changed.series[key].slice(0, 30), kind + key).toEqual(
          baseline.series[key].slice(0, 30),
        );
    }
  });
  it('stops a future crossing but never erases land burned before a late barrier', async () => {
    const baseline = await run([]),
      early = await run([measure()]);
    expect(baseline.arrival[8 * 16 + 12]).toBeLessThan(Infinity);
    expect(early.arrival[8 * 16 + 12]).toBe(Infinity);
    const time = baseline.arrival[8 * 16 + 10] + 1;
    const late = await run([measure({ startMin: time })]);
    for (let i = 0; i < 256; i++)
      if (baseline.arrival[i] < time) expect(late.arrival[i]).toBe(baseline.arrival[i]);
    expect(late.arrival[8 * 16 + 10]).toBeLessThan(time);
  });
  it('does not squeeze through timed diagonal barriers', async () => {
    const result = await run([
      measure({
        points: [
          [0, 16],
          [16, 0],
        ],
        startMin: 1,
      }),
    ]);
    expect(result.arrival[2 * 16 + 12]).toBe(Infinity);
  });
  it('starts and expires water relative to deployment and integrates crossings across both boundaries', () => {
    const field = compileCountermeasures(
      [8, 8],
      [
        measure({
          kind: 'helicopter',
          points: [[7.5, 8.5]],
          strength: 0.5,
          durationMin: 20,
          startMin: 100,
        }),
      ],
    );
    const windows = field.temporary.get(7 * 16 + 7);
    expect(treatmentFactor(windows, 99)).toBe(1);
    expect(treatmentFactor(windows, 100)).toBe(0.5);
    expect(treatmentFactor(windows, 119)).toBe(0.5);
    expect(treatmentFactor(windows, 120)).toBe(1);
    expect(treatedTravel(200, 10, 95, windows)).toBeCloseTo(30);
    let previous = -Infinity;
    for (let t = 90; t < 130; t += 0.25) {
      const arrival = t + treatedTravel(200, 10, t, windows);
      expect(arrival).toBeGreaterThanOrEqual(previous);
      previous = arrival;
    }
  });
  it('ignites backfire only at deployment even beyond an already active barrier', async () => {
    const result = await run([
      measure({ startMin: 0 }),
      measure({
        id: 'back',
        kind: 'backfire',
        points: [
          [12.5, 10],
          [12.5, 6],
        ],
        startMin: 120,
      }),
    ]);
    expect(result.arrival[8 * 16 + 12]).toBe(120);
    expect(result.series.area[120]).toBeGreaterThan(result.series.area[119]);
    expect(result.arrival[8 * 16 + 7]).toBe(Infinity);
  });
  it('keeps earlier interventions and history intact when a second one is added', async () => {
    const first = measure({ kind: 'water-line', strength: 0.8, durationMin: 40, startMin: 25 });
    const before = await run([first]);
    const after = await run([
      first,
      measure({
        id: 'second',
        kind: 'clearing',
        strength: 0.7,
        startMin: 110,
        points: [
          [11.5, 16],
          [11.5, 0],
        ],
      }),
    ]);
    for (let i = 0; i < 256; i++)
      if (before.arrival[i] < 110) expect(after.arrival[i]).toBe(before.arrival[i]);
    expect(after.series.area.slice(0, 110)).toEqual(before.series.area.slice(0, 110));
  });
});
