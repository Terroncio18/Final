import { GRID } from './domain';

/**
 * Exact squared Euclidean distance to the nearest ignition, in grid cells.
 * Linear in grid area, even for thousands of backfire seeds. First solve the
 * vertical distance, then take the lower envelope of horizontal parabolas.
 */
export function ignitionDistances(ignitions: readonly number[]): Float64Array {
  const field = new Float64Array(GRID * GRID).fill(Infinity);
  for (const cell of ignitions) field[cell] = 0;
  for (let x = 0; x < GRID; x++) {
    let last = -Infinity;
    for (let y = 0; y < GRID; y++) {
      const at = y * GRID + x;
      if (field[at] === 0) last = y;
      field[at] = (y - last) ** 2;
    }
    last = Infinity;
    for (let y = GRID - 1; y >= 0; y--) {
      const at = y * GRID + x;
      if (field[at] === 0) last = y;
      field[at] = Math.min(field[at], (last - y) ** 2);
    }
  }
  const sites = new Int32Array(GRID);
  const cuts = new Float64Array(GRID + 1);
  const source = new Float64Array(GRID);
  for (let y = 0; y < GRID; y++) {
    source.set(field.subarray(y * GRID, (y + 1) * GRID));
    let last = -1;
    for (let x = 0; x < GRID; x++) {
      if (!Number.isFinite(source[x])) continue;
      let cut = -Infinity;
      while (last >= 0) {
        const p = sites[last];
        cut = (source[x] + x * x - source[p] - p * p) / (2 * (x - p));
        if (cut > cuts[last]) break;
        last--;
      }
      last++;
      sites[last] = x;
      cuts[last] = last ? cut : -Infinity;
      cuts[last + 1] = Infinity;
    }
    if (last < 0) continue;
    let active = 0;
    for (let x = 0; x < GRID; x++) {
      while (cuts[active + 1] < x) active++;
      const p = sites[active];
      field[y * GRID + x] = (x - p) ** 2 + source[p];
    }
  }
  return field;
}
