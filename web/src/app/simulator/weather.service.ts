import { Injectable, signal } from '@angular/core';

import type { Point } from '../simulation/point';

/**
 * What the nearest weather station last measured, as the API serves it.
 *
 * Declared here as well as in `api/src/weather.ts`, for the reason `Hotspot`
 * is: the two projects share no package.
 */
export interface Observation {
  readonly source: 'AEMET' | 'IPMA';
  readonly station: {
    readonly id: string;
    readonly name: string;
    readonly lon: number;
    readonly lat: number;
  };
  /** UTC, ISO 8601. */
  readonly observedAt: string;
  readonly windKmh: number;
  /** Where the wind comes from, in degrees from north. */
  readonly windFromDeg: number;
  readonly humidity: number;
  readonly temperature: number;
  /** How far the station is from the place asked about. */
  readonly distanceKm: number;
  /** True when the service failed and this is the last answer it gave. */
  readonly stale: boolean;
}

/**
 * The live weather of the domain: one station's last observation.
 *
 * Asked of our own server and not of AEMET or IPMA: AEMET needs a key, which
 * cannot live in the browser (§2.1), and going through one endpoint means the
 * two countries answer in the same shape.
 *
 * Each request carries a token, as the terrain's do: a domain that has moved
 * on must not be overwritten by an answer that arrives late.
 */
@Injectable({ providedIn: 'root' })
export class WeatherService {
  public readonly observation = signal<Observation | null>(null);
  public readonly loading = signal(false);
  public readonly failed = signal(false);

  private token = 0;

  /** Asks again, whether or not there is an answer already: this is «refresh». */
  public load(country: 'ES' | 'PT', point: Point): void {
    const mine = (this.token += 1);
    this.loading.set(true);
    this.failed.set(false);

    const url = `/api/weather?country=${country}&lon=${point[0]}&lat=${point[1]}`;
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<Observation>;
      })
      .then((observation) => {
        if (mine !== this.token) return;
        this.observation.set(observation);
        this.loading.set(false);
      })
      .catch((error: unknown) => {
        console.error('[weather]', error);
        if (mine !== this.token) return;
        // Whatever was read before stays: an old observation with its hour
        // on display is still an observation.
        this.failed.set(true);
        this.loading.set(false);
      });
  }

  public clear(): void {
    this.token += 1;
    this.observation.set(null);
    this.loading.set(false);
    this.failed.set(false);
  }
}
