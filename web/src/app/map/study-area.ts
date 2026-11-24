import { Injectable, signal } from '@angular/core';
import type { Feature, Point } from 'geojson';
import { boundsOf, contains, type AreaGeometry } from '../simulation/bounds';
import { REGIONS_URL } from './map.config';
import { readJson } from '../simulation/read-json';

interface Area {
  readonly bounds: readonly [number, number, number, number];
  readonly shape: AreaGeometry;
}

interface RegionFeature {
  readonly geometry: AreaGeometry;
}

@Injectable({ providedIn: 'root' })
export class StudyArea {
  public readonly failed = signal(false);

  private areas: readonly Area[] = [];
  private reading: Promise<void> | null = null;

  public async inside<T extends Feature<Point>>(features: readonly T[]): Promise<readonly T[]> {
    await this.read();
    // With no usable boundaries, keep detections visible instead of implying there are none.
    if (!this.areas.length) return features;

    return features.filter((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      if (lon === undefined || lat === undefined) return false;
      const point = [lon, lat] as const;

      for (const area of this.areas) {
        const [west, south, east, north] = area.bounds;
        if (lon < west || lon > east || lat < south || lat > north) continue;
        if (contains(area.shape, point)) return true;
      }

      return false;
    });
  }

  private read(): Promise<void> {
    if (this.reading) return this.reading;

    const reading = readJson<{ features: readonly RegionFeature[] }>(REGIONS_URL)
      .then((collection) => {
        this.areas = collection.features.map((feature) => ({
          bounds: boundsOf(feature.geometry),
          shape: feature.geometry,
        }));
        this.failed.set(false);
      })
      .catch((error: Error) => {
        console.error('[study-area]', error);
        this.failed.set(true);
        // Keep no failed read: the boundaries are asked for again the next time they are needed.
        if (this.reading === reading) this.reading = null;
      });

    this.reading = reading;
    return reading;
  }
}
