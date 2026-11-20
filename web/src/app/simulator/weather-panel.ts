import { Component, computed, inject, input, model, output } from '@angular/core';
import type { SpreadResult } from '../simulation/fire-spread';
import type { Point } from '../simulation/point';
import { Icon } from './icon';
import { WeatherService } from './weather.service';

/** The eight points of the compass, for naming a bearing. */
const DIRECTIONS = [
  { degrees: 0, short: 'N', name: 'nord' },
  { degrees: 45, short: 'NE', name: 'nord-est' },
  { degrees: 90, short: 'E', name: 'est' },
  { degrees: 135, short: 'SE', name: 'sud-est' },
  { degrees: 180, short: 'S', name: 'sud' },
  { degrees: 225, short: 'SO', name: 'sud-oest' },
  { degrees: 270, short: 'O', name: 'oest' },
  { degrees: 315, short: 'NO', name: 'nord-oest' },
] as const;

/** The point of the compass a bearing is nearest to. */
export function compass(degrees: number): (typeof DIRECTIONS)[number] {
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return DIRECTIONS[index];
}

/** How full a range's track is painted, as a percentage. */
export function trackFill(value: number, min: number, max: number): string {
  // Clamped: a station can report 97 % of humidity or 8 °C, outside what the
  // sliders offer, and the track must not paint past its own ends.
  const share = Math.min(Math.max((value - min) / (max - min), 0), 1);
  return `${share * 100}%`;
}

/** The weather in force, as the console works it out (SimulatorView.now). */
export interface WeatherNow {
  wind: number;
  fromDeg: number;
  towardsDeg: number;
  humidity: number;
  temperature: number;
  temperatureText: string;
}

/** A change of wind in the run, as the list under the slider says it. */
export interface WindRow {
  startMin: number;
  speedKmh: number;
  fromDeg: number;
  time: string;
  origin: string;
  pending: boolean;
}

/** A change to the wind asked for from the dial, the keyboard or the slider. */
export type WindEdit = Partial<{ speedKmh: number; fromDeg: number }>;

/**
 * The «Meteorologia» block of the configuration column.
 *
 * The weather is the console's and not this block's: it is what the model is
 * given, and the fire, the scenario file and the analysis column read it too.
 * So the values come in —the weather in force already worked out— and what
 * is set here goes back out: the mode, the humidity, the temperature and the
 * pending change as two-way inputs, and a change of wind as an event, because
 * what that means —a value before a run, a pending change over one— is the
 * console's to say. What is this block's own is the live card and the compass.
 */
@Component({
  selector: 'app-weather-panel',
  imports: [Icon],
  templateUrl: './weather-panel.html',
  styleUrls: ['./config-section.css', './weather-panel.css'],
})
export class WeatherPanel {
  public readonly weatherMode = model.required<'live' | 'manual'>();
  public readonly humidity = model.required<number>();
  public readonly temperature = model.required<number>();
  /** A change of wind over a computed fire, waiting to be applied. */
  public readonly windDraft = model.required<{ speedKmh: number; fromDeg: number } | null>();

  public readonly now = input.required<WeatherNow>();
  public readonly windRows = input.required<readonly WindRow[]>();
  public readonly result = input.required<SpreadResult | null>();
  public readonly computing = input.required<boolean>();
  public readonly canStart = input.required<boolean>();
  public readonly elapsed = input.required<string>();
  /** Which state service speaks for the domain: the first segment of the address says. */
  public readonly country = input.required<'ES' | 'PT'>();
  public readonly centre = input.required<Point | null>();

  public readonly windEdit = output<WindEdit>();
  public readonly applyWind = output();

  private readonly weather = inject(WeatherService);

  protected readonly fill = trackFill;
  protected readonly weatherLoading = this.weather.loading;

  /** Where the wind comes from, by name: a station reports 183° and that is «sud». */
  protected readonly from = computed(() => compass(this.now().fromDeg));

  /** «del nord», but «de l'est» and «de l'oest»: the article gives way to a vowel. */
  protected readonly fromPhrase = computed(() => {
    const { name } = this.from();
    return /^[eo]/.test(name) ? `de l'${name}` : `del ${name}`;
  });

  /**
   * Where the wind takes the fire. Spelled out because the two readings of
   * «vent del nord-oest» are 180° apart and only one of them is the fire's.
   */
  protected readonly towards = computed(() => compass(this.now().towardsDeg));

  /**
   * Who would be asked for the weather here: the country decides.
   *
   * AEMET for Spain and IPMA for Portugal, each the state service of its
   * side of the border (§5).
   */
  protected readonly weatherSource = computed(() =>
    this.country() === 'PT'
      ? { name: 'IPMA', short: "l'IPMA" }
      : { name: 'AEMET OpenData', short: "l'AEMET" },
  );

  /** The station that is speaking for the domain, in the words the card uses. */
  protected readonly station = computed(() => {
    const seen = this.weather.observation();
    if (!seen) return null;
    const when = new Intl.DateTimeFormat('ca-ES', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(seen.observedAt));
    return {
      name: seen.station.name,
      distance:
        new Intl.NumberFormat('ca-ES', { maximumFractionDigits: 1 }).format(seen.distanceKm) +
        ' km',
      observedAt: `${when} UTC`,
    };
  });

  /**
   * What the live card says about itself: a tag and a sentence.
   *
   * Four states and each one says what the figures below are, because that is
   * the one thing this card must never leave unsaid: an observation, an old
   * observation, or the manual values standing in for one.
   */
  protected readonly liveState = computed(() => {
    const seen = this.weather.observation();
    const service = this.weatherSource().short;
    if (this.weather.loading() && !seen) {
      return { tag: 'LLEGINT', warn: false, note: `Demanant l'observació a ${service}…` };
    }
    if (!seen) {
      return {
        tag: 'SENSE CONNEXIÓ',
        warn: true,
        note: `No s'ha pogut llegir ${service}. Els valors de sota són els manuals i no una observació.`,
      };
    }
    if (this.weather.failed() || seen.stale) {
      return {
        tag: 'DADA ANTIGA',
        warn: true,
        note: `${service} no respon ara: es manté la darrera observació llegida.`,
      };
    }
    return {
      tag: 'EN DIRECTE',
      warn: false,
      note: 'Una sola estació parla per tot el domini: la més propera al centre, sense interpolar.',
    };
  });

  protected setNumber(which: 'wind' | 'humidity' | 'temperature', event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    if (this.computing()) return;
    if (which === 'wind') this.windEdit.emit({ speedKmh: value });
    else ({ humidity: this.humidity, temperature: this.temperature })[which].set(value);
  }

  /**
   * Turns the compass with the pointer: the needle follows it.
   *
   * The needle points where the wind **goes**, so the angle under the pointer
   * is that, and the bearing kept is the opposite one, where it comes from.
   * In steps of five degrees: finer than that is more than a hand on a 92 px
   * dial can mean, and more than one station can tell.
   */
  protected turnWind(event: PointerEvent): void {
    if (this.computing() || (this.weatherMode() === 'live' && !this.result())) return;
    const dial = event.currentTarget as HTMLElement;
    if (event.type === 'pointerdown') {
      // Captured, so the drag carries on outside the dial. A pointer that is
      // not a live one —a scripted event— cannot be captured, and then the
      // press still sets the direction; only the drag is lost.
      try {
        dial.setPointerCapture(event.pointerId);
      } catch {
        /* nothing to follow */
      }
      dial.focus();
    } else if (!dial.hasPointerCapture(event.pointerId)) {
      return;
    }
    const box = dial.getBoundingClientRect();
    const east = event.clientX - (box.left + box.width / 2);
    const south = event.clientY - (box.top + box.height / 2);
    // Too close to the pivot the angle is noise.
    if (Math.hypot(east, south) < 6) return;
    const towards = (Math.atan2(east, -south) * 180) / Math.PI;
    this.windEdit.emit({ fromDeg: (((Math.round(towards / 5) * 5 + 180) % 360) + 360) % 360 });
  }

  /** The same with the keyboard: arrows by five degrees, page keys by a point. */
  protected nudgeWind(event: KeyboardEvent): void {
    if (this.computing() || (this.weatherMode() === 'live' && !this.result())) return;
    const steps: Record<string, number> = {
      ArrowRight: 5,
      ArrowUp: 5,
      ArrowLeft: -5,
      ArrowDown: -5,
      PageUp: 45,
      PageDown: -45,
    };
    const step = steps[event.key];
    if (step === undefined && event.key !== 'Home') return;
    event.preventDefault();
    this.windEdit.emit({
      fromDeg: event.key === 'Home' ? 0 : (this.now().fromDeg + step + 360) % 360,
    });
  }

  /** Asks the station again; the console asks on its own on entering the mode. */
  protected refreshWeather(): void {
    const centre = this.centre();
    if (centre) this.weather.load(this.country(), centre);
  }
}
