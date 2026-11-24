import { Injectable, signal } from '@angular/core';
import { REGIONS_URL } from '../map/map.config';
import { boundsOf, type AreaGeometry } from './bounds';
import type { Region } from './region';

interface RegionFeature {
  readonly properties: {
    readonly id: string;
    readonly name: string;
    readonly country: string;
    readonly scope: Region['scope'];
  };
  readonly geometry: AreaGeometry;
}

interface RegionCollection {
  readonly features: readonly RegionFeature[];
}

function toRegion(feature: RegionFeature): Region {
  const { id, name, country, scope } = feature.properties;
  return {
    id,
    // GISCO names can have trailing whitespace, for example Comunitat Valenciana.
    name: name.trim(),
    country,
    scope,
    bounds: boundsOf(feature.geometry),
  };
}

@Injectable({ providedIn: 'root' })
export class RegionsService {
  public readonly regions = signal<readonly Region[]>([]);

  public readonly failed = signal(false);

  private asked = false;

  // Reuse the same region file as the map so names and borders share one source.
  public load(): void {
    if (this.asked) return;
    this.asked = true;
    this.failed.set(false);

    // Resolve against document.baseURI; nested routes would otherwise request /simulacio/data/.
    const url = new URL(REGIONS_URL, document.baseURI).href;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<RegionCollection>;
      })
      .then((collection) => this.regions.set(collection.features.map(toRegion)))
      .catch((error: Error) => {
        console.error('[regions]', error);
        this.failed.set(true);
        // Forget the failed read: these data are asked for once, so this is what lets the step's
        // retry control bring them back after a passing network failure.
        this.asked = false;
      });
  }

  public find(id: string): Region | undefined {
    return this.regions().find((region) => region.id === id);
  }
}
