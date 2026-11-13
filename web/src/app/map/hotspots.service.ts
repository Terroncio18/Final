import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import type { FeatureCollection } from 'geojson';

import { HOTSPOTS_URL } from './map.config';
import { MapService } from './map.service';
import { StudyArea } from './study-area';
import { defaultRange, paramsFor, rangeFrom, sameRange, type Range } from './hotspot-range';

/**
 * The detections on the map, and the dates they are from.
 *
 * The dates live in the URL and nowhere else (§2.19, §2.26): this reads them
 * and asks the server, and the picker in the top bar only navigates. One
 * direction, so a link, the back button and the control can never disagree
 * about what is on screen.
 *
 * The fetch is ours and not MapLibre's —the style used to carry the URL in the
 * source— because a month takes about ten seconds to come back the first time.
 * A map that sits there unchanged for ten seconds is a map that looks broken,
 * and only whoever made the request can say that it is still on its way.
 */
@Injectable({ providedIn: 'root' })
export class HotspotsService {
  private readonly maps = inject(MapService);
  private readonly router = inject(Router);
  private readonly area = inject(StudyArea);

  /** Bumped on every navigation, so the range below is read again. */
  private readonly navigated = toSignal(
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)),
    { initialValue: null },
  );

  /**
   * What the address bar is asking for.
   *
   * Compared by value: every navigation produces a new object, and without
   * this, walking into the form would re-ask FIRMS for the same month.
   */
  readonly range = computed<Range>(
    () => {
      this.navigated();
      return rangeFrom(this.router.parseUrl(this.router.url).queryParams);
    },
    { equal: sameRange },
  );

  readonly loading = signal(false);
  readonly failed = signal(false);

  /** What the last answer carried once it was cut to the study area. */
  private readonly answer = signal<FeatureCollection | null>(null);

  /**
   * How many of them are in the territory being looked at.
   *
   * Not how many came back: one answer covers the peninsula and the Canaries,
   * because FIRMS is asked for both boxes at once and the map filters by
   * camera. «6.799 focus» over a view of the Canaries would be claiming the
   * islands burned the way Iberia did.
   */
  readonly count = computed(
    () =>
      this.answer()?.features.filter(
        (feature) => feature.properties?.['scope'] === this.maps.scope(),
      ).length ?? 0,
  );

  /**
   * The first date FIRMS holds anything for, once it has said so.
   *
   * It bounds the date fields. Without it, a range in 2005 would come back
   * empty and the map would read as «nothing burned in Spain in 2005» rather
   * than «VIIRS was not in orbit yet».
   */
  readonly earliest = signal<string | null>(null);

  /** Counts the requests, so a slow answer cannot overwrite a newer one. */
  private asked = 0;

  constructor() {
    effect(() => this.load(this.range()));
  }

  /** Puts a range in the address bar. Everything else follows from there. */
  choose(range: Range): void {
    void this.router.navigate([], {
      queryParams: paramsFor(range),
      queryParamsHandling: 'merge',
    });
  }

  /** Back to the portada's own range, which writes no parameters. */
  reset(): void {
    this.choose(defaultRange());
  }

  private load(range: Range): void {
    const token = ++this.asked;
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
        // A month asked for and then left before it arrived must not land on
        // top of the day the user went back to.
        if (token !== this.asked) return;

        // The box FIRMS is asked for is not the study area: see StudyArea.
        const features = await this.area.inside(collection.features);
        if (token !== this.asked) return;

        const kept: FeatureCollection = { type: 'FeatureCollection', features: [...features] };
        this.answer.set(kept);
        this.maps.setHotspots(kept);
        this.loading.set(false);
      })
      .catch((error: unknown) => {
        console.error('[hotspots]', error);
        if (token !== this.asked) return;
        // The map keeps whatever it was showing: an empty map reads as
        // «nothing is burning», which is the one thing it must not say by
        // accident.
        this.failed.set(true);
        this.loading.set(false);
      });
  }
}
