import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Hotspot } from '../map/hotspot';
import { formatPoint, formatPoints } from '../simulation/point';
import { PointLocator, type Place } from '../simulation/point-locator';

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
 * Where the power bands fall, in megawatts.
 *
 * Chosen here and nowhere else: there is no standard threshold of radiative
 * power that separates a wildfire from a stubble burn, because the measurement
 * does not know what is burning. They describe the reading and claim nothing
 * about the fire, which is why the labels name the power and not the kind.
 *
 * Provisional: an October sample tops out below 60 MW, which is too narrow to
 * calibrate the upper band. Worth revisiting against a summer one.
 */
const MODERATE_MW = 5;
const HIGH_MW = 50;

/**
 * What a single detection says.
 *
 * One detection, not one fire: the three VIIRS platforms see the same fire on
 * different passes and nothing merges them (§2.16 of the log). The panel shows
 * what was observed and says so.
 */
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
  /** Where the detection is, by the codes the simulator is addressed by (§11.53). */
  private readonly place = signal<Place | null | 'pending' | 'failed'>('pending');

  /**
   * The simulator, centred on the detection and with the fire starting there:
   * the same address the form builds (§2.26), plus the ignition (§11.16).
   */
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

  /** Why the button is not there yet, or cannot be. */
  protected readonly simulationStatus = computed(() => {
    const place = this.place();
    if (place === 'pending') return 'Buscant el municipi…';
    if (place === 'failed') return 'No s’ha pogut llegir on és la detecció.';
    if (place === null) return 'La detecció no cau dins de cap municipi.';
    return null;
  });

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

  /** One decimal: FIRMS reports two, and the second claims a precision the measurement has not got. */
  protected readonly power = computed(() =>
    new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(this.hotspot().frp),
  );

  protected readonly band = computed(() => {
    const frp = this.hotspot().frp;
    if (frp >= HIGH_MW) return 'alta';
    if (frp >= MODERATE_MW) return 'moderada';
    return 'baixa';
  });

  /** Five decimals is about a metre: more would pretend to a precision the 375 m pixel does not have. */
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
        .catch((error: unknown) => {
          console.error('[hotspot-panel]', error);
          this.place.set('failed');
        });
    });
  }
}
