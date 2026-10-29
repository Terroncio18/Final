import { inject, Injectable, signal } from '@angular/core';
import type { FeatureCollection } from 'geojson';

import { PROVINCES_URL } from '../map/map.config';
import { MapService } from '../map/map.service';
import { boundsOf, type AreaGeometry } from './bounds';
import type { Province } from './province';

interface ProvinceFeature {
  readonly properties: {
    readonly id: string;
    readonly name: string;
    readonly region: string;
  };
  readonly geometry: AreaGeometry;
}

function toProvince(feature: ProvinceFeature): Province {
  const { id, name, region } = feature.properties;
  return { id, name: name.trim(), region, bounds: boundsOf(feature.geometry) };
}

/**
 * The provinces and islands of the second step.
 *
 * Unlike the regions, these are not in the map's opening style: 380 kB that the
 * portada never draws, on the one screen that has to be quick. They arrive the
 * first time a step asks for them, and the parsed collection is handed straight
 * to the map, so the file is downloaded and parsed exactly once for both uses.
 */
@Injectable({ providedIn: 'root' })
export class ProvincesService {
  private readonly maps = inject(MapService);

  /** Empty until the file is in. The step says it is waiting. */
  readonly provinces = signal<readonly Province[]>([]);

  /** True when the file could not be read, so the step can say so. */
  readonly failed = signal(false);

  private asked = false;

  load(): void {
    if (this.asked) return;
    this.asked = true;

    // Resolved against the document and not against the current URL: from
    // /simulacio/ES51 a relative path would look for /simulacio/data/.
    const url = new URL(PROVINCES_URL, document.baseURI).href;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<FeatureCollection>;
      })
      .then((collection) => {
        const features = collection.features as unknown as ProvinceFeature[];
        this.provinces.set(features.map(toProvince));
        this.maps.addProvinces(collection);
      })
      .catch((error: unknown) => {
        console.error('[provinces]', error);
        this.failed.set(true);
      });
  }

  /** The provinces or islands of one region, in the file's own order. */
  of(region: string): readonly Province[] {
    return this.provinces().filter((province) => province.region === region);
  }

  /** The one a URL code names, or nothing if it names none. */
  find(id: string): Province | undefined {
    return this.provinces().find((province) => province.id === id);
  }
}
