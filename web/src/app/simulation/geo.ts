import type { Point } from './point';

/**
 * Metres per degree of latitude. Constant enough at this scale, and the only place this number
 * lives: four call sites carried their own copy of it before.
 */
export const M_PER_DEGREE = 111_320;

/**
 * Half-spans in degrees for a distance in metres at a latitude. Longitude degrees shrink by
 * cos(latitude), so the two differ; the caller says which latitude applies to its own case.
 */
export function degreesFor(metres: number, atLat: number): { dLat: number; dLon: number } {
  return {
    dLat: metres / M_PER_DEGREE,
    dLon: metres / (M_PER_DEGREE * Math.cos((atLat * Math.PI) / 180)),
  };
}

/** Flat-earth metres for degree offsets at a latitude. The inverse of degreesFor. */
export function metresFor(
  dLon: number,
  dLat: number,
  atLat: number,
): { east: number; north: number } {
  return {
    east: dLon * M_PER_DEGREE * Math.cos((atLat * Math.PI) / 180),
    north: dLat * M_PER_DEGREE,
  };
}

/**
 * Move a point by east/north metres. Flat-earth is enough over the few kilometres of a domain.
 * Each axis goes through degreesFor on its own so the arithmetic matches it exactly, with no
 * reciprocal in between.
 */
export function offsetBy([lon, lat]: Point, east: number, north: number): Point {
  return [lon + degreesFor(east, lat).dLon, lat + degreesFor(north, lat).dLat];
}
