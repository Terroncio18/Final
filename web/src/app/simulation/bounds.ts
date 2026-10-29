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

  const polygons =
    geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];

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
