import { Component, computed, inject, input, model, output } from '@angular/core';
import type { SpreadResult } from '../simulation/fire-spread';
import type { Point } from '../simulation/point';
import { Icon } from './icon';
import { WeatherService } from './weather.service';

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

export function compass(degrees: number): (typeof DIRECTIONS)[number] {
  const index = Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
  return DIRECTIONS[index];
}

export function trackFill(value: number, min: number, max: number): string {
  // Live station readings can exceed slider bounds; clamp only the painted track.
  const share = Math.min(Math.max((value - min) / (max - min), 0), 1);
  return `${share * 100}%`;
}

export interface WeatherNow {
  wind: number;
  fromDeg: number;
  towardsDeg: number;
  humidity: number;
  temperature: number;
  temperatureText: string;
}

export interface WindRow {
  startMin: number;
  speedKmh: number;
  fromDeg: number;
  time: string;
  origin: string;
  pending: boolean;
}

/** A wind: how fast it blows and where it comes from. */
export interface WindValues {
  readonly speedKmh: number;
  readonly fromDeg: number;
}

/** One half of a wind, as the dial and the slider each send it. */
export type WindEdit = Partial<WindValues>;

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

  public readonly windDraft = model.required<WindValues | null>();

  public readonly now = input.required<WeatherNow>();
  public readonly windRows = input.required<readonly WindRow[]>();
  public readonly result = input.required<SpreadResult | null>();
  public readonly computing = input.required<boolean>();
  public readonly canStart = input.required<boolean>();
  public readonly elapsed = input.required<string>();

  public readonly country = input.required<'ES' | 'PT'>();
  public readonly centre = input.required<Point | null>();

  public readonly windEdit = output<WindEdit>();
  public readonly applyWind = output();

  private readonly weather = inject(WeatherService);

  protected readonly fill = trackFill;
  protected readonly weatherLoading = this.weather.loading;

  // Only an observation asked of this country and centre describes the domain on screen.
  private readonly seen = computed(() =>
    this.weather.observationFor(this.country(), this.centre()),
  );

  protected readonly from = computed(() => compass(this.now().fromDeg));

  // Catalan contracts the article before est and oest.
  protected readonly fromPhrase = computed(() => {
    const { name } = this.from();
    return /^[eo]/.test(name) ? `de l'${name}` : `del ${name}`;
  });

  // Wind-from and spread-towards bearings differ by 180°.
  protected readonly towards = computed(() => compass(this.now().towardsDeg));

  protected readonly weatherSource = computed(() =>
    this.country() === 'PT'
      ? { name: 'IPMA', short: "l'IPMA" }
      : { name: 'AEMET OpenData', short: "l'AEMET" },
  );

  protected readonly station = computed(() => {
    const seen = this.seen();
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

  protected readonly liveState = computed(() => {
    const seen = this.seen();
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

  // The dial points towards; store the opposite wind-from bearing, rounded to 5°.
  protected turnWind(event: PointerEvent): void {
    if (this.computing() || (this.weatherMode() === 'live' && !this.result())) return;
    const dial = event.currentTarget as HTMLElement;
    if (event.type === 'pointerdown') {
      // Capture the pointer to continue dragging outside the dial. Synthetic events may reject
      // capture but still set the initial direction.
      try {
        dial.setPointerCapture(event.pointerId);
      } catch {
        // Rejected capture is fine; the direction is still set above.
      }
      dial.focus();
    } else if (!dial.hasPointerCapture(event.pointerId)) {
      return;
    }
    const box = dial.getBoundingClientRect();
    const east = event.clientX - (box.left + box.width / 2);
    const south = event.clientY - (box.top + box.height / 2);
    // Angles near the dial pivot are unstable.
    if (Math.hypot(east, south) < 6) return;
    const towards = (Math.atan2(east, -south) * 180) / Math.PI;
    this.windEdit.emit({ fromDeg: (((Math.round(towards / 5) * 5 + 180) % 360) + 360) % 360 });
  }

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

  protected refreshWeather(): void {
    const centre = this.centre();
    if (centre) this.weather.load(this.country(), centre);
  }
}
