import type { Params } from '@angular/router';

/**
 * The dates the detections on screen are from, both ends included.
 *
 * `YYYY-MM-DD` strings and not `Date` objects, for the same reason the server
 * uses them: it is what FIRMS speaks, what the URL carries, and what compares
 * correctly with `<`. A `Date` would bring a local timezone into a question
 * that has none —satellite overpasses are published in UTC.
 */
export interface Range {
  readonly from: string;
  readonly to: string;
}

/** The server's ceiling too, and for the reasons written there. */
export const MAX_RANGE_DAYS = 31;

/**
 * The spans a click can ask for, in days ending today.
 *
 * Four, because they are the questions that get asked without a date in mind:
 * what is burning now, what the weekend left, the week, the month. Anything
 * else is a date, and that is what the two fields beside them are for.
 */
export const PRESETS = [1, 3, 7, 30] as const;

/** FIRMS publishes in UTC, so «today» is today there. */
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

/** What the portada opens on, and §2.9's «active fires»: what burned today. */
export function defaultRange(): Range {
  return lastDays(1);
}

export function isDay(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !isNaN(Date.parse(value));
}

export function sameRange(a: Range, b: Range): boolean {
  return a.from === b.from && a.to === b.to;
}

/**
 * The preset a range *is*, or nothing when it is a pair of dates.
 *
 * Asked of the range and not remembered as a choice, because the URL carries
 * dates and not «seven days»: a link has to reopen the same map next month,
 * and a preset would quietly mean a different week. The button still reads
 * «Darrers 7 dies» while that is what the dates say, which is the one place
 * the two descriptions agree.
 */
export function presetOf(range: Range): number | null {
  if (range.to !== today()) return null;
  const span = spanOf(range);
  return (PRESETS as readonly number[]).includes(span) ? span : null;
}

const DATES = new Intl.DateTimeFormat('ca-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `Darrers 7 dies`, `Avui`, `1–31 d'agost de 2024`, `22 d'agost de 2024`. */
export function labelOf(range: Range): string {
  const preset = presetOf(range);
  if (preset === 1) return 'Avui';
  if (preset) return `Darrers ${preset} dies`;

  const from = new Date(range.from + 'T00:00:00Z');
  const to = new Date(range.to + 'T00:00:00Z');
  // formatRange collapses what the two dates share —one month, one year— so a
  // whole month comes out as «1–31 d'agost de 2024» and not twice over.
  return DATES.formatRange(from, to);
}

/**
 * The range a URL is asking for, or the default when it asks for none.
 *
 * Anything unreadable is the default and not an error: a hand-edited address
 * should land on the portada, not on a complaint.
 */
export function rangeFrom(params: Params): Range {
  const from = params['des'] as string | undefined;
  const to = params['fins'] as string | undefined;
  if (!isDay(from) || !isDay(to) || from > to) return defaultRange();
  if (to > today() || spanOf({ from, to }) > MAX_RANGE_DAYS) return defaultRange();
  return { from, to };
}

/**
 * What to put in the address bar for a range, nulls included.
 *
 * The default writes nothing: `/peninsula` is the portada, and it should not
 * grow two parameters saying «today» the first time somebody opens the picker
 * and closes it again.
 */
export function paramsFor(range: Range): Params {
  if (sameRange(range, defaultRange())) return { des: null, fins: null };
  return { des: range.from, fins: range.to };
}
