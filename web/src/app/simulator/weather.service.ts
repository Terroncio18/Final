import { Injectable, signal } from '@angular/core';
import type { Point } from '../simulation/point';

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
  // Station distance in kilometres.
  readonly distanceKm: number;
  /** True when the service failed and this is the last answer it gave. */
  readonly stale: boolean;
}

// What an observation was asked about: the provider's country and the centre of the domain. The
// centre comes from the route, so two readings of the same domain compare equal.
interface Domain {
  readonly country: 'ES' | 'PT';
  readonly lon: number;
  readonly lat: number;
}

interface Reading {
  readonly domain: Domain;
  readonly observation: Observation;
}

function domainOf(country: 'ES' | 'PT', point: Point): Domain {
  return { country, lon: point[0], lat: point[1] };
}

function sameDomain(one: Domain, other: Domain): boolean {
  return one.country === other.country && one.lon === other.lon && one.lat === other.lat;
}

// The server keeps the AEMET key out of the browser and normalizes both providers. Only the newest
// request may publish, and only for the domain it asked about.
@Injectable({ providedIn: 'root' })
export class WeatherService {
  public readonly loading = signal(false);
  public readonly failed = signal(false);

  private readonly reading = signal<Reading | null>(null);

  private asked: Domain | null = null;
  private token = 0;

  public load(country: 'ES' | 'PT', point: Point): void {
    const domain = domainOf(country, point);
    const mine = (this.token += 1);
    // A station of another domain describes neither its weather nor its country, not even while
    // the new reading is on its way.
    if (!this.asked || !sameDomain(this.asked, domain)) {
      this.asked = domain;
      this.reading.set(null);
    }
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
        this.reading.set({ domain, observation });
        this.loading.set(false);
      })
      .catch((error: Error) => {
        console.error('[weather]', error);
        if (mine !== this.token) return;
        // Retain the last dated observation when a refresh of the same domain fails.
        this.failed.set(true);
        this.loading.set(false);
      });
  }

  // Callers name the domain they are showing, so an answer reaches only the domain it belongs to.
  public observationFor(country: 'ES' | 'PT', point: Point | null): Observation | null {
    const reading = this.reading();
    if (!reading || !point) return null;
    return sameDomain(reading.domain, domainOf(country, point)) ? reading.observation : null;
  }

  public clear(): void {
    this.token += 1;
    this.asked = null;
    this.reading.set(null);
    this.loading.set(false);
    this.failed.set(false);
  }
}
