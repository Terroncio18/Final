import { inject, Injectable } from '@angular/core';
import type { FeatureCollection, Point } from 'geojson';

import { MapService } from './map.service';
import { PLACES_URL } from './map.config';

/**
 * How many summits a domain is allowed to name.
 *
 * The Serra de Tramuntana answers with about a hundred inside one domain, and
 * a hundred labels over a mountain range is a wall of text that pushes the
 * towns off the screen —the first version did exactly that, and Sóller
 * disappeared behind the peaks around it. A dozen is what a view holds, and
 * the tallest dozen is the one worth having: those are the ridges.
 */
const PEAKS_IN_VIEW = 12;

/** The places that fall in an extent, or all of them when there is none. */
function clip(
  collection: FeatureCollection,
  within?: readonly [number, number, number, number],
): FeatureCollection {
  if (!within) return collection;
  const [west, south, east, north] = within;

  const inside = collection.features.filter((feature) => {
    // Every feature in these files is a point; they are our own output.
    const [lon, lat] = (feature.geometry as Point).coordinates as [number, number];
    return lon >= west && lon <= east && lat >= south && lat <= north;
  });

  const peak = (feature: (typeof inside)[number]) => feature.properties?.['kind'] === 'peak';
  const summits = inside
    .filter(peak)
    .sort((a, b) => Number(b.properties?.['ele'] ?? 0) - Number(a.properties?.['ele'] ?? 0))
    .slice(0, PEAKS_IN_VIEW);

  return { type: 'FeatureCollection', features: [...inside.filter((f) => !peak(f)), ...summits] };
}

/**
 * The place names of one province at a time.
 *
 * The same bargain as the municipalities (§2.25): one file per province, asked
 * for when a screen knows which province it is on, and kept afterwards because
 * coming back is the normal way to use this. The difference is what is in it —
 * towns and named summits from OpenStreetMap, which the administrative files
 * do not carry — and who asks: the simulation screen, which writes them over
 * the terrain, and not the form, where the map is deliberately bare.
 *
 * A failure is quiet on purpose. A domain with no labels is a map that says
 * less; a domain that refuses to open because a label file is missing would be
 * a screen lost over decoration.
 */
@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly maps = inject(MapService);

  private readonly cache = new Map<string, FeatureCollection>();
  private asked: string | null = null;

  /**
   * Puts one province's names on the map, keeping only those inside `within`.
   *
   * The file is a province and the screen is a domain, and the difference is
   * the whole plain of Mallorca written over a screen about the Serra de
   * Tramuntana. Clipped here and not in the style, because every name dropped
   * is also one less label for MapLibre to fit against the others.
   *
   * `within` is `[west, south, east, north]`, the order the domain is in.
   */
  load(province: string, within?: readonly [number, number, number, number]): void {
    const key = province + (within ? '@' + within.join(',') : '');
    if (this.asked === key) return;
    this.asked = key;

    const held = this.cache.get(province);
    if (held) {
      this.maps.setPlaces(clip(held, within));
      return;
    }

    // Resolved against the document and not against the current URL, which
    // has four segments of its own by the time this runs.
    const url = new URL(`${PLACES_URL}/${province}.geojson`, document.baseURI).href;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<FeatureCollection>;
      })
      .then((collection) => {
        this.cache.set(province, collection);
        // A slow answer for a province the user has already left must not
        // replace what is on screen now.
        if (this.asked === key) this.maps.setPlaces(clip(collection, within));
      })
      .catch((error: unknown) => {
        console.error('[places]', error);
      });
  }

  /** Takes the names off the map, and forgets which province was asked for. */
  release(): void {
    this.asked = null;
    this.maps.setPlaces(null);
  }
}
