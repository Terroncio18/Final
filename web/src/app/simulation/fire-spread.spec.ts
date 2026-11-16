import { describe, expect, it, vi } from 'vitest';
vi.mock('./domain', () => ({ GRID: 16, CELL_M: 30, domainAround: () => [0, 0, 16, 16] }));
import { spread, type SpreadInput } from './fire-spread';
import { fuelBed, FUEL_MODELS, M_PER_FT, flameLength } from './rothermel';
import { frontIntensity } from './fire-emitters';
import {
  compileCountermeasures,
  crewSchedule,
  treatmentFactor,
  type Countermeasure,
} from './countermeasures';

const centre = [8, 8] as const;
const naturalBed = fuelBed(FUEL_MODELS[1], { dead1: 0.08, dead10: 0.08, dead100: 0.08, live: 1 });
const input: SpreadInput = {
  elevation: new Float32Array(256).fill(100),
  bed: { ...naturalBed, r0: 10 / M_PER_FT, heatPerArea: 1000 },
  midflame: 0,
  towardsDeg: 90,
  ignitions: [8 * 16 + 2],
  horizon: 100,
};
const line = (patch: Partial<Countermeasure> = {}): Countermeasure => ({
  id: 'crew',
  kind: 'defense-line',
  points: [
    [7.5, 15.5],
    [7.5, 0],
  ],
  widthM: 30,
  strength: 0,
  durationMin: 0,
  ...patch,
});
const crew = (patch: Partial<Countermeasure> = {}) =>
  line({ arrivalMin: 0, crewSize: 1, ratePerPerson: 60, ...patch });
const run = (
  measures: readonly Countermeasure[],
  patch: Partial<SpreadInput> = {},
  crewStops?: ReadonlyMap<string, number>,
) =>
  spread({
    ...input,
    ...patch,
    countermeasures: { centre, measures, ...(crewStops ? { crewStops } : {}) },
  });

describe('progressive crew interventions and causal safety stops', () => {
  it('activates barriers, mop-up, legacy clearing and water windows cell by cell', () => {
    for (const kind of ['defense-line', 'firebreak', 'mop-up', 'clearing', 'water-line'] as const) {
      const m = crew({
        kind,
        startMin: 5,
        arrivalMin: 10,
        ratePerPerson: kind === 'mop-up' ? 0.05 : 60,
        strength: kind === 'clearing' || kind === 'water-line' ? 0.7 : 0,
        durationMin: kind === 'water-line' ? 20 : 0,
      });
      const schedule = crewSchedule(centre, m)!;
      const field = compileCountermeasures(centre, [m]);
      for (let i = 0; i < schedule.cells.length; i++) {
        const cell = schedule.cells[i],
          activation = schedule.minutes[i];
        expect(field.blocked[cell]).toBe(0);
        expect(treatmentFactor(field.temporary.get(cell), activation - 0.001)).toBe(1);
        expect(treatmentFactor(field.temporary.get(cell), activation)).toBeCloseTo(
          m.strength ? 0.3 : 0,
        );
        expect(treatmentFactor(field.temporary.get(cell), activation + 20)).toBeCloseTo(
          kind === 'water-line' ? 1 : m.strength ? 0.3 : 0,
        );
        if (kind === 'mop-up') expect(field.mopUp.get(cell)).toBe(activation);
      }
    }
  });
  it('contains a crossing with an instantaneous or fast line, but not an unfinished slow line', async () => {
    const instant = await run([line()]);
    const slow = await run([crew()]);
    const fast = await run([crew({ crewSize: 100, ratePerPerson: 2000 })]);
    const beyond = 8 * 16 + 12;
    expect(instant.arrival[beyond]).toBe(Infinity);
    expect(slow.arrival[beyond]).toBeLessThan(Infinity);
    expect(fast.arrival[beyond]).toBe(Infinity);
    expect(fast.crewStops?.size).toBe(0);
  });

  it('stops a crew at an intense arriving front and never activates its unfinished cells', async () => {
    const m = crew(),
      result = await run([m]);
    const stop = result.crewStops!.get(m.id)!;
    expect(stop).toBeGreaterThan(0);
    expect(stop).toBeLessThan(100);
    const schedule = crewSchedule(centre, m)!;
    const field = compileCountermeasures(centre, [m], result.crewStops);
    let built = 0,
      unfinished = 0;
    for (let i = 0; i < schedule.cells.length; i++) {
      const cell = schedule.cells[i];
      const factor = field.blocked[cell] ? 0 : treatmentFactor(field.temporary.get(cell), 1e6);
      if (schedule.minutes[i] > stop) {
        unfinished++;
        expect(factor).toBe(1);
      } else {
        built++;
        expect(factor).toBe(0);
      }
    }
    expect(built).toBeGreaterThan(0);
    expect(unfinished).toBeGreaterThan(0);
  });

  it('uses the existing front reader on the reached side at entry, not the theoretical head rate', async () => {
    const m = crew();
    const schedule = crewSchedule(centre, m)!;
    const provisional = await run([m], {}, new Map([[m.id, schedule.workEnd]]));
    let expected = Infinity;
    for (let i = 0; i < schedule.cells.length; i++) {
      const cell = schedule.cells[i],
        time = provisional.arrival[cell];
      if (time >= schedule.minutes[i] || !Number.isFinite(time)) continue;
      const x = cell % 16,
        y = Math.floor(cell / 16);
      let previous = -Infinity;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (x + dx < 0 || x + dx >= 16 || y + dy < 0 || y + dy >= 16) continue;
          const t = provisional.arrival[cell + dy * 16 + dx];
          if (t < time) previous = Math.max(previous, t);
        }
      if (!Number.isFinite(previous)) continue;
      const reached = provisional.arrival.map((t) => (t <= time ? t : Infinity));
      const intensity = frontIntensity(reached, (previous + time) / 2, new Set([cell]), (target) =>
        target === cell ? provisional.heat[cell] : 0,
      );
      if (flameLength(intensity) > 1.2) expected = Math.min(expected, time);
    }
    expect(expected).toBeLessThan(Infinity);
    expect((await run([m])).crewStops!.get(m.id)).toBe(expected);
  });

  it('does not turn a theoretical intense head into a stop when a legacy window slows the front', async () => {
    const m = crew({ ratePerPerson: 1 });
    const wet = line({
      id: 'wet',
      kind: 'water-line',
      widthM: 3000,
      strength: 0.95,
      durationMin: 720,
    });
    const result = await run([m, wet], { horizon: 720 });
    expect(result.arrival[8 * 16 + 7]).toBeLessThan(Infinity);
    expect(result.crewStops?.size).toBe(0);
  });

  it('reads treated heat at entry instead of the original fuel heat', async () => {
    const m = crew({ ratePerPerson: 1 });
    const clearing = line({ id: 'cleared', kind: 'clearing', widthM: 3000, fuelRemaining: 0.05 });
    const result = await run([m, clearing], {
      horizon: 10000,
      fuelMoistures: { dead1: 0.08, dead10: 0.08, dead100: 0.08, live: 1 },
    });
    const cell = 8 * 16 + 7;
    expect(result.arrival[cell]).toBeLessThan(Infinity);
    expect(result.fuelTreatments!.at(cell, result.arrival[cell])!.bed.heatPerArea).toBeLessThan(
      result.heat[cell],
    );
    expect(result.crewStops?.size).toBe(0);
  });

  it('still detects an intense front in a one-cell corridor without a finite display triangle', async () => {
    const elevation = new Float32Array(256);
    elevation.fill(100, 8 * 16, 9 * 16);
    const result = await run([crew()], { elevation });
    expect(result.crewStops!.get('crew')).toBeGreaterThan(0);
    expect(result.crewStops!.get('crew')).toBeLessThan(20);
    expect(result.arrival[8 * 16 + 12]).toBeLessThan(Infinity);
  });

  it('does not stop at a weak front and eventually activates even burned cells', async () => {
    const m = crew();
    const result = await run([m], { bed: { ...input.bed, heatPerArea: 1 } });
    expect(result.crewStops?.size).toBe(0);
    const schedule = crewSchedule(centre, m)!;
    const cell = 8 * 16 + 7;
    const activation = schedule.minutes[schedule.cells.indexOf(cell)];
    expect(result.arrival[cell]).toBeLessThan(activation);
    const field = compileCountermeasures(centre, [m], result.crewStops);
    expect(treatmentFactor(field.temporary.get(cell), activation)).toBe(0);
  });

  it('does not stop a crew before its arrival or after it finishes', async () => {
    const late = await run([crew({ arrivalMin: 100 })]);
    expect(late.crewStops?.size).toBe(0);
    const finished = await run([crew({ crewSize: 500, ratePerPerson: 2000 })]);
    expect(finished.crewStops?.size).toBe(0);
  });

  it('replays known stops bit for bit and preserves every arrival before the first stop', async () => {
    const m = crew();
    const result = await run([m]);
    const replay = await run([m], {}, result.crewStops);
    const stop = result.crewStops!.get(m.id)!;
    expect(replay.arrival).toEqual(result.arrival);
    expect(replay.series).toEqual(result.series);
    // A stop after workEnd represents the provisional run with all future work.
    const provisional = await run([m], {}, new Map([[m.id, crewSchedule(centre, m)!.workEnd]]));
    for (let cell = 0; cell < 256; cell++)
      if (provisional.arrival[cell] <= stop || result.arrival[cell] <= stop)
        expect(result.arrival[cell]).toBe(provisional.arrival[cell]);
    for (const key of Object.keys(result.series) as (keyof typeof result.series)[])
      expect(result.series[key].slice(0, Math.floor(stop) + 1)).toEqual(
        provisional.series[key].slice(0, Math.floor(stop) + 1),
      );
  });

  it('finds successive stops in time order, independently of plan order', async () => {
    const a = crew(),
      b = crew({
        id: 'second',
        points: [
          [11.5, 15.5],
          [11.5, 0],
        ],
      });
    const result = await run([a, b]);
    const reversed = await run([b, a]);
    expect(result.crewStops?.size).toBe(2);
    expect(result.crewStops!.get(a.id)).toBeLessThan(result.crewStops!.get(b.id)!);
    expect(reversed.crewStops).toEqual(result.crewStops);
    expect(reversed.arrival).toEqual(result.arrival);
    const replay = await run([a, b], {}, result.crewStops);
    expect(replay.arrival).toEqual(result.arrival);
    for (const m of [a, b]) {
      const frozen = new Map(result.crewStops);
      frozen.set(m.id, crewSchedule(centre, m)!.workEnd);
      const provisional = await run([a, b], {}, frozen);
      const stop = result.crewStops!.get(m.id)!;
      for (let cell = 0; cell < 256; cell++)
        if (result.arrival[cell] < stop || provisional.arrival[cell] < stop)
          expect(result.arrival[cell]).toBe(provisional.arrival[cell]);
    }
  });

  it('leaves legacy arrivals, statistics and optional result fields identical with no crew', async () => {
    const legacy = line({ startMin: 5 });
    const absent = await run([legacy]);
    const explicit = await run([legacy], {}, new Map());
    expect(explicit).toEqual(absent);
    expect(absent.crewStops).toBeUndefined();
    const withoutPlan = await spread(input);
    const emptyPlan = await run([]);
    expect(emptyPlan).toEqual(withoutPlan);
  });
});
