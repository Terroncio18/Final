import { Injectable, signal } from '@angular/core';
import {
  AttributionControl,
  MapLibreMap,
  ScaleControl,
  setWorkerUrl,
  type CanvasSource,
  type GeoJSONSource,
  type ImageSource,
  type LngLatBoundsLike,
  type MapGeoJSONFeature,
  type MapMouseEvent,
} from 'maplibre-gl';
import type { Feature, FeatureCollection, Point } from 'geojson';
import type { Hotspot } from './hotspot';
import { BOUNDARIES_ATTRIBUTION, INITIAL_VIEW, VIEWS, type ViewId } from './map.config';
import {
  buildMunicipalityLayers,
  buildProvinceLayers,
  buildStyle,
  DEM_SOURCE,
  DOMAIN_SOURCE,
  FIRE_SOURCE,
  hotspotColour,
  type HotspotColourBy,
  hotspotDensity,
  hotspotRadius,
  HOTSPOTS_SOURCE,
  LAYERS,
  MUNICIPALITIES_SOURCE,
  PLACES_SOURCE,
  PROVINCES_SOURCE,
  SLOPES_SOURCE,
} from './map.style';
import { FireParticles, type Emitters } from './fire-particles';
import { addSpawnMarker, type SpawnMarker } from './spawn-marker';
import type { Agents3D } from './agents-3d';
import { writeSource } from './source-data';
import type { GroundAgent, Pass } from '../simulation/agents';

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

/**
 * How far the camera leans over at the last step, in degrees from straight down.
 *
 * Terrain seen from directly above is a flat map with shadows on it: the relief
 * is only relief once the camera has an angle on it. 55° and not MapLibre's
 * maximum of 60°, which puts so much of the horizon on screen that the domain
 * stops being the subject.
 */
const DOMAIN_PITCH = 55;

/**
 * The relief at its true height.
 *
 * A demo would exaggerate it —one and a half times is the usual— and the
 * mountains would read better. Here the slope of each cell is an input of the
 * model (§2.28), so an inflated terrain would be a second, different ground
 * under the same numbers: what the user judges the point on would not be what
 * the simulation runs on.
 */
const TERRAIN_EXAGGERATION = 1;

/**
 * How far into the sandbox the wheel goes.
 *
 * Sixteen is about thirty metres of ground per imagery tile pixel, which is
 * also the size of a cell of the simulation grid (§2.27). Closer than that the
 * photograph is enlarged pixels and the mesh is finer than the DEM can feed.
 */
const SANDBOX_MAX_ZOOM = 16;

/**
 * How far out of the domain the camera may be pointed, as a fraction of it.
 *
 * Room to move and not a tight fit. The square can be pushed to the edge of
 * the card and off it, which nobody using this screen for what it is for will
 * do; what the limit is there for is that the movement ends somewhere instead
 * of running on into empty ground forever.
 */
const SANDBOX_REACH = 0.8;

function between(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

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
/** How far the mask reaches beyond the domain, in degrees. */
const MASK_MARGIN = 3;

function domainFeature(ring: readonly (readonly [number, number])[]): Feature {
  return {
    type: 'Feature',
    properties: { mask: false },
    geometry: { type: 'Polygon', coordinates: [ring.map((p) => [...p])] },
  };
}

/**
 * The domain seen from the outside: a wide box with the square cut out of it.
 *
 * A hole and not a second polygon, because a ring inside another ring is what
 * GeoJSON means by a hole and what the renderer already knows how to leave
 * empty. The box is three degrees wider on each side —about 330 km, well past
 * the horizon of a camera that cannot be panned or zoomed (§11.3)— and not the
 * whole world, which would be a polygon covering every tile at every zoom for
 * ground that is never on screen.
 */
function maskFeature(ring: readonly (readonly [number, number])[]): Feature {
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  const west = Math.min(...lons) - MASK_MARGIN;
  const east = Math.max(...lons) + MASK_MARGIN;
  const south = Math.max(-90, Math.min(...lats) - MASK_MARGIN);
  const north = Math.min(90, Math.max(...lats) + MASK_MARGIN);

  return {
    type: 'Feature',
    properties: { mask: true },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [west, south],
          [west, north],
          [east, north],
          [east, south],
          [west, south],
        ],
        ring.map((p) => [...p]),
      ],
    },
  };
}

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

  /** Takes the sandbox's centre clamp off again; see setSandboxBounds(). */
  private unclamp: (() => void) | null = null;
  private clamping = false;

  /** True while a step is waiting for a click on the map rather than on a mark. */
  private picking = false;
  /** Moves each time the fire's canvas is repainted (refreshFire). */
  private fireRevision = 0;

  /** Whether the map is draped over the terrain. See setTerrain3D(). */
  private terrain3D = false;

  /** The marks of where the fire starts. See setFireStarts(). */
  private fireStarts: SpawnMarker[] = [];

  /** The fixed white mark at the centre of the simulation domain. */
  private centreMarker: SpawnMarker | null = null;

  /**
   * Where the last click while picking landed, as [lon, lat].
   *
   * A fresh array every time, so clicking the same place twice still counts as
   * two answers: the value is what changed, not where it is.
   */
  public readonly picked = signal<[number, number] | null>(null);

  /**
   * Where the pointer is over the canvas, as [lon, lat], or nothing when it
   * has left. With the relief on MapLibre answers with the ground under the
   * pointer and not the flat plane behind it, which is what a reading of the
   * terrain needs.
   */
  public readonly pointer = signal<[number, number] | null>(null);

  /**
   * Counts the right clicks on the canvas while picking: a tool's «undo» or
   * «cancel» (§11.39). A right-button drag turns the relief instead, and does
   * not count.
   */
  public readonly rightClicks = signal(0);

  /** Whether the style has loaded once, which is when the layers start existing. */
  private styled = false;

  /**
   * Whose provinces should be drawn, remembered rather than applied and
   * forgotten: the step asks for them before the file that carries them has
   * arrived, so the answer has to survive until the layers exist.
   */
  private provincesOf: string | null = null;

  /** False until the style has loaded and the first view is framed. */
  public readonly ready = signal(false);

  /** Which way the view faces: degrees clockwise from north, for the compass. */
  public readonly bearing = signal(0);

  /**
   * The detection the panel is showing, or nothing.
   *
   * A signal because the application is zoneless: a MapLibre click happens
   * outside Angular and nothing would redraw on its own.
   */
  public readonly selected = signal<Hotspot | null>(null);

  /**
   * The scope the camera is on.
   *
   * The form reads it so that opening it does not change territory: the user
   * has already said which map they are looking at with the header's toggle,
   * and asking again would be the step §2.18 does away with.
   */
  public readonly scope = signal<ViewId>(INITIAL_VIEW);

  /** What the colour of the marks is saying. The legend reads it. */
  public readonly hotspotColourBy = signal<HotspotColourBy>('power');

  /**
   * How much the marks have been shrunk for the number on screen, from 1 down.
   * Published because the legend draws the same circles and has to match.
   */
  public readonly hotspotScale = signal(1);

  /**
   * The 3D figures of who works on the fire (§11.50). The layer, and three.js
   * with it, is loaded the first time anyone is at work: a screen that never
   * puts a crew or an aircraft down does not pay for it.
   */
  private agents3d: Agents3D | null = null;
  private agents3dModule: Promise<typeof import('./agents-3d')> | null = null;
  /** The latest wishes, applied once the layer exists. */
  private groundWanted: readonly GroundAgent[] = [];
  private agentsMotion = true;

  /** The flames and the smoke over the fire. See setFireParticles(). */
  private particles: FireParticles | null = null;

  public get map(): MapLibreMap | null {
    return this.instance;
  }

  public create(container: HTMLElement): void {
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
      // Smoothed edges: the 3D figures of the agents (§11.50) are a few dozen
      // pixels and broke up into loose pixels without it (§11.51).
      canvasContextAttributes: { antialias: true },
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
      this.select(feature ? toHotspot(feature) : null);
    });

    // The right button both turns the relief and, while picking, undoes. A
    // press and release in the same place is a click; anything that moved
    // was a turn. Judged on release, which every platform fires, and not on
    // `contextmenu`, which some fire on the press, before any movement.
    let rightDown: { x: number; y: number } | null = null;
    map.on('mousedown', (event) => {
      if (event.originalEvent.button === 2) rightDown = event.point;
    });
    map.on('mouseup', (event) => {
      if (event.originalEvent.button !== 2 || !rightDown) return;
      const moved = Math.hypot(event.point.x - rightDown.x, event.point.y - rightDown.y);
      rightDown = null;
      if (this.picking && moved <= 4) this.rightClicks.update((count) => count + 1);
    });
    // While picking, the right button belongs to the tool, not to the
    // browser's own menu.
    map.getCanvasContainer().addEventListener('contextmenu', (event) => {
      if (this.picking) event.preventDefault();
    });

    // Without this the marks read as decoration. Only written when it changes:
    // mousemove fires for every pixel the pointer crosses.
    let overMark = false;
    map.on('mouseout', () => this.pointer.set(null));
    map.on('mousemove', (event) => {
      this.pointer.set([event.lngLat.lng, event.lngLat.lat]);
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

    map.on('rotate', () => this.bearing.set(map.getBearing()));
    this.instance = map;
  }

  /** Frames one of the two fixed scope views. */
  public goToView(view: ViewId, clearOfPanel = false): void {
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
  public goToBounds(bounds: LngLatBoundsLike, clearOfPanel = false): void {
    this.withStyle((map) => {
      const fit = clearOfPanel ? FIT_BESIDE_PANEL : FIT;
      // The lean goes in the framing and not in a move of its own. The first
      // version tilted the camera when the terrain went on, a step framed its
      // extent right after, and the second animation cut the first one off
      // partway: the map ended up at nine degrees, which reads as a mistake
      // rather than as a point of view.
      const pitch = this.terrain3D ? DOMAIN_PITCH : 0;
      // Where the user has turned the relief, the framing keeps their angle:
      // moving the point reframes the domain (§2.27) and snapping back to north
      // would undo the look they had chosen. Flat, north is up again, which is
      // what fitBounds does on its own when no bearing is asked for.
      const bearing = this.terrain3D ? map.getBearing() : 0;
      map.fitBounds(bounds, { ...fit, pitch, bearing, duration: this.framed ? 900 : 0 });
      this.framed = true;
    });
  }

  /**
   * Shows only the regions belonging to a scope.
   *
   * The filter runs inside MapLibre against the `scope` property baked into the
   * data, so switching scope costs nothing: no refetch, no new source.
   */
  public showRegionsFor(scope: ViewId): void {
    this.withStyle((map) => {
      const filter = ['==', ['get', 'scope'], scope] as never;
      map.setFilter(LAYERS.regionsFill, filter);
      map.setFilter(LAYERS.regionsLine, filter);
    });
  }

  /**
   * Draws the region borders, or takes them off.
   *
   * Visibility and not the filter above, which answers a different question:
   * the scope is whose regions these are and survives the form, while this is
   * whether the level is on screen at all. Writing both into one filter would
   * mean that coming back out of the form had to remember a scope it never
   * chose.
   *
   * The fill goes with the line. It is nearly invisible and it is what would
   * make a region clickable, which is not something to offer while the user is
   * two levels further down.
   */
  public setRegionsVisible(visible: boolean): void {
    this.withStyle((map) => {
      const visibility = visible ? 'visible' : 'none';
      for (const id of [LAYERS.regionsFill, LAYERS.regionsLine]) {
        map.setLayoutProperty(id, 'visibility', visibility);
      }
    });
  }

  /**
   * Picks out one region, or none.
   *
   * A filter and nothing else, because the focus layers carry fixed paint. That
   * is what makes it cheap enough to follow a pointer down a list: no paint
   * property is recomputed and no expression is rebuilt.
   */
  public focusRegion(id: string | null): void {
    this.setFocus(LAYERS.regionFocusFill, LAYERS.regionFocusLine, id);
  }

  /** The same, one level down. Does nothing until the provinces have arrived. */
  public focusProvince(id: string | null): void {
    this.setFocus(LAYERS.provinceFocusFill, LAYERS.provinceFocusLine, id);
  }

  /** And one further down still. */
  public focusMunicipality(id: string | null): void {
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
  public setMunicipalities(data: FeatureCollection | null): void {
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
      writeSource(source, data);
    });
  }

  /**
   * Adds the provinces to the style, once.
   *
   * They are not in the opening style —380 kB the portada never draws— and they
   * arrive as an already parsed collection rather than a URL, so the file is
   * downloaded and parsed exactly once for both the list and the map.
   */
  public addProvinces(data: FeatureCollection): void {
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
  public showProvincesOf(region: string | null): void {
    this.provincesOf = region;
    this.withStyle((map) => this.applyProvinces(map));
  }

  /**
   * Puts a set of detections on the map, replacing whatever was there.
   *
   * The style declares the source empty (§2.30bis): which detections belong on
   * screen depends on the dates in the URL, and the style is built once.
   */
  public setHotspots(data: FeatureCollection): void {
    this.withStyle((map) => {
      const source = map.getSource(HOTSPOTS_SOURCE) as GeoJSONSource | undefined;
      writeSource(source, data);
    });
  }

  /**
   * Makes the colour of the marks say the power, or the date.
   *
   * See hotspotColour(). Called with the detections and not before them: the
   * dates are written on the features, and a map recoloured ahead of its data
   * would paint the old answer by a rule it was not prepared for.
   */
  public setHotspotColourBy(by: HotspotColourBy): void {
    this.hotspotColourBy.set(by);
    this.withStyle((map) =>
      map.setPaintProperty(LAYERS.hotspots, 'circle-color', hotspotColour(by)),
    );
  }

  /**
   * Sizes and thins the marks for how many of them are in view.
   *
   * See hotspotDensity() for the rule and for why it is only presentation. The
   * ring of the selected detection follows the same scale, so it stays the
   * same distance from the mark it is around; the dark edge thins with the
   * mark, because a full pixel of edge around a two-pixel dot is mostly edge.
   */
  public setHotspotDensity(count: number): void {
    const { scale, opacity } = hotspotDensity(count);
    this.hotspotScale.set(scale);
    this.withStyle((map) => {
      map.setPaintProperty(LAYERS.hotspots, 'circle-radius', hotspotRadius(scale));
      map.setPaintProperty(LAYERS.hotspots, 'circle-opacity', opacity);
      map.setPaintProperty(LAYERS.hotspots, 'circle-stroke-width', scale);
      map.setPaintProperty(LAYERS.hotspotSelected, 'circle-radius', hotspotRadius(scale, 4));
    });
  }

  /**
   * Hides the detections, or brings them back.
   *
   * Hiding also stops them being clickable, with no second code path:
   * `queryRenderedFeatures` does not return features from a hidden layer, so
   * featureAt() finds nothing and no panel can open behind the form.
   */
  public setHotspotsVisible(visible: boolean): void {
    this.withStyle((map) => {
      // The ring goes with the marks: it is drawn from the same source, and a
      // ring left over the form would point at a detection that is not there.
      for (const id of [LAYERS.hotspots, LAYERS.hotspotSelected]) {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    });
  }

  /**
   * Turns the map into something to click on, or back.
   *
   * `interactive: false` leaves `click` firing (§2.9), which is what makes
   * this possible without touching the gesture handlers: the only difference
   * between picking and not is what the handler does with the event.
   */
  public setPicking(on: boolean): void {
    this.picking = on;
    if (!on) this.picked.set(null);
    const canvas = this.instance?.getCanvas();
    if (canvas) canvas.style.cursor = on ? 'crosshair' : '';
  }

  /** Marks the simulation centre, or takes it off. Kept under its existing API name. */
  public setIgnition(point: readonly [number, number] | null): void {
    this.withStyle((map) => {
      this.centreMarker?.remove();
      this.centreMarker = point
        ? addSpawnMarker(map, point, 'Centre de la simulació', 'centre')
        : null;
    });
  }

  /**
   * Marks where the fire starts, one standing mark per place.
   *
   * Not setIgnition(), in spite of the name: that one draws the centre of the
   * domain, which is what the form's click has meant since §11.11, and keeps
   * its old name until the rename of §12.7. These are the points the
   * simulator's own tool places, and there can be several.
   *
   * Taken down and put up again on every call rather than diffed: there are a
   * handful of them, and each is two DOM elements (see spawn-marker.ts).
   */
  public setFireStarts(
    starts: readonly { readonly point: readonly [number, number]; readonly label: string }[],
  ): void {
    this.withStyle((map) => {
      for (const mark of this.fireStarts) mark.remove();
      this.fireStarts = starts.map((start) => addSpawnMarker(map, start.point, start.label));
    });
  }

  /**
   * Draws the contour lines, or takes them off.
   *
   * Visibility and not data: the lines are traced on demand from the
   * elevation tiles (see contours.ts), so there is nothing to load and
   * nothing to free —what the style asks for is only asked for while the
   * layers are on.
   */
  public setContours(on: boolean): void {
    this.withStyle((map) => {
      const visibility = on ? 'visible' : 'none';
      for (const id of [LAYERS.contourLines, LAYERS.contourLabels]) {
        map.setLayoutProperty(id, 'visibility', visibility);
      }
    });
  }

  /**
   * Writes the place names of one province over the ground, or clears them.
   *
   * One province's worth and not one domain's: the file is a couple of hundred
   * kilobytes, the style filters what is on screen, and cutting it to the
   * domain would mean a fetch every time the point moves.
   */
  public setPlaces(data: FeatureCollection | null): void {
    this.withStyle((map) => {
      const source = map.getSource(PLACES_SOURCE) as GeoJSONSource | undefined;
      writeSource(source, data ?? { type: 'FeatureCollection', features: [] });
    });
  }

  /** The crews and machines at work at the cursor's minute, as 3D figures. */
  public setGroundAgents(agents: readonly GroundAgent[]): void {
    this.groundWanted = agents;
    this.withStyle((map) => {
      if (!agents.length && !this.agents3d) return;
      this.withAgents(map, (layer) => layer.setGround(this.groundWanted));
    });
  }

  /** An aircraft makes one pass, in real time. */
  public flyPass(pass: Pass): void {
    if (!this.agentsMotion) return;
    this.withStyle((map) => this.withAgents(map, (layer) => layer.fly(pass)));
  }

  /** Every pass in the air is put away. */
  public landPasses(): void {
    this.agents3d?.land();
  }

  public setAgentsMotion(on: boolean): void {
    this.agentsMotion = on;
    this.agents3d?.setMotion(on);
  }

  /** Draws the simulation domain, or takes it off. */
  public setDomain(ring: readonly (readonly [number, number])[] | null): void {
    this.withStyle((map) => {
      const source = map.getSource(DOMAIN_SOURCE) as GeoJSONSource | undefined;
      writeSource(source, {
        type: 'FeatureCollection',
        features: ring ? [domainFeature(ring), maskFeature(ring)] : [],
      });
    });
  }

  /**
   * Paints the slope of the domain over the ground, or takes it off.
   *
   * The picture is one pixel per cell of the grid (see slope-classes.ts) and
   * the bounds are the domain's, `[west, south, east, north]`. It is a
   * `raster` layer, which MapLibre drapes (§13.1), so on the relief each band
   * lies on the hillside it describes.
   *
   * Under the contours, the mask and the outline of the domain: it is a
   * property of the ground and everything drawn *on* the ground goes over it.
   * `nearest` and not the default smoothing, because the picture is classes
   * and a blend of two bands would be a colour the legend does not have.
   *
   * Added and removed rather than hidden: an image source cannot exist without
   * its image, and a megapixel texture is not worth keeping for a layer that
   * is off by default.
   */
  public setSlopes(image: string | null, bounds?: readonly [number, number, number, number]): void {
    this.withStyle((map) => {
      if (!image || !bounds) {
        if (map.getLayer(LAYERS.slopes)) map.removeLayer(LAYERS.slopes);
        if (map.getSource(SLOPES_SOURCE)) map.removeSource(SLOPES_SOURCE);
        return;
      }

      const [west, south, east, north] = bounds;
      const coordinates: [[number, number], [number, number], [number, number], [number, number]] =
        [
          [west, north],
          [east, north],
          [east, south],
          [west, south],
        ];

      const source = map.getSource(SLOPES_SOURCE) as ImageSource | undefined;
      if (source) {
        source.updateImage({ url: image, coordinates });
        return;
      }

      map.addSource(SLOPES_SOURCE, { type: 'image', url: image, coordinates });
      map.addLayer(
        {
          id: LAYERS.slopes,
          type: 'raster',
          source: SLOPES_SOURCE,
          paint: {
            'raster-opacity': 0.7,
            'raster-resampling': 'nearest',
            'raster-fade-duration': 0,
          },
        },
        LAYERS.contourLines,
      );
    });
  }

  /**
   * Lays the simulated fire over the ground, or takes it off.
   *
   * The fire is a picture the simulator paints itself, one pixel per cell, in
   * a canvas this hands to MapLibre as a `canvas` source. A canvas and not an
   * image because it changes with every move of the timeline: re-encoding a
   * megapixel PNG sixty times a second is the slow way to change a texture
   * MapLibre can simply read again.
   *
   * It is a `raster` layer, so it drapes over the relief like the slopes do
   * (§13.1), and it sits above them and under the contours, the mask and the
   * outline: the fire is on the ground, and the lines are drawn on the fire.
   */
  public setFire(
    canvas: HTMLCanvasElement | null,
    bounds?: readonly [number, number, number, number],
  ): void {
    this.withStyle((map) => {
      if (map.getLayer(LAYERS.fire)) map.removeLayer(LAYERS.fire);
      if (map.getSource(FIRE_SOURCE)) map.removeSource(FIRE_SOURCE);
      if (!canvas || !bounds) return;

      const [west, south, east, north] = bounds;
      map.addSource(FIRE_SOURCE, {
        type: 'canvas',
        canvas,
        // Not animated: the picture changes when the timeline moves, not on
        // every frame, and refreshFire() says when.
        animate: false,
        coordinates: [
          [west, north],
          [east, north],
          [east, south],
          [west, south],
        ],
      });
      map.addLayer(
        {
          id: LAYERS.fire,
          type: 'raster',
          source: FIRE_SOURCE,
          // Linear, unlike the slopes: the picture is continuous and the
          // filter puts the front between two cells instead of on one of them.
          paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
        },
        LAYERS.contourLines,
      );
    });
  }

  /**
   * Puts flames and smoke over the cells the fire is in, or takes them off.
   *
   * The second layer of the fire (see fire-particles.ts): the raster is the
   * ground and this is the air above it. The layer is added the first time
   * there is something to draw and stays while there is a fire, because adding
   * and removing a custom layer recompiles its shaders.
   *
   * On top of everything, labels included: it is not draped, and a layer that
   * is not draped put between two that are splits the stack MapLibre renders
   * to the terrain in one pass (§13.1).
   */
  public setFireParticles(emitters: Emitters | null, towardsDeg = 0, windKmh = 0): void {
    this.withStyle((map) => {
      if (!emitters) {
        if (this.particles && map.getLayer(this.particles.id)) map.removeLayer(this.particles.id);
        this.particles = null;
        return;
      }
      if (!this.particles) {
        this.particles = new FireParticles(LAYERS.fireParticles);
        map.addLayer(this.particles);
      }
      this.particles.setWind(towardsDeg, windKmh);
      this.particles.setEmitters(emitters);
    });
  }

  /** Stops the particles for whoever has asked for less motion, or lets them go. */
  public setFireMotion(on: boolean): void {
    this.particles?.setMotion(on);
  }

  public resetFireParticles(): void {
    this.particles?.reset();
  }

  public focusFire(bounds: readonly [number, number, number, number]): void {
    this.withStyle((map) =>
      map.fitBounds(
        [
          [bounds[0], bounds[1]],
          [bounds[2], bounds[3]],
        ],
        {
          padding: { top: 100, right: 80, bottom: 60, left: 80 },
          maxZoom: 15,
          pitch: map.getPitch(),
          bearing: map.getBearing(),
          duration: 850,
        },
      ),
    );
  }

  /**
   * Tells MapLibre the fire's canvas has been painted again.
   *
   * `play()` and `pause()` in a row is how a canvas source that is not
   * animated is made to read its canvas once: pausing uploads the texture a
   * last time before it stops.
   */
  public refreshFire(): void {
    this.withStyle((map) => {
      const source = map.getSource(FIRE_SOURCE) as CanvasSource | undefined;
      if (!source) return;
      source.play();
      source.pause();
      // With the relief on, each terrain tile keeps the fire draped into a
      // texture of its own, and a new upload alone does not redo them (§13.3).
      // What does, in maplibre-gl 6.15, is the source's revision changing: it
      // is part of each tile's fingerprint, and every tile with the fire under
      // it is redrawn that same frame. The revision is the feature-state one,
      // so a counter in the feature state is what moves it (§13.6). It replaces
      // setCoordinates(), which only reached the tiles in the line of the
      // canvas's own tile, and left the rest showing an older fire.
      this.fireRevision += 1;
      map.setFeatureState({ source: FIRE_SOURCE, id: 0 }, { revisio: this.fireRevision });
      map.triggerRepaint();
    });
  }

  /**
   * Lights the ground the way the simulation screen needs it, or puts it back.
   *
   * The same relief, not a different one: this moves light and colour and
   * never the geometry. The vertical exaggeration stays at 1× because the
   * slope of each cell is an input of the model (§11.2, §2.28), and a mountain
   * inflated for the photograph would be a second terrain under the same
   * numbers. What the prototype gets from a directional light at full strength
   * is had here from the shading MapLibre already computes over the same DEM.
   *
   * Over a photograph the shading had to be a hint (§2.6), because the imagery
   * carries its own sunlight and the portada is read at the scale of a
   * country. Thirty kilometres across a mountain range is the other case: at
   * that size the photograph flattens, the valleys close up, and which way a
   * slope faces —which is what a fire runs on— stops being legible.
   *
   * The highlight borrows the prototype's own warm light, `#fff0d3`, so the
   * sunlit faces read as sunlit instead of washed out.
   */
  public setReliefEmphasis(on: boolean): void {
    this.withStyle((map) => {
      map.setPaintProperty(LAYERS.hillshade, 'hillshade-exaggeration', on ? 0.62 : 0.3);
      map.setPaintProperty(
        LAYERS.hillshade,
        'hillshade-highlight-color',
        on ? '#fff0d3' : '#ffffff',
      );
      map.setPaintProperty(LAYERS.hillshade, 'hillshade-shadow-color', on ? '#060c12' : '#0a1016');
      map.setPaintProperty(LAYERS.hillshade, 'hillshade-accent-color', on ? '#32444f' : '#3a4a56');
      // The imagery of a wooded range comes back hazy from the atmosphere it
      // was photographed through. A little saturation and contrast is what
      // separates the pine from the rock again.
      map.setPaintProperty(LAYERS.satellite, 'raster-saturation', on ? 0.22 : 0);
      map.setPaintProperty(LAYERS.satellite, 'raster-contrast', on ? 0.12 : 0);
    });
  }

  /**
   * Paints out everything outside the domain, or stops.
   *
   * The simulator's map is the square and nothing else: what happens outside
   * it is not simulated, so showing it invites reading a fire into ground the
   * model never touches. The form does the opposite —the square is chosen by
   * looking at where it falls— so this is off unless a screen asks.
   *
   * The mask travels in the same source as the square, because it is the same
   * geometry seen from the other side and a second source would be one more
   * thing to keep in step.
   */
  public setDomainMask(on: boolean): void {
    this.withStyle((map) =>
      map.setLayoutProperty(LAYERS.domainMask, 'visibility', on ? 'visible' : 'none'),
    );
  }

  /**
   * Drapes the map over the terrain, or lays it flat again.
   *
   * Nothing new is downloaded and nothing new is drawn: the elevation is the
   * `raster-dem` source the hillshade has read since the first style (§2.6),
   * and the same tiles the fourth step samples for the slope (§2.28). MapLibre
   * builds the mesh and drapes over it what it already drapes —the imagery,
   * the borders, the domain square— so this is one call and not a second
   * renderer: `background`, `fill`, `line`, `raster`, `hillshade` and
   * `color-relief` go onto the terrain by themselves.
   *
   * The camera is not touched here. A terrain seen from straight above is a
   * flat map with shadows, so it does have to lean —but the lean belongs to
   * the framing that each step asks for right after this call (§2.8), and not
   * to a second animation that would interrupt it. goToBounds() reads the
   * state this sets.
   */
  public setTerrain3D(on: boolean): void {
    if (on === this.terrain3D) return;
    this.terrain3D = on;
    this.withStyle((map) => {
      map.setTerrain(on ? { source: DEM_SOURCE, exaggeration: TERRAIN_EXAGGERATION } : null);
      this.particles?.reset();
    });
  }

  /**
   * Hands the relief over to the pointer, or takes it back.
   *
   * The rotation and nothing else. The map is built with `interactive: false`
   * because the portada is a picture to click on (§2.9), and that argument does
   * not reach the last step: at thirty kilometres over a mountain range the
   * angle is the whole point of drawing the terrain. But only the angle —the
   * extent is the step's to decide (§2.8), so panning and zooming stay off.
   *
   * It is the right button and ctrl+drag that turn, which is MapLibre's own
   * binding and the reason there is no conflict to resolve: the left button
   * goes on meaning «the fire starts here» (§2.26), and a click still places
   * the point while the drag is turning the ground under it.
   *
   * On touch, two fingers tilt. Turning them would mean enabling the pinch
   * handler, and that one brings the zoom with it.
   */
  public setOrbit(on: boolean): void {
    this.withStyle((map) => {
      if (on) {
        // Linear and not MapLibre's default: turning follows the horizontal
        // movement of the pointer and means the same anywhere on the canvas.
        // The default follows the pointer around the centre like a wheel,
        // which is sound on a north-up plan and disorienting on a relief: the
        // same drag turns one way above the middle of the screen and the other
        // way below it.
        map.dragRotate.enable({ movement: 'linear' });
        map.touchPitch.enable();
      } else {
        map.dragRotate.disable();
        map.touchPitch.disable();
      }
    });
  }

  /**
   * Lets the pointer move inside the domain, within the domain.
   *
   * §11.3 settled that on the relief you turn and only turn, and the reason
   * was that the extent is the step's to decide (§2.8): a map you can drift
   * out of answers a different question from the one the form asked. What
   * changes it is the sandbox (§11.8) —outside the square there is nothing
   * drawn any more, so drifting out of it is not a different view, it is a
   * blank one.
   *
   * So the movement is allowed, with a limit that is loose on purpose:
   *
   * - **The camera is pointed at the domain, give or take a domain**, which is
   *   room to move rather than a tight fit; see the clamp below for why.
   * - **The minimum zoom is the one that frames the domain**, computed from
   *   the same bounds rather than guessed, so zooming out stops exactly where
   *   the whole square is on screen and never shows a border of nothing.
   * - **The maximum is 16**, about a tile of imagery per thirty metres of
   *   ground: past that the photograph is enlarged pixels and the terrain is
   *   a mesh the DEM cannot feed (§2.6).
   *
   * Turning stays where it was, in setOrbit(): it is the relief's and this is
   * the frame's, and the simulator is the only screen that asks for either.
   */
  public setSandboxBounds(bounds: readonly [number, number, number, number] | null): void {
    this.withStyle((map) => {
      if (!bounds) {
        map.dragPan.disable();
        map.scrollZoom.disable();
        this.unclamp?.();
        this.unclamp = null;
        map.setMinZoom(undefined);
        map.setMaxZoom(undefined);
        return;
      }

      // Asked of the camera rather than taken from it: fitBounds animates, and
      // the zoom it is heading for is wanted before it gets there.
      const framed = map.cameraForBounds([...bounds] as [number, number, number, number], FIT);
      // A shade under, so the framing itself is never refused by its own floor.
      if (framed?.zoom !== undefined) map.setMinZoom(framed.zoom - 0.15);
      map.setMaxZoom(SANDBOX_MAX_ZOOM);

      // The wall is the centre of the camera, and it is deliberately loose.
      //
      // `maxBounds` is the obvious tool and it is the wrong one here: it asks
      // that the *view* fit inside it, and a view leaning at 55° covers far
      // more ground than the square it frames, so asked for the square itself
      // MapLibre satisfied it by zooming in until the visible trapezoid fitted
      // —the domain opened at 500 m across instead of thirty kilometres.
      //
      // A first version then clamped the centre to the square minus half a
      // screen, which is the strict reading: it kept the block filling the
      // card, and at the zoom that frames the whole domain it left nothing to
      // move at all. Strict and uncomfortable. The limit is not here to stop
      // the square leaving the view —nobody using this screen for what it is
      // for will drag it out— it is here so the movement ends somewhere.
      const [west, south, east, north] = bounds;
      const horizontal = (east - west) * SANDBOX_REACH;
      const vertical = (north - south) * SANDBOX_REACH;

      this.unclamp?.();
      const clamp = () => {
        if (this.clamping) return;
        const centre = map.getCenter();
        const lon = between(centre.lng, west - horizontal, east + horizontal);
        const lat = between(centre.lat, south - vertical, north + vertical);
        if (lon === centre.lng && lat === centre.lat) return;

        // setCenter fires `move` again, and without this the correction would
        // chase its own tail.
        this.clamping = true;
        map.setCenter([lon, lat]);
        this.clamping = false;
      };
      map.on('move', clamp);
      this.unclamp = () => map.off('move', clamp);

      map.dragPan.enable();
      map.scrollZoom.enable();
    });
  }

  /**
   * Moves the camera in or out by so many zoom levels.
   *
   * For the buttons of the sandbox, which is the only screen with a zoom to
   * offer. No limits of its own: the floor and the ceiling are the ones
   * setSandboxBounds() set, and MapLibre stops at them by itself.
   */
  public zoomBy(levels: number): void {
    this.withStyle((map) => map.easeTo({ zoom: map.getZoom() + levels, duration: 250 }));
  }

  /**
   * Metres of ground under one pixel at the centre of the view, or null
   * before there is a map.
   *
   * For whatever is painted into a draped texture and has to keep a width on
   * screen —the forecast lines of the fire—: the texture is stretched with the
   * ground, so a width in cells is a hairline from afar and a band up close.
   * MapLibre's tiles are 512 px, hence half the usual constant.
   */
  public metresPerPixel(): number | null {
    const map = this.instance;
    if (!map || !this.styled) return null;
    const latitude = (map.getCenter().lat * Math.PI) / 180;
    return (78_271.517 * Math.cos(latitude)) / 2 ** map.getZoom();
  }

  public clearSelection(): void {
    this.select(null);
  }

  public destroy(): void {
    this.particles = null;
    this.centreMarker?.remove();
    this.centreMarker = null;
    for (const mark of this.fireStarts) mark.remove();
    this.fireStarts = [];
    this.instance?.remove();
    this.instance = null;
    this.queued.length = 0;
    this.framed = false;
    this.styled = false;
    this.picking = false;
    this.terrain3D = false;
    this.picked.set(null);
    this.pointer.set(null);
    this.ready.set(false);
    this.selected.set(null);
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

  private withAgents(map: MapLibreMap, then: (layer: Agents3D) => void): void {
    if (this.agents3d && map.getLayer(this.agents3d.id)) return then(this.agents3d);
    this.agents3dModule ??= import('./agents-3d');
    void this.agents3dModule.then(({ Agents3D }) => {
      if (!this.agents3d || !map.getLayer(this.agents3d.id)) {
        this.agents3d = new Agents3D(LAYERS.agents);
        map.addLayer(this.agents3d);
        this.agents3d.setMotion(this.agentsMotion);
        this.agents3d.setGround(this.groundWanted);
      }
      then(this.agents3d);
    });
  }

  /**
   * Opens a detection, or closes whichever was open.
   *
   * The signal is what the panel reads and the filter is what the map draws,
   * and they are set together so that the ring is always around the detection
   * the panel is describing. A filter and not a feature state: the source is
   * replaced whole when the dates change, and a state would not survive it.
   */
  private select(hotspot: Hotspot | null): void {
    this.selected.set(hotspot);
    this.withStyle((map) =>
      map.setFilter(LAYERS.hotspotSelected, ['==', ['get', 'id'], hotspot?.id ?? ''] as never),
    );
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

    return hits.reduce((best, hit) => (frpOf(hit) > frpOf(best) ? hit : best), hits[0]!);
  }
}
