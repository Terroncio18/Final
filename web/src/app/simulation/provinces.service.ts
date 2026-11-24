import { inject, Injectable, signal } from '@angular/core';
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson';
import { PROVINCES_URL } from '../map/map.config';
import { MapService } from '../map/map.service';

import type { Province } from './province';
import { boundsOf } from './bounds';
import { readJson } from './read-json';
import { Asked } from './asked';

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

  private readonly asked = new Asked();

  public load(): void {
    if (!this.asked.take(true)) return;
    this.failed.set(false);

    readJson<FeatureCollection<Polygon | MultiPolygon, ProvinceFeature['properties']>>(
      PROVINCES_URL,
    )
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
        this.asked.forget(true);
      });
  }

  public of(region: string): readonly Province[] {
    return this.provinces().filter((province) => province.region === region);
  }

  public find(id: string): Province | undefined {
    return this.provinces().find((province) => province.id === id);
  }
}
