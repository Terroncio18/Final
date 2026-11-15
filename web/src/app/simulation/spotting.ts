import { CELL_M, GRID } from './domain';

export interface SpottingOptions {
  readonly enabled: boolean;
  readonly seed: number;
}
export interface SpotIgnition {
  readonly cell: number;
  readonly source: number;
  readonly minute: number;
  readonly distanceM: number;
}
export interface EmberWind {
  readonly speedKmh: number;
  readonly towardsDeg: number;
  readonly until: number;
}

/** A cell-based hash avoids changing the random sequence when a forecast is edited. */
export function emberRandom(seed: number, cell: number, salt: number): number {
  let x = (seed ^ Math.imul(cell + 1, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

/** Experimental conditional probability, NOT the operational NWCG ignition table. */
export function emberIgnitionProbability(
  moisture: number,
  extinction: number,
  fineKgM2: number,
  temperatureC: number,
): number {
  if (moisture >= extinction || fineKgM2 <= 0) return 0;
  const dry = Math.max(0, 1 - moisture / extinction);
  const warmth = Math.max(0.2, Math.min(1, (temperatureC + 10) / 50));
  return Math.min(0.95, dry * dry * warmth * Math.min(1, Math.sqrt(fineKgM2 / 0.1)));
}

/** A bounded near-field ember flight, integrating every programmed wind change. */
export function emberFlight(
  cell: number,
  minute: number,
  intensity: number,
  woody: boolean,
  seed: number,
  windAt: (minute: number) => EmberWind,
): SpotIgnition | null {
  if (!(intensity > 0)) return null;
  const emission = Math.min(0.08, (woody ? 0.045 : 0.015) * Math.sqrt(intensity / 1000));
  if (emberRandom(seed, cell, 0) >= emission) return null;
  const flight =
    Math.min(2.5, 0.2 + Math.log1p(intensity / 300) * 0.45) *
    (0.6 + emberRandom(seed, cell, 1) * 0.8);
  const release = minute + 0.25,
    land = release + flight;
  const sideways = (emberRandom(seed, cell, 2) - 0.5) * 0.5;
  let east = 0,
    north = 0,
    time = release;
  while (time < land) {
    const wind = windAt(time),
      end = Math.min(land, wind.until);
    if (!(end > time)) return null;
    const angle = (wind.towardsDeg * Math.PI) / 180;
    const distance = ((wind.speedKmh * 1000) / 60) * (end - time) * 0.6;
    east += distance * (Math.sin(angle) + sideways * Math.cos(angle));
    north += distance * (Math.cos(angle) - sideways * Math.sin(angle));
    time = end;
  }
  const distanceM = Math.hypot(east, north);
  if (distanceM < CELL_M || distanceM > 2000) return null;
  const x = Math.round((cell % GRID) + east / CELL_M),
    y = Math.round(Math.floor(cell / GRID) - north / CELL_M);
  if (x < 0 || x >= GRID || y < 0 || y >= GRID) return null;
  return { source: cell, cell: y * GRID + x, minute: land + 0.5, distanceM };
}

export function parseSpotting(value: unknown): SpottingOptions | string {
  const v = value as Partial<SpottingOptions> | null;
  return v &&
    typeof v === 'object' &&
    typeof v.enabled === 'boolean' &&
    Number.isInteger(v.seed) &&
    v.seed! >= 0 &&
    v.seed! <= 4294967295
    ? { enabled: v.enabled, seed: v.seed! }
    : 'Configuració de brases incorrecta.';
}
