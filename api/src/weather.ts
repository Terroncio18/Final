import { AEMET_API_KEY, AEMET_OBSERVATIONS, IPMA_OBSERVATIONS, IPMA_STATIONS } from './config.js';
import type { JsonValue } from './json-value.js';
import { fetchChecked, readJson } from './read-json.js';
import {
  readAemetPointer,
  readAemetObservations,
  readIpmaStations,
  readIpmaObservations,
  type Observation,
  type WeatherStation,
} from './weather-data.js';

type Country = 'ES' | 'PT';

// Providers update hourly; reuse the country-wide response for twenty minutes per visitor.
const TTL_MS = 20 * 60 * 1000;

const STATIONS_TTL_MS = 24 * 60 * 60 * 1000;

interface Cached<T> {
  readonly value: T;
  readonly at: number;
}

const cache = new Map<Country, Cached<Observation[]>>();
let ipmaStations: Cached<Map<string, WeatherStation>> | null = null;

// AEMET returns a data URL first, then ISO-8859-15 bytes; decode explicitly, since response.json()
// would treat them as UTF-8.
async function fromAemet(): Promise<Observation[]> {
  if (!AEMET_API_KEY) throw new Error('AEMET_API_KEY is not set');

  // AEMET reports its own errors inside a 200, like FIRMS does.
  const url = readAemetPointer(
    await readJson<JsonValue>(AEMET_OBSERVATIONS, 'AEMET', {
      headers: { api_key: AEMET_API_KEY },
    }),
  );

  const second = await fetchChecked(url, (status) => `AEMET data: ${status}`);
  const text = new TextDecoder('iso-8859-15').decode(await second.arrayBuffer());
  return readAemetObservations(JSON.parse(text) as JsonValue);
}

async function stationsOfIpma() {
  if (ipmaStations && Date.now() - ipmaStations.at < STATIONS_TTL_MS) return ipmaStations.value;

  const value = readIpmaStations(await readJson<JsonValue>(IPMA_STATIONS, 'IPMA stations'));
  ipmaStations = { value, at: Date.now() };
  return value;
}

async function fromIpma(): Promise<Observation[]> {
  const [stations, data] = await Promise.all([
    stationsOfIpma(),
    readJson<JsonValue>(IPMA_OBSERVATIONS, 'IPMA'),
  ]);
  return readIpmaObservations(data, stations);
}

// Great-circle distance in kilometres; accurate enough for picking the nearest station.
function distanceKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

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

// No interpolation or altitude correction: the nearest station's distance is returned so the UI
// can show how representative it is.
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
