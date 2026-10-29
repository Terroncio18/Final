import { Injectable, signal } from '@angular/core';

import { REGIONS_URL } from '../map/map.config';
import type { Region } from './region';

/**
 * The shape of the file, asserted once here.
 *
 * It is our own preprocessed output and not a third-party feed, so one cast at
 * the boundary is honest; anything stricter would be ceremony.
 */
type Ring = readonly (readonly [number, number])[];

type RegionGeometry =
  | { readonly type: 'Polygon'; readonly coordinates: readonly Ring[] }
  | { readonly type: 'MultiPolygon'; readonly coordinates: readonly (readonly Ring[])[] };

interface RegionFeature {
  readonly properties: {
    readonly id: string;
    readonly name: string;
    readonly country: string;
    readonly scope: Region['scope'];
  };
  readonly geometry: RegionGeometry;
}

interface RegionCollection {
  readonly features: readonly RegionFeature[];
}

/**
 * The extent of a polygon or a multipolygon.
 *
 * Derived here instead of being stored in the file: the geometry is in memory
 * already and one pass over it costs a couple of milliseconds, which is cheaper
 * than a second file that can fall out of step with the first.
 */
function boundsOf(geometry: RegionGeometry): [number, number, number, number] {
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

function toRegion(feature: RegionFeature): Region {
  const { id, name, country, scope } = feature.properties;
  return {
    id,
    // GISCO ships at least one name with a trailing space (`Comunitat
    // Valenciana `), which shows up as a gap before the next word.
    name: name.trim(),
    country,
    scope,
    bounds: boundsOf(feature.geometry),
  };
}

/**
 * The regions of the first step, and where each one is.
 *
 * Root-provided on purpose: every step of the form needs the same list, and
 * reading the file once per session is the whole point.
 */
@Injectable({ providedIn: 'root' })
export class RegionsService {
  /** Empty until the file is in. The step says it is waiting. */
  readonly regions = signal<readonly Region[]>([]);

  /** True when the file could not be read, so the step can say so. */
  readonly failed = signal(false);

  private asked = false;

  /**
   * Reads the regions, once.
   *
   * It is the same file MapLibre has already fetched for the border layer, so
   * the browser answers from cache and there is no second source of truth for
   * the names.
   */
  load(): void {
    if (this.asked) return;
    this.asked = true;

    // Resolved against the document and not against the current URL: from
    // /simulacio a relative path would go looking for /simulacio/data/.
    const url = new URL(REGIONS_URL, document.baseURI).href;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<RegionCollection>;
      })
      .then((collection) => this.regions.set(collection.features.map(toRegion)))
      .catch((error: unknown) => {
        console.error('[regions]', error);
        this.failed.set(true);
      });
  }

  /** The region a URL code names, or nothing if it names none. */
  find(id: string): Region | undefined {
    return this.regions().find((region) => region.id === id);
  }
}
