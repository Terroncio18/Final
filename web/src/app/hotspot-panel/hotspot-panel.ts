import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Hotspot, HotspotConfidence, HotspotSatellite } from '../map/hotspot';
import { formatPoint, formatPoints } from '../simulation/point';
import { PointLocator, type Place } from '../simulation/point-locator';

const PLATFORMS: Partial<Record<HotspotSatellite, string>> = {
  N: 'Suomi NPP',
  N20: 'NOAA-20',
  N21: 'NOAA-21',
};

const CONFIDENCE: Partial<Record<HotspotConfidence, string>> = {
  l: 'baixa',
  n: 'nominal',
  h: 'alta',
};

// FRP bands describe measured power, not fire type; no universal FRP threshold distinguishes
// wildfire from stubble burning. These provisional bands need summer data for calibration.
const MODERATE_MW = 5;
const HIGH_MW = 50;

@Component({
  selector: 'app-hotspot-panel',
  imports: [RouterLink],
  templateUrl: './hotspot-panel.html',
  styleUrl: './hotspot-panel.css',
})
export class HotspotPanel {
  public readonly hotspot = input.required<Hotspot>();
  public readonly closed = output<void>();

  private readonly locator = inject(PointLocator);
  private readonly place = signal<Place | null | 'pending' | 'failed'>('pending');

  protected readonly simulation = computed(() => {
    const place = this.place();
    if (!place || place === 'pending' || place === 'failed') return null;
    const { lon, lat } = this.hotspot();
    return {
      link: [
        '/simulador',
        place.region,
        place.province,
        place.municipality,
        formatPoint([lon, lat]),
      ],
      query: { ignicions: formatPoints([[lon, lat]]) },
    };
  });

  protected readonly simulationStatus = computed(() => {
    const place = this.place();
    if (place === 'pending') return 'Buscant el municipi…';
    if (place === 'failed') return 'No s’ha pogut llegir on és la detecció.';
    if (place === null) return 'La detecció no cau dins de cap municipi.';
    return null;
  });

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
    return CONFIDENCE[code] ?? 'desconeguda';
  });

  protected readonly moment = computed(() => {
    const code = this.hotspot().daynight;
    if (code === 'N') return 'nit';
    if (code === 'D') return 'dia';
    return 'desconegut';
  });

  protected readonly power = computed(() =>
    new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(this.hotspot().frp),
  );

  protected readonly band = computed(() => {
    const frp = this.hotspot().frp;
    if (frp >= HIGH_MW) return 'alta';
    if (frp >= MODERATE_MW) return 'moderada';
    return 'baixa';
  });

  /** Five decimals locate the 375 m pixel without implying sub-metre accuracy. */
  protected readonly coordinates = computed(() => {
    const { lat, lon } = this.hotspot();
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  });

  public constructor() {
    effect(() => {
      const { lon, lat } = this.hotspot();
      this.place.set('pending');
      this.locator
        .locate([lon, lat])
        .then((place) => {
          // A slow answer for a detection no longer selected changes nothing.
          if (this.hotspot().lon === lon && this.hotspot().lat === lat) this.place.set(place);
        })
        .catch((error: Error) => {
          if (this.hotspot().lon === lon && this.hotspot().lat === lat) {
            console.error('[hotspot-panel]', error);
            this.place.set('failed');
          }
        });
    });
  }
}
