import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  GeoJSONSource,
  Map as MapLibreMap,
  MapMouseEvent,
} from 'maplibre-gl';
import type { Feature, FeatureCollection } from 'geojson';
import { writeSource } from './source-data';
import { degreesFor } from '../simulation/geo';

type Point = readonly [number, number];

interface DrawnMeasure {
  readonly id: string;
  readonly points: readonly Point[];
  readonly widthM: number;
  readonly colour: string;
  // For a disc this is its diameter, rather than a strip width.
  readonly disc: boolean;
}

interface DrawnDraft {
  readonly points: readonly Point[];

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

// Metres per pixel at zoom 0 on the equator, using MapLibre 512 px tiles.
const M_PER_PX_Z0 = 78_271.517;
const HIT_SLOP = 4;

// MapLibre line widths are pixels: w0 × 2^zoom converts a ground width at the feature latitude.
// Zoom expressions require exponential interpolation.
const WIDTH_IN_METRES: ExpressionSpecification = [
  'interpolate',
  ['exponential', 2],
  ['zoom'],
  0,
  ['get', 'w0'],
  24,
  ['*', ['get', 'w0'], 2 ** 24],
];

function widthAtZoom0(widthM: number, latitude: number): number {
  return widthM / (M_PER_PX_Z0 * Math.cos((latitude * Math.PI) / 180));
}

// A fill polygon drapes the disc over terrain.
function discRing(centre: Point, diameterM: number): [number, number][] {
  const radius = diameterM / 2;
  const { dLat, dLon } = degreesFor(radius, centre[1]);
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
  properties:
    { id: string; colour: string; selected: boolean } | { part: 'disc' | 'band'; colour: string },
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

// Each strip has a band at its true ground width and a thin axis that remains visible at domain
// scale.
function measureLayers(): LayerSpecification[] {
  const lines: FilterSpecification = ['==', ['geometry-type'], 'LineString'];
  const polygons: FilterSpecification = ['==', ['geometry-type'], 'Polygon'];
  const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
  return [
    {
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
    },
    {
      id: LAYERS.disc,
      type: 'fill',
      source: SOURCE,
      filter: polygons,
      paint: { 'fill-color': ['get', 'colour'], 'fill-opacity': 0.4 },
    },
    {
      id: LAYERS.discEdge,
      type: 'line',
      source: SOURCE,
      filter: polygons,
      paint: { 'line-color': ['get', 'colour'], 'line-width': 1.5 },
    },
    {
      id: LAYERS.axis,
      type: 'line',
      source: SOURCE,
      filter: lines,
      layout: round,
      paint: { 'line-color': ['get', 'colour'], 'line-width': 2 },
    },
    {
      id: LAYERS.selected,
      type: 'line',
      source: SOURCE,
      filter: ['==', ['get', 'selected'], true],
      layout: round,
      paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-gap-width': 3 },
    },
  ];
}

function draftLayers(): LayerSpecification[] {
  const round = { 'line-cap': 'round', 'line-join': 'round' } as const;
  return [
    {
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
    },
    {
      id: LAYERS.draftDisc,
      type: 'fill',
      source: DRAFT_SOURCE,
      filter: ['==', ['get', 'part'], 'disc'],
      paint: { 'fill-color': ['get', 'colour'], 'fill-opacity': 0.25 },
    },
    {
      id: LAYERS.draftAxis,
      type: 'line',
      source: DRAFT_SOURCE,
      filter: ['==', ['get', 'part'], 'band'],
      layout: round,
      paint: { 'line-color': '#ffffff', 'line-width': 1.5, 'line-dasharray': [2, 2] },
    },
    {
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
    },
  ];
}

export class CountermeasureDisplay {
  private map: MapLibreMap | null = null;
  private drawing = false;
  private onSelect: ((id: string | null) => void) | null = null;

  // Wait for MapService.ready before attaching layers.
  public attach(map: MapLibreMap, onSelect: (id: string | null) => void): void {
    if (this.map === map) return;
    this.detach();
    this.map = map;
    this.onSelect = onSelect;
    map.addSource(SOURCE, { type: 'geojson', data: EMPTY });
    map.addSource(DRAFT_SOURCE, { type: 'geojson', data: EMPTY });
    for (const layer of measureLayers()) map.addLayer(layer);
    for (const layer of draftLayers()) map.addLayer(layer);
    map.on('click', this.clicked);
  }

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
      // Before the first vertex, preview a disc with the strip width.
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
      // A removed map has already discarded its layers.
    }
  }

  private readonly clicked = (event: MapMouseEvent) => {
    const map = this.map;
    // While drawing, clicks add vertices instead of selecting measures.
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

  private write(source: string, data: FeatureCollection): void {
    writeSource(this.map?.getSource(source) as GeoJSONSource | undefined, data);
  }
}
