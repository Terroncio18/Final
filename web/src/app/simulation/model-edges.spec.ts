import { describe, it, expect } from 'vitest';
import { parsePoint, parsePoints, formatPoints } from './point';
import { domainAround, domainRing } from './domain';
import {
  moisturesFor,
  windFactor,
  effectiveWind,
  flameLength,
  FUEL_MODELS,
  fuelBed,
} from './rothermel';
import { decodeFuels } from './fuel-data';
import { parseWindChanges, spreadWinds, windAt } from './wind';
import { parseSpotting, emberFlight, emberRandom } from './spotting';
import { readScenario, formatScenario, type Scenario } from './scenario';

describe('model input boundaries', () => {
  it('rejects malformed coordinates without confusing zero with missing input', () => {
    for (const value of [
      undefined,
      '',
      '0,0',
      '@1',
      '@1,2,3',
      '@,1',
      '@1, ',
      '@NaN,0',
      '@0,Infinity',
      '@181,0',
      '@0,-91',
    ])
      expect(parsePoint(value)).toBeNull();
    expect(parsePoint('@0,0')).toEqual([0, 0]);
    expect(parsePoint('@-180,90')).toEqual([-180, 90]);
    expect(parsePoints(undefined)).toEqual([]);
    expect(parsePoints('1,2;bad;3,4')).toEqual([
      [1, 2],
      [3, 4],
    ]);
    expect(formatPoints([[1, 2]])).toBe('1.00000,2.00000');
    const [w, s, e, n] = domainAround([2, 39]);
    expect(domainRing([2, 39])).toEqual([
      [w, s],
      [e, s],
      [e, n],
      [w, n],
      [w, s],
    ]);
  });

  it('covers all humidity regimes, clamps out-of-range humidity and preserves supplied live moisture', () => {
    for (const humidity of [-10, 0, 5, 10, 49, 50, 100, 110]) {
      const m = moisturesFor(30, humidity);
      expect(m.dead1).toBeGreaterThanOrEqual(0.01);
      expect(m.dead10).toBeCloseTo(m.dead1 + 0.01);
      expect(m.dead100).toBeCloseTo(m.dead1 + 0.02);
      expect(m.live).toBe(1);
    }
    expect(moisturesFor(30, 110)).toEqual(moisturesFor(30, 100));
    expect(moisturesFor(30, -10)).toEqual(moisturesFor(30, 0));
    expect(moisturesFor(30, 50, 0.8).live).toBe(0.8);
    const bed = fuelBed(FUEL_MODELS[1], moisturesFor(30, 20));
    expect(windFactor(bed, 0)).toBe(0);
    expect(effectiveWind(bed, 0)).toBe(0);
    expect(effectiveWind(bed, windFactor(bed, 100))).toBeCloseTo(100);
    expect(flameLength(-1)).toBe(0);
  });

  it('validates every fuel metadata field and accumulates repeated model runs', () => {
    const bounds = [0, 0, 1, 1],
      valid = {
        version: 'anderson13-worldcover2021-v2',
        bounds,
        size: 2,
        runs: [1, 1, 1, 2, 2, 1, 1, 2, 2],
        sources: [
          {
            label: 'official',
            sourceUrl: 'https://example.test/data',
            sourceDate: '2024',
            attribution: 'provider',
          },
        ],
        warnings: ['estimated'],
      };
    const decoded = decodeFuels(valid, bounds, 2);
    expect(decoded.counts).toEqual([
      { id: 1, cells: 3 },
      { id: 2, cells: 1 },
    ]);
    expect(decoded.sources[0].label).toBe('official');
    for (const sources of [
      null,
      [null],
      [{}],
      [{ ...valid.sources[0], sourceUrl: 'http://example.test' }],
      [{ ...valid.sources[0], sourceDate: 2 }],
    ])
      expect(() => decodeFuels({ ...valid, sources }, bounds, 2)).toThrow();
    for (const warnings of [null, [2]])
      expect(() => decodeFuels({ ...valid, warnings }, bounds, 2)).toThrow();
    for (const raw of [
      null,
      {},
      { ...valid, bounds: [0, 0] },
      { ...valid, bounds: 'bad' },
      { ...valid, runs: null },
      { ...valid, runs: [1] },
      { ...valid, runs: [1.5, 1, 4] },
      { ...valid, runs: [-1, 1, 4] },
      { ...valid, runs: [14, 1, 4] },
      { ...valid, runs: [1, 1, 0] },
      { ...valid, runs: [1, 1, 1.5] },
    ])
      expect(() => decodeFuels(raw, bounds, 2)).toThrow();
  });

  it('rejects invalid wind and ember settings at the input boundary', () => {
    const valid = { startMin: 0, speedKmh: 10, fromDeg: 0 };
    for (const value of [
      null,
      Array(101).fill(valid),
      [null],
      ['bad'],
      [{ ...valid, startMin: NaN }],
      [{ ...valid, startMin: -1 }],
      [{ ...valid, startMin: 721 }],
      [{ ...valid, speedKmh: -1 }],
      [{ ...valid, speedKmh: 61 }],
      [{ ...valid, fromDeg: -1 }],
      [{ ...valid, fromDeg: 360 }],
    ])
      expect(typeof parseWindChanges(value)).toBe('string');
    expect(() => spreadWinds([{ ...valid, speedKmh: 61 }])).toThrow();
    expect(windAt([{ ...valid, startMin: 10 }], 0)).toBeUndefined();
    for (const value of [
      null,
      1,
      {},
      { enabled: true, seed: -1 },
      { enabled: true, seed: 4294967296 },
      { enabled: true, seed: 1.5 },
    ])
      expect(typeof parseSpotting(value)).toBe('string');
    expect(parseSpotting({ enabled: false, seed: 0 })).toEqual({ enabled: false, seed: 0 });
    const cell = 512 * 1024 + 512;
    let seed = 0;
    while (emberRandom(seed, cell, 0) >= 0.08) seed++;
    expect(
      emberFlight(cell, 0, 0, true, seed, () => ({ speedKmh: 10, towardsDeg: 0, until: Infinity })),
    ).toBeNull();
    expect(
      emberFlight(cell, 0, 100000, true, seed, () => ({ speedKmh: 10, towardsDeg: 0, until: 0 })),
    ).toBeNull();
    expect(
      emberFlight(cell, 0, 100000, false, seed, () => ({
        speedKmh: 100000,
        towardsDeg: 0,
        until: Infinity,
      })),
    ).toBeNull();
  });

  it('reports corrupt JSON and rejects invalid options when saving scenarios', () => {
    const scenario: Scenario = {
      name: 'test',
      region: 'ES53',
      province: 'ES532',
      municipality: 'ES_07061',
      centre: [2.7, 39.7],
      ignitions: [],
      wind: 20,
      windFrom: 0,
      humidity: 30,
      temperature: 30,
    };
    const text = formatScenario(scenario, new Date(0));
    expect(readScenario(text + '\nbrases = [')).toContain('JSON');
    expect(readScenario(text + '\ncanvis_vent = [')).toContain('JSON');
    expect(() =>
      formatScenario({ ...scenario, spotting: { enabled: true, seed: -1 } }, new Date(0)),
    ).toThrow();
    expect(() =>
      formatScenario(
        { ...scenario, windChanges: [{ startMin: -1, speedKmh: 0, fromDeg: 0 }] },
        new Date(0),
      ),
    ).toThrow();
  });
});
