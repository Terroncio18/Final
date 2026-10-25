import { Injectable, signal } from '@angular/core';
import {
  AttributionControl,
  MapLibreMap,
  ScaleControl,
  setWorkerUrl,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from 'maplibre-gl';

import type { Hotspot } from './hotspot';
import { VIEWS, type ViewId } from './map.config';
import { buildStyle, LAYERS } from './map.style';

/**
 * MapLibre picks its worker file name at runtime, which neither Vite nor esbuild
 * can follow, so the bundler emits no worker and the map loads nothing at all.
 * angular.json copies the file out of node_modules as a static asset and this
 * points MapLibre at it, which works the same in development and in a build.
 */
setWorkerUrl(new URL('maplibre-gl-worker.mjs', document.baseURI).href);

/** Framing is the same at every level; only the animation changes. */
const FIT = { padding: 24 } as const;

/** Half the side of the click target, in pixels. */
const HIT_SLOP = 2;

function frpOf(feature: MapGeoJSONFeature): number {
  return Number(feature.properties['frp'] ?? 0);
}

/** The position lives in the geometry; the panel should not have to parse GeoJSON. */
function toHotspot(feature: MapGeoJSONFeature): Hotspot {
  const { coordinates } = feature.geometry as { coordinates: [number, number] };
  const [lon, lat] = coordinates;
  return { ...(feature.properties as Omit<Hotspot, 'lon' | 'lat'>), lon, lat };
}

/**
 * Owns the MapLibre instance.
 *
 * The map is deliberately kept out of Angular's view: it has its own canvas and
 * its own render loop, and Angular only decides where the container element
 * sits. Everything else talks to it imperatively through this service.
 *
 * The application is zoneless, so map events do not trigger change detection by
 * themselves. Anything the template must react to is published as a signal.
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  private instance: MapLibreMap | null = null;

  /** False until the style has loaded and the first view is framed. */
  readonly ready = signal(false);

  /**
   * The detection the panel is showing, or nothing.
   *
   * A signal because the application is zoneless: a MapLibre click happens
   * outside Angular and nothing would redraw on its own.
   */
  readonly selected = signal<Hotspot | null>(null);

  get map(): MapLibreMap | null {
    return this.instance;
  }

  create(container: HTMLElement, initialView: ViewId): void {
    if (this.instance) return;

    const map = new MapLibreMap({
      container,
      style: buildStyle(),
      // A rough starting camera; the initial view is framed once the style is
      // in. Passing `bounds` here would be measured against a container the
      // layout has not sized yet, and MapLibre falls back to the whole world.
      center: [-3.7, 40.0],
      zoom: 4.5,
      pitch: 0,
      // The overview is a picture to click on, not a map to explore: at this
      // scale there is no detail worth panning to, and the fixed framing is what
      // the hotspot layer will be drawn against. This one option leaves every
      // gesture handler disabled —pan, scroll zoom, box zoom, double click,
      // keyboard, rotation and touch pitch— while `click` and `mousemove` keep
      // firing, because MapLibre registers those regardless of the flag. A zoom
      // range would be inert here, so there is none.
      interactive: false,
      attributionControl: false,
    });

    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.addControl(
      new AttributionControl({ compact: true, customAttribution: 'IgnisLab · TFG UOC' }),
      // Bottom left, stacked over the scale: the detection panel covers the
      // right edge and the imagery and elevation credits have to stay visible.
      'bottom-left',
    );

    // A style that fails to load leaves a blank map and a camera frozen at its
    // initial pose, which is easy to mistake for a slow network. Say so instead.
    map.on('error', (event) => {
      console.error('[mapa]', event.error?.message ?? event.error);
    });

    // `interactive: false` leaves the gesture handlers off but keeps `click` and
    // `mousemove` firing, which is what makes a fixed map clickable at all.
    //
    // One handler for the whole canvas rather than one scoped to the layer: a
    // click on a mark and a click on empty sea both need an answer, and asking
    // the renderer what lies under the pointer gives both at once.
    map.on('click', (event) => {
      const feature = this.featureAt(event);
      this.selected.set(feature ? toHotspot(feature) : null);
    });

    // Without this the marks read as decoration. Only written when it changes:
    // mousemove fires for every pixel the pointer crosses.
    let overMark = false;
    map.on('mousemove', (event) => {
      const over = this.featureAt(event) !== null;
      if (over === overMark) return;
      overMark = over;
      map.getCanvas().style.cursor = over ? 'pointer' : '';
    });

    // The opening frame is not an animation: there is nothing to travel from.
    map.once('styledata', () => {
      map.fitBounds(VIEWS[initialView].bounds, { ...FIT, duration: 0 });
      this.showRegionsFor(initialView);
    });

    const reveal = () => this.ready.set(true);
    map.once('load', reveal);
    // A worker that fails to start stops `load` firing at all, even though the
    // map renders. `idle` covers that case so the view is never left hidden.
    map.once('idle', reveal);

    this.instance = map;
  }

  /** Moves to one of the fixed scope framings. Ignored until the map exists. */
  goToView(view: ViewId): void {
    this.instance?.fitBounds(VIEWS[view].bounds, { ...FIT, duration: 900 });
  }

  /**
   * Shows only the regions belonging to a scope.
   *
   * The filter runs inside MapLibre against the `scope` property baked into the
   * data, so switching scope costs nothing: no refetch, no new source.
   */
  showRegionsFor(scope: ViewId): void {
    const map = this.instance;
    if (!map) return;
    const filter = ['==', ['get', 'scope'], scope] as never;
    map.setFilter(LAYERS.regionsFill, filter);
    map.setFilter(LAYERS.regionsLine, filter);
  }

  clearSelection(): void {
    this.selected.set(null);
  }

  /**
   * The detection under the pointer, if there is one.
   *
   * Queried over a small box and not a single pixel: the smallest mark is 3,5 px
   * across and hitting it exactly with a mouse is luck. When the box catches
   * more than one the fiercest wins, which is the rule the layer already uses
   * to decide what gets drawn on top.
   */
  private featureAt(event: MapMouseEvent): MapGeoJSONFeature | null {
    const map = this.instance;
    if (!map || !map.getLayer(LAYERS.hotspots)) return null;

    const { x, y } = event.point;
    const box: [[number, number], [number, number]] = [
      [x - HIT_SLOP, y - HIT_SLOP],
      [x + HIT_SLOP, y + HIT_SLOP],
    ];
    const hits = map.queryRenderedFeatures(box, { layers: [LAYERS.hotspots] });
    if (!hits.length) return null;

    return hits.reduce((best, hit) => (frpOf(hit) > frpOf(best) ? hit : best));
  }

  destroy(): void {
    this.instance?.remove();
    this.instance = null;
    this.ready.set(false);
    this.selected.set(null);
  }
}
