import { Injectable, signal } from '@angular/core';
import type { Feature, Point as GeoPoint } from 'geojson';
// The only description of point-in-polygon in the project, written for the
// municipalities (§2.25). It is pure geometry with no opinion about forms or
// maps, so it is borrowed rather than written a second time; the day a shared
// folder exists, it is the first thing that should move into it.
import { boundsOf, contains, type AreaGeometry } from '../simulation/bounds';
import { REGIONS_URL } from './map.config';

interface Area {
  /** `[west, south, east, north]`: four comparisons before any ray casting. */
  readonly bounds: readonly [number, number, number, number];
  readonly shape: AreaGeometry;
}

interface RegionFeature {
  readonly geometry: AreaGeometry;
}

/**
 * What counts as being in the study area, and what falls outside it.
 *
 * The detections are asked of FIRMS by bounding box, because that is what its
 * API takes, and a box around Iberia is not Iberia. The peninsular one reaches
 * from 35,8° to 44,0°, so a third of what comes back in a summer month is
 * somebody else's: measured over August 2024, of 6.799 detections **2.485 were
 * outside Spain and Portugal** —1.498 in Morocco and Algeria, 239 in France,
 * and the rest at sea.
 *
 * Counting them would be saying that Spain and Portugal burned half again as
 * much as they did, and drawing them without counting them would be worse: a
 * map with fifty dots over the Rif and a number that ignores them.
 *
 * The outlines are the NUTS 2 regions already in `regions.geojson`, which the
 * style downloads anyway to draw the borders, so this costs no new data and no
 * second truth about where the border is. Ceuta and Melilla are not in that
 * file and that is not an oversight: `fetch-regions.mjs` leaves them out with
 * the Azores and Madeira as outside the study area, so «outside Spain» and
 * «outside the study area» differ exactly there, and this is the second.
 *
 * The 1:3M generalisation was checked before trusting it: of the discarded
 * points that are not plainly in another country, exactly one sits within 5 km
 * of the drawn border. A coarse coastline is not throwing Spanish fires away.
 */
@Injectable({ providedIn: 'root' })
export class StudyArea {
  /** True when the outlines could not be read, so nothing is filtered. */
  public readonly failed = signal(false);

  private areas: readonly Area[] = [];
  private reading: Promise<void> | null = null;

  /**
   * The detections that fall in the study area.
   *
   * Everything, unchanged, when the outlines are missing: a map showing a few
   * fires too many is a smaller lie than a map showing none, and the one thing
   * an empty map must never mean is «nothing is burning».
   */
  public async inside<T extends Feature>(features: readonly T[]): Promise<readonly T[]> {
    await this.read();
    if (!this.areas.length) return features;

    return features.filter((feature) => {
      const point = (feature.geometry as GeoPoint).coordinates as [number, number];
      const [lon, lat] = point;

      for (const area of this.areas) {
        const [west, south, east, north] = area.bounds;
        // The box rejects twenty-three of the twenty-four regions for the
        // price of four comparisons; only then is walking the rings worth it.
        if (lon < west || lon > east || lat < south || lat > north) continue;
        if (contains(area.shape, point)) return true;
      }

      return false;
    });
  }

  /** Reads the outlines once, and remembers the attempt and not the result. */
  private read(): Promise<void> {
    if (this.reading) return this.reading;

    // The same file MapLibre has already fetched for the border layer, so the
    // browser answers from cache.
    const url = new URL(REGIONS_URL, document.baseURI).href;

    this.reading = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<{ features: readonly RegionFeature[] }>;
      })
      .then((collection) => {
        this.areas = collection.features.map((feature) => ({
          bounds: boundsOf(feature.geometry),
          shape: feature.geometry,
        }));
      })
      .catch((error: unknown) => {
        console.error('[study-area]', error);
        this.failed.set(true);
      });

    return this.reading;
  }
}
