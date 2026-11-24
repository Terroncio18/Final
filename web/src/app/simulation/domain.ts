import { degreesFor } from './geo';
import type { Point } from './point';

// 1024 cells × 30 m = 30.72 km per side. Changing resolution must respect the elevation and fuel
// source resolution.
export const GRID = 1024;

/** Metres per cell. The elevation and fuel sources are built around this. */
export const CELL_M = 30;

export const SIDE_M = GRID * CELL_M;

// Bounds order: west, south, east, north. Longitude degrees shrink by cos(latitude), so east/west
// and north/south half-spans differ.
export function domainAround(point: Point): [number, number, number, number] {
  const [lon, lat] = point;
  const half = SIDE_M / 2;

  const { dLat, dLon } = degreesFor(half, lat);

  return [lon - dLon, lat - dLat, lon + dLon, lat + dLat];
}

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
