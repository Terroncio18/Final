import { describe, expect, it } from 'vitest';
import {
  activeFront,
  arrivalTexture,
  fireExtent,
  forecastOffsets,
  UNREACHED,
} from './fire-display';

describe('FireCast presentation over computed arrivals', () => {
  it('crops the texture without changing grid coordinates or clipping future arrivals', () => {
    const field = new Float32Array(32 * 32).fill(Infinity);
    field[10 * 32 + 8] = 0;
    field[15 * 32 + 20] = 720;
    expect(fireExtent(field, 32)).toEqual([5 / 32, 7 / 32, 24 / 32, 19 / 32]);
    field[0] = 10;
    expect(fireExtent(field, 32).slice(0, 2)).toEqual([0, 0]);
  });
  it('interpolates a front continuously between cells without changing input', () => {
    const arrival = Float32Array.from([0, 10, 20, 0, 10, 20, 0, 10, 20]);
    const original = arrival.slice();
    const a = activeFront(arrival, 3, 2),
      b = activeFront(arrival, 3, 7);
    expect(a.length).toBeGreaterThan(0);
    for (const s of a) {
      expect(s.x0).toBeCloseTo(0.7);
      expect(s.x1).toBeCloseTo(0.7);
    }
    for (const s of b) {
      expect(s.x0).toBeCloseTo(1.2);
      expect(s.x1).toBeCloseTo(1.2);
    }
    expect(a.reduce((sum, s) => sum + s.length, 0)).toBeCloseTo(2);
    expect(arrival).toEqual(original);
  });
  it('does not fabricate flame segments through unreachable cells', () => {
    const arrival = Float32Array.from([0, Infinity, 20, 0, Infinity, 20, 0, Infinity, 20]);
    expect(activeFront(arrival, 3, 10)).toEqual([]);
    expect(activeFront(arrival, 3, 30)).toEqual([]);
  });
  it('keeps disconnected fronts separate and reverses scrubbing reproducibly', () => {
    const arrival = Float32Array.from([0, 10, 20, 10, 0, 0, 10, 20, 10, 0]);
    // Grid is square in production; use a 5×5 stripe fixture here.
    const field = new Float32Array(25);
    for (let y = 0; y < 5; y++) field.set(arrival.subarray(0, 5), y * 5);
    const before = activeFront(field, 5, 5);
    expect(before.every((s) => Math.abs(s.x0 - 1) < 1e-5 || Math.abs(s.x0 - 4) < 1e-5)).toBe(true);
    activeFront(field, 5, 15);
    expect(activeFront(field, 5, 5)).toEqual(before);
  });
  it('packs unknown and invalid values without infinities for GPU sampling', () => {
    const packed = arrivalTexture(Float32Array.from([0, 10, Infinity, NaN]), 2);
    expect([...packed].every(Number.isFinite)).toBe(true);
    expect(packed[4]).toBe(UNREACHED);
    expect(packed[6]).toBe(UNREACHED);
    expect(packed[0]).toBe(0);
    expect(packed[1]).toBe(10);
  });
  it('never labels a truncated forecast as a full +1/+3/+6 h band', () => {
    expect(forecastOffsets(0, 720)).toEqual([60, 180, 360]);
    expect(forecastOffsets(360, 720)).toEqual([60, 180, 360]);
    expect(forecastOffsets(360.1, 720)).toEqual([60, 180]);
    expect(forecastOffsets(600, 720)).toEqual([60]);
    expect(forecastOffsets(720, 720)).toEqual([]);
    // Computed six hours past a twelve-hour timeline, every band exists at its end.
    expect(forecastOffsets(720, 1080)).toEqual([60, 180, 360]);
  });
});
