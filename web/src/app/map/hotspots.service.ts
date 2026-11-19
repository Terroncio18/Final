import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import type { FeatureCollection } from 'geojson';
import { HOTSPOTS_URL } from './map.config';
import { MapService } from './map.service';
import { StudyArea } from './study-area';
import {
  addDays,
  defaultRange,
  paramsFor,
  rangeFrom,
  sameRange,
  spanOf,
  type Range,
} from './hotspot-range';

@Injectable({ providedIn: 'root' })
export class HotspotsService {
  private readonly maps = inject(MapService);
  private readonly router = inject(Router);
  private readonly area = inject(StudyArea);

  private readonly navigated = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    { initialValue: null },
  );

  public readonly loading = signal(false);
  public readonly failed = signal(false);
  public readonly earliest = signal<string | null>(null);

  private readonly insideStudyArea = signal<FeatureCollection | null>(null);
  private requests = 0;

  public readonly range = computed<Range>(
    () => {
      this.navigated();
      return rangeFrom(this.router.parseUrl(this.router.url).queryParams);
    },
    { equal: sameRange },
  );

  public readonly countInScope = computed(
    () =>
      this.insideStudyArea()?.features.filter(
        (feature) => feature.properties?.['scope'] === this.maps.scope(),
      ).length ?? 0,
  );

  public constructor() {
    effect(() => this.load(this.range()));
    effect(() => this.maps.setHotspotDensity(this.countInScope()));
  }

  public choose(range: Range): void {
    void this.router.navigate([], {
      queryParams: paramsFor(range),
      queryParamsHandling: 'merge',
    });
  }

  public reset(): void {
    this.choose(defaultRange());
  }

  private stampPositionInRange(collection: FeatureCollection, range: Range): void {
    const start = Date.parse(range.from + 'T00:00:00Z');
    const end = Date.parse(addDays(range.to, 1) + 'T00:00:00Z');
    for (const feature of collection.features) {
      const properties = feature.properties;
      if (!properties) continue;
      const seen = Date.parse(String(properties['observedAt']));
      if (Number.isNaN(seen)) continue;
      properties['when'] = Math.min(Math.max((seen - start) / (end - start), 0), 1);
    }
  }

  private load(range: Range): void {
    const request = ++this.requests;
    this.loading.set(true);
    this.failed.set(false);

    const url = `${HOTSPOTS_URL}?from=${range.from}&to=${range.to}`;

    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const earliest = response.headers.get('x-earliest');
        if (earliest) this.earliest.set(earliest);
        return response.json() as Promise<FeatureCollection>;
      })
      .then(async (collection) => {
        if (request !== this.requests) return;

        const features = await this.area.inside(collection.features);
        if (request !== this.requests) return;

        const kept: FeatureCollection = { type: 'FeatureCollection', features: [...features] };

        const colourByDate = spanOf(range) > 1;
        if (colourByDate) this.stampPositionInRange(kept, range);

        this.insideStudyArea.set(kept);
        this.maps.setHotspots(kept);
        this.maps.setHotspotColourBy(colourByDate ? 'date' : 'power');
        this.loading.set(false);
      })
      .catch((error: unknown) => {
        console.error('[hotspots]', error);
        if (request !== this.requests) return;
        this.failed.set(true);
        this.loading.set(false);
      });
  }
}
