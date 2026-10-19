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

export interface NamedView {
  readonly label: string;
  readonly bounds: LngLatBoundsLike;
}

/**
 * The study area is not contiguous: the Canaries sit some 1.400 km southwest of
 * the peninsula, so one fitted view would be mostly ocean. Each gets its own.
 */
export const VIEWS = {
  peninsula: { label: 'Península', bounds: [-9.9, 35.8, 3.5, 44.0] },
  balears: { label: 'Illes Balears', bounds: [1.1, 38.6, 4.4, 40.2] },
  canaries: { label: 'Illes Canàries', bounds: [-18.3, 27.5, -13.3, 29.5] },
} as const satisfies Record<string, NamedView>;

export type ViewId = keyof typeof VIEWS;

export const INITIAL_VIEW: ViewId = 'peninsula';