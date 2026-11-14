/** Presentation of computed arrival times. This module never changes propagation. */
export const FORECASTS = [30, 60, 90] as const;
export const FORECAST_COLOURS = ['#ff5733', '#ff9e32', '#f5cf50'] as const;
export const UNREACHED = 1_000_000;

/** Spend texture resolution on the reachable fire, rather than an empty 30 km square. */
export function fireExtent(arrival: Float32Array, size: number): [number, number, number, number] {
  let left = size,
    top = size,
    right = -1,
    bottom = -1;
  for (let i = 0; i < arrival.length; i++) {
    if (!Number.isFinite(arrival[i]) || arrival[i] < 0) continue;
    const x = i % size,
      y = Math.floor(i / size);
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
  }
  return right < 0
    ? [0, 0, 1, 1]
    : [
        Math.max(0, left - 3) / size,
        Math.max(0, top - 3) / size,
        Math.min(size, right + 4) / size,
        Math.min(size, bottom + 4) / size,
      ];
}

export function forecastOffsets(minute: number, horizon: number): number[] {
  return FORECASTS.filter((offset) => minute + offset <= horizon);
}

/** Arrival and local minutes/cell, interleaved for the GPU. Unknown stays unknown. */
export function arrivalTexture(arrival: Float32Array, size: number): Float32Array {
  if (arrival.length !== size * size) throw new Error('Invalid fire grid');
  const data = new Float32Array(arrival.length * 2);
  const valid = (t: number) => Number.isFinite(t) && t >= 0;
  for (let i = 0; i < arrival.length; i++) {
    const t = arrival[i];
    data[2 * i] = valid(t) ? t : UNREACHED;
    if (!valid(t)) continue;
    const x = i % size,
      y = Math.floor(i / size);
    const difference = (a: number, b: number) =>
      valid(a) && valid(b) ? (b - a) / 2 : valid(a) ? t - a : valid(b) ? b - t : 0;
    const dx = difference(
      x > 0 ? arrival[i - 1] : Infinity,
      x + 1 < size ? arrival[i + 1] : Infinity,
    );
    const dy = difference(
      y > 0 ? arrival[i - size] : Infinity,
      y + 1 < size ? arrival[i + size] : Infinity,
    );
    data[2 * i + 1] = Math.max(0.04, Math.min(25, Math.hypot(dx, dy)));
  }
  return data;
}

export interface FrontSegment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  length: number;
}

/** Marching triangles: continuous isochrone in grid coordinates, never an invented ellipse. */
export function activeFront(arrival: Float32Array, size: number, minute: number): FrontSegment[] {
  const segments: FrontSegment[] = [];
  const triangle = (points: readonly (readonly [number, number, number])[]) => {
    // A barrier/unreached cell has no interpolatable arrival time.
    if (points.some((p) => !Number.isFinite(p[2]) || p[2] < 0)) return;
    const cuts: [number, number][] = [];
    for (let i = 0; i < 3; i++) {
      const a = points[i],
        b = points[(i + 1) % 3];
      if (a[2] <= minute === b[2] <= minute) continue;
      const f = (minute - a[2]) / (b[2] - a[2]);
      cuts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
    if (cuts.length !== 2) return;
    const [a, b] = cuts;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (length > 1e-6) segments.push({ x0: a[0], y0: a[1], x1: b[0], y1: b[1], length });
  };
  for (let y = 0; y + 1 < size; y++)
    for (let x = 0; x + 1 < size; x++) {
      const i = y * size + x;
      const t0 = arrival[i],
        t1 = arrival[i + 1],
        t2 = arrival[i + size + 1],
        t3 = arrival[i + size];
      if (Math.min(t0, t1, t2, t3) > minute || Math.max(t0, t1, t2, t3) <= minute) continue;
      const times = [t0, t1, t2, t3];
      const a = [x + 0.5, y + 0.5, times[0]] as const,
        b = [x + 1.5, y + 0.5, times[1]] as const;
      const c = [x + 1.5, y + 1.5, times[2]] as const,
        d = [x + 0.5, y + 1.5, times[3]] as const;
      triangle([a, b, c]);
      triangle([a, c, d]);
    }
  return segments;
}
