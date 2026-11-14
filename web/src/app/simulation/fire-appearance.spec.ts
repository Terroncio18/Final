import { describe, expect, it } from 'vitest';
import { FireAppearance } from './fire-appearance';

describe('FireAppearance', () => {
  it('keeps the exact model footprint at every animation phase', () => {
    const arrival = new Float32Array([0, 2, 6, 10, Infinity, NaN, -Infinity, -1]);
    const original = arrival.slice();
    const painter = new FireAppearance(arrival);
    for (const minute of [-1, 0, 2, 5, 10, 80, 1]) {
      for (const seconds of [0, 0.4, 2, 80]) {
        const pixels = painter.paint(minute, seconds);
        for (let i = 0; i < arrival.length; i += 1) {
          const reached = Number.isFinite(arrival[i]) && arrival[i] >= 0 && arrival[i] <= minute;
          expect(pixels[i * 4 + 3] > 0).toBe(reached);
        }
      }
    }
    expect(arrival).toEqual(original);
  });

  it('animates warm cells with the timeline paused, without changing opacity', () => {
    const painter = new FireAppearance(new Float32Array([0, 1, 2, 3]));
    const first = painter.paint(4, 0).slice();
    const second = painter.paint(4, 0.37).slice();
    expect(second).not.toEqual(first);
    expect(second.filter((_, i) => i % 4 === 3)).toEqual(first.filter((_, i) => i % 4 === 3));
  });

  it('reproduces a frame after scrubbing forwards and backwards', () => {
    const painter = new FireAppearance(new Float32Array([0, 5, 20, Infinity]));
    const first = painter.paint(8, 1.5).slice();
    painter.paint(100, 20);
    expect(painter.activeCellCount).toBe(0);
    expect(painter.paint(8, 1.5)).toEqual(first);
    expect(painter.activeCellCount).toBe(2);
  });

  it('respects reduced motion and still responds to timeline changes', () => {
    const painter = new FireAppearance(new Float32Array([0, 5]));
    const first = painter.paint(3, 0, false).slice();
    expect(painter.paint(3, 123, false)).toEqual(first);
    expect(painter.paint(8, 123, false)).not.toEqual(first);
  });

  it('leaves old char still and reuses its output buffer', () => {
    const painter = new FireAppearance(new Float32Array([0, 1, Infinity]));
    const pixels = painter.paint(50, 0);
    const first = pixels.slice();
    expect(painter.paint(50, 2)).toBe(pixels);
    expect(pixels).toEqual(first);
    expect(painter.activeCellCount).toBe(0);
  });

  it('crosses the visual age boundaries without abrupt colour steps', () => {
    const painter = new FireAppearance(new Float32Array([0]));
    for (const boundary of [6, 30, 40]) {
      const before = painter.paint(boundary - 0.0001, 0).slice();
      const after = painter.paint(boundary + 0.0001, 0);
      for (let channel = 0; channel < 4; channel += 1) {
        expect(Math.abs(before[channel] - after[channel])).toBeLessThanOrEqual(1);
      }
    }
  });

  it('rejects invalid clocks without poisoning the previous frame', () => {
    const painter = new FireAppearance(new Float32Array([0]));
    const first = painter.paint(1, 0).slice();
    expect(() => painter.paint(NaN)).toThrow(RangeError);
    expect(() => painter.paint(1, Infinity)).toThrow(RangeError);
    expect(painter.pixels).toEqual(first);
  });
});
