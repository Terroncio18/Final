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
  RESOURCES_ATTRIBUTION,
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
  lakesFill: 'lakes-fill',
  lakesLine: 'lakes-line',
  resources: 'resources',
  agentRoutes: 'agent-routes',
  agents: 'agents',
} as const;

export const DEM_SOURCE = 'terrain-dem';
export const REGIONS_SOURCE = 'regions';
export const PROVINCES_SOURCE = 'provinces';
export const MUNICIPALITIES_SOURCE = 'municipalities';
export const PLACES_SOURCE = 'places';
export const RESOURCES_SOURCE = 'resources';
export const LAKES_SOURCE = 'lakes';
export const AGENTS_SOURCE = 'agents';
export const CONTOURS_SOURCE = 'contours';
export const DOMAIN_SOURCE = 'domain';

/** Not in the style: an image source needs its image, so it is added on demand. */
export const SLOPES_SOURCE = 'slopes';

/** The simulated fire. Added on demand too: a canvas source needs its canvas. */
export const FIRE_SOURCE = 'fire';

/**
 * How a detection is drawn, by its radiative power.
 *
 * In one place because three things read it: the radius and the colour of the
 * layer, the ring around the selected detection, and the legend of the
 * portada —which would otherwise be a second copy of these numbers, free to
 * drift from what the map actually paints.
 *
 * The stops climb by tens because the power spans orders of magnitude (§2.16).
 */
export const HOTSPOT_STOPS = [
  { mw: 1, radius: 3.5, colour: '#b06a12' },
  { mw: 10, radius: 6, colour: '#e08b1e' },
  { mw: 100, radius: 10, colour: '#ffb13c' },
  { mw: 1000, radius: 15, colour: '#ffe3ad' },
] as const;

/**
 * The radius of a mark: the stop's own, shrunk by `scale` when the map is
 * crowded (see hotspotDensity), plus whatever a ring around it needs to clear
 * it. The ring's clearance is not scaled: it is a gap, not a size.
 */
export function hotspotRadius(scale = 1, extra = 0): ExpressionSpecification {
  return [
    'interpolate',
    ['linear'],
    ['get', 'frp'],
    ...HOTSPOT_STOPS.flatMap((stop) => [stop.mw, stop.radius * scale + extra]),
  ] as ExpressionSpecification;
}

/** Up to here the marks are drawn at full size: a day is one or two hundred. */
const SPARSE = 300;
/** From here on they are as small as they get: a summer month is four thousand. */
const CROWDED = 5000;
const CROWDED_SCALE = 0.6;
const FULL_OPACITY = 0.9;
const CROWDED_OPACITY = 0.65;

/**
 * How the marks are drawn for a given number of them on screen.
 *
 * A day of detections is a couple of hundred marks and each can be read; a
 * month is four thousand, and at full size the large ones bury the small ones
 * and Galicia in August is one orange stain. So past a few hundred the marks
 * shrink and thin out, down to 60 % of the size and 65 % of the opacity.
 *
 * **Presentation and nothing else.** No detection is merged, dropped or
 * averaged —that would be deciding what makes two of them the same fire,
 * which is §3.7 and is not decided— and the order between them is untouched:
 * every mark is scaled by the same factor, so a mark twice as large as another
 * still is. The legend reads the same factor and shows the sizes in use.
 *
 * By the logarithm of the count, for the reason the stops climb by tens: from
 * three hundred to six hundred is a bigger change on screen than from four
 * thousand to four thousand three hundred.
 */
export function hotspotDensity(count: number): { scale: number; opacity: number } {
  const span = Math.log(CROWDED / SPARSE);
  const crowding = Math.min(Math.max(Math.log(Math.max(count, 1) / SPARSE) / span, 0), 1);
  return {
    scale: 1 - crowding * (1 - CROWDED_SCALE),
    opacity: FULL_OPACITY - crowding * (FULL_OPACITY - CROWDED_OPACITY),
  };
}

/**
 * The colours of a detection by when it was seen, from the first day of the
 * range on screen to the last.
 *
 * A different ramp from the power's amber, on purpose: when the colour changes
 * meaning it has to change looks, or yesterday's reading of the map is carried
 * over to a map that no longer says it. Violet to pale yellow, which gets
 * lighter all the way —so the order survives a greyscale print, the same test
 * §2.16 set— and whose old end is a colour the photograph underneath does not
 * have. The recent end is the bright one because recent is what the eye should
 * find first.
 */
export const HOTSPOT_DATE_STOPS = [
  { at: 0, colour: '#6a1f8a' },
  { at: 1 / 3, colour: '#c43c75' },
  { at: 2 / 3, colour: '#f8765c' },
  { at: 1, colour: '#fde3a0' },
] as const;

/** What the colour of a mark is saying. The size always says the power. */
export type HotspotColourBy = 'power' | 'date';

/**
 * The colour of a mark.
 *
 * By power, colour and size carry the same value (§2.16). By date, the colour
 * reads `when` —where in the range the detection falls, from 0 to 1, written
 * on each feature by whoever loads them— and the size is left to carry the
 * power alone. A detection without it is drawn as the most recent, which is
 * the bright end: a mark that stands out is a better mistake than one that
 * hides.
 */
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
      // Empty on purpose, like the other sources a service feeds: the
      // detections depend on the dates in the URL, and the style is built
      // once. HotspotsService fetches them and sets them here.
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
      [LAKES_SOURCE]: { type: 'geojson', data: NO_POINT },
      [RESOURCES_SOURCE]: {
        type: 'geojson',
        data: NO_POINT,
        attribution: RESOURCES_ATTRIBUTION,
      },
      [AGENTS_SOURCE]: { type: 'geojson', data: NO_POINT },
      [CONTOURS_SOURCE]: {
        type: 'vector',
        tiles: [contourTiles()],
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
          'circle-radius': hotspotRadius(),
          'circle-color': hotspotColour('power'),
          'circle-opacity': FULL_OPACITY,
          // The dark ring is what detaches the mark from the imagery: over sand
          // or cloud an amber dot on its own dissolves.
          'circle-stroke-width': 1,
          'circle-stroke-color': '#2b1403',
          'circle-stroke-opacity': 0.8,
        },
      },
      {
        // The detection the panel is describing. A ring and no fill, so the
        // mark underneath keeps its own size and colour, and white because on
        // this map white is what points at something (§2.22) while orange is
        // the fire itself. Still, like every highlight here: nothing blinks.
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
      {
        // The simulation domain. Dashed, and that is the whole distinction:
        // the solid white outlines are administrative and come from a
        // register, while this one is computed and exists only here.
        id: LAYERS.domainFill,
        type: 'fill',
        source: DOMAIN_SOURCE,
        filter: ['!=', ['get', 'mask'], true],
        paint: { 'fill-color': '#f4f8fb', 'fill-opacity': 0.05 },
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
        // Everything that is not the domain, painted out.
        //
        // The simulation happens inside the square and nowhere else, so on the
        // simulator's map the square is all there is to see: one polygon whose
        // outer ring is a wide box and whose hole is the domain. A `fill` is
        // draped onto the terrain (§13.1), which is what makes this work in
        // relief: the paint follows the ground instead of floating over it.
        //
        // Off unless a screen asks for it. The form needs the surroundings,
        // because the point is chosen by looking at where the square falls.
        //
        // After the contours and before the labels: what has to disappear is
        // everything drawn on the ground outside the square, and the names are
        // already cut to the domain by the service that loads them.
        id: LAYERS.domainMask,
        type: 'fill',
        source: DOMAIN_SOURCE,
        filter: ['==', ['get', 'mask'], true],
        layout: { visibility: 'none' },
        paint: { 'fill-color': '#0e141a', 'fill-opacity': 0.97 },
      },
      {
        // Over the mask, which is why it moved down here: the outline sits
        // exactly on the hole's edge, so underneath it would be half painted
        // over.
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
        // The official lakes and reservoirs of the domain (§11.48): where an
        // aircraft may load. Draped, so the water lies on the relief; the named
        // ones also get a water mark (resources).
        id: LAYERS.lakesFill,
        type: 'fill',
        source: LAKES_SOURCE,
        paint: { 'fill-color': '#5dbad7', 'fill-opacity': 0.35 },
      },
      {
        id: LAYERS.lakesLine,
        type: 'line',
        source: LAKES_SOURCE,
        paint: { 'line-color': '#9ad8ec', 'line-width': 1.2, 'line-opacity': 0.9 },
      },
      {
        // Stations, water points and aerodromes (12.23): green marks that
        // stand up on the relief like the names (§13.1), told apart by the
        // glyph. Over the names, because they are what this screen acts on;
        // the name of each only from close up.
        id: LAYERS.resources,
        type: 'symbol',
        source: RESOURCES_SOURCE,
        layout: {
          'icon-image': ['concat', 'resource-', ['get', 'kind']],
          'icon-allow-overlap': true,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.8, 13, 1],
          'text-field': ['step', ['zoom'], '', 13, ['get', 'name']],
          'text-font': [LABEL_FONT],
          'text-size': 11,
          'text-offset': [0, 1.4],
          'text-anchor': 'top',
          'text-optional': true,
          'text-max-width': 9,
        },
        paint: {
          'text-color': '#bfe8c9',
          'text-halo-color': 'rgba(8, 12, 16, 0.85)',
          'text-halo-width': 1.1,
        },
      },
      {
        // Where each aircraft flies between (12.20): a faint dashed line from
        // where it loads to where it drops. A line is draped (§13.1), so it
        // lies on the ground under the flight, like a shadow of the route.
        id: LAYERS.agentRoutes,
        type: 'line',
        source: AGENTS_SOURCE,
        filter: ['==', ['geometry-type'], 'LineString'],
        paint: {
          'line-color': '#f2c94c',
          'line-width': 1.2,
          'line-opacity': 0.55,
          'line-dasharray': [2, 3],
        },
      },
      {
        // Who is working (12.20): a crew at the head of its line, an aircraft
        // on its way. Over everything, because they move.
        id: LAYERS.agents,
        type: 'symbol',
        source: AGENTS_SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        layout: {
          'icon-image': ['concat', 'agent-', ['get', 'kind']],
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          // Keep silhouettes legible at the domain view and upright on relief.
          'icon-size': ['interpolate', ['linear'], ['zoom'], 9, 0.94, 13, 1],
          'icon-pitch-alignment': 'viewport',
          'icon-rotation-alignment': 'viewport',
        },
      },
    ],
  };
}
