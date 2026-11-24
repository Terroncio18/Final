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

type PresetDays = (typeof PRESETS)[number];

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
  protected readonly partial = this.hotspots.partial;
  protected readonly stale = this.hotspots.stale;
  protected readonly count = this.hotspots.countInScope;
  protected readonly earliest = this.hotspots.earliest;
  protected readonly open = signal(false);

  protected readonly from = signal(this.range().from);
  protected readonly to = signal(this.range().to);

  protected readonly presets = PRESETS;
  protected readonly maxDays = MAX_RANGE_DAYS;
  protected readonly label = computed(() => labelOf(this.range()));
  protected readonly current = computed(() => presetOf(this.range()));

  protected readonly problem = computed(() => {
    const from = this.from();
    const to = this.to();
    if (!isDay(from) || !isDay(to)) return 'Falta una data.';
    if (from > to) return 'La data inicial és posterior a la final.';
    if (to > this.maxDay()) return 'No hi ha deteccions de dates futures.';
    const first = this.earliest();
    if (first && from < first) return `No hi ha dades anteriors al ${first}.`;
    const span = spanOf({ from, to });
    if (span > this.maxDays) return `Són ${span} dies i el màxim és ${this.maxDays}.`;
    return null;
  });

  protected toggle(): void {
    const open = !this.open();
    // Reopening discards incomplete edits and starts from the applied range.
    if (open) {
      this.from.set(this.range().from);
      this.to.set(this.range().to);
    }
    this.open.set(open);
  }

  protected leave(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && this.host.nativeElement.contains(next)) return;
    this.open.set(false);
  }

  protected key(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.open.set(false);
  }

  // Read when used, not when the component is built: past midnight UTC a captured day would hold
  // the calendar and the validation back to yesterday.
  protected maxDay(): string {
    return today();
  }

  // Also read when used: an age captured once would freeze while the panel stays open.
  protected age(): string | null {
    const at = this.hotspots.fetchedAt();
    if (!at) return null;
    const minutes = Math.floor((Date.now() - Date.parse(at)) / 60_000);
    if (!Number.isFinite(minutes) || minutes < 0) return null;
    if (minutes < 60) return `fa ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return hours < 24 ? `fa ${hours} h` : `fa ${Math.floor(hours / 24)} dies`;
  }

  protected retry(): void {
    this.hotspots.retry();
  }

  protected choosePreset(days: PresetDays): void {
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
    // Keep the range valid while either boundary is moved past the other.
    if (which === 'from' && value > this.to()) this.to.set(value);
    if (which === 'to' && value < this.from()) this.from.set(value);
  }
}
