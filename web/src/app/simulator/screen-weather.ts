import { computed, signal } from '@angular/core';
import type { Point } from '../simulation/point';
import { SCENARIO_DEFAULTS } from '../simulation/scenario';
import { parseWindChanges, windAt, type WindChange } from '../simulation/wind';
import type { WeatherService } from './weather.service';
import type { WindValues } from './weather-panel';

/** The weather a scenario carries, in the file's own fields. */
export interface WeatherScenario {
  readonly wind: number;
  readonly windFrom: number;
  readonly humidity: number;
  readonly temperature: number;
  readonly windChanges?: readonly WindChange[];
}

// What this state needs to know about the screen around it: which service answers for the domain,
// which centre is being asked about, and the minute the timeline is showing.
export interface WeatherDomain {
  readonly country: () => 'ES' | 'PT';
  readonly centre: () => Point | null;
  readonly minute: () => number;
}

// Wind-from and spread-towards bearings differ by 180°.
function turning(speedKmh: number, fromDeg: number) {
  return { wind: speedKmh, fromDeg, towardsDeg: (fromDeg + 180) % 360 };
}

// The weather of the console: the values the user sets, the live observation that replaces them
// while it belongs to the domain on screen, and the changes of wind along the timeline.
export class ScreenWeather {
  public readonly mode = signal<'live' | 'manual'>('manual');

  public readonly wind = signal(SCENARIO_DEFAULTS.wind);
  public readonly fromDeg = signal(SCENARIO_DEFAULTS.windFrom);
  public readonly humidity = signal(SCENARIO_DEFAULTS.humidity);
  public readonly temperature = signal(SCENARIO_DEFAULTS.temperature);

  public readonly changes = signal<readonly WindChange[]>([]);
  public readonly draft = signal<WindValues | null>(null);

  // What a run starts from: a station of this domain while live, the manual values otherwise.
  public readonly base = computed(() => {
    const seen =
      this.mode() === 'live'
        ? this.observations.observationFor(this.domain.country(), this.domain.centre())
        : null;
    const wind = seen ? Math.round(seen.windKmh) : this.wind();
    const fromDeg = seen ? seen.windFromDeg : this.fromDeg();
    const temperature = seen ? seen.temperature : this.temperature();
    return {
      live: seen !== null,
      ...turning(wind, fromDeg),
      humidity: seen ? Math.round(seen.humidity) : this.humidity(),
      temperature,
      temperatureText: new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(
        temperature,
      ),
    };
  });

  // The weather blowing at the minute on screen, after the changes that have already arrived.
  public readonly active = computed(() => {
    const base = this.base();
    const change = windAt(this.changes(), this.domain.minute());
    return change ? { ...base, ...turning(change.speedKmh, change.fromDeg) } : base;
  });

  // What the console shows: an unapplied edit of the wind takes precedence over everything.
  public readonly now = computed(() => {
    const active = this.active(),
      draft = this.draft();
    return draft ? { ...active, ...turning(draft.speedKmh, draft.fromDeg) } : active;
  });

  public constructor(
    private readonly observations: WeatherService,
    private readonly domain: WeatherDomain,
  ) {}

  // Ask the provider of this country about this centre; manual weather needs no observation.
  public readLive(): void {
    const centre = this.domain.centre();
    if (this.mode() !== 'live' || !centre) return;
    this.observations.load(this.domain.country(), centre);
  }

  // Before a run, editing the wind sets the weather the run will start from.
  public setInitial(values: WindValues): void {
    this.wind.set(values.speedKmh);
    this.fromDeg.set(values.fromDeg);
    this.changes.update((items) => items.filter((change) => change.startMin !== 0));
  }

  // After a run, the same edit becomes a change at the paused minute. Returns why it cannot be.
  public withChangeAt(values: WindValues, minute: number): readonly WindChange[] | string {
    return parseWindChanges(
      [
        ...this.changes().filter((change) => change.startMin !== minute),
        { ...values, startMin: minute },
      ].sort((a, b) => a.startMin - b.startMin),
    );
  }

  public restore(scenario: WeatherScenario): void {
    this.mode.set('manual');
    this.changes.set(scenario.windChanges ?? []);
    this.wind.set(scenario.wind);
    this.fromDeg.set(scenario.windFrom);
    this.humidity.set(scenario.humidity);
    this.temperature.set(scenario.temperature);
  }

  // A scenario stores whole degrees and whole km/h, whether they were read or set by hand.
  public snapshot(): WeatherScenario {
    const base = this.base();
    return {
      wind: Math.round(base.wind),
      windFrom: Math.round(base.fromDeg),
      humidity: Math.round(base.humidity),
      temperature: Math.round(base.temperature),
      windChanges: this.changes(),
    };
  }

  public release(): void {
    this.observations.clear();
  }
}
