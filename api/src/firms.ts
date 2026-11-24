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
import type { JsonValue } from './json-value.js';

type Satellite = 'N' | 'N20' | 'N21' | '?';
type Confidence = 'l' | 'n' | 'h' | '';
type DayNight = 'D' | 'N' | '';
export type FirmsSource = (typeof FIRMS_PLATFORMS)[number]['nrt' | 'sp'];

interface HotspotProperties {
  // Detection ids distinguish platform, pixel and overpass time.
  readonly id: string;
  readonly scope: Scope;

  readonly satellite: Satellite;
  // Overpass time, UTC, ISO 8601.
  readonly observedAt: string;
  // Fire radiative power, in megawatts.
  readonly frp: number;
  // VIIRS confidence: l low, n nominal, h high.
  readonly confidence: Confidence;
  // D day / N night. Night detections avoid sunglint.
  readonly daynight: DayNight;
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

interface HotspotAnswer {
  readonly body: HotspotCollection;
  readonly sources: readonly FirmsSource[];
  readonly missing: readonly string[];
}

// FIRMS can return errors with HTTP 200; the CSV header distinguishes data from an error.
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

function satelliteCode(value: string | undefined): Satellite {
  return value === 'N' || value === 'N20' || value === 'N21' ? value : '?';
}

function confidenceCode(value: string | undefined): Confidence {
  return value === 'l' || value === 'n' || value === 'h' ? value : '';
}

function dayNightCode(value: string | undefined): DayNight {
  return value === 'D' || value === 'N' ? value : '';
}

function toIsoInstant(date: string | undefined, time: string | undefined): string | null {
  if (!isDay(date) || !time || !/^\d{1,4}$/.test(time)) return null;
  const padded = time.padStart(4, '0');
  const hour = Number(padded.slice(0, 2));
  const minute = Number(padded.slice(2, 4));
  if (hour > 23 || minute > 59) return null;
  return `${date}T${padded.slice(0, 2)}:${padded.slice(2, 4)}:00Z`;
}

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

export function isDay(value: JsonValue | undefined): value is Day {
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

// Out-of-coverage NRT queries return empty rows rather than an error. Cache availability so
// historical emptiness is not misread as no fires; on lookup failure fall back to NRT.
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

// Prefer reprocessed SP data where available; omit platforms that cover the day in neither.
export function sourcesFor(day: Day, table: Map<string, Span>): FirmsSource[] {
  const covers = (source: FirmsSource) => {
    const span = table.get(source);

    return span ? day >= span.min && day <= span.max : null;
  };

  const sources: FirmsSource[] = [];
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

// Expose the oldest available date so the UI cannot query years before the instrument record.
export async function earliest(): Promise<Day | null> {
  const table = await availability();
  const starts = FIRMS_PLATFORMS.flatMap((platform) =>
    [platform.sp, platform.nrt].map((source) => table.get(source)?.min).filter(isDay),
  );
  return starts.length
    ? starts.reduce((first, day) => (day < first ? day : first), starts[0]!)
    : null;
}

// FIRMS accepts windows of at most five days, expressed as start date plus length.
export function windowsFor(from: Day, to: Day): { start: Day; days: number }[] {
  const windows: { start: Day; days: number }[] = [];
  const total = daysBetween(from, to) + 1;

  for (let offset = 0; offset < total; offset += WINDOW_DAYS) {
    windows.push({ start: addDays(from, offset), days: Math.min(WINDOW_DAYS, total - offset) });
  }

  return windows;
}

function finiteNumber(value: string | undefined): number | null {
  if (value === undefined || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function detectionFrom(
  row: Readonly<Record<string, string>>,
  scope: Scope,
): HotspotCollection['features'][number] | null {
  const lon = finiteNumber(row['longitude']);
  const lat = finiteNumber(row['latitude']);
  const frp = finiteNumber(row['frp']);
  if (lon === null || lat === null || frp === null) return null;
  if (Math.abs(lon) > 180 || Math.abs(lat) > 90 || frp < 0) return null;
  const observedAt = toIsoInstant(row['acq_date'], row['acq_time']);
  if (!observedAt) return null;
  const satellite = satelliteCode(row['satellite']);
  const id = `${satellite}-${observedAt}-${lat.toFixed(5)}-${lon.toFixed(5)}`;
  return {
    type: 'Feature',
    id,
    geometry: { type: 'Point', coordinates: [lon, lat] },
    properties: {
      id,
      scope,
      satellite,
      observedAt,
      frp,
      confidence: confidenceCode(row['confidence']),
      daynight: dayNightCode(row['daynight']),
    },
  };
}

async function fetchWindow(
  source: FirmsSource,
  area: (typeof AREAS)[number],
  start: Day,
  days: number,
  latest: boolean,
) {
  const box = `${area.west},${area.south},${area.east},${area.north}`;
  // Omitting the date asks for the most recent data; explicitly asking for today can hide delayed
  // overpasses.
  const url = latest
    ? `${FIRMS_BASE}/${FIRMS_MAP_KEY}/${source}/${box}/${days}`
    : `${FIRMS_BASE}/${FIRMS_MAP_KEY}/${source}/${box}/${days}/${start}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`FIRMS answered ${response.status} for ${source}`);

  const rows = parseCsv(await response.text(), 'latitude');
  const features = rows.flatMap((row) => {
    const feature = detectionFrom(row, area.scope);
    return feature ? [feature] : [];
  });
  if (rows.length && !features.length) throw new Error('FIRMS returned no valid detections');
  return features;
}

// Serve successful platforms when others fail, throwing only on total failure; overlapping
// SP/NRT overpasses are deduplicated by detection id.
export async function fetchHotspots(from: Day, to: Day): Promise<HotspotAnswer> {
  if (!FIRMS_MAP_KEY) throw new Error('FIRMS_MAP_KEY is not set');

  const table = await availability();
  const now = today();

  const jobs = windowsFor(from, to).flatMap((window) => {
    // Choose sources for each window’s final day; SP/NRT overlap within the window is handled by
    // deduplication.
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

  if (!jobs.length)
    return { body: { type: 'FeatureCollection', features: [] }, sources: [], missing: [] };

  const results = await Promise.allSettled(jobs.map((job) => job.task));

  const features: HotspotCollection['features'] = [];
  const keys = new Set<string>();
  const answered = new Set<FirmsSource>();
  const failures: string[] = [];
  const missing = new Set<string>();

  for (const [i, result] of results.entries()) {
    const job = jobs[i]!;
    if (result.status === 'rejected') {
      failures.push(`${job.source}/${job.area.scope}: ${result.reason?.message}`);
      missing.add(`${job.source}/${job.area.scope}`);
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
  return {
    body: { type: 'FeatureCollection', features },
    sources: [...answered].sort((a, b) => a.localeCompare(b)),
    missing: [...missing],
  };
}
