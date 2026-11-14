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
 * The three VIIRS platforms, each in the two processings FIRMS publishes.
 *
 * All three give 375 m, the best resolution available operationally, and they
 * fly at different times, so the same fire is normally seen by more than one:
 * these are observations, not fires, and no attempt is made here to merge them.
 *
 * NRT is what a satellite sends within hours of the overpass and it only
 * covers the last few months. SP —standard processing— is the reprocessed
 * record, which reaches back to the platform's first year and stops a few
 * weeks short of today. Same instrument and the same pixel either way; which
 * one can answer depends only on the date being asked for.
 *
 * The boundary between them moves —SP catches up about once a month— so it is
 * never written down here. `availability()` asks FIRMS where each one starts
 * and ends, and `sourcesFor()` picks by date.
 */
export const FIRMS_PLATFORMS = [
  { nrt: 'VIIRS_SNPP_NRT', sp: 'VIIRS_SNPP_SP' },
  { nrt: 'VIIRS_NOAA20_NRT', sp: 'VIIRS_NOAA20_SP' },
  { nrt: 'VIIRS_NOAA21_NRT', sp: 'VIIRS_NOAA21_SP' },
] as const;

/**
 * Which dates each source holds: `data_id,min_date,max_date` as CSV.
 *
 * A table of twelve rows that changes about once a month, and the only thing
 * that knows whether a given day is NRT's or SP's.
 */
export const FIRMS_AVAILABILITY = 'https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv';

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

/**
 * How long the availability table is reused.
 *
 * It moves when FIRMS promotes a month from NRT to SP, so six hours is already
 * far more often than it can change. It is asked for once at the first query
 * and then costs nothing.
 */
export const AVAILABILITY_TTL_MS = 6 * 60 * 60 * 1000;

/** What one day of detections means when nothing else is asked for: today. */
export const DEFAULT_DAYS = 1;

/**
 * The API's own ceiling for a single request: `day_range` is 1 to 5.
 *
 * A longer range is not refused here, it is cut into windows of this size and
 * asked for one after another. A month is seven of them per platform.
 */
export const WINDOW_DAYS = 5;

/**
 * The longest range askable at once, in days.
 *
 * A month, which is the case this exists for —«the fires of August 2024»— and
 * the point past which the cost stops being invisible: 31 days is 7 windows
 * times 2 areas times 3 platforms, 42 requests against a quota of 5.000 per
 * ten minutes, and about 7.500 detections at the measured August rate. Three
 * months would be 126 requests and 25.000 points for one query.
 */
export const MAX_RANGE_DAYS = 31;

/**
 * AEMET OpenData. Free key, from
 * https://opendata.aemet.es/centrodedescargas/altaUsuario
 *
 * Kept here for the reason the FIRMS key is: it cannot live in the client.
 */
export const AEMET_API_KEY = process.env.AEMET_API_KEY ?? '';

/** The last hours of every conventional station in Spain, in one answer. */
export const AEMET_OBSERVATIONS =
  'https://opendata.aemet.es/opendata/api/observacion/convencional/todas';

/**
 * IPMA's open data. No key, and open to CORS, so the browser could ask it
 * directly; it goes through here anyway so that both countries answer in one
 * shape and from one cache.
 */
export const IPMA_STATIONS =
  'https://api.ipma.pt/open-data/observation/meteorology/stations/stations.json';
export const IPMA_OBSERVATIONS =
  'https://api.ipma.pt/open-data/observation/meteorology/stations/observations.json';
