import { describe, expect, it, vi } from 'vitest';
vi.mock('./domain', () => ({ GRID: 32, CELL_M: 30, domainAround: () => [0, 0, 32, 32] }));
import {
  compileCountermeasures,
  countermeasureCells,
  type Countermeasure,
} from './countermeasures';
import { frontIntensity } from './fire-emitters';
import { spread } from './fire-spread';
import { fuelBed, FUEL_MODELS } from './rothermel';

const moistures = { dead1: 0.06, dead10: 0.07, dead100: 0.08, live: 1 };
const centre = [16, 16] as const;
const ignition = 16 * 32 + 16;
const input = {
  elevation: new Float32Array(32 * 32).fill(100),
  bed: fuelBed(FUEL_MODELS[1], moistures),
  midflame: 0,
  towardsDeg: 90,
  ignitions: [ignition],
  horizon: 600,
};

const strip = (kind: 'mop-up' | 'firebreak', minute: number): Countermeasure => ({
  id: kind,
  kind,
  points: [
    [16.5, 15.5],
    [16.6, 15.5],
  ],
  widthM: 60,
  strength: 0,
  durationMin: 0,
  startMin: minute,
});

describe('mop-up', () => {
  it('compiles into a late barrier and a minute the fire goes out', () => {
    const field = compileCountermeasures(centre, [strip('mop-up', 40)]);
    const cells = countermeasureCells(centre, strip('mop-up', 40));
    expect([...field.mopUp.keys()].sort()).toEqual([...cells].sort());
    expect(field.mopUp.get(ignition)).toBe(40);
    expect(field.temporary.get(ignition)?.at(-1)).toEqual({ until: Infinity, factor: 0 });
  });

  it('puts out the fire that a late barrier on the same cells would let through', async () => {
    const before = await spread(input);
    const cells = new Set(countermeasureCells(centre, strip('mop-up', 0)));
    const inside = Math.max(...[...cells].map((c) => before.arrival[c]));
    let outside = Infinity;
    for (let c = 0; c < before.arrival.length; c++)
      if (!cells.has(c)) outside = Math.min(outside, before.arrival[c]);

    expect(inside).toBeLessThan(outside);
    const minute = (inside + outside) / 2;

    const firebreak = await spread({
      ...input,
      countermeasures: { centre, measures: [strip('firebreak', minute)] },
    });
    const mopUp = await spread({
      ...input,
      countermeasures: { centre, measures: [strip('mop-up', minute)] },
    });
    const escaped = (arrival: Float32Array) =>
      [...arrival.keys()].filter((c) => !cells.has(c) && Number.isFinite(arrival[c])).length;
    /* Extinguishing must also block a step already in transit across the source cell. */

    expect(escaped(firebreak.arrival)).toBeGreaterThan(0);
    expect(escaped(mopUp.arrival)).toBe(0);

    for (const c of cells) expect(mopUp.arrival[c]).toBe(before.arrival[c]);
  });

  it('reads how hot the front is where it crosses some cells', () => {
    const heat = input.bed.heatPerArea;

    const front = (pace: number) => {
      const arrival = new Float32Array(32 * 32);
      for (let i = 0; i < arrival.length; i++) arrival[i] = (i % 32) * pace;
      return arrival;
    };
    const here = new Set([10 * 32 + 3]);
    const fast = frontIntensity(front(0.5), 1.25, here, () => heat);
    const slow = frontIntensity(front(60), 150, here, () => heat);
    expect(fast).toBeGreaterThan(slow);
    expect(slow).toBeGreaterThan(0);

    expect(frontIntensity(front(0.5), 1.25, new Set([10 * 32 + 20]), () => heat)).toBe(0);
    expect(frontIntensity(front(0.5), 1.25, here, () => 0)).toBe(0);
  });
});
