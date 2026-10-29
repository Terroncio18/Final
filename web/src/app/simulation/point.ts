/** An ignition point: longitude first, the order GeoJSON and MapLibre use. */
export type Point = readonly [number, number];

/**
 * Five decimals, about a metre.
 *
 * Far finer than the thirty-metre cell the simulation will run on, but the
 * cost is five characters and the alternative —rounding in the URL— would mean
 * that reopening a shared link lands on a slightly different cell than the one
 * that was marked.
 */
const DECIMALS = 5;

/**
 * The point as it travels in the URL: `@0.52341,41.57092`.
 *
 * The leading `@` is what tells a coordinate segment from a code segment at a
 * glance, in the address bar and in the route table alike.
 */
export function formatPoint(point: Point): string {
  return '@' + point[0].toFixed(DECIMALS) + ',' + point[1].toFixed(DECIMALS);
}

/** The point a URL segment carries, or nothing if it carries none. */
export function parsePoint(segment: string | undefined): Point | null {
  if (!segment || !segment.startsWith('@')) return null;

  const parts = segment.slice(1).split(',');
  if (parts.length !== 2) return null;

  const lon = Number(parts[0]);
  const lat = Number(parts[1]);
  // Number('') is 0, so empty halves have to be caught before the range test.
  if (parts[0].trim() === '' || parts[1].trim() === '') return null;
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90) return null;

  return [lon, lat];
}
