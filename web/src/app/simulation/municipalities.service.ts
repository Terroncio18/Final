import { inject, Injectable, signal } from '@angular/core';
import type { FeatureCollection } from 'geojson';

import { MUNICIPALITIES_URL } from '../map/map.config';
import { MapService } from '../map/map.service';
import { boundsOf, type AreaGeometry } from './bounds';
import type { Municipality } from './municipality';

interface MunicipalityFeature {
  readonly properties: {
    readonly id: string;
    readonly name: string;
    readonly province: string;
  };
  readonly geometry: AreaGeometry;
}

function toMunicipality(feature: MunicipalityFeature): Municipality {
  const { id, name, province } = feature.properties;
  return { id, name: name.trim(), province, bounds: boundsOf(feature.geometry) };
}

/**
 * The municipalities of one province at a time.
 *
 * One file per province and never all of them: the eighty-one files come to
 * 13 MB together, and the biggest on its own is 438 kB. Which one is needed is
 * known by the time the step opens, so there is nothing to gain by having the
 * rest. Each one is kept after its first read, because walking back up the
 * hierarchy and down again is the normal way to use the form.
 */
@Injectable({ providedIn: 'root' })
export class MunicipalitiesService {
  private readonly maps = inject(MapService);

  /** The province now loaded, and its municipalities. */
  readonly municipalities = signal<readonly Municipality[]>([]);
  readonly failed = signal(false);

  private readonly cache = new Map<string, readonly Municipality[]>();
  private readonly sources = new Map<string, FeatureCollection>();
  private asked: string | null = null;

  load(province: string): void {
    if (this.asked === province) return;
    this.asked = province;
    this.failed.set(false);

    const held = this.cache.get(province);
    if (held) {
      this.show(province, held);
      return;
    }

    this.municipalities.set([]);

    // Resolved against the document and not against the current URL, which has
    // three segments of its own by the time this runs.
    const url = new URL(`${MUNICIPALITIES_URL}/${province}.geojson`, document.baseURI).href;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<FeatureCollection>;
      })
      .then((collection) => {
        const features = collection.features as unknown as MunicipalityFeature[];
        const list = features.map(toMunicipality);
        this.cache.set(province, list);
        this.sources.set(province, collection);
        // A slow answer for a province the user has already left must not
        // replace what is on screen now.
        if (this.asked === province) this.show(province, list);
      })
      .catch((error: unknown) => {
        console.error('[municipalities]', error);
        if (this.asked === province) this.failed.set(true);
      });
  }

  /** Clears the list and takes the outlines off the map. */
  release(): void {
    this.asked = null;
    this.municipalities.set([]);
    this.maps.setMunicipalities(null);
  }

  find(id: string): Municipality | undefined {
    return this.municipalities().find((municipality) => municipality.id === id);
  }

  private show(province: string, list: readonly Municipality[]): void {
    this.municipalities.set(list);
    const source = this.sources.get(province);
    if (source) this.maps.setMunicipalities(source);
  }
}
