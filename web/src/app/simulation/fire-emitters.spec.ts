import { describe, expect, it, vi } from 'vitest';
vi.mock('./domain', () => ({ GRID: 16, CELL_M: 30, domainAround: () => [0, 0, 1, 1] }));
import { activeFront } from './fire-display';
import { flameStrength, frontEmitters } from './fire-emitters';
import { fuelBed, FUEL_MODELS } from './rothermel';

const moistures = { dead1: 0.06, dead10: 0.07, dead100: 0.08, live: 1 };
const grass = fuelBed(FUEL_MODELS[1], moistures).heatPerArea;
const bounds = [0, 0, 1, 1] as const;
const elevation = new Float32Array(256);

/** A front crossing the grid west to east, `pace` minutes per cell. */
const front = (pace: number) => {
  const arrival = new Float32Array(256);
  for (let i = 0; i < 256; i++) arrival[i] = (i % 16) * pace;
  return arrival;
};

describe('flames drawn from the front the model computed', () => {
  it('reads how fast the front crosses a cell, and which cell it enters', () => {
    const segments = activeFront(front(10), 16, 25);
    expect(segments.length).toBeGreaterThan(0);
    for (const s of segments) {
      expect(s.pace).toBeCloseTo(10);
      expect([2, 3]).toContain(s.ahead % 16);
    }
  });

  it('draws no flame below the minimum length, and grows with it up to a ceiling', () => {
    // 0.3 m is the minimum flame length drawn (fire-emitters.ts).
    expect(flameStrength(0.3 * 0.9)).toBe(0);
    expect(flameStrength(NaN)).toBe(0);
    expect(flameStrength(0.3)).toBeGreaterThan(0);
    expect(flameStrength(1)).toBeLessThan(flameStrength(3));
    expect(flameStrength(12)).toBe(1);
    expect(flameStrength(40)).toBe(1);
  });

  it('gives a faster front bigger flames over the same fuel', () => {
    const slow = frontEmitters(front(10), elevation, 25, bounds, () => grass);
    const fast = frontEmitters(front(1), elevation, 2.5, bounds, () => grass);
    expect(slow.count).toBeGreaterThan(0);
    expect(Math.max(...fast.strength)).toBeGreaterThan(Math.max(...slow.strength));
  });

  it('leaves a stalled or wetted front without flames', () => {
    // Half a day to cross a cell of grass: the front is waiting, not burning.
    expect(frontEmitters(front(720), elevation, 1000, bounds, () => grass).count).toBe(0);
    // Fuel past its moisture of extinction gives off no heat.
    expect(frontEmitters(front(1), elevation, 2.5, bounds, () => 0).count).toBe(0);
  });

  it('puts more of the flames where the front is hotter', () => {
    const arrival = front(1);
    const hot = (cell: number) => (Math.floor(cell / 16) < 8 ? grass * 20 : grass);
    const e = frontEmitters(arrival, elevation, 2.5, bounds, hot);
    let north = 0,
      previous = 0;
    for (let i = 0; i < e.count; i++) {
      // Mercator y grows southwards: the north half is the hot one.
      if (e.positions[i * 3 + 1] < 0.5 - 0.0001) north += e.weights[i] - previous;
      previous = e.weights[i];
    }
    expect(north / e.weights[e.count - 1]).toBeGreaterThan(0.6);
  });
});
