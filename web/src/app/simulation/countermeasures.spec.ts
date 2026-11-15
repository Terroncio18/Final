import { describe, expect, it } from 'vitest';
import { domainAround, GRID } from './domain';
import {
  COUNTERMEASURE_CATALOG,
  compileCountermeasures,
  countermeasureCells,
  parseCountermeasures,
  treatedTravel,
  treatmentFactor,
  type Countermeasure,
} from './countermeasures';
import type { Point } from './point';

const centre: Point = [2.71, 39.76];
const [w, s, e, n] = domainAround(centre);
const point = (x: number, y: number): Point => [w + (x / GRID) * (e - w), n - (y / GRID) * (n - s)];
const make = (patch: Partial<Countermeasure> = {}): Countermeasure => ({
  id: 'm1',
  kind: 'helicopter',
  points: [point(512.5, 512.5)],
  widthM: 30,
  strength: 0.5,
  durationMin: 10,
  ...patch,
});

describe('countermeasure geometry and validation', () => {
  it('refuses a field it does not know, instead of dropping it', () => {
    expect(parseCountermeasures([make({ startMin: 5 })])).not.toBeTypeOf('string');
    expect(parseCountermeasures([{ ...make(), efficacy: 0.9 }])).toBe(
      'Camp de contramesura desconegut: «efficacy».',
    );
    expect(parseCountermeasures([[1, 2]])).toBe('Contramesura incorrecta.');
  });

  it('validates every catalogue preset and copies coordinates', () => {
    for (const d of COUNTERMEASURE_CATALOG) {
      const { kind, widthM, strength, durationMin } = d;
      const measure = make({
        kind,
        widthM,
        strength,
        durationMin,
        points: d.geometry === 'point' ? [centre] : [centre, point(514, 514)],
      });
      const parsed = parseCountermeasures([measure]);
      expect(parsed).toEqual([measure]);
      expect((parsed as Countermeasure[])[0].points).not.toBe(measure.points);
    }
  });
  it('rejects malformed, duplicated, unbounded and nonfinite data atomically', () => {
    for (const patch of [
      { widthM: 29 },
      { widthM: Infinity },
      { strength: -1 },
      { strength: 1 },
      { durationMin: 0 },
      { durationMin: 721 },
      { points: [[NaN, 4]] },
      { points: [] },
      { kind: 'invented' },
      { id: '../bad' },
    ])
      expect(typeof parseCountermeasures([{ ...make(), ...patch }])).toBe('string');
    expect(typeof parseCountermeasures([make(), make()])).toBe('string');
    expect(typeof parseCountermeasures([make({ kind: 'clearing', durationMin: 4 })])).toBe(
      'string',
    );
    expect(
      typeof parseCountermeasures([
        make({ kind: 'firebreak', durationMin: 0, points: [centre, centre] }),
      ]),
    ).toBe('string');
    expect(typeof parseCountermeasures(Array(101).fill(make()))).toBe('string');
  });
  it('rasterizes a disc locally and conservatively, without a square footprint', () => {
    const cells = new Set(countermeasureCells(centre, make({ widthM: 180 })));
    expect(cells.has(512 * GRID + 512)).toBe(true);
    expect(cells.has(515 * GRID + 512)).toBe(true);
    expect(cells.has(515 * GRID + 515)).toBe(false);
    expect(cells.size).toBeLessThan(60);
  });
  it('covers a diagonal continuously and is invariant to vertex order', () => {
    const m = make({
      kind: 'firebreak',
      durationMin: 0,
      points: [point(500.5, 500.5), point(520.5, 520.5)],
    });
    const cells = countermeasureCells(centre, m);
    for (let i = 500; i <= 520; i++) expect(cells).toContain(i * GRID + i);
    expect(new Set(countermeasureCells(centre, { ...m, points: [...m.points].reverse() }))).toEqual(
      new Set(cells),
    );
  });
  it('clips footprint at the boundary and rejects vertices outside it', () => {
    const cells = countermeasureCells(centre, make({ points: [[w, n]] }));
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c >= 0 && c < GRID * GRID)).toBe(true);
    expect(() => countermeasureCells(centre, make({ points: [[w - 0.01, n]] }))).toThrow('domini');
  });
  it('uses the strongest overlapping reduction, returning to the permanent factor after expiry', () => {
    const line: Partial<Countermeasure> = {
      kind: 'clearing',
      durationMin: 0,
      points: [point(510, 512), point(515, 512)],
      widthM: 60,
      strength: 0.5,
    };
    const field = compileCountermeasures(centre, [
      make(line),
      make({ id: 'water', strength: 0.8 }),
      make({ id: 'water2', strength: 0.6, durationMin: 20 }),
    ]);
    const cell = 512 * GRID + 512,
      windows = field.temporary.get(cell);
    expect(field.permanent[cell] * treatmentFactor(windows, 0)).toBeCloseTo(0.2);
    expect(field.permanent[cell] * treatmentFactor(windows, 10)).toBeCloseTo(0.4);
    expect(field.permanent[cell] * treatmentFactor(windows, 20)).toBeCloseTo(0.5);
  });
});

describe('time-dependent travel', () => {
  it('rejects malformed deployment times and retains valid legacy or timed plans', () => {
    for (const startMin of [-1, 721, NaN, Infinity, '30', null])
      expect(typeof parseCountermeasures([{ ...make(), startMin }])).toBe('string');
    expect(parseCountermeasures([make({ startMin: 120.5 })])).toEqual([make({ startMin: 120.5 })]);
    expect(parseCountermeasures([make()])).toEqual([make()]);
  });
  const windows = [
    { until: 5, factor: 0.5 },
    { until: 10, factor: 0.8 },
  ];
  it('integrates across each expiry rather than freezing speed at entry', () => {
    expect(treatedTravel(100, 10, 0, windows)).toBeCloseTo(13.5);
    expect(treatedTravel(10, 10, 0, windows)).toBe(2);
    expect(treatedTravel(100, 10, 10, windows)).toBe(10);
    expect(treatedTravel(100, 10, 0, undefined)).toBe(10);
  });
  it('never lets a later departure arrive earlier (FIFO)', () => {
    let previous = -Infinity;
    for (let t = 0; t <= 15; t += 0.1) {
      const arrival = t + treatedTravel(40, 10, t, windows);
      expect(arrival).toBeGreaterThanOrEqual(previous - 1e-10);
      previous = arrival;
    }
  });
});
