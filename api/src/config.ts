/** Where the server listens. The Angular dev server proxies `/api` here. */
export const PORT = Number(process.env.PORT ?? 3000);

/**
 * `127.0.0.1` on purpose, not `localhost`: on Windows a `localhost` bind lands
 * on `::1` only, and anything dialing `127.0.0.1` gets its connection refused.
 */
export const HOST = process.env.HOST ?? '127.0.0.1';

/**
 * NASA FIRMS area API. Free key, requested by e-mail from
 * https://firms.modaps.eosdis.nasa.gov/api/area/
 *
 * Never hardcoded and never sent to the browser: the whole reason this server
 * exists is that the key cannot live in the client.
 */
export const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY ?? '';
export const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

/**
 * The three VIIRS platforms in near real time. All three give 375 m, the best
 * resolution available operationally, and they fly at different times, so the
 * same fire is normally seen by more than one: these are observations, not
 * fires, and no attempt is made here to merge them.
 */
export const FIRMS_SOURCES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT'] as const;

/**
 * One request per rectangle, which is what the API takes.
 *
 * These mirror the two framings in the frontend's `map.config.ts`. They are
 * written twice on purpose for now: the two projects share no package yet, and
 * inventing one for four numbers would cost more than it saves. If a shared
 * types package ever appears, this is the first thing that should move into it.
 *
 * The peninsular box reaches down to 35,8°, so it also covers northern Morocco
 * and Algeria. Those detections come back with everything else; filtering them
 * out is a decision for the frontend, which already holds the NUTS polygons.
 */
export const AREAS = [
  { scope: 'peninsula', west: -9.9, south: 35.8, east: 4.4, north: 44.0 },
  { scope: 'canaries', west: -18.3, south: 27.5, east: -13.3, north: 29.5 },
] as const;

export type Scope = (typeof AREAS)[number]['scope'];

/**
 * How long a response is reused.
 *
 * Not an optimisation: VIIRS only updates when a satellite passes, which over
 * Iberia is a handful of times a day, and NRT detections appear hours after the
 * overpass. Asking FIRMS on every page load would spend the key's quota —5.000
 * requests per ten minutes— to fetch something that has not changed.
 */
export const CACHE_TTL_MS = 10 * 60 * 1000;

/** Days of detections to ask for. The API refuses more than five. */
export const DEFAULT_DAYS = 1;
export const MAX_DAYS = 5;
