import type { GeoJSONSource, Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { writeSource } from './source-data';

type Point = readonly [number, number];

/** What the display needs of a measure: where, how wide, what colour. */
export interface DrawnMeasure {
  readonly id: string;
  readonly points: readonly Point[];
  readonly widthM: number;
  readonly colour: string;
  /** A disc of that diameter, not a strip of that width. */
  readonly disc: boolean;
}

export interface DrawnDraft {
  readonly points: readonly Point[];
  /** Where the pointer is, for the segment not yet clicked. */
  readonly pointer: Point | null;
  readonly widthM: number;
  readonly colour: string;
  readonly disc: boolean;
}

const SOURCE = 'countermeasures';
const DRAFT_SOURCE = 'countermeasure-draft';
const LAYERS = {
  band: 'countermeasure-band',
  disc: 'countermeasure-disc',
  discEdge: 'countermeasure-disc-edge',
  axis: 'countermeasure-axis',
  selected: 'countermeasure-selected',
  draftBand: 'countermeasure-draft-band',
  draftDisc: 'countermeasure-draft-disc',
  draftAxis: 'countermeasure-draft-axis',
  draftVertex: 'countermeasure-draft-vertex',
} as const;

const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Metres per pixel at zoom 0 on the equator, for MapLibre's 512 px tiles. */
const M_PER_PX_Z0 = 78_271.517;
const M_PER_DEGREE = 111_320;
const HIT_SLOP = 4;

/**
 * A line as wide as the strip really is.
 *
 * `line-width` is in pixels, and a strip is in metres. Pixels per metre double
 * with every zoom level, so the width is `w0 · 2^zoom`, where `w0` —the width
 * at zoom 0, worked out per feature from its latitude— travels as a property.
 * An exponential interpolation of base 2 between two zooms is exactly that
 * curve, and it is the only shape MapLibre lets a zoom expression take.
 */
const WIDTH_IN_METRES = [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  0,
  ['get', 'w0'],
  24,
  ['*', ['get', 'w0'], 2 ** 24],
] as unknown as number;

function widthAtZoom0(widthM: number, latitude: number): number {
  return widthM / (M_PER_PX_Z0 * Math.cos((latitude * Math.PI) / 180));
}

/** A circle on the ground as a polygon: a `fill` drapes over the relief. */
function discRing(centre: Point, diameterM: number): [number, number][] {
  const radius = diameterM / 2;
  const dLat = radius / M_PER_DEGREE;
  const dLon = radius / (M_PER_DEGREE * Math.cos((centre[1] * Math.PI) / 180));
  const ring: [number, number][] = [];
  for (let i = 0; i <= 48; i += 1) {
    const angle = (i / 48) * 2 * Math.PI;
    ring.push([centre[0] + dLon * Math.cos(angle), centre[1] + dLat * Math.sin(angle)]);
  }
  ring[ring.length - 1] = [...ring[0]];
  return ring;
}

function shape(
  points: readonly Point[],
  widthM: number,
  disc: boolean,
  properties: Record<string, unknown>,
): Feature | null {
  if (disc) {
    if (!points.length) return null;
    return {
      type: 'Feature',
      properties,
      geometry: { type: 'Polygon', coordinates: [discRing(points[0], widthM)] },
    };
  }
  if (points.length < 2) return null;
  return {
    type: 'Feature',
    properties: { ...properties, w0: widthAtZoom0(widthM, points[0][1]) },
    geometry: { type: 'LineString', coordinates: points.map(([lon, lat]) => [lon, lat]) },
  };
}

/**
 * The countermeasures on the map: the plan, and the line being drawn.
 *
 * Layers of the style and not DOM markers, unlike the ignitions: a strip has a
 * width on the ground and has to lie on the hillside it crosses, which is what
 * `line` and `fill` layers do on the relief and an element cannot.
 *
 * Each strip is drawn twice. A translucent band of its true width says how
 * much ground it takes —thirty metres is a hair at the framing of the whole
 * domain—, and a thin axis over it keeps the measure findable at any zoom.
 *
 * Owns its two sources and its layers and nothing else on the map: attach()
 * puts them up, detach() takes down exactly those and the click listener.
 */
export class CountermeasureDisplay {
  private map: MapLibreMap | null = null;
  private drawing = false;
  private onSelect: ((id: string | null) => void) | null = null;

  private readonly clicked = (event: MapMouseEvent) => {
    const map = this.map;
    // While a tool is in the hand a click is a vertex, not a selection.
    if (!map || this.drawing || !this.onSelect) return;
    const { x, y } = event.point;
    const hits = map.queryRenderedFeatures(
      [
        [x - HIT_SLOP, y - HIT_SLOP],
        [x + HIT_SLOP, y + HIT_SLOP],
      ],
      { layers: [LAYERS.axis, LAYERS.band, LAYERS.disc] },
    );
    const id = hits[0]?.properties?.['id'];
    this.onSelect(typeof id === 'string' ? id : null);
  };

  /** Puts the layers up. The style must have loaded: wait for MapService.ready. */
  public attach(map: MapLibreMap, onSelect: (id: string | null) => void): void {
    if (this.map === map) return;
    this.detach();
    this.map = map;
    this.onSelect = onSelect;

    map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
    map.addSource(DRAFT_SOURCE, { type: 'geojson', data: EMPTY });

    const lines = ['==', ['geometry-type'], 'LineString'] as unknown as never;
    const polygons = ['==', ['geometry-type'], 'Polygon'] as unknown as never;
    const round = { 'line-cap': 'round', 'line-join': 'round' } as const;

    map.addLayer({
      id: LAYERS.band,
      type: 'line',
      source: SOURCE,
      filter: lines,
      layout: round,
      paint: {
        'line-color': ['get', 'colour'],
        'line-width': WIDTH_IN_METRES,
        'line-opacity': 0.4,
      },
    });
    map.addLayer({
      id: LAYERS.disc,
      type: 'fill',
      source: SOURCE,
      filter: polygons,
      paint: { 'fill-color': ['get', 'colour'], 'fill-opacity': 0.4 },
    });
    map.addLayer({
      id: LAYERS.discEdge,
      type: 'line',
      source: SOURCE,
      filter: polygons,
      paint: { 'line-color': ['get', 'colour'], 'line-width': 1.5 },
    });
    map.addLayer({
      id: LAYERS.axis,
      type: 'line',
      source: SOURCE,
      filter: lines,
      layout: round,
      paint: { 'line-color': ['get', 'colour'], 'line-width': 2 },
    });
    // The selected one, outlined in white over whatever colour it has.
    map.addLayer({
      id: LAYERS.selected,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['get', 'selected'], true],
      layout: round,
      paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-gap-width': 3 },
    });

    map.addLayer({
      id: LAYERS.draftBand,
      type: 'line',
      source: DRAFT_SOURCE,
      filter: ['==', ['get', 'part'], 'band'],
      layout: round,
      paint: {
        'line-color': ['get', 'colour'],
        'line-width': WIDTH_IN_METRES,
        'line-opacity': 0.25,
      },
    });
    map.addLayer({
      id: LAYERS.draftDisc,
      type: 'fill',
      source: DRAFT_SOURCE,
      filter: ['==', ['get', 'part'], 'disc'],
      paint: { 'fill-color': ['get', 'colour'], 'fill-opacity': 0.25 },
    });
    map.addLayer({
      id: LAYERS.draftAxis,
      type: 'line',
      source: DRAFT_SOURCE,
      filter: ['==', ['get', 'part'], 'band'],
      layout: round,
      paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-dasharray': [2, 2] },
    });
    map.addLayer({
      id: LAYERS.draftVertex,
      type: 'circle',
      source: DRAFT_SOURCE,
      filter: ['==', ['get', 'part'], 'vertex'],
      paint: {
        'circle-radius': 4,
        'circle-color': '#ffffff',
        'circle-stroke-color': ['get', 'colour'],
        'circle-stroke-width': 2,
      },
    });

    map.on('click', this.clicked);
  }

  /** The plan, with one of its measures marked as the selected one. */
  public setMeasures(measures: readonly DrawnMeasure[], selected: string | null): void {
    const features = measures
      .map((measure) =>
        shape(measure.points, measure.widthM, measure.disc, {
          id: measure.id,
          colour: measure.colour,
          selected: measure.id === selected,
        }),
      )
      .filter((feature): feature is Feature => feature !== null);
    this.write(SOURCE, { type: 'FeatureCollection', features });
  }

  /**
   * The line in progress, or nothing.
   *
   * The vertices clicked, and one more that follows the pointer, so the next
   * segment is seen before it is committed. For a point tool the pointer alone
   * is the preview: the disc that a click would leave.
   */
  public setDraft(draft: DrawnDraft | null): void {
    this.drawing = draft !== null;
    if (!draft) {
      this.write(DRAFT_SOURCE, EMPTY);
      return;
    }
    const features: Feature[] = [];
    if (draft.disc) {
      const disc = draft.pointer
        ? shape([draft.pointer], draft.widthM, true, { part: 'disc', colour: draft.colour })
        : null;
      if (disc) features.push(disc);
    } else {
      // Before the first vertex, the brush: a disc as wide as the strip, under
      // the pointer, so the tool shows the ground it will take (§11.39).
      if (draft.pointer && !draft.points.length) {
        const brush = shape([draft.pointer], draft.widthM, true, {
          part: 'disc',
          colour: draft.colour,
        });
        if (brush) features.push(brush);
      }
      const path =
        draft.pointer && draft.points.length ? [...draft.points, draft.pointer] : draft.points;
      const band = shape(path, draft.widthM, false, { part: 'band', colour: draft.colour });
      if (band) features.push(band);
      for (const point of draft.points) {
        features.push({
          type: 'Feature',
          properties: { part: 'vertex', colour: draft.colour },
          geometry: { type: 'Point', coordinates: [point[0], point[1]] },
        });
      }
    }
    this.write(DRAFT_SOURCE, { type: 'FeatureCollection', features });
  }

  /** Takes down what attach() put up. Safe on a map already removed. */
  public detach(): void {
    const map = this.map;
    this.map = null;
    this.onSelect = null;
    this.drawing = false;
    if (!map) return;
    try {
      map.off('click', this.clicked);
      for (const id of Object.values(LAYERS)) if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [SOURCE, DRAFT_SOURCE]) if (map.getSource(id)) map.removeSource(id);
    } catch {
      // The map was removed first and took its layers with it: nothing left to undo.
    }
  }

  private write(source: string, data: FeatureCollection): void {
    writeSource(this.map?.getSource(source) as GeoJSONSource | undefined, data);
  }
}
