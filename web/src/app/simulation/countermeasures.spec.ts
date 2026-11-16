import { describe, expect, it } from 'vitest';
import { domainAround, GRID } from './domain';
import {
  COUNTERMEASURE_CATALOG,
  compileCountermeasures,
  countermeasureCells,
  crewSchedule,
  crewHead,
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

const crew = (patch: Partial<Countermeasure> = {}): Countermeasure =>
  make({
    kind: 'defense-line',
    points: [point(502, 512), point(522, 512)],
    strength: 0,
    durationMin: 0,
    startMin: 10,
    arrivalMin: 20,
    crewSize: 50,
    ratePerPerson: 60,
    ...patch,
  });

describe('crew validation, schedule and head', () => {
  it('never rounds fractional activation into the past', () => {
    const m = crew({ startMin: 100.000001, arrivalMin: 0 });
    const schedule = crewSchedule(centre, m)!;
    expect(Math.min(...schedule.minutes)).toBeGreaterThanOrEqual(schedule.workStart);
    const field = compileCountermeasures(centre, [m]);
    for (let i = 0; i < schedule.cells.length; i++)
      expect(treatmentFactor(field.temporary.get(schedule.cells[i]), 100)).toBe(1);
  });
  it('requires all three fields, including explicitly undefined fields', () => {
    const { arrivalMin, crewSize, ratePerPerson, ...legacy } = crew();
    expect(parseCountermeasures([legacy])).toEqual([legacy]);
    for (const fields of [
      { arrivalMin },
      { crewSize },
      { ratePerPerson },
      { arrivalMin, crewSize },
      { arrivalMin, ratePerPerson },
      { crewSize, ratePerPerson },
      { arrivalMin: undefined },
    ])
      expect(parseCountermeasures([{ ...legacy, ...fields }])).toBeTypeOf('string');
    expect(parseCountermeasures([crew()])).toEqual([crew()]);
  });

  it('bounds finite arrival, integer headcount and production in the kind’s unit', () => {
    for (const patch of [
      { arrivalMin: -1 },
      { arrivalMin: 721 },
      { arrivalMin: NaN },
      { crewSize: 0 },
      { crewSize: 501 },
      { crewSize: 1.5 },
      { crewSize: Infinity },
      { ratePerPerson: 0.999 },
      { ratePerPerson: 2001 },
      { ratePerPerson: NaN },
    ])
      expect(parseCountermeasures([crew(patch)])).toBeTypeOf('string');
    for (const patch of [
      { arrivalMin: 0, crewSize: 1, ratePerPerson: 1 },
      { arrivalMin: 720, crewSize: 500, ratePerPerson: 2000 },
      { kind: 'mop-up' as const, ratePerPerson: 0.001 },
      { kind: 'mop-up' as const, ratePerPerson: 10 },
    ])
      expect(parseCountermeasures([crew(patch)])).not.toBeTypeOf('string');
    for (const ratePerPerson of [0, 0.0009, 10.01, Infinity])
      expect(parseCountermeasures([crew({ kind: 'mop-up', ratePerPerson })])).toBeTypeOf('string');
  });

  it('only accepts crews on ground crew kinds', () => {
    for (const kind of ['backfire', 'helicopter', 'amphibious', 'retardant'] as const)
      expect(parseCountermeasures([crew({ kind })])).toMatch(/no admet brigades/);
    for (const kind of ['defense-line', 'firebreak', 'clearing', 'water-line', 'mop-up'] as const)
      expect(
        parseCountermeasures([
          crew({ kind, ratePerPerson: 1, durationMin: kind === 'water-line' ? 10 : 0 }),
        ]),
      ).not.toBeTypeOf('string');
  });

  it('starts at the first vertex, progresses monotonically, and finishes at the last', () => {
    const m = crew(),
      schedule = crewSchedule(centre, m)!;
    expect(schedule.cells).toEqual(countermeasureCells(centre, m));
    expect(schedule.workStart).toBe(30);
    expect(schedule.lengthM).toBeCloseTo(600, 8);
    expect(schedule.workEnd).toBeCloseTo(42, 8);
    expect(Math.min(...schedule.minutes)).toBe(30);
    expect(Math.max(...schedule.minutes)).toBeCloseTo(schedule.workEnd, 5);
    const row = schedule.cells
      .map((c, i) => [c % GRID, schedule.minutes[i]])
      .filter((_, i) => Math.floor(schedule.cells[i] / GRID) === 512)
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < row.length; i++) expect(row[i][1]).toBeGreaterThanOrEqual(row[i - 1][1]);
    const doubled = crewSchedule(centre, crew({ crewSize: 100 }))!;
    expect(doubled.workEnd - doubled.workStart).toBeCloseTo(
      (schedule.workEnd - schedule.workStart) / 2,
      8,
    );
    for (let i = 0; i < schedule.cells.length; i++)
      expect(doubled.minutes[i] - 30).toBeCloseTo((schedule.minutes[i] - 30) / 2, 4);
    expect(crewSchedule(centre, make())).toBeUndefined();
  });

  it('follows bends and drawing order, retaining the first segment at a retraced tie', () => {
    const m = crew({ points: [point(500.5, 500.5), point(510.5, 500.5), point(510.5, 510.5)] });
    const schedule = crewSchedule(centre, m)!;
    const at = (cell: number) => schedule.minutes[schedule.cells.indexOf(cell)];
    expect(at(500 * GRID + 500)).toBeCloseTo(30);
    expect(at(500 * GRID + 510)).toBeCloseTo(36);
    expect(at(510 * GRID + 510)).toBeCloseTo(42);
    const reversed = crewSchedule(centre, { ...m, points: [...m.points].reverse() })!;
    expect(reversed.minutes[reversed.cells.indexOf(510 * GRID + 510)]).toBeCloseTo(30);
    const retraced = crewSchedule(
      centre,
      crew({ points: [point(500.5, 500.5), point(510.5, 500.5), point(500.5, 500.5)] }),
    )!;
    expect(retraced.minutes[retraced.cells.indexOf(500 * GRID + 505)]).toBeCloseTo(33);
  });

  it('converts mop-up hectares to metres using width, for both schedule and head', () => {
    const m = crew({ kind: 'mop-up', widthM: 100, crewSize: 20, ratePerPerson: 0.05 });
    const schedule = crewSchedule(centre, m)!;
    expect(schedule.workEnd - schedule.workStart).toBeCloseTo(360, 7);
    expect(crewHead(m, 210).builtM).toBeCloseTo(300, 7);
    const wider = crewSchedule(centre, { ...m, widthM: 200 })!;
    expect(wider.workEnd - wider.workStart).toBeCloseTo(720, 7);
  });

  it('places the head before work, halfway, at completion, and at a frozen stop', () => {
    const m = crew();
    expect(crewHead(m, 0)).toEqual({ point: m.points[0], builtM: 0, done: false });
    const halfway = crewHead(m, 36);
    expect(halfway.builtM).toBeCloseTo(300, 8);
    expect(halfway.point[0]).toBeCloseTo(centre[0], 8);
    expect(halfway.done).toBe(false);
    expect(crewHead(m, 100).point).toEqual(m.points[1]);
    expect(crewHead(m, 100).done).toBe(true);
    expect(crewHead(m, 100, 36)).toEqual(halfway);
    expect(crewHead(m, 0, 36).builtM).toBe(0);
    expect(crewHead(m, 100, 20).builtM).toBe(0);
    const bend = crew({ points: [point(502, 502), point(522, 502), point(522, 522)] });
    const head = crewHead(bend, 48);
    expect(head.builtM).toBeCloseTo(900);
    expect(head.point[0]).toBeCloseTo(bend.points[1][0], 8);
    expect(head.point[1]).toBeCloseTo(centre[1], 8);
  });
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
