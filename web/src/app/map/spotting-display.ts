import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import { domainAround, GRID } from '../simulation/domain';
import type { Point } from '../simulation/point';
import type { SpotIgnition } from '../simulation/spotting';

export function spotPoint(cell: number, centre: Point): [number, number] {
  const [w, s, e, n] = domainAround(centre);
  return [
    w + (((cell % GRID) + 0.5) / GRID) * (e - w),
    n - ((Math.floor(cell / GRID) + 0.5) / GRID) * (n - s),
  ];
}
export class SpottingDisplay {
  private map: MapLibreMap | null = null;
  set(map: MapLibreMap, centre: Point, spots: readonly SpotIgnition[]): void {
    if (this.map !== map) {
      this.detach();
      this.map = map;
    }
    const data: FeatureCollection = {
      type: 'FeatureCollection',
      features: spots.map((s) => ({
        type: 'Feature',
        properties: { minute: s.minute },
        geometry: { type: 'Point', coordinates: spotPoint(s.cell, centre) },
      })),
    };
    if (!map.getSource('spot-ignitions')) {
      map.addSource('spot-ignitions', { type: 'geojson', data });
      map.addLayer({
        id: 'spot-ignitions',
        source: 'spot-ignitions',
        type: 'circle',
        paint: {
          'circle-radius': 5,
          'circle-color': '#ffab61',
          'circle-stroke-color': '#7c2317',
          'circle-stroke-width': 2,
        },
      });
    } else (map.getSource('spot-ignitions') as GeoJSONSource).setData(data);
  }
  detach(): void {
    if (this.map?.getLayer('spot-ignitions')) this.map.removeLayer('spot-ignitions');
    if (this.map?.getSource('spot-ignitions')) this.map.removeSource('spot-ignitions');
    this.map = null;
  }
}
