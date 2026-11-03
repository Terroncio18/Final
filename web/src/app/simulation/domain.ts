import type { Point } from './point';

/**
 * The simulation domain: a square of cells around the ignition point.
 *
 * The three numbers below are one decision and not three. The grid is what the
 * GPU holds, the cell is what the data can honestly resolve, and the side is
 * whatever those two multiply to. Changing the side means changing one of the
 * other two, and each costs something different:
 *
 *   1024 x 1024 cells of 30 m  =  30,7 km of side   (what is here)
 *    512 x  512 cells of 30 m  =  15,4 km of side   (a quarter of the work)
 *   1024 x 1024 cells of 15 m  =  15,4 km of side   (same work, finer cells,
 *                                                    but no 15 m fuel data)
 */
export const GRID = 1024;

/** Metres per cell. The elevation and fuel sources are built around this. */
export const CELL_M = 30;

/** 30.720 m. Not a round 30 km on purpose: the grid is what is fixed. */
export const SIDE_M = GRID * CELL_M;

/** Metres per degree of latitude. Constant enough at this scale. */
const M_PER_DEGREE = 111_320;

/**
 * The domain around a point, as `[west, south, east, north]`.
 *
 * A square on the ground is not a square in degrees: a degree of longitude
 * shrinks with the cosine of the latitude, so the two half-sides are worked
 * out separately. At Iberian latitudes ignoring that would stretch the square
 * by about a quarter of its width.
 */
export function domainAround(point: Point): [number, number, number, number] {
  const [lon, lat] = point;
  const half = SIDE_M / 2;

  const dLat = half / M_PER_DEGREE;
  const dLon = half / (M_PER_DEGREE * Math.cos((lat * Math.PI) / 180));

  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

/** The same square as a ring, for drawing. */
export function domainRing(point: Point): [number, number][] {
  const [west, south, east, north] = domainAround(point);
  return [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ];
}
