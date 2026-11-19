import type { GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';

/**
 * Writes the data of a GeoJSON source.
 *
 * MapLibre's `setData` returns a promise —the worker is the one that answers—
 * and nobody here waits for it: the map draws when it is ready. What must not
 * happen is that a failure passes unnoticed, which is what an unhandled
 * rejection is, so the only thing this adds is somewhere for it to be seen.
 */
export function writeSource(source: GeoJSONSource | undefined, data: FeatureCollection): void {
  source?.setData(data).catch((error: unknown) => {
    console.warn('[map] the source could not be written —', error);
  });
}
