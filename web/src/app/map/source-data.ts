import type { GeoJSONSource } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';

export function writeSource(
  source: Pick<GeoJSONSource, 'setData'> | undefined,
  data: FeatureCollection,
): void {
  source?.setData(data).catch((error: Error) => {
    console.warn('[map] the source could not be written —', error);
  });
}
