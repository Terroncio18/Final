import type { LngLatBoundsLike } from 'maplibre-gl';

// ArcGIS orders tile coordinates as z/y/x; MapLibre's default is z/x/y.
export const IMAGERY_TILES =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
export const IMAGERY_ATTRIBUTION =
  'Imatgeria: Esri, Vantor, Earthstar Geographics, and the GIS User Community';

export const DEM_TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
export const DEM_MAX_ZOOM = 15;
export const DEM_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noreferrer">Terrain Tiles</a>: ' +
  'Europe terrain data produced using Copernicus data and information funded by ' +
  'the European Union - EU-DEM layers; SRTM and GMTED2010 terrain data courtesy ' +
  'of the U.S. Geological Survey';

export const HOTSPOTS_URL = '/api/hotspots';

export const REGIONS_URL = 'data/regions.geojson';

export const BOUNDARIES_ATTRIBUTION =
  'Límits: Eurostat GISCO, NUTS 2024 · © EuroGeographics for the administrative boundaries';

export const PROVINCES_URL = 'data/provinces.geojson';

export const MUNICIPALITIES_URL = 'data/municipalities';

export const MUNICIPALITY_INDEX_URL = 'data/municipality-index.json';

export const PLACES_URL = 'data/places';

export const PLACES_ATTRIBUTION =
  'Topònims: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">' +
  'OpenStreetMap</a> contributors, ODbL';

export const GLYPHS = 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf';

export const LABEL_FONT = 'Open Sans Regular';

interface NamedView {
  readonly label: string;
  readonly bounds: LngLatBoundsLike;
}

// The Balearics fit the peninsular frame; the Canaries need their own latitude span.
export const VIEWS = {
  peninsula: { label: 'Península i Balears', bounds: [-9.9, 35.8, 4.4, 44.0] },
  canaries: { label: 'Illes Canàries', bounds: [-18.3, 27.5, -13.3, 29.5] },
} as const satisfies Record<string, NamedView>;

export type ViewId = keyof typeof VIEWS;

export const INITIAL_VIEW: ViewId = 'peninsula';
