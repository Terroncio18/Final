import type { Emitters } from '../map/fire-particles';
import { GRID, CELL_M } from './domain';
import { activeFront } from './fire-display';
import { byramIntensity, flameLength } from './rothermel';

/**
 * Flames below this length are not drawn: the front is creeping or waiting
 * —for wet fuel to dry, at a line it cannot cross— and what is left is the
 * ember glow on the ground, not a flame.
 */
export const FLAME_MIN_M = 0.3;
/** At and above this length a flame is drawn at its largest. */
const FLAME_MAX_M = 12;
/** The smallest flame drawn is this fraction of the largest. */
const FLAME_FLOOR = 0.25;

/**
 * How big a front's flames are drawn, from 0 (none) to 1, for a flame length
 * in metres. Logarithmic, so that a creeping fire under trees and a grass head
 * fire both read, and bounded, because the drawing is seen from thirty
 * kilometres away and is a picture of the flame length, not the flame (§11.35).
 */
export function flameStrength(lengthM: number): number {
  if (!(lengthM >= FLAME_MIN_M)) return 0;
  const share = Math.log(lengthM / FLAME_MIN_M) / Math.log(FLAME_MAX_M / FLAME_MIN_M);
  return FLAME_FLOOR + (1 - FLAME_FLOOR) * Math.min(1, share);
}

/**
 * The hottest the front is, at a minute, where it crosses some cells: Byram's
 * intensity in kW/m, read as the flames are (§11.35), from the speed the front
 * really crosses each cell at and the heat of the cell it enters. Zero where
 * the front does not pass, or has stopped.
 */
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

/**
 * Evenly spaced along the flaming part of the continuous front, not clustered
 * at cell centres, each with the strength of its flame.
 *
 * The intensity is Byram's with the speed the front **really** crosses each
 * cell at —read from the arrival times, so barriers, water and waits are in
 * it— and the heat per area of the cell it is entering, treated if a
 * countermeasure has wetted it or taken fuel out (`heatAt`).
 */
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
    // More flames where the front is hotter: a particle picks its birthplace
    // with a chance that grows with the strength there.
    total += s.strength * s.strength;
    weights[i] = total;
  }
  return { positions, count, unitsPerMetre, strength, weights };
}
