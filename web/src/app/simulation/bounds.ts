import type { Point } from './point';

/** A ring of a GeoJSON polygon: its outline, or one of its holes. */
export type Ring = readonly (readonly [number, number])[];

/**
 * The shape of the geometries in our preprocessed files, asserted once.
 *
 * They are our own output and not a third-party feed, so one cast at the
 * boundary is honest; anything stricter would be ceremony.
 */
export type AreaGeometry =
  | { readonly type: 'Polygon'; readonly coordinates: readonly Ring[] }
  | { readonly type: 'MultiPolygon'; readonly coordinates: readonly (readonly Ring[])[] };

/**
 * The extent of a polygon or a multipolygon, as `[west, south, east, north]`.
 *
 * Derived from the geometry that is already in memory instead of being stored
 * in the file: one pass over it costs a couple of milliseconds, which is
 * cheaper than a second file that can fall out of step with the first.
 */
export function boundsOf(geometry: AreaGeometry): [number, number, number, number] {
  let west = 180;
  let south = 90;
  let east = -180;
  let north = -90;

  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

  for (const polygon of polygons) {
    // Only the first ring is read: it is the outline, and the rest are holes
    // that by definition lie inside it.
    for (const [lon, lat] of polygon[0]) {
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
    }
  }

  return [west, south, east, north];
}

/**
 * Whether a point falls inside a polygon or a multipolygon.
 *
 * Ray casting: a ray cast east from the point crosses the outline an odd
 * number of times when the point is inside it. Holes are counted with the same
 * rule and flip the answer back, so a municipality with another one enclosed
 * in it answers correctly for both.
 *
 * Longitude and latitude are read as plain numbers, with no projection. At the
 * size of a municipality the meridians are straight enough, and projecting
 * first would change the answer only for points within centimetres of the
 * border —where the border's own generalisation is already worth more than
 * that.
 */
export function contains(geometry: AreaGeometry, point: Point): boolean {
  const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

  for (const polygon of polygons) {
    if (!inRing(polygon[0], point)) continue;
    // Inside the outline. It only counts if it is in none of the holes.
    if (polygon.slice(1).every((hole) => !inRing(hole, point))) return true;
  }

  return false;
}

function inRing(ring: Ring, [lon, lat]: Point): boolean {
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    // Only the edges the ray's latitude actually crosses, and then whether the
    // crossing is to the east of the point.
    const crosses = yi > lat !== yj > lat;
    if (crosses && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }

  return inside;
}
