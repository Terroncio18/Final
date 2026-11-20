import type { Emitters } from '../map/fire-particles';
import { GRID, CELL_M } from './domain';
import { activeFront } from './fire-display';
import { byramIntensity, flameLength } from './rothermel';

// Below this flame length, render only ground glow: a creeping or waiting front has no visible
// flame at domain scale.
const FLAME_MIN_M = 0.3;
// Flame length in metres at maximum visual size.
const FLAME_MAX_M = 12;
// Minimum visual size as a fraction of maximum.
const FLAME_FLOOR = 0.25;

// Logarithmic visual strength in [0, 1], not a physical flame height.
export function flameStrength(lengthM: number): number {
  if (!(lengthM >= FLAME_MIN_M)) return 0;
  const share = Math.log(lengthM / FLAME_MIN_M) / Math.log(FLAME_MAX_M / FLAME_MIN_M);
  return FLAME_FLOOR + (1 - FLAME_FLOOR) * Math.min(1, share);
}

// Peak Byram intensity, kW/m, using actual front speed from arrival times and the destination
// cell’s heat.
export function frontIntensity(
  arrival: Float32Array,
  minute: number,
  cells: ReadonlySet<number>,
  heatAt: (cell: number, minute: number) => number,
): number {
  let hottest = 0;
  for (const s of activeFront(arrival, GRID, minute)) {
    const x = Math.min(GRID - 1, Math.floor((s.x0 + s.x1) / 2));
    const y = Math.min(GRID - 1, Math.floor((s.y0 + s.y1) / 2));
    if (!cells.has(s.ahead) && !cells.has(y * GRID + x)) continue;
    const heat = s.ahead >= 0 ? heatAt(s.ahead, minute) : 0;
    if (!(heat > 0)) continue;
    const speed = s.pace > 0 ? CELL_M / s.pace : Infinity;
    hottest = Math.max(hottest, byramIntensity(heat, speed));
  }
  return hottest;
}

// Space emitters along the continuous front. Use arrival-derived speed and treated fuel heat so
// waits and suppression affect visual intensity.
export function frontEmitters(
  arrival: Float32Array,
  elevation: Float32Array,
  minute: number,
  bounds: readonly [number, number, number, number],
  heatAt: (cell: number, minute: number) => number,
): Emitters {
  const segments = activeFront(arrival, GRID, minute)
    .map((segment) => {
      const speed = segment.pace > 0 ? CELL_M / segment.pace : Infinity;
      const heat = segment.ahead >= 0 ? heatAt(segment.ahead, minute) : 0;
      const strength = heat > 0 ? flameStrength(flameLength(byramIntensity(heat, speed))) : 0;
      return { ...segment, strength };
    })
    .filter((segment) => segment.strength > 0);
  const length = segments.reduce((sum, s) => sum + s.length, 0);
  const count = Math.min(4000, Math.ceil((length * CELL_M) / 8));
  const positions = new Float32Array(count * 3);
  const strength = new Float32Array(count);
  const weights = new Float32Array(count);
  const [west, south, east, north] = bounds;
  const unitsPerMetre = 1 / (40_075_016.686 * Math.cos((((south + north) / 2) * Math.PI) / 180));
  let segment = 0,
    passed = 0,
    total = 0;
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
    strength[i] = s.strength;
    // Choose particle birthplaces with probability weighted by flame strength.
    total += s.strength * s.strength;
    weights[i] = total;
  }
  return { positions, count, unitsPerMetre, strength, weights };
}
