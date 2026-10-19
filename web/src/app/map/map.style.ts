import type { StyleSpecification } from 'maplibre-gl';
import {
  DEM_ATTRIBUTION,
  DEM_MAX_ZOOM,
  DEM_TILES,
  IMAGERY_ATTRIBUTION,
  IMAGERY_TILES,
} from './map.config';

/** Layer ids the rest of the app refers to. Later layers are inserted above these. */
export const LAYERS = {
  background: 'background',
  satellite: 'basemap-satellite',
  hillshade: 'hillshade',
} as const;

export const DEM_SOURCE = 'terrain-dem';

/**
 * A flat map with relief read off the DEM, rather than a 3D terrain mesh.
 *
 * The elevation data is loaded all the same: slope is one of the three inputs to
 * Rothermel, so the model needs it whether or not the user sees it in relief.
 */
export function buildStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'IgnisLab · base',
    sources: {
      [DEM_SOURCE]: {
        type: 'raster-dem',
        tiles: [DEM_TILES],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: DEM_MAX_ZOOM,
        attribution: DEM_ATTRIBUTION,
      },
      satellite: {
        type: 'raster',
        tiles: [IMAGERY_TILES],
        tileSize: 256,
        maxzoom: 19,
        attribution: IMAGERY_ATTRIBUTION,
      },
    },
    layers: [
      {
        id: LAYERS.background,
        type: 'background',
        paint: { 'background-color': '#0c1116' },
      },
      {
        id: LAYERS.satellite,
        type: 'raster',
        source: 'satellite',
        paint: { 'raster-fade-duration': 200 },
      },
      {
        // Over a photograph the shading only needs to be a hint: the imagery
        // already carries its own sunlight.
        id: LAYERS.hillshade,
        type: 'hillshade',
        source: DEM_SOURCE,
        paint: {
          'hillshade-exaggeration': 0.3,
          'hillshade-shadow-color': '#0a1016',
          'hillshade-highlight-color': '#ffffff',
          'hillshade-accent-color': '#3a4a56',
        },
      },
    ],
  };
}