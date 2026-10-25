import Fastify from 'fastify';

import { CACHE_TTL_MS, DEFAULT_DAYS, FIRMS_MAP_KEY, HOST, MAX_DAYS, PORT } from './config.js';
import { fetchHotspots, type HotspotCollection } from './firms.js';

const app = Fastify({ logger: { transport: undefined } });

interface CacheEntry {
  readonly body: HotspotCollection;
  readonly fetchedAt: number;
}

/**
 * One entry per day range asked for. In memory on purpose: the data is public,
 * cheap to rebuild and worthless after a few minutes, so persisting it would
 * only add a moving part.
 */
const cache = new Map<number, CacheEntry>();

/**
 * Serves the cached answer while it is fresh, and —this is the point— serves a
 * stale one when FIRMS fails. An outage upstream should leave the map showing
 * detections from an hour ago with their age on display, not an empty map that
 * reads as «nothing is burning».
 */
async function hotspots(days: number) {
  const hit = cache.get(days);
  const age = hit ? Date.now() - hit.fetchedAt : Infinity;
  if (hit && age < CACHE_TTL_MS) return { body: hit.body, fetchedAt: hit.fetchedAt, stale: false };

  try {
    const body = await fetchHotspots(days);
    const entry = { body, fetchedAt: Date.now() };
    cache.set(days, entry);
    return { ...entry, stale: false };
  } catch (error) {
    if (!hit) throw error;
    app.log.warn(`FIRMS failed, serving ${Math.round(age / 60000)} min old data: ${error}`);
    return { body: hit.body, fetchedAt: hit.fetchedAt, stale: true };
  }
}

app.get<{ Querystring: { days?: string } }>('/api/hotspots', async (request, reply) => {
  const asked = Number(request.query.days ?? DEFAULT_DAYS);
  const days = Number.isFinite(asked) ? Math.min(Math.max(Math.trunc(asked), 1), MAX_DAYS) : DEFAULT_DAYS;

  try {
    const { body, fetchedAt, stale } = await hotspots(days);
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
});

/** Enough to tell «the server is down» from «the key is missing». */
app.get('/api/health', async () => ({
  ok: true,
  firmsKey: FIRMS_MAP_KEY ? 'present' : 'missing',
  cached: [...cache.entries()].map(([days, e]) => ({
    days,
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
