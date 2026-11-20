import type { Params } from '@angular/router';

// FIRMS and the URL use UTC calendar dates; strings avoid local-time conversion.
export interface Range {
  readonly from: string;
  readonly to: string;
}

export const MAX_RANGE_DAYS = 31;

export const PRESETS = [1, 3, 7, 30] as const;
export type PresetDays = (typeof PRESETS)[number];

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(day: string, count: number): string {
  const at = new Date(day + 'T00:00:00Z');
  at.setUTCDate(at.getUTCDate() + count);
  return at.toISOString().slice(0, 10);
}

export function spanOf(range: Range): number {
  const from = Date.parse(range.from + 'T00:00:00Z');
  const to = Date.parse(range.to + 'T00:00:00Z');
  return Math.round((to - from) / 86_400_000) + 1;
}

export function lastDays(days: number): Range {
  const to = today();
  return { from: addDays(to, 1 - days), to };
}

export function defaultRange(): Range {
  return lastDays(1);
}

export function isDay(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export function sameRange(a: Range, b: Range): boolean {
  return a.from === b.from && a.to === b.to;
}

export function presetOf(range: Range): PresetDays | null {
  if (range.to !== today()) return null;
  const span = spanOf(range);
  return PRESETS.find((preset) => preset === span) ?? null;
}

const DATES = new Intl.DateTimeFormat('ca-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function labelOf(range: Range): string {
  const preset = presetOf(range);
  if (preset === 1) return 'Avui';
  if (preset) return `Darrers ${preset} dies`;

  const from = new Date(range.from + 'T00:00:00Z');
  const to = new Date(range.to + 'T00:00:00Z');
  return DATES.formatRange(from, to);
}

export function rangeFrom(params: Params): Range {
  const from = params['des'] as string | undefined;
  const to = params['fins'] as string | undefined;
  if (!isDay(from) || !isDay(to) || from > to) return defaultRange();
  if (to > today() || spanOf({ from, to }) > MAX_RANGE_DAYS) return defaultRange();
  return { from, to };
}

export function paramsFor(range: Range): Params {
  if (sameRange(range, defaultRange())) return { des: null, fins: null };
  return { des: range.from, fins: range.to };
}
