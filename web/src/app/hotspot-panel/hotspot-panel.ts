import { Component, computed, input, output } from '@angular/core';

import type { Hotspot } from '../map/hotspot';

/** FIRMS names the platforms by their satellite code; nobody else does. */
const PLATFORMS: Record<string, string> = {
  N: 'Suomi NPP',
  N20: 'NOAA-20',
  N21: 'NOAA-21',
};

const CONFIDENCE: Record<string, string> = {
  l: 'baixa',
  n: 'nominal',
  h: 'alta',
};

/**
 * What a single detection says.
 *
 * One detection, not one fire: the three VIIRS platforms see the same fire on
 * different passes and nothing merges them (§2.16 of the log). The panel shows
 * what was observed and says so.
 */
@Component({
  selector: 'app-hotspot-panel',
  templateUrl: './hotspot-panel.html',
  styleUrl: './hotspot-panel.css',
})
export class HotspotPanel {
  readonly hotspot = input.required<Hotspot>();
  readonly closed = output<void>();

  /**
   * Shown in UTC, which is how FIRMS reports it. Translating to the reader's
   * clock would be friendlier but hides that the overpass time is the one fixed
   * fact here, and the detection reaches the API hours later anyway.
   */
  protected readonly observed = computed(() => {
    const when = new Date(this.hotspot().observedAt);
    const format = new Intl.DateTimeFormat('ca-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    });
    return `${format.format(when)} UTC`;
  });

  protected readonly platform = computed(() => {
    const code = this.hotspot().satellite;
    return PLATFORMS[code] ?? code;
  });

  protected readonly confidence = computed(() => {
    const code = this.hotspot().confidence;
    return CONFIDENCE[code] ?? code;
  });

  protected readonly moment = computed(() => (this.hotspot().daynight === 'N' ? 'nit' : 'dia'));

  /** Five decimals is about a metre: more would pretend to a precision the 375 m pixel does not have. */
  protected readonly coordinates = computed(() => {
    const { lat, lon } = this.hotspot();
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  });
}
