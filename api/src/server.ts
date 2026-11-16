import Fastify from 'fastify';

import {
  AEMET_API_KEY,
  CACHE_TTL_MS,
  DEFAULT_DAYS,
  FIRMS_MAP_KEY,
  HOST,
  MAX_RANGE_DAYS,
  PORT,
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
  type HotspotCollection,
} from './firms.js';

import { nearestObservation } from './weather.js';
import { registerFuelRoutes } from './fuel-routes.js';
import { registerWaterRoutes } from './water-routes.js';
import { registerLakesRoutes } from './lakes-routes.js';

const app = Fastify({ logger: { transport: undefined } });
registerFuelRoutes(app);
registerWaterRoutes(app);
registerLakesRoutes(app);

interface CacheEntry {
  readonly body: HotspotCollection;
  readonly sources: readonly string[];
  readonly fetchedAt: number;
}

/**
 * One entry per range asked for, keyed `from:to`. In memory on purpose: the
 * data is public, cheap to rebuild and worthless after a few minutes, so
 * persisting it would only add a moving part.
 *
 * A historical range never changes, and it is still only kept for the same ten
 * minutes as today's. Holding every month anybody ever asked for would be a
 * leak with a nice name; a month is four seconds to rebuild.
 */
const cache = new Map<string, CacheEntry>();

/**
 * Serves the cached answer while it is fresh, and —this is the point— serves a
 * stale one when FIRMS fails. An outage upstream should leave the map showing
 * detections from an hour ago with their age on display, not an empty map that
 * reads as «nothing is burning».
 */
async function hotspots(from: Day, to: Day) {
  const key = `${from}:${to}`;
  const hit = cache.get(key);
  const age = hit ? Date.now() - hit.fetchedAt : Infinity;
  if (hit && age < CACHE_TTL_MS) return { ...hit, stale: false };

  try {
    const { body, sources } = await fetchHotspots(from, to);
    const entry = { body, sources, fetchedAt: Date.now() };
    cache.set(key, entry);
    return { ...entry, stale: false };
  } catch (error) {
    if (!hit) throw error;
    app.log.warn(`FIRMS failed, serving ${Math.round(age / 60000)} min old data: ${error}`);
    return { ...hit, stale: true };
  }
}

/**
 * What the query asked for, as two dates, or what is wrong with it.
 *
 * Three ways to ask, and they all end as a range: nothing at all is today;
 * `days=N` is the last N days, which is what the presets send; `from` and `to`
 * are the two dates themselves. The server never answers in the shape it was
 * asked —the answer always carries the resolved range— so a link and a preset
 * cannot drift apart.
 */
function rangeOf(query: { from?: string; to?: string; days?: string }): { from: Day; to: Day } | string {
  const now = today();

  if (query.from !== undefined || query.to !== undefined) {
    const from = query.from ?? query.to;
    const to = query.to ?? query.from;
    if (!isDay(from) || !isDay(to)) return 'Les dates han de ser YYYY-MM-DD';
    if (from > to) return 'La data inicial és posterior a la final';
    if (to > now) return 'No es poden demanar dates futures';
    const span = daysBetween(from, to) + 1;
    if (span > MAX_RANGE_DAYS) return `El rang màxim és de ${MAX_RANGE_DAYS} dies i se n'han demanat ${span}`;
    return { from, to };
  }

  const asked = Number(query.days ?? DEFAULT_DAYS);
  const days = Number.isFinite(asked)
    ? Math.min(Math.max(Math.trunc(asked), 1), MAX_RANGE_DAYS)
    : DEFAULT_DAYS;

  return { from: addDays(now, 1 - days), to: now };
}

app.get<{ Querystring: { from?: string; to?: string; days?: string } }>(
  '/api/hotspots',
  async (request, reply) => {
    const range = rangeOf(request.query);
    if (typeof range === 'string') return reply.status(400).send({ error: range });

    try {
      const { body, sources, fetchedAt, stale } = await hotspots(range.from, range.to);

      // The range travels back resolved, because the client may have asked in
      // days and has to be able to say which dates it is showing.
      reply.header('x-from', range.from);
      reply.header('x-to', range.to);
      reply.header('x-sources', sources.join(','));
      // What the date fields may offer: see earliest().
      const first = await earliest();
      if (first) reply.header('x-earliest', first);
      // The age travels in the headers so the interface can say how old the data
      // is, which with NRT detections —hours behind the overpass— it must.
      reply.header('x-fetched-at', new Date(fetchedAt).toISOString());
      reply.header('x-stale', String(stale));
      reply.header('cache-control', 'public, max-age=300');
      return body;
    } catch (error) {
      request.log.error(error);
      return reply.status(502).send({ error: 'FIRMS is unreachable and nothing is cached yet' });
    }
  },
);

/**
 * The weather at a place, as its nearest station last measured it.
 *
 * The country is asked for and not worked out from the coordinates: the
 * client already knows it —a NUTS code starts with it— and a point-in-polygon
 * test here would need the borders the server does not hold. It decides who is
 * asked: AEMET for Spain, IPMA for Portugal.
 */
app.get<{ Querystring: { country?: string; lon?: string; lat?: string } }>(
  '/api/weather',
  async (request, reply) => {
    const { country } = request.query;
    const lon = Number(request.query.lon);
    const lat = Number(request.query.lat);
    if (country !== 'ES' && country !== 'PT') {
      return reply.status(400).send({ error: 'El país ha de ser ES o PT' });
    }
    if (!request.query.lon || !request.query.lat || !Number.isFinite(lon) || !Number.isFinite(lat)) {
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

/** Enough to tell «the server is down» from «the key is missing». */
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

try {
  await app.listen({ port: PORT, host: HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
