import Fastify from 'fastify';
import {
  AEMET_API_KEY,
  CACHE_TTL_MS,
  DEFAULT_DAYS,
  FIRMS_MAP_KEY,
  MAX_HOTSPOT_CACHE_ENTRIES,
  MAX_RANGE_DAYS,
} from './config.js';
import {
  addDays,
  availability,
  daysBetween,
  earliest,
  fetchHotspots,
  isDay,
  today,
  type Day,
} from './firms.js';
import { HotspotCache } from './hotspot-cache.js';
import { nearestObservation } from './weather.js';
import { registerFuelRoutes } from './fuel-routes.js';

export const app = Fastify({ logger: { transport: undefined } });
registerFuelRoutes(app);

const cache = new HotspotCache(MAX_HOTSPOT_CACHE_ENTRIES);
const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof fetchHotspots>>>>();

async function hotspots(from: Day, to: Day) {
  const key = `${from}:${to}`;
  const hit = cache.get(key);
  const age = hit ? Date.now() - hit.fetchedAt : Infinity;
  if (hit && age < CACHE_TTL_MS) return { ...hit, stale: false };

  let job = inFlight.get(key);
  try {
    if (!job) {
      job = fetchHotspots(from, to);
      inFlight.set(key, job);
    }
    const { body, sources } = await job;
    const entry = { body, sources, fetchedAt: Date.now() };
    cache.set(key, entry);
    return { ...entry, stale: false };
  } catch (error) {
    if (!hit) throw error;
    app.log.warn(`FIRMS failed, serving ${Math.round(age / 60000)} min old data: ${error}`);
    return { ...hit, stale: true };
  } finally {
    if (inFlight.get(key) === job) inFlight.delete(key);
  }
}

type QueryRange = { readonly from: Day; readonly to: Day };
type RangeResult =
  | { readonly ok: true; readonly range: QueryRange }
  | { readonly ok: false; readonly error: string };

function rangeOf(query: { from?: string; to?: string; days?: string }): RangeResult {
  const now = today();

  if (query.from !== undefined || query.to !== undefined) {
    const from = query.from ?? query.to;
    const to = query.to ?? query.from;
    if (!isDay(from) || !isDay(to)) return { ok: false, error: 'Les dates han de ser YYYY-MM-DD' };
    if (from > to) return { ok: false, error: 'La data inicial és posterior a la final' };
    if (to > now) return { ok: false, error: 'No es poden demanar dates futures' };
    const span = daysBetween(from, to) + 1;
    if (span > MAX_RANGE_DAYS) {
      return {
        ok: false,
        error: `El rang màxim és de ${MAX_RANGE_DAYS} dies i se n'han demanat ${span}`,
      };
    }
    return { ok: true, range: { from, to } };
  }

  const asked = Number(query.days ?? DEFAULT_DAYS);
  const days = Number.isFinite(asked)
    ? Math.min(Math.max(Math.trunc(asked), 1), MAX_RANGE_DAYS)
    : DEFAULT_DAYS;

  return { ok: true, range: { from: addDays(now, 1 - days), to: now } };
}

app.get<{ Querystring: { from?: string; to?: string; days?: string } }>(
  '/api/hotspots',
  async (request, reply) => {
    const range = rangeOf(request.query);
    if (!range.ok) return reply.status(400).send({ error: range.error });

    try {
      const { from, to } = range.range;
      const { body, sources, fetchedAt, stale } = await hotspots(from, to);

      // Return the resolved dates even when the client requested a number of days.
      reply.header('x-from', from);
      reply.header('x-to', to);
      reply.header('x-sources', sources.join(','));
      const first = await earliest();
      if (first) reply.header('x-earliest', first);
      // NRT detections arrive hours after overpass; the interface displays their age.
      reply.header('x-fetched-at', new Date(fetchedAt).toISOString());
      reply.header('x-stale', String(stale));
      reply.header('cache-control', 'public, max-age=300');
      return body;
    } catch (error) {
      request.log.error(error);
      // A missing key needs a distinct response because retries cannot fix it.
      if (!FIRMS_MAP_KEY) {
        return reply
          .status(503)
          .send({ error: 'Falta la clau FIRMS_MAP_KEY al servidor', reason: 'missing-key' });
      }
      return reply.status(502).send({ error: 'FIRMS is unreachable and nothing is cached yet' });
    }
  },
);

app.get<{ Querystring: { country?: string; lon?: string; lat?: string } }>(
  '/api/weather',
  async (request, reply) => {
    const { country } = request.query;
    const lon = Number(request.query.lon);
    const lat = Number(request.query.lat);
    if (country !== 'ES' && country !== 'PT') {
      return reply.status(400).send({ error: 'El país ha de ser ES o PT' });
    }
    if (
      !request.query.lon ||
      !request.query.lat ||
      !Number.isFinite(lon) ||
      !Number.isFinite(lat)
    ) {
      return reply.status(400).send({ error: 'Calen lon i lat' });
    }
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
      return reply.status(400).send({ error: 'Coordenades fora de rang' });
    }

    try {
      const found = await nearestObservation(country, lon, lat);
      if (!found) return reply.status(404).send({ error: 'Cap estació amb dades' });
      reply.header('cache-control', 'public, max-age=300');
      return {
        ...found.observation,
        distanceKm: Math.round(found.distanceKm * 10) / 10,
        stale: found.stale,
      };
    } catch (error) {
      request.log.error(error);
      return reply.status(502).send({ error: 'El servei meteorològic no respon' });
    }
  },
);

app.get('/api/health', async () => ({
  ok: true,
  firmsKey: FIRMS_MAP_KEY ? 'present' : 'missing',
  aemetKey: AEMET_API_KEY ? 'present' : 'missing',
  sources: Object.fromEntries(
    [...(await availability()).entries()].map(([id, span]) => [id, `${span.min} → ${span.max}`]),
  ),
  cached: [...cache.entries()].map(([range, e]) => ({
    range,
    features: e.body.features.length,
    ageSeconds: Math.round((Date.now() - e.fetchedAt) / 1000),
  })),
}));
