import type { LngLatBoundsLike } from 'maplibre-gl';

/**
 * Esri World Imagery. The path is {z}/{y}/{x}, not MapLibre's usual {z}/{x}/{y}:
 * ArcGIS REST puts the row before the column.
 */
export const IMAGERY_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
/**
 * Esri's own credit for World Imagery, word for word as its item page gives it.
 * The licence is the Esri Master License Agreement (§6).
 */
export const IMAGERY_ATTRIBUTION =
  'Imatgeria: Esri, Vantor, Earthstar Geographics, and the GIS User Community';

/** Terrarium-encoded elevation, global and keyless. Mapzen / Copernicus EU-DEM, USGS, NOAA. */
export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const DEM_MAX_ZOOM = 15;
/**
 * Terrain Tiles has no licence of its own: every source keeps its own terms and
 * its own required wording (§6). Over the study area the elevation comes from
 * Copernicus EU-DEM, with SRTM and GMTED2010 underneath as global cover, so
 * both are credited in the words their providers ask for.
 */
export const DEM_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Terrain Tiles</a>: ' +
  'Europe terrain data produced using Copernicus data and information funded by ' +
  'the European Union - EU-DEM layers; SRTM and GMTED2010 terrain data courtesy ' +
  'of the U.S. Geological Survey';

/**
 * Active fire detections, served by our own API.
 *
 * FIRMS cannot be called from the browser: the key would travel with the page
 * and there is no CORS header. The server holds the key, asks the three VIIRS
 * platforms and caches the answer, which matters because the data only changes
 * when a satellite passes over.
 */
export const HOTSPOT_DAYS = 1;
export const HOTSPOTS_URL = `/api/hotspots?days=${HOTSPOT_DAYS}`;

/**
 * Administrative boundaries, preprocessed from Eurostat GISCO NUTS 2024.
 *
 * Both the map and the form read this one file: the layer draws the borders and
 * the first step of the form lists the names, so a label and a border cannot
 * disagree. Relative on purpose —the application may be served from a
 * subdirectory— which means it has to be resolved against the document and not
 * against the current URL.
 */
export const REGIONS_URL = 'data/regions.geojson';

/**
 * Boundaries, for both levels.
 *
 * GISCO's NUTS page publishes no terms of its own. The EuroGeographics notice
 * is the one its administrative-units page requires, and it is carried here
 * because this application redistributes geometry derived from the data, which
 * is the case the notice exists for (§6).
 */
export const BOUNDARIES_ATTRIBUTION =
  'Límits: Eurostat GISCO, NUTS 2024 · © EuroGeographics for the administrative boundaries';

/**
 * Provinces and islands (NUTS 3), for the second step.
 *
 * Deliberately not part of the opening style: 380 kB of borders the portada
 * never draws, on the one screen that has to open quickly. They are added to
 * the map the first time a step asks for them.
 */
export const PROVINCES_URL = 'data/provinces.geojson';

/**
 * Municipalities (LAU), one file per province.
 *
 * Eighty-one files, 13 MB together, so they are never loaded as one: the step
 * knows which province it is in and asks for that file alone.
 */
export const MUNICIPALITIES_URL = 'data/municipalities';

export interface NamedView {
  readonly label: string;
  readonly bounds: LngLatBoundsLike;
}

/**
 * The study area is not contiguous, but it does not need three framings.
 *
 * The Balearic Islands reach 4,4° east and sit inside the peninsular latitudes,
 * so they come along at no cost in zoom: a wide window is framed by latitude,
 * which they do not change. The Canaries do change it —they double the latitude
 * span and leave a frame that is mostly ocean— so they keep one of their own.
 */
export const VIEWS = {
  peninsula: { label: 'Península i Balears', bounds: [-9.9, 35.8, 4.4, 44.0] },
  canaries: { label: 'Illes Canàries', bounds: [-18.3, 27.5, -13.3, 29.5] },
} as const satisfies Record<string, NamedView>;

export type ViewId = keyof typeof VIEWS;

export const INITIAL_VIEW: ViewId = 'peninsula';