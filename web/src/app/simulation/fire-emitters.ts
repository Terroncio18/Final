import type { Emitters } from '../map/fire-particles';
import { GRID, CELL_M } from './domain';
import { activeFront } from './fire-display';

/** Evenly spaced along the continuous front, not clustered at cell centres. */
export function frontEmitters(
  arrival: Float32Array,
  elevation: Float32Array,
  minute: number,
  bounds: readonly [number, number, number, number],
): Emitters {
  const segments = activeFront(arrival, GRID, minute);
  const length = segments.reduce((sum, s) => sum + s.length, 0);
  const count = Math.min(4000, Math.ceil((length * CELL_M) / 8));
  const positions = new Float32Array(count * 3);
  const [west, south, east, north] = bounds;
  const unitsPerMetre = 1 / (40_075_016.686 * Math.cos((((south + north) / 2) * Math.PI) / 180));
  let segment = 0,
    passed = 0;
  for (let i = 0; i < count; i++) {
    const distance = ((i + 0.5) * length) / count;
    while (segment + 1 < segments.length && passed + segments[segment].length < distance)
      passed += segments[segment++].length;
    const s = segments[segment],
      f = (distance - passed) / s.length;
    const x = s.x0 + (s.x1 - s.x0) * f,
      y = s.y0 + (s.y1 - s.y0) * f;
    const lon = west + (x / GRID) * (east - west),
      lat = north - (y / GRID) * (north - south);
    const sin = Math.sin((lat * Math.PI) / 180);
    positions[i * 3] = (lon + 180) / 360;
    positions[i * 3 + 1] = 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
    const cell = Math.min(GRID - 1, Math.floor(y)) * GRID + Math.min(GRID - 1, Math.floor(x));
    positions[i * 3 + 2] = Math.max(elevation[cell], 0) * unitsPerMetre;
  }
  return { positions, count, unitsPerMetre };
}
