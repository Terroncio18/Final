import type { FeatureCollection } from 'geojson';
import type { FilterSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { CONTOUR_TILES } from './contours';
import {
  BOUNDARIES_ATTRIBUTION,
  DEM_ATTRIBUTION,
  DEM_MAX_ZOOM,
  DEM_TILES,
  GLYPHS,
  HOTSPOTS_URL,
  IMAGERY_ATTRIBUTION,
  IMAGERY_TILES,
  LABEL_FONT,
  PLACES_ATTRIBUTION,
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
  contourLines: 'contour-lines',
  contourLabels: 'contour-labels',
  placeLabels: 'place-labels',
  peakLabels: 'peak-labels',
  domainFill: 'domain-fill',
  domainLine: 'domain-line',
  ignitionHalo: 'ignition-halo',
  ignitionDot: 'ignition-dot',
} as const;

export const DEM_SOURCE = 'terrain-dem';
export const REGIONS_SOURCE = 'regions';
export const PROVINCES_SOURCE = 'provinces';
export const MUNICIPALITIES_SOURCE = 'municipalities';
export const IGNITION_SOURCE = 'ignition';
export const PLACES_SOURCE = 'places';
export const CONTOURS_SOURCE = 'contours';
export const DOMAIN_SOURCE = 'domain';

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
    glyphs: GLYPHS,
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
      [DOMAIN_SOURCE]: { type: 'geojson', data: NO_POINT },
      [IGNITION_SOURCE]: { type: 'geojson', data: NO_POINT },
      [PLACES_SOURCE]: {
        type: 'geojson',
        data: NO_POINT,
        attribution: PLACES_ATTRIBUTION,
      },
      [CONTOURS_SOURCE]: {
        type: 'vector',
        tiles: [CONTOUR_TILES],
        // Traced from the elevation tiles, so they stop where those do.
        maxzoom: DEM_MAX_ZOOM,
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
          'circle-radius': [
            'interpolate',
            ['linear'],
            ['get', 'frp'],
            1,
            3.5,
            10,
            6,
            100,
            10,
            1000,
            15,
          ],
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
        // The simulation domain. Dashed, and that is the whole distinction:
        // the solid white outlines are administrative and come from a
        // register, while this one is computed and exists only here.
        id: LAYERS.domainFill,
        type: 'fill',
        source: DOMAIN_SOURCE,
        paint: { 'fill-color': '#f4f8fb', 'fill-opacity': 0.05 },
      },
      {
        id: LAYERS.domainLine,
        type: 'line',
        source: DOMAIN_SOURCE,
        paint: {
          'line-color': '#f4f8fb',
          'line-width': 1.5,
          'line-opacity': 0.9,
          'line-dasharray': [4, 3],
        },
      },
      {
        // Contours are `line`, which MapLibre does drape (§13.1), and that is
        // what they want: an isoline that did not follow the ground would be
        // a drawing of a different hill. Off until a screen asks for them —
        // the form's map is flat and a contour on a flat map is a decoration.
        id: LAYERS.contourLines,
        type: 'line',
        source: CONTOURS_SOURCE,
        'source-layer': 'contours',
        // Dry land only. Terrarium carries the sea floor as negative
        // elevation and the tracer has no opinion about it, so without this
        // the bay comes with isobaths at −200 m: true, and nothing to do with
        // a fire.
        filter: ['>', ['get', 'ele'], 0],
        layout: { visibility: 'none' },
        paint: {
          'line-color': '#f2f6fa',
          // Every fifth line carries the height, so it is drawn heavier.
          'line-width': ['match', ['get', 'level'], 1, 1.3, 0.7],
          // Faint enough not to compete with the photograph, strong enough to
          // be read over it: at a fifth of an opacity the first version was
          // drawing twenty-five lines that nobody could see.
          'line-opacity': ['match', ['get', 'level'], 1, 0.7, 0.4],
        },
      },
      {
        id: LAYERS.contourLabels,
        type: 'symbol',
        source: CONTOURS_SOURCE,
        'source-layer': 'contours',
        filter: ['all', ['>', ['get', 'level'], 0], ['>', ['get', 'ele'], 0]],
        // Only once the camera is inside the domain. At the opening framing
        // the figures would be a second layer of text over the names.
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
      {
        // Names over the ground and not painted on it: a symbol layer is one
        // of the things MapLibre does not drape over the terrain (§13.1), so
        // the text stands upright on the relief instead of wrapping over a
        // hillside the way a label in the imagery would.
        //
        // Settlements before peaks, because collision is resolved in the order
        // the layers are drawn: when a name and a summit want the same pixels,
        // the name wins.
        id: LAYERS.placeLabels,
        type: 'symbol',
        source: PLACES_SOURCE,
        filter: ['!=', ['get', 'kind'], 'peak'],
        layout: {
          'text-field': ['get', 'name'],
          'text-font': [LABEL_FONT],
          'text-size': ['interpolate', ['linear'], ['zoom'], 9, 11, 13, 15],
          'text-max-width': 7,
          // Lower goes first and first wins: cities, then towns, then
          // villages. Without it the order is whatever the file happens to be.
          'symbol-sort-key': ['get', 'rank'],
        },
        paint: {
          'text-color': '#ffffff',
          'text-halo-color': 'rgba(8, 12, 16, 0.85)',
          'text-halo-width': 1.3,
        },
      },
      {
        // The summits, dimmer and only from close up. Six hundred of them
        // come in each province's file and a domain holds a dozen legible
        // ones, so the height decides which: the highest is placed first and
        // the rest give way to it.
        id: LAYERS.peakLabels,
        type: 'symbol',
        source: PLACES_SOURCE,
        filter: ['==', ['get', 'kind'], 'peak'],
        // The domain is framed at about zoom 10, so anything stricter would
        // keep the summits off the one view this screen opens on.
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
