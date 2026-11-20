import { Component, computed, ElementRef, inject, signal } from '@angular/core';
import { HotspotsService } from '../map/hotspots.service';
import {
  isDay,
  labelOf,
  lastDays,
  MAX_RANGE_DAYS,
  PRESETS,
  presetOf,
  spanOf,
  today,
} from '../map/hotspot-range';

/**
 * Which dates the detections are from, next to which territory they are over.
 *
 * The two questions the portada's map answers are «where» and «when», and the
 * scope toggle had been answering the first one on its own since §2.9. The
 * second one had a constant for an answer —one day— which is right for «what
 * is burning» and has nothing to say about a fire that is over.
 *
 * Presets and dates in the same panel because they are the same question
 * asked at two scales: the four spans are what gets asked without a date in
 * mind, and August 2024 is a date. What leaves the panel is always a pair of
 * dates, and they go into the URL, never into this component.
 */
@Component({
  selector: 'app-range-picker',
  templateUrl: './range-picker.html',
  styleUrl: './range-picker.css',
})
export class RangePicker {
  private readonly hotspots = inject(HotspotsService);
  private readonly host = inject(ElementRef<HTMLElement>);

  protected readonly range = this.hotspots.range;
  protected readonly loading = this.hotspots.loading;
  protected readonly failed = this.hotspots.failed;
  protected readonly missingKey = this.hotspots.missingKey;
  protected readonly count = this.hotspots.countInScope;
  protected readonly earliest = this.hotspots.earliest;
  protected readonly open = signal(false);

  /**
   * The two fields, which are a draft and not the state.
   *
   * They start from whatever is on screen and only become the range when the
   * dates make one: typing a year goes through `1`, `20`, `202`, and a map
   * that reloaded on each of those would be asking FIRMS for the Middle Ages.
   */
  protected readonly from = signal(this.range().from);
  protected readonly to = signal(this.range().to);

  protected readonly presets = PRESETS;
  protected readonly maxDays = MAX_RANGE_DAYS;
  protected readonly today = today();
  protected readonly label = computed(() => labelOf(this.range()));
  protected readonly current = computed(() => presetOf(this.range()));

  /** Nothing when the draft is a range, and what is wrong with it when not. */
  protected readonly problem = computed(() => {
    const from = this.from();
    const to = this.to();
    if (!isDay(from) || !isDay(to)) return 'Falta una data.';
    if (from > to) return 'La data inicial és posterior a la final.';
    if (to > this.today) return 'No hi ha deteccions de dates futures.';
    const first = this.earliest();
    if (first && from < first) return `No hi ha dades anteriors al ${first}.`;
    const span = spanOf({ from, to });
    if (span > this.maxDays) return `Són ${span} dies i el màxim és ${this.maxDays}.`;
    return null;
  });

  protected toggle(): void {
    const open = !this.open();
    // Reopening starts again from what is on screen, so the panel never shows
    // a half-typed range from the last time it was used.
    if (open) {
      this.from.set(this.range().from);
      this.to.set(this.range().to);
    }
    this.open.set(open);
  }

  /** Closes when the focus leaves the control altogether, and not before. */
  protected leave(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && (this.host.nativeElement as HTMLElement).contains(next)) return;
    this.open.set(false);
  }

  protected key(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.open.set(false);
  }

  protected choosePreset(days: number): void {
    this.hotspots.choose(lastDays(days));
    this.open.set(false);
  }

  protected apply(): void {
    if (this.problem()) return;
    this.hotspots.choose({ from: this.from(), to: this.to() });
    this.open.set(false);
  }

  protected edit(which: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    (which === 'from' ? this.from : this.to).set(value);
    // A start date past the end is almost always a range being moved rather
    // than a mistake, so the other end follows instead of complaining.
    if (which === 'from' && value > this.to()) this.to.set(value);
    if (which === 'to' && value < this.from()) this.from.set(value);
  }
}
