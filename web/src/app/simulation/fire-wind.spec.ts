import { describe, expect, it, vi } from 'vitest';
vi.mock('./domain', () => ({ GRID: 16, CELL_M: 30, domainAround: () => [0, 0, 16, 16] }));
import { spread, type SpreadInput } from './fire-spread';
import { fuelBed, FUEL_MODELS, midflameWind } from './rothermel';
import { parseWindChanges, spreadWinds, windAt } from './wind';
const bed = fuelBed(FUEL_MODELS[1], { dead1: 0.08, dead10: 0.08, dead100: 0.08, live: 1 });
const input: SpreadInput = {
  elevation: new Float32Array(256).fill(100),
  bed,
  midflame: 0,
  towardsDeg: 90,
  ignitions: [8 * 16 + 8],
  horizon: 720,
};
describe('wind changes during simulation', () => {
  it('preserves arrivals and every statistic before a change, including successive changes', async () => {
    const first = { startMin: 40, speedKmh: 30, fromDeg: 270 };
    const base = await spread(input);
    const changed = await spread({ ...input, windChanges: spreadWinds([first]) });
    const again = await spread({
      ...input,
      windChanges: spreadWinds([first, { startMin: 100, speedKmh: 5, fromDeg: 0 }]),
    });
    for (const [before, after, minute] of [
      [base, changed, 40],
      [changed, again, 100],
    ] as const) {
      for (let i = 0; i < 256; i++)
        if (before.arrival[i] < minute) expect(after.arrival[i]).toBe(before.arrival[i]);
      for (const key of Object.keys(before.series) as (keyof typeof before.series)[])
        expect(after.series[key].slice(0, minute), key).toEqual(
          before.series[key].slice(0, minute),
        );
    }
    expect(changed.arrival[8 * 16 + 15]).toBeLessThan(base.arrival[8 * 16 + 15]);
    expect(changed.arrival[8 * 16 + 15]).toBeLessThan(changed.arrival[8 * 16 + 1]);
  });
  it('is identical with an empty schedule or a change beyond the calculation horizon', async () => {
    const base = await spread({ ...input, horizon: 100 });
    for (const windChanges of [[], spreadWinds([{ startMin: 200, speedKmh: 60, fromDeg: 180 }])]) {
      const result = await spread({ ...input, horizon: 100, windChanges });
      expect(result.arrival).toEqual(base.arrival);
      expect(result.series).toEqual(base.series);
    }
  });
  it('integrates a crossing across a speed transition instead of using the departure wind throughout', async () => {
    const elevation = new Float32Array(256).fill(100),
      fuels = new Uint8Array(256);
    for (let x = 0; x < 16; x++) fuels[8 * 16 + x] = 1;
    const at = 8 * 16 + 12,
      seed = 8 * 16 + 2;
    const run = (speed: number, windChanges = input.windChanges) =>
      spread({
        ...input,
        elevation,
        fuels,
        ignitions: [seed],
        midflame: midflameWind(FUEL_MODELS[1], speed),
        fuelBeds: { 1: { bed, midflame: midflameWind(FUEL_MODELS[1], speed) } },
        windChanges,
        horizon: 2000,
      });
    const before = await run(5),
      after = await run(20);
    const startMin = before.arrival[at] / 2;
    const changed = await run(5, spreadWinds([{ startMin, speedKmh: 20, fromDeg: 270 }]));
    const expected =
      startMin + (300 - (300 / before.arrival[at]) * startMin) / (300 / after.arrival[at]);
    expect(changed.arrival[at]).toBeCloseTo(expected, 3);
  });
  it('combines time-dependent wind with a deployed firebreak', async () => {
    const result = await spread({
      ...input,
      ignitions: [8 * 16 + 2],
      windChanges: spreadWinds([{ startMin: 20, speedKmh: 40, fromDeg: 270 }]),
      countermeasures: {
        centre: [8, 8],
        measures: [
          {
            id: 'b',
            kind: 'firebreak',
            points: [
              [7.5, 0],
              [7.5, 16],
            ],
            widthM: 30,
            strength: 0,
            durationMin: 0,
            startMin: 1,
          },
        ],
      },
    });
    expect(result.arrival[8 * 16 + 12]).toBe(Infinity);
  });
  it('validates unique ordered wind events and selects the wind at a seek', () => {
    const events = [
      { startMin: 100, speedKmh: 25, fromDeg: 270 },
      { startMin: 200, speedKmh: 0, fromDeg: 0 },
    ];
    expect(parseWindChanges(events)).toEqual(events);
    expect(windAt(events, 99)).toBeUndefined();
    expect(windAt(events, 150)).toEqual(events[0]);
    expect(windAt(events, 200)).toEqual(events[1]);
    for (const bad of [
      [events[0], events[0]],
      [...events].reverse(),
      [{ ...events[0], speedKmh: NaN }],
      [{ ...events[0], startMin: 721 }],
      [{ ...events[0], fromDeg: 360 }],
    ])
      expect(typeof parseWindChanges(bad)).toBe('string');
  });
});
