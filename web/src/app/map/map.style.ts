import type { StyleSpecification } from 'maplibre-gl';
import {
  DEM_ATTRIBUTION,
  DEM_MAX_ZOOM,
  DEM_TILES,
  HOTSPOTS_URL,
  IMAGERY_ATTRIBUTION,
  IMAGERY_TILES,
} from './map.config';

/** Layer ids the rest of the app refers to. Later layers are inserted above these. */
export const LAYERS = {
  background: 'background',
  satellite: 'basemap-satellite',
  hillshade: 'hillshade',
  regionsFill: 'regions-fill',
  regionsLine: 'regions-line',
  hotspots: 'hotspots',
} as const;

export const DEM_SOURCE = 'terrain-dem';
export const REGIONS_SOURCE = 'regions';
export const HOTSPOTS_SOURCE = 'hotspots';

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
      [REGIONS_SOURCE]: {
        type: 'geojson',
        data: 'data/regions.geojson',
        attribution: 'Límits: Eurostat GISCO, NUTS 2024',
      },
      [HOTSPOTS_SOURCE]: {
        type: 'geojson',
        data: HOTSPOTS_URL,
        attribution: 'Focus: NASA FIRMS (VIIRS 375 m)',
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
            {
        // Nearly invisible, but it is what makes a region pickable: a line alone
        // would only respond on the border itself.
        id: LAYERS.regionsFill,
        type: 'fill',
        source: REGIONS_SOURCE,
        paint: { 'fill-color': '#9fb4c4', 'fill-opacity': 0.06 },
      },
      {
        id: LAYERS.regionsLine,
        type: 'line',
        source: REGIONS_SOURCE,
        paint: {
          'line-color': '#b9cddb',
          'line-width': 1,
          'line-opacity': 0.55,
        },
      },
      {
        // One mark per detection, not per fire: the three VIIRS platforms see
        // the same fire on different passes and nothing merges them.
        //
        // Radiative power spans orders of magnitude —stubble sits near 1 MW and
        // a running wildfire passes 1.000— so the stops climb by tens instead of
        // evenly. Size and colour carry the same value on purpose: a reading
        // that depended on colour alone would be lost on a photograph.
        id: LAYERS.hotspots,
        type: 'circle',
        source: HOTSPOTS_SOURCE,
        layout: {
          // Which mark wins an overlap should be the fiercest one, not
          // whichever the server happened to send last.
          'circle-sort-key': ['get', 'frp'],
        },
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['get', 'frp'], 1, 3.5, 10, 6, 100, 10, 1000, 15],
          'circle-color': [
            'interpolate',
            ['linear'],
            ['get', 'frp'],
            1,
            '#b06a12',
            10,
            '#e08b1e',
            100,
            '#ffb13c',
            1000,
            '#ffe3ad',
          ],
          'circle-opacity': 0.9,
          // The dark ring is what detaches the mark from the imagery: over sand
          // or cloud an amber dot on its own dissolves.
          'circle-stroke-width': 1,
          'circle-stroke-color': '#2b1403',
          'circle-stroke-opacity': 0.8,
        },
      },
    ],
  };
}
