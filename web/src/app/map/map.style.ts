import type { FeatureCollection } from 'geojson';
import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  StyleSpecification,
} from 'maplibre-gl';
import { contourTiles } from './contours';
import {
  BOUNDARIES_ATTRIBUTION,
  DEM_ATTRIBUTION,
  DEM_MAX_ZOOM,
  DEM_TILES,
  GLYPHS,
  IMAGERY_ATTRIBUTION,
  IMAGERY_TILES,
  LABEL_FONT,
  PLACES_ATTRIBUTION,
  REGIONS_URL,
} from './map.config';

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
  hotspotSelected: 'hotspot-selected',
  slopes: 'slopes',
  fire: 'fire',
  fireParticles: 'fire-particles',
  contourLines: 'contour-lines',
  contourLabels: 'contour-labels',
  placeLabels: 'place-labels',
  peakLabels: 'peak-labels',
  domainFill: 'domain-fill',
  domainMask: 'domain-mask',
  domainLine: 'domain-line',
  agents: 'agents-3d',
} as const;

export const DEM_SOURCE = 'terrain-dem';
const REGIONS_SOURCE = 'regions';
export const PROVINCES_SOURCE = 'provinces';
export const MUNICIPALITIES_SOURCE = 'municipalities';
export const PLACES_SOURCE = 'places';
const CONTOURS_SOURCE = 'contours';
export const DOMAIN_SOURCE = 'domain';

// Image sources are added on demand because an empty image source is invalid.
export const SLOPES_SOURCE = 'slopes';

// Canvas sources are added on demand because they require a canvas.
export const FIRE_SOURCE = 'fire';

// Shared stops keep the layer, selection ring and legend consistent across orders of magnitude.
export const HOTSPOT_STOPS = [
  { mw: 1, radius: 3.5, colour: '#b06a12' },
  { mw: 10, radius: 6, colour: '#e08b1e' },
  { mw: 100, radius: 10, colour: '#ffb13c' },
  { mw: 1000, radius: 15, colour: '#ffe3ad' },
] as const;

// Only the mark radius scales with crowding; the ring clearance stays constant.
export function hotspotRadius(scale = 1, extra = 0): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['get', 'frp'],
    ...HOTSPOT_STOPS.flatMap((stop) => [stop.mw, stop.radius * scale + extra]),
  ] as ExpressionSpecification;
}

const SPARSE = 300;

const CROWDED = 5000;
const CROWDED_SCALE = 0.6;
const FULL_OPACITY = 0.9;
const CROWDED_OPACITY = 0.65;

// Crowding changes size and opacity by log(count), without merging, dropping or reordering
// detections.
export function hotspotDensity(count: number): { scale: number; opacity: number } {
  const span = Math.log(CROWDED / SPARSE);
  const crowding = Math.min(Math.max(Math.log(Math.max(count, 1) / SPARSE) / span, 0), 1);
  return {
    scale: 1 - crowding * (1 - CROWDED_SCALE),
    opacity: FULL_OPACITY - crowding * (FULL_OPACITY - CROWDED_OPACITY),
  };
}

// The date ramp gets lighter towards recent detections and remains ordered in greyscale.
export const HOTSPOT_DATE_STOPS = [
  { at: 0, colour: '#6a1f8a' },
  { at: 1 / 3, colour: '#c43c75' },
  { at: 2 / 3, colour: '#f8765c' },
  { at: 1, colour: '#fde3a0' },
] as const;

export type HotspotColourBy = 'power' | 'date';

// Size always shows power. Date colour uses normalized when; missing dates default to the bright
// recent end.
export function hotspotColour(by: HotspotColourBy): ExpressionSpecification {
  if (by === 'date') {
    return [
      'interpolate',
      ['linear'],
      ['coalesce', ['get', 'when'], 1],
      ...HOTSPOT_DATE_STOPS.flatMap((stop) => [stop.at, stop.colour]),
    ] as ExpressionSpecification;
  }
  return [
    'interpolate',
    ['linear'],
    ['get', 'frp'],
    ...HOTSPOT_STOPS.flatMap((stop) => [stop.mw, stop.colour]),
  ] as ExpressionSpecification;
}

const NO_POINT: FeatureCollection = { type: 'FeatureCollection', features: [] };
export const HOTSPOTS_SOURCE = 'hotspots';

// An empty code matches no feature.
const NOTHING: FilterSpecification = ['==', ['get', 'id'], ''];

const FOCUS_FILL = { 'fill-color': '#e6eaee', 'fill-opacity': 0.1 } as const;
const FOCUS_LINE = {
  'line-color': '#f4f8fb',
  'line-width': 2.5,
  'line-opacity': 0.95,
} as const;

const SUBDIVISION_LINE = {
  'line-color': '#b9cddb',
  'line-width': 1,
  'line-opacity': 0.55,
} as const;

// The municipality source holds one province at a time, so its layers need no province filter.
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

export function buildStyle(): StyleSpecification {
  return {
    version: 8,
    name: 'IgnisLab · base',
    glyphs: GLYPHS,
    sources: baseSources(),
    layers: [
      ...baseLayers(),
      ...regionLayers(),
      ...hotspotLayers(),
      ...domainFillLayers(),
      ...contourLayers(),
      ...domainOutlineLayers(),
      ...placeLayers(),
    ],
  };
}

function baseSources(): StyleSpecification['sources'] {
  return {
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
      data: NO_POINT,
      attribution: 'Focus: NASA FIRMS (VIIRS 375 m)',
    },
    [DOMAIN_SOURCE]: { type: 'geojson', data: NO_POINT },
    [PLACES_SOURCE]: {
      type: 'geojson',
      data: NO_POINT,
      attribution: PLACES_ATTRIBUTION,
    },
    [CONTOURS_SOURCE]: {
      type: 'vector',
      tiles: [contourTiles()],

      maxzoom: DEM_MAX_ZOOM,
    },
  };
}

function baseLayers(): LayerSpecification[] {
  return [
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
  ];
}

function regionLayers(): LayerSpecification[] {
  return [
    {
      // The nearly invisible fill makes the whole region clickable, not only its border.
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
      // Separate focus layers allow cheap filter changes while keeping their paint constant.
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
  ];
}

function hotspotLayers(): LayerSpecification[] {
  return [
    {
      // A detection is one platform overpass, not a merged fire.
      id: LAYERS.hotspots,
      type: 'circle',
      source: HOTSPOTS_SOURCE,
      layout: {
        // Draw stronger detections above weaker overlaps.
        'circle-sort-key': ['get', 'frp'],
      },
      paint: {
        'circle-radius': hotspotRadius(),
        'circle-color': hotspotColour('power'),
        'circle-opacity': FULL_OPACITY,

        'circle-stroke-width': 1,
        'circle-stroke-color': '#2b1403',
        'circle-stroke-opacity': 0.8,
      },
    },
    {
      // Transparent fill: the detection’s own circle stays visible inside the ring.
      id: LAYERS.hotspotSelected,
      type: 'circle',
      source: HOTSPOTS_SOURCE,
      filter: NOTHING,
      paint: {
        'circle-radius': hotspotRadius(1, 4),
        'circle-color': 'transparent',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
      },
    },
  ];
}

function domainFillLayers(): LayerSpecification[] {
  return [
    {
      id: LAYERS.domainFill,
      type: 'fill',
      source: DOMAIN_SOURCE,
      filter: ['!=', ['get', 'mask'], true],
      paint: { 'fill-color': '#f4f8fb', 'fill-opacity': 0.05 },
    },
  ];
}

function contourLayers(): LayerSpecification[] {
  return [
    {
      id: LAYERS.contourLines,
      type: 'line',
      source: CONTOURS_SOURCE,
      'source-layer': 'contours',
      // Terrarium includes negative seafloor elevations; exclude isobaths from the fire map.
      filter: ['>', ['get', 'ele'], 0],
      layout: { visibility: 'none' },
      paint: {
        'line-color': '#f2f6fa',
        // Every fifth contour is a heavier index contour.
        'line-width': ['match', ['get', 'level'], 1, 1.3, 0.7],

        'line-opacity': ['match', ['get', 'level'], 1, 0.7, 0.4],
      },
    },
    {
      id: LAYERS.contourLabels,
      type: 'symbol',
      source: CONTOURS_SOURCE,
      'source-layer': 'contours',
      filter: ['all', ['>', ['get', 'level'], 0], ['>', ['get', 'ele'], 0]],

      minzoom: 12,
      layout: {
        visibility: 'none',
        'symbol-placement': 'line',
        'text-field': ['concat', ['number-format', ['get', 'ele'], { locale: 'ca-ES' }], ' m'],
        'text-font': [LABEL_FONT],
        'text-size': 10,
        'symbol-spacing': 320,
        'text-max-angle': 25,
      },
      paint: {
        'text-color': '#f2f6fa',
        'text-halo-color': 'rgba(8, 12, 16, 0.7)',
        'text-halo-width': 1,
        'text-opacity': 0.75,
      },
    },
  ];
}

function domainOutlineLayers(): LayerSpecification[] {
  return [
    {
      // The mask polygon has the domain as its hole. Keep it above ground overlays and below
      // labels.
      id: LAYERS.domainMask,
      type: 'fill',
      source: DOMAIN_SOURCE,
      filter: ['==', ['get', 'mask'], true],
      layout: { visibility: 'none' },
      paint: { 'fill-color': '#0e141a', 'fill-opacity': 0.97 },
    },
    {
      // Dashed to distinguish the computed domain from administrative boundaries; placed above
      // the mask so its outer half remains visible.
      id: LAYERS.domainLine,
      type: 'line',
      source: DOMAIN_SOURCE,
      filter: ['!=', ['get', 'mask'], true],
      paint: {
        'line-color': '#f4f8fb',
        'line-width': 1.5,
        'line-opacity': 0.9,
        'line-dasharray': [4, 3],
      },
    },
  ];
}

function placeLayers(): LayerSpecification[] {
  return [
    {
      // Settlement layers precede peaks so settlement names win label collisions.
      id: LAYERS.placeLabels,
      type: 'symbol',
      source: PLACES_SOURCE,
      filter: ['!=', ['get', 'kind'], 'peak'],
      layout: {
        'text-field': ['get', 'name'],
        'text-font': [LABEL_FONT],
        'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 13, 15],
        'text-max-width': 7,
        // Lower sort keys win label collisions: cities, towns, then villages.
        'symbol-sort-key': ['get', 'rank'],
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': 'rgba(8, 12, 16, 0.85)',
        'text-halo-width': 1.3,
      },
    },
    {
      // Place higher peaks first when summit labels collide.
      id: LAYERS.peakLabels,
      type: 'symbol',
      source: PLACES_SOURCE,
      filter: ['==', ['get', 'kind'], 'peak'],

      minzoom: 9.5,
      layout: {
        'text-field': [
          'concat',
          ['get', 'name'],
          '  ',
          ['number-format', ['get', 'ele'], { locale: 'ca-ES' }],
          ' m',
        ],
        'text-font': [LABEL_FONT],
        'text-size': ['interpolate', ['linear'], ['zoom'], 10.5, 9.5, 13, 12],
        'text-max-width': 9,
        'symbol-sort-key': ['-', ['get', 'ele']],
      },
      paint: {
        'text-color': '#d8e2ea',
        'text-halo-color': 'rgba(8, 12, 16, 0.8)',
        'text-halo-width': 1.1,
        'text-opacity': 0.85,
      },
    },
  ];
}
