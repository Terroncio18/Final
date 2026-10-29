import { Injectable, signal } from '@angular/core';
import {
  AttributionControl,
  MapLibreMap,
  ScaleControl,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from 'maplibre-gl';

import type { FeatureCollection, Point } from 'geojson';

import type { Hotspot } from './hotspot';
import { BOUNDARIES_ATTRIBUTION, INITIAL_VIEW, VIEWS, type ViewId } from './map.config';
import {
  buildMunicipalityLayers,
  buildProvinceLayers,
  buildStyle,
  IGNITION_SOURCE,
  LAYERS,
  MUNICIPALITIES_SOURCE,
  PROVINCES_SOURCE,
} from './map.style';

/**
 * MapLibre picks its worker file name at runtime, which neither Vite nor esbuild
 * can follow, so the bundler emits no worker and the map loads nothing at all.
 * angular.json copies the file out of node_modules as a static asset and this
 * points MapLibre at it, which works the same in development and in a build.
 */
setWorkerUrl(new URL('maplibre-gl-worker.mjs', document.baseURI).href);

/** Framing is the same at every level; only the animation changes. */
const FIT = { padding: 24 } as const;

/**
 * The same framing with the side panel taken into account.
 *
 * The canvas fills the window and the panel sits over it, so a plain fit
 * centres what it frames under the panel and hides a third of it. 320 px is the
 * panel's width in the stylesheets, plus the usual margin.
 */
const FIT_BESIDE_PANEL = {
  padding: { top: 24, right: 320 + 24, bottom: 24, left: 24 },
} as const;

/** Half the side of the click target, in pixels. */
const HIT_SLOP = 2;

function frpOf(feature: MapGeoJSONFeature): number {
  return Number(feature.properties['frp'] ?? 0);
}

/** The position lives in the geometry; the panel should not have to parse GeoJSON. */
function toHotspot(feature: MapGeoJSONFeature): Hotspot {
  // Narrowed to a point because the layer it comes from is a circle layer:
  // there is nothing else it could be.
  const [lon, lat] = (feature.geometry as Point).coordinates as [number, number];
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

  /**
   * Work that needs the map and its loaded style, kept until both exist.
   *
   * The order is awkward and not accidental: MapShell creates the map in
   * afterNextRender, which Angular runs *after* the first change detection, so
   * a child's effect asking for a framing arrives before there is a map to
   * frame. Queueing it here is simpler than making every caller wait.
   */
  private readonly queued: ((map: MapLibreMap) => void)[] = [];

  /** Whether the camera has been placed yet. See goToBounds and create(). */
  private framed = false;

  /** True while a step is waiting for a click on the map rather than on a mark. */
  private picking = false;

  /**
   * Where the last click while picking landed, as [lon, lat].
   *
   * A fresh array every time, so clicking the same place twice still counts as
   * two answers: the value is what changed, not where it is.
   */
  readonly picked = signal<[number, number] | null>(null);

  /** Whether the style has loaded once, which is when the layers start existing. */
  private styled = false;

  /**
   * Whose provinces should be drawn, remembered rather than applied and
   * forgotten: the step asks for them before the file that carries them has
   * arrived, so the answer has to survive until the layers exist.
   */
  private provincesOf: string | null = null;

  /** False until the style has loaded and the first view is framed. */
  readonly ready = signal(false);

  /**
   * The detection the panel is showing, or nothing.
   *
   * A signal because the application is zoneless: a MapLibre click happens
   * outside Angular and nothing would redraw on its own.
   */
  readonly selected = signal<Hotspot | null>(null);

  /**
   * The scope the camera is on.
   *
   * The form reads it so that opening it does not change territory: the user
   * has already said which map they are looking at with the header's toggle,
   * and asking again would be the step §2.18 does away with.
   */
  readonly scope = signal<ViewId>(INITIAL_VIEW);

  get map(): MapLibreMap | null {
    return this.instance;
  }

  create(container: HTMLElement): void {
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
      if (this.picking) {
        this.picked.set([event.lngLat.lng, event.lngLat.lat]);
        return;
      }
      const feature = this.featureAt(event);
      this.selected.set(feature ? toHotspot(feature) : null);
    });

    // Without this the marks read as decoration. Only written when it changes:
    // mousemove fires for every pixel the pointer crosses.
    let overMark = false;
    map.on('mousemove', (event) => {
      // While picking the whole canvas is the target, so the pointer must not
      // keep flickering between a hand and a crosshair over the marks.
      if (this.picking) return;
      const over = this.featureAt(event) !== null;
      if (over === overMark) return;
      overMark = over;
      map.getCanvas().style.cursor = over ? 'pointer' : '';
    });

    // Framing and filtering both need the layers to exist, so nothing that was
    // queued can run before this point.
    map.once('styledata', () => {
      this.styled = true;

      // The borders start on the default scope and whoever is on screen may
      // then narrow them, which is why this goes first and the queue second.
      this.showRegionsFor(INITIAL_VIEW);
      for (const run of this.queued.splice(0)) run(map);

      // The camera is decided by whoever is on screen. A view that decides
      // nothing —the first step of the form, opened directly— would be left on
      // the placeholder camera above, so it falls back to the default framing.
      if (!this.framed) this.goToView(INITIAL_VIEW);
    });

    const reveal = () => this.ready.set(true);
    map.once('load', reveal);
    // A worker that fails to start stops `load` firing at all, even though the
    // map renders. `idle` covers that case so the view is never left hidden.
    map.once('idle', reveal);

    this.instance = map;
  }

  /** Frames one of the two fixed scope views. */
  goToView(view: ViewId, clearOfPanel = false): void {
    this.scope.set(view);
    this.goToBounds(VIEWS[view].bounds, clearOfPanel);
  }

  /**
   * Frames any extent: a scope, a region, later a province or a municipality.
   *
   * The first framing is instant and the rest animate. On opening there is
   * nothing to travel from and a flight out of the placeholder camera reads as
   * a glitch, while later on the movement is what makes the change legible.
   *
   * `clearOfPanel` is for the steps of the form, which always have a panel
   * open over the right of the canvas.
   */
  goToBounds(bounds: LngLatBoundsLike, clearOfPanel = false): void {
    this.withStyle((map) => {
      const fit = clearOfPanel ? FIT_BESIDE_PANEL : FIT;
      map.fitBounds(bounds, { ...fit, duration: this.framed ? 900 : 0 });
      this.framed = true;
    });
  }

  /**
   * Shows only the regions belonging to a scope.
   *
   * The filter runs inside MapLibre against the `scope` property baked into the
   * data, so switching scope costs nothing: no refetch, no new source.
   */
  showRegionsFor(scope: ViewId): void {
    this.withStyle((map) => {
      const filter = ['==', ['get', 'scope'], scope] as never;
      map.setFilter(LAYERS.regionsFill, filter);
      map.setFilter(LAYERS.regionsLine, filter);
    });
  }

  /**
   * Picks out one region, or none.
   *
   * A filter and nothing else, because the focus layers carry fixed paint. That
   * is what makes it cheap enough to follow a pointer down a list: no paint
   * property is recomputed and no expression is rebuilt.
   */
  focusRegion(id: string | null): void {
    this.setFocus(LAYERS.regionFocusFill, LAYERS.regionFocusLine, id);
  }

  /** The same, one level down. Does nothing until the provinces have arrived. */
  focusProvince(id: string | null): void {
    this.setFocus(LAYERS.provinceFocusFill, LAYERS.provinceFocusLine, id);
  }

  /** And one further down still. */
  focusMunicipality(id: string | null): void {
    this.setFocus(LAYERS.municipalityFocusFill, LAYERS.municipalityFocusLine, id);
  }

  /**
   * Puts one province's municipalities on the map, or takes them off.
   *
   * The source is swapped rather than added again: there is only ever one
   * province on screen, and `setData` is what MapLibre is built for. Passing
   * nothing hides the layers, which also stops them being drawn over the levels
   * above when the form moves back up.
   */
  setMunicipalities(data: FeatureCollection | null): void {
    this.withStyle((map) => {
      if (!map.getSource(MUNICIPALITIES_SOURCE)) {
        if (!data) return;
        map.addSource(MUNICIPALITIES_SOURCE, {
          type: 'geojson',
          data,
          attribution: BOUNDARIES_ATTRIBUTION,
        });
        for (const layer of buildMunicipalityLayers()) map.addLayer(layer, LAYERS.hotspots);
        return;
      }

      const visibility = data ? 'visible' : 'none';
      for (const id of [
        LAYERS.municipalitiesLine,
        LAYERS.municipalityFocusFill,
        LAYERS.municipalityFocusLine,
      ]) {
        map.setLayoutProperty(id, 'visibility', visibility);
      }

      if (!data) return;
      const source = map.getSource(MUNICIPALITIES_SOURCE) as GeoJSONSource | undefined;
      source?.setData(data);
    });
  }

  /**
   * Adds the provinces to the style, once.
   *
   * They are not in the opening style —380 kB the portada never draws— and they
   * arrive as an already parsed collection rather than a URL, so the file is
   * downloaded and parsed exactly once for both the list and the map.
   */
  addProvinces(data: FeatureCollection): void {
    this.withStyle((map) => {
      if (map.getSource(PROVINCES_SOURCE)) return;
      map.addSource(PROVINCES_SOURCE, {
        type: 'geojson',
        data,
        // Same provider as the regions, and MapLibre shows one credit for both.
        attribution: BOUNDARIES_ATTRIBUTION,
      });
      // Under the detections, which stay the topmost thing on the map.
      for (const layer of buildProvinceLayers()) map.addLayer(layer, LAYERS.hotspots);
      this.applyProvinces(map);
    });
  }

  /** Shows the borders of one region's provinces, or of none. */
  showProvincesOf(region: string | null): void {
    this.provincesOf = region;
    this.withStyle((map) => this.applyProvinces(map));
  }

  private applyProvinces(map: MapLibreMap): void {
    if (!map.getLayer(LAYERS.provincesLine)) return;
    const filter = ['==', ['get', 'region'], this.provincesOf ?? ''] as never;
    map.setFilter(LAYERS.provincesLine, filter);
  }

  private setFocus(fill: string, line: string, id: string | null): void {
    this.withStyle((map) => {
      if (!map.getLayer(fill)) return;
      const filter = ['==', ['get', 'id'], id ?? ''] as never;
      map.setFilter(fill, filter);
      map.setFilter(line, filter);
    });
  }

  /**
   * Hides the detections, or brings them back.
   *
   * Hiding also stops them being clickable, with no second code path:
   * `queryRenderedFeatures` does not return features from a hidden layer, so
   * featureAt() finds nothing and no panel can open behind the form.
   */
  setHotspotsVisible(visible: boolean): void {
    this.withStyle((map) =>
      map.setLayoutProperty(LAYERS.hotspots, 'visibility', visible ? 'visible' : 'none'),
    );
  }

  /**
   * Turns the map into something to click on, or back.
   *
   * `interactive: false` leaves `click` firing (§2.9), which is what makes
   * this possible without touching the gesture handlers: the only difference
   * between picking and not is what the handler does with the event.
   */
  setPicking(on: boolean): void {
    this.picking = on;
    if (!on) this.picked.set(null);
    const canvas = this.instance?.getCanvas();
    if (canvas) canvas.style.cursor = on ? 'crosshair' : '';
  }

  /** Draws the ignition point, or takes it off. */
  setIgnition(point: readonly [number, number] | null): void {
    this.withStyle((map) => {
      const source = map.getSource(IGNITION_SOURCE) as GeoJSONSource | undefined;
      source?.setData({
        type: 'FeatureCollection',
        features: point
          ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [...point] } }]
          : [],
      });
    });
  }

  clearSelection(): void {
    this.selected.set(null);
  }

  /**
   * Runs work that needs the map and its style, now or as soon as it can.
   *
   * `fitBounds` against a container the layout has not sized yet, and
   * `setFilter` against a layer that does not exist, both fail quietly, so
   * everything that touches the style goes through here.
   *
   * The test is «has the style ever loaded» and deliberately not
   * `isStyleLoaded()`, which answers a different question: it goes false again
   * whenever the style has pending changes. Asking it meant that a camera move
   * right after a `setFilter` —leaving the form, say— was mistaken for «the map
   * is not ready», queued, and never run, because the queue drains once.
   */
  private withStyle(run: (map: MapLibreMap) => void): void {
    const map = this.instance;
    if (map && this.styled) {
      run(map);
      return;
    }
    this.queued.push(run);
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
    this.queued.length = 0;
    this.framed = false;
    this.styled = false;
    this.picking = false;
    this.picked.set(null);
    this.ready.set(false);
    this.selected.set(null);
  }
}
