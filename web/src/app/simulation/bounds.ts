import type { Point } from './point';

// A polygon ring is its outline or one of its holes.
export type Ring = readonly (readonly number[])[];

export type AreaGeometry =
  | { readonly type: 'Polygon'; readonly coordinates: readonly Ring[] }
  | { readonly type: 'MultiPolygon'; readonly coordinates: readonly (readonly Ring[])[] };

// Bounds order: west, south, east, north.
export function boundsOf(geometry: AreaGeometry): [number, number, number, number] {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;

  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

  for (const polygon of polygons) {
    // Only the outer ring contributes to bounds; holes lie within it.
    for (const [lon, lat] of polygon[0]) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }

  return [west, south, east, north];
}

// Eastward ray casting uses odd/even crossings, with holes excluding enclosed areas. At
// municipality scale, raw lon/lat are sufficient relative to boundary generalization.
export function contains(geometry: AreaGeometry, point: Point): boolean {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

  for (const polygon of polygons) {
    if (!inRing(polygon[0], point)) continue;

    if (polygon.slice(1).every((hole) => !inRing(hole, point))) return true;
  }

  return false;
}

function inRing(ring: Ring, [lon, lat]: Point): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    const crosses = yi > lat !== yj > lat;
    if (crosses && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }

  return inside;
}
