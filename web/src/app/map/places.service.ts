import { inject, Injectable } from '@angular/core';
import type { FeatureCollection, Point } from 'geojson';
import { MapService } from './map.service';
import { PLACES_URL } from './map.config';

// Limit summit labels so they do not crowd out town names.
const PEAKS_IN_VIEW = 12;

function clip(
  collection: FeatureCollection<Point>,
  within?: readonly [number, number, number, number],
): FeatureCollection<Point> {
  if (!within) return collection;
  const [west, south, east, north] = within;

  const inside = collection.features.filter((feature) => {
    const [lon, lat] = feature.geometry.coordinates;
    return lon >= west && lon <= east && lat >= south && lat <= north;
  });

  const peak = (feature: (typeof inside)[number]) => feature.properties?.['kind'] === 'peak';
  const summits = inside
    .filter(peak)
    .sort((a, b) => Number(b.properties?.['ele'] ?? 0) - Number(a.properties?.['ele'] ?? 0))
    .slice(0, PEAKS_IN_VIEW);

  return { type: 'FeatureCollection', features: [...inside.filter((f) => !peak(f)), ...summits] };
}

@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly maps = inject(MapService);

  private readonly cache = new Map<string, FeatureCollection<Point>>();
  private asked: string | null = null;

  public load(province: string, within?: readonly [number, number, number, number]): void {
    const key = province + (within ? '@' + within.join(',') : '');
    if (this.asked === key) return;
    this.asked = key;

    const held = this.cache.get(province);
    if (held) {
      this.maps.setPlaces(clip(held, within));
      return;
    }

    const url = new URL(`${PLACES_URL}/${province}.geojson`, document.baseURI).href;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<FeatureCollection<Point>>;
      })
      .then((collection) => {
        this.cache.set(province, collection);
        // Ignore an older request after navigation has moved to another province.
        if (this.asked === key) this.maps.setPlaces(clip(collection, within));
      })
      .catch((error: Error) => {
        console.error('[places]', error);
        // Forget the failed request: this province has no labels, and asking again must be able
        // to bring them.
        if (this.asked === key) this.asked = null;
      });
  }

  public release(): void {
    this.asked = null;
    this.maps.setPlaces(null);
  }
}
