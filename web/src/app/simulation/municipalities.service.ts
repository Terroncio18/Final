import { inject, Injectable, signal } from '@angular/core';
import type { FeatureCollection } from 'geojson';

import { MUNICIPALITIES_URL } from '../map/map.config';
import { MapService } from '../map/map.service';
import { boundsOf, contains, type AreaGeometry } from './bounds';
import type { Municipality } from './municipality';
import type { Point } from './point';

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

  /**
   * The outline of each municipality read so far, by code.
   *
   * Kept beside the list because the list carries extents and an extent is not
   * a shape: a point can sit inside the box of a coastal municipality and be
   * out at sea. See at().
   */
  private readonly shapes = new Map<string, AreaGeometry>();
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
        for (const feature of features) this.shapes.set(feature.properties.id, feature.geometry);
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

  /**
   * The municipality a point falls in, or nothing.
   *
   * Only among the ones now on screen, which are one province's (§2.25): the
   * domain is wider than most provinces' border regions, so a point near the
   * edge can perfectly well land outside everything that is loaded. Nothing is
   * the honest answer there, and the caller says what to do with it —loading
   * the neighbour's file to answer would be asking the question backwards,
   * since the form is on this province.
   *
   * The extent is tested first because it is four comparisons and rules out
   * every municipality but a handful; the ray casting then runs on those.
   */
  at(point: Point): Municipality | null {
    const [lon, lat] = point;

    for (const municipality of this.municipalities()) {
      const [west, south, east, north] = municipality.bounds;
      if (lon < west || lon > east || lat < south || lat > north) continue;

      const shape = this.shapes.get(municipality.id);
      if (shape && contains(shape, point)) return municipality;
    }

    return null;
  }

  private show(province: string, list: readonly Municipality[]): void {
    this.municipalities.set(list);
    const source = this.sources.get(province);
    if (source) this.maps.setMunicipalities(source);
  }
}
