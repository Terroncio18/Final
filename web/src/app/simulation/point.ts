/** An ignition point: longitude first, the order GeoJSON and MapLibre use. */
export type Point = readonly [number, number];

// Five decimals give metre precision and avoid moving a reopened point across a 30 m cell
// boundary.
const DECIMALS = 5;

// URL coordinate segment: @lon,lat.
export function formatPoint(point: Point): string {
  return '@' + point[0].toFixed(DECIMALS) + ',' + point[1].toFixed(DECIMALS);
}

// Multiple URL points: lon,lat;lon,lat. Semicolons separate points because commas separate
// coordinates.
export function formatPoints(points: readonly Point[]): string {
  return points.map((point) => formatPoint(point).slice(1)).join(';');
}

export function parsePoints(value: string | undefined): Point[] {
  if (!value) return [];
  return value
    .split(';')
    .map((part) => parsePoint('@' + part))
    .filter((point): point is Point => point !== null);
}

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
