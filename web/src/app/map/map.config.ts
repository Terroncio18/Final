import type { LngLatBoundsLike } from 'maplibre-gl';

/**
 * Esri World Imagery. The path is {z}/{y}/{x}, not MapLibre's usual {z}/{x}/{y}:
 * ArcGIS REST puts the row before the column.
 */
export const IMAGERY_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const IMAGERY_ATTRIBUTION = 'Imatgeria © Esri, Vantor, Earthstar Geographics';

/** Terrarium-encoded elevation, global and keyless. Mapzen / Copernicus EU-DEM, USGS, NOAA. */
export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const DEM_MAX_ZOOM = 15;
export const DEM_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Mapzen Terrain Tiles</a>';

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