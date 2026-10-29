import type { FeatureCollection } from 'geojson';
import type { FilterSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import {
  BOUNDARIES_ATTRIBUTION,
  DEM_ATTRIBUTION,
  DEM_MAX_ZOOM,
  DEM_TILES,
  HOTSPOTS_URL,
  IMAGERY_ATTRIBUTION,
  IMAGERY_TILES,
  REGIONS_URL,
} from './map.config';

/** Layer ids the rest of the app refers to. Later layers are inserted above these. */
export const LAYERS = {
  background: 'background',
  satellite: 'basemap-satellite',
  hillshade: 'hillshade',
  regionsFill: 'regions-fill',
  regionsLine: 'regions-line',
  regionFocusFill: 'region-focus-fill',
  regionFocusLine: 'region-focus-line',
  provincesLine: 'provinces-line',
  provinceFocusFill: 'province-focus-fill',
  provinceFocusLine: 'province-focus-line',
  municipalitiesLine: 'municipalities-line',
  municipalityFocusFill: 'municipality-focus-fill',
  municipalityFocusLine: 'municipality-focus-line',
  hotspots: 'hotspots',
  ignitionHalo: 'ignition-halo',
  ignitionDot: 'ignition-dot',
} as const;

export const DEM_SOURCE = 'terrain-dem';
export const REGIONS_SOURCE = 'regions';
export const PROVINCES_SOURCE = 'provinces';
export const MUNICIPALITIES_SOURCE = 'municipalities';
export const IGNITION_SOURCE = 'ignition';

/** No point yet. The source has to exist from the start to be drawn into. */
const NO_POINT: FeatureCollection = { type: 'FeatureCollection', features: [] };
export const HOTSPOTS_SOURCE = 'hotspots';

/** An empty code matches no feature: this is how «nothing focused» is drawn. */
const NOTHING: FilterSpecification = ['==', ['get', 'id'], ''];

/**
 * The outline of whatever is being pointed at, shared by both steps so they
 * cannot drift apart.
 *
 * White and not the accent: over the imagery orange means fire, and a border
 * that borrowed that colour would say something it does not mean. The line
 * carries the weight, because a fill bright enough to be noticed would wash out
 * the terrain, which is the one thing the user is here to look at.
 */
const FOCUS_FILL = { 'fill-color': '#e6eaee', 'fill-opacity': 0.1 } as const;
const FOCUS_LINE = {
  'line-color': '#f4f8fb',
  'line-width': 2.5,
  'line-opacity': 0.95,
} as const;

/** The borders of the level below, drawn as faintly as the regions above them. */
const SUBDIVISION_LINE = {
  'line-color': '#b9cddb',
  'line-width': 1,
  'line-opacity': 0.55,
} as const;

/**
 * The province layers, added to the style the first time a step needs them.
 *
 * Built here and not in the service so that every layer of the map is declared
 * in one file, whether it opens with the style or arrives later.
 */
/**
 * The municipality layers, added the first time a step needs them.
 *
 * Unlike the provinces, the source holds one province's worth at a time and is
 * swapped with setData, so the border layer needs no filter: everything in the
 * source belongs to the province on screen.
 */
export function buildMunicipalityLayers(): LayerSpecification[] {
  return [
    {
      id: LAYERS.municipalitiesLine,
      type: 'line',
      source: MUNICIPALITIES_SOURCE,
      paint: { ...SUBDIVISION_LINE },
    },
    {
      id: LAYERS.municipalityFocusFill,
      type: 'fill',
      source: MUNICIPALITIES_SOURCE,
      filter: NOTHING,
      paint: { ...FOCUS_FILL },
    },
    {
      id: LAYERS.municipalityFocusLine,
      type: 'line',
      source: MUNICIPALITIES_SOURCE,
      filter: NOTHING,
      paint: { ...FOCUS_LINE },
    },
  ];
}

export function buildProvinceLayers(): LayerSpecification[] {
  return [
    {
      id: LAYERS.provincesLine,
      type: 'line',
      source: PROVINCES_SOURCE,
      filter: NOTHING,
      paint: { ...SUBDIVISION_LINE },
    },
    {
      id: LAYERS.provinceFocusFill,
      type: 'fill',
      source: PROVINCES_SOURCE,
      filter: NOTHING,
      paint: { ...FOCUS_FILL },
    },
    {
      id: LAYERS.provinceFocusLine,
      type: 'line',
      source: PROVINCES_SOURCE,
      filter: NOTHING,
      paint: { ...FOCUS_LINE },
    },
  ];
}

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
        data: REGIONS_URL,
        attribution: BOUNDARIES_ATTRIBUTION,
      },
      [HOTSPOTS_SOURCE]: {
        type: 'geojson',
        data: HOTSPOTS_URL,
        attribution: 'Focus: NASA FIRMS (VIIRS 375 m)',
      },
      [IGNITION_SOURCE]: { type: 'geojson', data: NO_POINT },
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
        paint: { ...SUBDIVISION_LINE },
      },
      {
        // The region under the pointer.
        //
        // Its own pair of layers instead of an expression over the ones above:
        // swapping a filter is among the cheapest things MapLibre does, which
        // is what lets the outline follow a pointer down a list of 24 without
        // stuttering, and it leaves the paint a constant that reads at a glance.
        id: LAYERS.regionFocusFill,
        type: 'fill',
        source: REGIONS_SOURCE,
        filter: NOTHING,
        paint: { ...FOCUS_FILL },
      },
      {
        id: LAYERS.regionFocusLine,
        type: 'line',
        source: REGIONS_SOURCE,
        filter: NOTHING,
        paint: { ...FOCUS_LINE },
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
      {
        // The ignition point, last of all so nothing can cover it. Two layers
        // because one dot is hard to find again over a photograph: the ring
        // says where to look and the dot says exactly where.
        id: LAYERS.ignitionHalo,
        type: 'circle',
        source: IGNITION_SOURCE,
        paint: {
          'circle-radius': 13,
          'circle-color': 'transparent',
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ff7a3c',
          'circle-stroke-opacity': 0.85,
        },
      },
      {
        id: LAYERS.ignitionDot,
        type: 'circle',
        source: IGNITION_SOURCE,
        paint: {
          'circle-radius': 4,
          'circle-color': '#ff7a3c',
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#2b1403',
        },
      },
    ],
  };
}
