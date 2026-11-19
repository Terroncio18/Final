import { AEMET_API_KEY, AEMET_OBSERVATIONS, IPMA_OBSERVATIONS, IPMA_STATIONS } from './config.js';

/**
 * What a weather station last measured, in the units the simulator works in.
 *
 * The two services publish different shapes in different units —AEMET gives
 * the wind in metres per second and its direction in degrees, IPMA gives it in
 * kilometres per hour and as one of eight points— and this is the one shape
 * both are turned into, so the browser never learns which one answered beyond
 * the name it shows.
 */
export interface Observation {
  /** Who measured it, as the interface names it. */
  readonly source: 'AEMET' | 'IPMA';
  readonly station: {
    readonly id: string;
    readonly name: string;
    readonly lon: number;
    readonly lat: number;
  };
  /** When, UTC, ISO 8601. Both services publish on the hour. */
  readonly observedAt: string;
  readonly windKmh: number;
  /** Where the wind comes **from**, in degrees from north, clockwise. */
  readonly windFromDeg: number;
  /** Relative humidity, in percent. */
  readonly humidity: number;
  /** Air temperature, in degrees Celsius. */
  readonly temperature: number;
}

export type Country = 'ES' | 'PT';

/**
 * How long a set of observations is reused.
 *
 * Both services publish once an hour, so twenty minutes is already three
 * times more often than the answer can change. For AEMET it is also what makes
 * the endpoint affordable: one request brings every station in the country,
 * three and a half megabytes of it, and that is not something to repeat for
 * each visitor.
 */
const TTL_MS = 20 * 60 * 1000;

/** The stations themselves do not move. A day is how often the list is re-read. */
const STATIONS_TTL_MS = 24 * 60 * 60 * 1000;

interface Cached<T> {
  readonly value: T;
  readonly at: number;
}

const cache = new Map<Country, Cached<Observation[]>>();
let ipmaStations: Cached<Map<string, { name: string; lon: number; lat: number }>> | null = null;

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * The hour of an observation, as the instant it is.
 *
 * Both services publish in UTC and neither says so in the string: AEMET's
 * `fint` is `2026-11-19T10:00:00` and IPMA's key is `2026-11-19T10:00`. Read
 * as they come, `new Date()` would put the server's own zone on them —an hour
 * out in winter here, two in summer— and the simulator would be given a wind
 * from the wrong hour. A zone is added unless the string already carries one.
 */
function asUtc(stamp: string): string {
  return /(?:Z|[+-]\d{2}:?\d{2})$/.test(stamp) ? stamp : `${stamp}Z`;
}

// ------------------------------------------------------------------ AEMET

interface AemetRow {
  idema: string;
  ubi: string;
  lon: number;
  lat: number;
  fint: string;
  vv?: number;
  dv?: number;
  ta?: number;
  hr?: number;
}

/**
 * The latest complete observation of every Spanish station.
 *
 * AEMET answers in two steps: the first request returns the address of the
 * data, and the data is a second request. And the data is **ISO-8859-15, not
 * UTF-8** —the header says so and `response.json()` ignores it— so it is
 * decoded by hand, or every «Ñ» in a station name arrives broken.
 *
 * The file carries about twelve hours of every station. Only the latest row
 * that has all four values is kept for each: a station that reports the
 * temperature and not the wind cannot say how a fire would run.
 */
async function fromAemet(): Promise<Observation[]> {
  if (!AEMET_API_KEY) throw new Error('AEMET_API_KEY is not set');

  const first = await fetch(AEMET_OBSERVATIONS, { headers: { api_key: AEMET_API_KEY } });
  if (!first.ok) throw new Error(`AEMET: ${first.status}`);
  // AEMET reports its own errors inside a 200, like FIRMS does.
  const pointer = (await first.json()) as { estado?: number; datos?: string; descripcion?: string };
  if (pointer.estado !== 200 || !pointer.datos) {
    throw new Error(`AEMET: ${pointer.estado} ${pointer.descripcion ?? ''}`);
  }

  const second = await fetch(pointer.datos);
  if (!second.ok) throw new Error(`AEMET data: ${second.status}`);
  const text = new TextDecoder('iso-8859-15').decode(await second.arrayBuffer());
  const rows = JSON.parse(text) as AemetRow[];

  const latest = new Map<string, AemetRow>();
  for (const row of rows) {
    if (!isNumber(row.vv) || !isNumber(row.dv) || !isNumber(row.ta) || !isNumber(row.hr)) continue;
    const held = latest.get(row.idema);
    if (!held || row.fint > held.fint) latest.set(row.idema, row);
  }

  return [...latest.values()].map((row) => ({
    source: 'AEMET' as const,
    station: { id: row.idema, name: row.ubi, lon: row.lon, lat: row.lat },
    observedAt: new Date(asUtc(row.fint)).toISOString(),
    // Metres per second to kilometres per hour.
    windKmh: Math.round((row.vv as number) * 36) / 10,
    windFromDeg: row.dv as number,
    humidity: row.hr as number,
    temperature: row.ta as number,
  }));
}

// ------------------------------------------------------------------- IPMA

/**
 * IPMA's `idDireccVento`, as degrees.
 *
 * Eight points and not degrees, with two codes for north and one for «no
 * direction», which is what a calm reports. A calm is skipped rather than
 * given a bearing: a wind from nowhere is not a wind from the north.
 */
const IPMA_BEARINGS: Record<number, number> = {
  1: 0,
  2: 45,
  3: 90,
  4: 135,
  5: 180,
  6: 225,
  7: 270,
  8: 315,
  9: 0,
};

/** What IPMA writes where a sensor gave nothing. */
const IPMA_MISSING = -99;

interface IpmaRow {
  intensidadeVentoKM: number;
  idDireccVento: number;
  temperatura: number;
  humidade: number;
}

async function stationsOfIpma() {
  if (ipmaStations && Date.now() - ipmaStations.at < STATIONS_TTL_MS) return ipmaStations.value;

  const response = await fetch(IPMA_STATIONS);
  if (!response.ok) throw new Error(`IPMA stations: ${response.status}`);
  const features = (await response.json()) as {
    geometry: { coordinates: [number, number] };
    properties: { idEstacao: number; localEstacao: string };
  }[];

  const value = new Map(
    features.map((feature) => [
      String(feature.properties.idEstacao),
      {
        name: feature.properties.localEstacao,
        lon: feature.geometry.coordinates[0],
        lat: feature.geometry.coordinates[1],
      },
    ]),
  );
  ipmaStations = { value, at: Date.now() };
  return value;
}

/**
 * The latest complete observation of every Portuguese station.
 *
 * The answer is keyed by hour and then by station, a day of it. Hours are
 * walked from the newest back, so each station keeps the first complete row
 * found: the last hour is often still empty for a fifth of them.
 */
async function fromIpma(): Promise<Observation[]> {
  const [stations, response] = await Promise.all([stationsOfIpma(), fetch(IPMA_OBSERVATIONS)]);
  if (!response.ok) throw new Error(`IPMA: ${response.status}`);
  const hours = (await response.json()) as Record<string, Record<string, IpmaRow | null>>;

  const found = new Map<string, Observation>();
  for (const hour of Object.keys(hours).sort((a, b) => b.localeCompare(a))) {
    for (const [id, row] of Object.entries(hours[hour] ?? {})) {
      if (found.has(id) || !row) continue;
      const station = stations.get(id);
      const bearing = IPMA_BEARINGS[row.idDireccVento];
      if (!station || bearing === undefined) continue;
      const values = [row.intensidadeVentoKM, row.temperatura, row.humidade];
      if (values.some((value) => !isNumber(value) || value === IPMA_MISSING)) continue;

      found.set(id, {
        source: 'IPMA',
        station: { id, ...station },
        observedAt: new Date(asUtc(hour + ':00')).toISOString(),
        windKmh: row.intensidadeVentoKM,
        windFromDeg: bearing,
        humidity: row.humidade,
        temperature: row.temperatura,
      });
    }
  }
  return [...found.values()];
}

// ---------------------------------------------------------------- nearest

/** Great-circle distance in kilometres. Plenty for choosing between stations. */
function distanceKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

/**
 * Every station of a country, fresh or the last set that arrived.
 *
 * The same bargain as the detections: when the service fails, an hour-old
 * observation with its time on display is better than none.
 */
async function observations(country: Country): Promise<{ list: Observation[]; stale: boolean }> {
  const hit = cache.get(country);
  if (hit && Date.now() - hit.at < TTL_MS) return { list: hit.value, stale: false };

  try {
    const value = country === 'PT' ? await fromIpma() : await fromAemet();
    cache.set(country, { value, at: Date.now() });
    return { list: value, stale: false };
  } catch (error) {
    if (!hit) throw error;
    return { list: hit.value, stale: true };
  }
}

/**
 * The observation of the station closest to a place.
 *
 * **The nearest one, and that is the whole method.** No interpolation between
 * stations and no correction for altitude: one station speaks for the domain,
 * and how far away it is travels with the answer so the interface can say it.
 * A valley and the ridge above it do not share a wind, and a number blended
 * from three stations would hide that behind a decimal.
 */
export async function nearestObservation(
  country: Country,
  lon: number,
  lat: number,
): Promise<{ observation: Observation; distanceKm: number; stale: boolean } | null> {
  const { list, stale } = await observations(country);

  let best: Observation | null = null;
  let bestKm = Infinity;
  for (const observation of list) {
    const km = distanceKm(lon, lat, observation.station.lon, observation.station.lat);
    if (km < bestKm) {
      best = observation;
      bestKm = km;
    }
  }
  return best ? { observation: best, distanceKm: bestKm, stale } : null;
}
