export const PORT = Number(process.env.PORT ?? 3000);

// On Windows, `localhost` may resolve to ::1 while the dev proxy uses IPv4.
export const HOST = process.env.HOST ?? '127.0.0.1';

// Server-side only; the key must not ship to the browser.
export const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY ?? '';
export const FIRMS_BASE = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

// NRT is recent; SP is reprocessed history. `availability()` supplies the moving cutoff.
export const FIRMS_PLATFORMS = [
  { nrt: 'VIIRS_SNPP_NRT', sp: 'VIIRS_SNPP_SP' },
  { nrt: 'VIIRS_NOAA20_NRT', sp: 'VIIRS_NOAA20_SP' },
  { nrt: 'VIIRS_NOAA21_NRT', sp: 'VIIRS_NOAA21_SP' },
] as const;

export const FIRMS_AVAILABILITY = 'https://firms.modaps.eosdis.nasa.gov/api/data_availability/csv';

// The API takes rectangles; the frontend filters detections outside its study polygons.
export const AREAS = [
  { scope: 'peninsula', west: -9.9, south: 35.8, east: 4.4, north: 44.0 },
  { scope: 'canaries', west: -18.3, south: 27.5, east: -13.3, north: 29.5 },
] as const;

export type Scope = (typeof AREAS)[number]['scope'];

// A pass changes the answer only a few times daily; this also protects FIRMS' request quota.
export const CACHE_TTL_MS = 10 * 60 * 1000;

// Retry incomplete FIRMS coverage sooner without repeating every upstream request on each visit.
export const PARTIAL_CACHE_TTL_MS = 60 * 1000;

export const MAX_HOTSPOT_CACHE_ENTRIES = 32;

// The NRT/SP cutoff changes about monthly.
export const AVAILABILITY_TTL_MS = 6 * 60 * 60 * 1000;

export const DEFAULT_DAYS = 1;

export const WINDOW_DAYS = 5;

// 31 days caps one range at 42 upstream requests across three platforms and two areas.
export const MAX_RANGE_DAYS = 31;

// Server-side only; the key must not ship to the browser.
export const AEMET_API_KEY = process.env.AEMET_API_KEY ?? '';

export const AEMET_OBSERVATIONS =
  'https://opendata.aemet.es/opendata/api/observacion/convencional/todas';

export const IPMA_STATIONS =
  'https://api.ipma.pt/open-data/observation/meteorology/stations/stations.json';
export const IPMA_OBSERVATIONS =
  'https://api.ipma.pt/open-data/observation/meteorology/stations/observations.json';
