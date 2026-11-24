import { inject, Injectable, signal } from '@angular/core';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { PROVINCES_URL } from '../map/map.config';
import { MapService } from '../map/map.service';

import type { Province } from './province';
import { boundsOf } from './bounds';

type ProvinceFeature = Feature<
  Polygon | MultiPolygon,
  {
    readonly id: string;
    readonly name: string;
    readonly region: string;
  }
>;

function toProvince(feature: ProvinceFeature): Province {
  const { id, name, region } = feature.properties;
  return { id, name: name.trim(), region, bounds: boundsOf(feature.geometry) };
}

// Load province geometry on demand and share the parsed collection with the map.
@Injectable({ providedIn: 'root' })
export class ProvincesService {
  private readonly maps = inject(MapService);

  public readonly provinces = signal<readonly Province[]>([]);

  public readonly failed = signal(false);

  private asked = false;

  public load(): void {
    if (this.asked) return;
    this.asked = true;
    this.failed.set(false);

    // Resolve against document.baseURI; nested routes would otherwise request /simulacio/data/.
    const url = new URL(PROVINCES_URL, document.baseURI).href;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<
          FeatureCollection<Polygon | MultiPolygon, ProvinceFeature['properties']>
        >;
      })
      .then((collection) => {
        const features = collection.features;
        this.provinces.set(features.map(toProvince));
        this.maps.addProvinces(collection);
      })
      .catch((error: Error) => {
        console.error('[provinces]', error);
        this.failed.set(true);
        // Forget the failed read: these data are asked for once, so this is what lets the step's
        // retry control bring them back after a passing network failure.
        this.asked = false;
      });
  }

  public of(region: string): readonly Province[] {
    return this.provinces().filter((province) => province.region === region);
  }

  public find(id: string): Province | undefined {
    return this.provinces().find((province) => province.id === id);
  }
}
