import type { MapService } from '../map/map.service';
import { domainAround } from '../simulation/domain';
import { frontEmitters } from '../simulation/fire-emitters';
import type { SpreadResult } from '../simulation/fire-spread';
import type { FireSurface } from '../simulation/fire-surface';
import type { Point } from '../simulation/point';

interface AnimationWeather {
  readonly towardsDeg: number;
  readonly wind: number;
}

interface FireAnimationInput {
  readonly result: SpreadResult;
  readonly centre: Point;
  readonly elevation: Float32Array;
  readonly heatAt: (cell: number, minute: number) => number;
  readonly minute: () => number;
  readonly forecast: () => boolean;
  readonly weather: () => AnimationWeather;
}

export class FireAnimation {
  private frame = 0;
  private last = 0;
  private lastPaint = -Infinity;
  private lastEmitters = -Infinity;
  private visualSeconds = 0;
  private emittersMinute = Number.NaN;
  private previousMinute = Number.NaN;
  private paintedMinute = Number.NaN;
  private paintedScale: number | undefined;
  private paintedForecast: boolean | undefined;
  private motionWas: boolean | undefined;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly bounds: ReturnType<typeof domainAround>;

  public constructor(
    private readonly maps: MapService,
    private readonly painter: FireSurface,
    private readonly input: FireAnimationInput,
  ) {
    this.bounds = domainAround(input.centre);
  }

  public start(): void {
    this.painter.paint(this.input.minute(), 0, this.input.forecast(), this.scale());
    this.maps.setFire(this.painter.canvas, this.painter.bounds(this.bounds));
    this.last = performance.now();
    this.draw(performance.now());
  }

  public redraw(minute: number, forecast: boolean): void {
    const weather = this.input.weather();
    this.painter.paint(
      minute,
      this.reduced.matches ? 0 : this.visualSeconds,
      forecast,
      this.scale(),
    );
    this.maps.refreshFire();
    this.maps.resetFireParticles();
    this.updateParticles(minute, weather);
    this.paintedMinute = minute;
    this.paintedForecast = forecast;
  }

  public dispose(): void {
    cancelAnimationFrame(this.frame);
    this.maps.setFireParticles(null);
    this.maps.setFire(null);
    this.painter.dispose();
  }

  private readonly nextFrame = (now: number): void => this.draw(now);

  private scale(): number | undefined {
    return this.maps.metresPerPixel() ?? undefined;
  }

  private changedSincePaint(
    minute: number,
    metres: number | undefined,
    forecast: boolean,
    motion: boolean,
  ): boolean {
    return (
      minute !== this.paintedMinute ||
      metres !== this.paintedScale ||
      forecast !== this.paintedForecast ||
      motion !== this.motionWas
    );
  }

  private draw(now: number): void {
    const dt = Math.min(Math.max((now - this.last) / 1000, 0), 0.1);
    this.last = now;
    const motion = !this.reduced.matches;
    if (!document.hidden) {
      if (motion) this.visualSeconds += dt;
      const minute = this.input.minute();
      const forecast = this.input.forecast();
      const metres = this.scale();
      const jumped =
        Number.isFinite(this.previousMinute) &&
        (minute < this.previousMinute || minute - this.previousMinute > 3);
      if (
        now - this.lastPaint >= 33 &&
        (motion || this.changedSincePaint(minute, metres, forecast, motion))
      ) {
        this.paint(minute, motion, forecast, metres, now);
      }
      if (minute !== this.emittersMinute && (now - this.lastEmitters >= 100 || jumped)) {
        const weather = this.input.weather();
        if (jumped) this.maps.resetFireParticles();
        this.updateParticles(minute, weather);
        this.lastEmitters = now;
      }
      this.maps.setFireMotion(motion);
      this.motionWas = motion;
      this.previousMinute = minute;
    }
    this.frame = requestAnimationFrame(this.nextFrame);
  }

  private paint(
    minute: number,
    motion: boolean,
    forecast: boolean,
    metres: number | undefined,
    now: number,
  ): void {
    this.painter.paint(minute, motion ? this.visualSeconds : 0, forecast, metres);
    this.maps.refreshFire();
    this.lastPaint = now;
    this.paintedMinute = minute;
    this.paintedScale = metres;
    this.paintedForecast = forecast;
  }

  private updateParticles(minute: number, weather: AnimationWeather): void {
    this.maps.setFireParticles(
      frontEmitters(
        this.input.result.arrival,
        this.input.elevation,
        minute,
        this.bounds,
        this.input.heatAt,
      ),
      weather.towardsDeg,
      weather.wind,
    );
    this.emittersMinute = minute;
  }
}
