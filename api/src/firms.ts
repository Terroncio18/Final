import { AREAS, FIRMS_BASE, FIRMS_MAP_KEY, FIRMS_SOURCES, type Scope } from './config.js';

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

/**
 * FIRMS answers errors in plain text with a 200 status —an invalid key included—
 * so the status code alone proves nothing. A real answer always carries the
 * column names, and that is what gets checked.
 */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines.shift();
  if (!header || !header.includes('latitude')) {
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

async function fetchArea(source: string, area: (typeof AREAS)[number], days: number) {
  const box = `${area.west},${area.south},${area.east},${area.north}`;
  const url = `${FIRMS_BASE}/${FIRMS_MAP_KEY}/${source}/${box}/${days}`;

  const response = await fetch(url);
  if (!response.ok) throw new Error(`FIRMS answered ${response.status} for ${source}`);

  return parseCsv(await response.text())
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
 * Every platform over every area, in parallel.
 *
 * A platform that fails does not empty the map: its rejection is reported and
 * the rest is served. Only a complete failure throws, which is what lets the
 * caller fall back to the previous answer.
 */
export async function fetchHotspots(days: number): Promise<HotspotCollection> {
  if (!FIRMS_MAP_KEY) throw new Error('FIRMS_MAP_KEY is not set');

  const jobs = AREAS.flatMap((area) =>
    FIRMS_SOURCES.map((source) => ({ source, area, task: fetchArea(source, area, days) })),
  );
  const results = await Promise.allSettled(jobs.map((job) => job.task));

  const features = [];
  const failures: string[] = [];
  for (const [i, result] of results.entries()) {
    if (result.status === 'fulfilled') features.push(...result.value);
    else failures.push(`${jobs[i]!.source}/${jobs[i]!.area.scope}: ${result.reason?.message}`);
  }

  if (failures.length === results.length) throw new Error(failures.join(' · '));
  if (failures.length) console.warn('[firms] partial answer —', failures.join(' · '));

  features.sort((a, b) => b.properties.frp - a.properties.frp);
  return { type: 'FeatureCollection', features };
}
