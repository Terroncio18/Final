import {
  AREAS,
  AVAILABILITY_TTL_MS,
  FIRMS_AVAILABILITY,
  FIRMS_BASE,
  FIRMS_MAP_KEY,
  FIRMS_PLATFORMS,
  WINDOW_DAYS,
  type Scope,
} from './config.js';

/** One detection, with only the fields the interface is going to show. */
export interface HotspotProperties {
  /** Stable enough to key a feature on: no two platforms see the same pixel at the same second. */
  readonly id: string;
  readonly scope: Scope;
  /** Platform that saw it, as FIRMS writes it (`N`, `N20`, `N21`). */
  readonly satellite: string;
  /** Overpass time, UTC. FIRMS gives the date and the time apart; joining them here spares every reader the job. */
  readonly observedAt: string;
  /** Fire radiative power, in megawatts: how much energy the fire is releasing. */
  readonly frp: number;
  /** VIIRS codes confidence as a letter: low, nominal, high. */
  readonly confidence: 'l' | 'n' | 'h' | string;
  /** `D` or `N`. A night detection is more reliable: no sunglint. */
  readonly daynight: string;
}

export type HotspotCollection = {
  type: 'FeatureCollection';
  features: {
    type: 'Feature';
    id: string;
    geometry: { type: 'Point'; coordinates: [number, number] };
    properties: HotspotProperties;
  }[];
};

/** What one query answered with, beside the detections themselves. */
export interface HotspotAnswer {
  readonly body: HotspotCollection;
  /** The sources that actually covered the range, for the interface to name. */
  readonly sources: readonly string[];
}

/**
 * FIRMS answers errors in plain text with a 200 status —an invalid key included—
 * so the status code alone proves nothing. A real answer always carries the
 * column names, and that is what gets checked.
 */
function parseCsv(text: string, expected: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header || !header.includes(expected)) {
    throw new Error(`FIRMS did not return data: ${text.slice(0, 160)}`);
  }
  const columns = header.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    const row: Record<string, string> = {};
    columns.forEach((name, i) => (row[name] = cells[i] ?? ''));
    return row;
  });
}

/** `2026-07-18` plus `1312` becomes an instant. FIRMS times are UTC. */
function toIsoInstant(date: string, time: string): string {
  const padded = time.padStart(4, '0');
  return `${date}T${padded.slice(0, 2)}:${padded.slice(2, 4)}:00Z`;
}

/**
 * Dates are handled as `YYYY-MM-DD` strings and not as `Date` objects.
 *
 * It is the shape FIRMS speaks, the shape the URL carries and the shape that
 * compares correctly with `<`. A `Date` would bring a local timezone into a
 * question that has none: these are the dates of satellite overpasses, which
 * FIRMS publishes in UTC.
 */
export type Day = string;

export function addDays(day: Day, count: number): Day {
  const at = new Date(day + 'T00:00:00Z');
  at.setUTCDate(at.getUTCDate() + count);
  return at.toISOString().slice(0, 10);
}

export function daysBetween(from: Day, to: Day): number {
  const a = Date.parse(from + 'T00:00:00Z');
  const b = Date.parse(to + 'T00:00:00Z');
  return Math.round((b - a) / 86_400_000);
}

export function today(): Day {
  return new Date().toISOString().slice(0, 10);
}

/**
 * `2024-08-01` and nothing else: no `2024-8-1`, no instants, no text.
 *
 * And no day that does not exist. The shape is not enough on its own, because
 * `Date` rolls the 30th of February over to the 1st of March instead of
 * refusing it, so what is asked for is that the date written back out is the
 * one that came in.
 */
export function isDay(value: unknown): value is Day {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const at = new Date(value + 'T00:00:00Z');
  return !Number.isNaN(at.getTime()) && at.toISOString().slice(0, 10) === value;
}

interface Span {
  readonly min: Day;
  readonly max: Day;
}

let availabilityCache: { readonly table: Map<string, Span>; readonly fetchedAt: number } | null =
  null;

/**
 * Which dates each source holds, straight from FIRMS.
 *
 * This is the whole reason a range further back than a few months works at
 * all. Asking a NRT source for August 2024 does not fail loudly —it answers
 * with no rows— so without this table a historical query would look like a
 * month with no fires in it.
 *
 * Kept for six hours. A failure is not fatal: an empty table makes
 * `sourcesFor()` fall back to NRT, which is what the application asked for
 * before any of this existed and is right for the only range that matters
 * when FIRMS is having a bad day —today's.
 */
export async function availability(): Promise<Map<string, Span>> {
  const held = availabilityCache;
  if (held && Date.now() - held.fetchedAt < AVAILABILITY_TTL_MS) return held.table;

  try {
    const response = await fetch(`${FIRMS_AVAILABILITY}/${FIRMS_MAP_KEY}/ALL`);
    if (!response.ok) throw new Error(`FIRMS answered ${response.status}`);

    const table = new Map<string, Span>();
    for (const row of parseCsv(await response.text(), 'data_id')) {
      const id = row['data_id'];
      const min = row['min_date'];
      const max = row['max_date'];
      if (id && isDay(min) && isDay(max)) table.set(id, { min, max });
    }

    availabilityCache = { table, fetchedAt: Date.now() };
    return table;
  } catch (error) {
    console.warn('[firms] availability unreadable, assuming near real time —', error);
    return held?.table ?? new Map();
  }
}

/**
 * The source of each platform that covers a day, or none.
 *
 * SP is preferred wherever it reaches: it is the same observation after
 * reprocessing, which is the better of the two for anything that is not
 * happening right now. A platform that covers the day in neither processing
 * is simply absent from the answer —NOAA-21 flew nothing before 2023, and no
 * query should fail over that.
 */
export function sourcesFor(day: Day, table: Map<string, Span>): string[] {
  const covers = (source: string) => {
    const span = table.get(source);
    // No table means FIRMS could not be asked; see availability().
    return span ? day >= span.min && day <= span.max : null;
  };

  const sources: string[] = [];
  for (const platform of FIRMS_PLATFORMS) {
    const sp = covers(platform.sp);
    if (sp) {
      sources.push(platform.sp);
      continue;
    }
    const nrt = covers(platform.nrt);
    if (nrt || (sp === null && nrt === null)) sources.push(platform.nrt);
  }
  return sources;
}

/**
 * The first date any of the platforms holds, or nothing if FIRMS did not say.
 *
 * VIIRS went up in 2011 and the record starts in 2012; asking for 2005 comes
 * back empty, which on a map reads as «nothing burned» rather than «the
 * instrument was not in orbit». The interface bounds its date fields with
 * this so the question cannot be asked.
 */
export async function earliest(): Promise<Day | null> {
  const table = await availability();
  const starts = FIRMS_PLATFORMS.flatMap((platform) =>
    [platform.sp, platform.nrt].map((source) => table.get(source)?.min).filter(isDay),
  );
  return starts.length ? starts.reduce((first, day) => (day < first ? day : first), starts[0]!) : null;
}

/**
 * The range cut into what the API takes: runs of at most five days.
 *
 * Each window is a start date and a length, which is exactly the shape of the
 * two last segments of a FIRMS URL.
 */
export function windowsFor(from: Day, to: Day): { start: Day; days: number }[] {
  const windows: { start: Day; days: number }[] = [];
  const total = daysBetween(from, to) + 1;

  for (let offset = 0; offset < total; offset += WINDOW_DAYS) {
    windows.push({ start: addDays(from, offset), days: Math.min(WINDOW_DAYS, total - offset) });
  }

  return windows;
}

async function fetchWindow(
  source: string,
  area: (typeof AREAS)[number],
  start: Day,
  days: number,
  latest: boolean,
) {
  const box = `${area.west},${area.south},${area.east},${area.north}`;
  // The date is the last segment and it is optional: without it FIRMS answers
  // «the most recent data», which is not the same as asking for today —the
  // satellites are hours behind, and a date would hide what has not landed yet.
  const url = latest
    ? `${FIRMS_BASE}/${FIRMS_MAP_KEY}/${source}/${box}/${days}`
    : `${FIRMS_BASE}/${FIRMS_MAP_KEY}/${source}/${box}/${days}/${start}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`FIRMS answered ${response.status} for ${source}`);

  return parseCsv(await response.text(), 'latitude')
    .filter((row) => row['latitude'] && row['longitude'])
    .map((row) => {
      const lon = Number(row['longitude']);
      const lat = Number(row['latitude']);
      const observedAt = toIsoInstant(row['acq_date'] ?? '', row['acq_time'] ?? '');
      const satellite = row['satellite'] ?? '?';
      const id = `${satellite}-${observedAt}-${lat.toFixed(5)}-${lon.toFixed(5)}`;

      return {
        type: 'Feature' as const,
        id,
        geometry: { type: 'Point' as const, coordinates: [lon, lat] as [number, number] },
        properties: {
          id,
          scope: area.scope,
          satellite,
          observedAt,
          frp: Number(row['frp'] ?? 0),
          confidence: row['confidence'] ?? '',
          daynight: row['daynight'] ?? '',
        },
      };
    });
}

/**
 * Every platform over every area for every window of the range, in parallel.
 *
 * A platform that fails does not empty the map: its rejection is reported and
 * the rest is served. Only a complete failure throws, which is what lets the
 * caller fall back to the previous answer.
 *
 * A range of one day is one request per platform and area, which is what this
 * did before ranges existed. A month is seven, and they go out together: the
 * quota is 5.000 per ten minutes and the slow part is FIRMS's own latency, not
 * ours.
 *
 * Deduplicated by id, because the same overpass can arrive twice: a window
 * that straddles the day SP hands over to NRT asks both processings of the
 * same platform, and they overlap by design.
 */
export async function fetchHotspots(from: Day, to: Day): Promise<HotspotAnswer> {
  if (!FIRMS_MAP_KEY) throw new Error('FIRMS_MAP_KEY is not set');

  const table = await availability();
  const now = today();

  const jobs = windowsFor(from, to).flatMap((window) => {
    // The sources are chosen for the window's last day. Within five days the
    // two processings do not change hands more than once, and the overlap is
    // what the deduplication above is for.
    const sources = new Set([
      ...sourcesFor(window.start, table),
      ...sourcesFor(addDays(window.start, window.days - 1), table),
    ]);

    return AREAS.flatMap((area) =>
      [...sources].map((source) => ({
        source,
        area,
        task: fetchWindow(source, area, window.start, window.days, to === now && from === now),
      })),
    );
  });

  if (!jobs.length) return { body: { type: 'FeatureCollection', features: [] }, sources: [] };

  const results = await Promise.allSettled(jobs.map((job) => job.task));

  const features: HotspotCollection['features'] = [];
  const keys = new Set<string>();
  const answered = new Set<string>();
  const failures: string[] = [];

  for (const [i, result] of results.entries()) {
    const job = jobs[i]!;
    if (result.status === 'rejected') {
      failures.push(`${job.source}/${job.area.scope}: ${result.reason?.message}`);
      continue;
    }
    answered.add(job.source);
    for (const feature of result.value) {
      if (keys.has(feature.id)) continue;
      keys.add(feature.id);
      features.push(feature);
    }
  }

  if (failures.length === results.length) throw new Error(failures.join(' · '));
  if (failures.length) console.warn('[firms] partial answer —', failures.join(' · '));

  features.sort((a, b) => b.properties.frp - a.properties.frp);
  return { body: { type: 'FeatureCollection', features }, sources: [...answered].sort((a, b) => a.localeCompare(b)) };
}
