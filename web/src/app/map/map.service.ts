import { Injectable, signal } from '@angular/core';
import {
  AttributionControl,
  MapLibreMap,
  ScaleControl,
  setWorkerUrl,
  type CanvasSource,
  type GeoJSONSource,
  type FilterSpecification,
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
import { MapAgents } from './map-agents';
import { writeSource } from './source-data';
import type { GroundAgent, Pass } from '../simulation/agents';

// angular.json copies this as an asset because the bundler cannot discover a runtime-resolved URL.
setWorkerUrl(new URL('maplibre-gl-worker.mjs', document.baseURI).href);

const FIT = { padding: 24 } as const;

// Fit padding must include the panel's own width and margin, since the canvas runs underneath it.
const FIT_BESIDE_PANEL = {
  padding: { top: 24, right: 320 + 24, bottom: 24, left: 24 },
} as const;

const HIT_SLOP = 2;

const DOMAIN_PITCH_DEG = 55;

// Keep vertical exaggeration at 1: the visible terrain must match the slopes used by the model.
const TERRAIN_EXAGGERATION = 1;

// Zoom 16 is ~30 m/px, matching a simulation cell; closer views add no source detail.
const SANDBOX_MAX_ZOOM = 16;

const SANDBOX_REACH = 0.8;

function between(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

function frpOf(feature: MapGeoJSONFeature): number {
  return Number(feature.properties['frp'] ?? 0);
}

// Panel coordinates come from geometry rather than GeoJSON properties.
function toHotspot(feature: MapGeoJSONFeature): Hotspot {
  // This circle layer contains only Point geometries.
  const [lon, lat] = (feature.geometry as Point).coordinates as [number, number];
  return { ...(feature.properties as Omit<Hotspot, 'lon' | 'lat'>), lon, lat };
}

const MASK_MARGIN = 3;

function domainFeature(ring: readonly (readonly [number, number])[]): Feature {
  return {
    type: 'Feature',
    properties: { mask: false },
    geometry: { type: 'Polygon', coordinates: [ring.map((p) => [...p])] },
  };
}

// The domain is a hole in a box past the camera horizon, rather than a world-sized polygon.
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

  // Child effects can run before afterNextRender creates the map; queue style work until load.
  private readonly queued: ((map: MapLibreMap) => void)[] = [];

  private framed = false;

  private unclamp: (() => void) | null = null;
  private clamping = false;

  private picking = false;

  private fireRevision = 0;

  private terrain3D = false;

  private fireStarts: SpawnMarker[] = [];

  private centreMarker: SpawnMarker | null = null;

  // Use a fresh coordinate array so two clicks at the same place still notify consumers.
  public readonly picked = signal<[number, number] | null>(null);

  // With relief enabled, MapLibre reports the terrain point under the pointer.
  public readonly pointer = signal<[number, number] | null>(null);

  // A stationary right click undoes; a right drag rotates the view.
  public readonly rightClicks = signal(0);

  private styled = false;

  // Remember the requested province filter until its layers arrive.
  private provincesOf: string | null = null;

  public readonly ready = signal(false);

  public readonly bearing = signal(0);

  public readonly selected = signal<Hotspot | null>(null);

  public readonly scope = signal<ViewId>(INITIAL_VIEW);

  public readonly hotspotColourBy = signal<HotspotColourBy>('power');

  public readonly hotspotScale = signal(1);

  private readonly agents = new MapAgents((map) => map === this.instance);

  private particles: FireParticles | null = null;

  public get map(): MapLibreMap | null {
    return this.instance;
  }

  public create(container: HTMLElement): void {
    if (this.instance) return;
    const map = this.createInstance(container);
    this.addControls(map);

    map.on('error', (event) => {
      console.error('[map]', event.error?.message ?? event.error);
    });
    this.listenForSelection(map);
    this.listenForRightClicks(map);
    this.listenForPointer(map);
    this.listenForReady(map);
    this.instance = map;
  }

  public goToView(view: ViewId, clearOfPanel = false): void {
    this.scope.set(view);
    this.goToBounds(VIEWS[view].bounds, clearOfPanel);
  }

  // The initial framing is instant; later ones animate.
  public goToBounds(bounds: LngLatBoundsLike, clearOfPanel = false): void {
    this.withStyle((map) => {
      const fit = clearOfPanel ? FIT_BESIDE_PANEL : FIT;
      // Apply pitch in the same framing call; a second animation would interrupt the first.
      const pitch = this.terrain3D ? DOMAIN_PITCH_DEG : 0;
      // Preserve a user-chosen bearing in relief; moving the ignition should not reset it.
      const bearing = this.terrain3D ? map.getBearing() : 0;
      map.fitBounds(bounds, { ...fit, pitch, bearing, duration: this.framed ? 900 : 0 });
      this.framed = true;
    });
  }

  public showRegionsFor(scope: ViewId): void {
    this.withStyle((map) => {
      const filter: FilterSpecification = ['==', ['get', 'scope'], scope];
      map.setFilter(LAYERS.regionsFill, filter);
      map.setFilter(LAYERS.regionsLine, filter);
    });
  }

  // Hide both region fill and border so hidden levels stop intercepting clicks.
  public setRegionsVisible(visible: boolean): void {
    this.withStyle((map) => {
      const visibility = visible ? 'visible' : 'none';
      for (const id of [LAYERS.regionsFill, LAYERS.regionsLine]) {
        map.setLayoutProperty(id, 'visibility', visibility);
      }
    });
  }

  public focusRegion(id: string | null): void {
    this.setFocus(LAYERS.regionFocusFill, LAYERS.regionFocusLine, id);
  }

  public focusProvince(id: string | null): void {
    this.setFocus(LAYERS.provinceFocusFill, LAYERS.provinceFocusLine, id);
  }

  public focusMunicipality(id: string | null): void {
    this.setFocus(LAYERS.municipalityFocusFill, LAYERS.municipalityFocusLine, id);
  }

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

  // Lazy-load province geometry once and share the parsed collection with the list.
  public addProvinces(data: FeatureCollection): void {
    this.withStyle((map) => {
      if (map.getSource(PROVINCES_SOURCE)) return;
      map.addSource(PROVINCES_SOURCE, {
        type: 'geojson',
        data,

        attribution: BOUNDARIES_ATTRIBUTION,
      });

      for (const layer of buildProvinceLayers()) map.addLayer(layer, LAYERS.hotspots);
      this.applyProvinces(map);
    });
  }

  public showProvincesOf(region: string | null): void {
    this.provincesOf = region;
    this.withStyle((map) => this.applyProvinces(map));
  }

  public setHotspots(data: FeatureCollection): void {
    this.withStyle((map) => {
      const source = map.getSource(HOTSPOTS_SOURCE) as GeoJSONSource | undefined;
      writeSource(source, data);
    });
  }

  // Recolour after writing the detections: normalized dates belong to that data set.
  public setHotspotColourBy(by: HotspotColourBy): void {
    this.hotspotColourBy.set(by);
    this.withStyle((map) =>
      map.setPaintProperty(LAYERS.hotspots, 'circle-color', hotspotColour(by)),
    );
  }

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

  // Hidden layers are absent from queryRenderedFeatures, so hidden detections are unclickable too.
  public setHotspotsVisible(visible: boolean): void {
    this.withStyle((map) => {
      for (const id of [LAYERS.hotspots, LAYERS.hotspotSelected]) {
        map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
      }
    });
  }

  public setPicking(on: boolean): void {
    this.picking = on;
    if (!on) this.picked.set(null);
    const canvas = this.instance?.getCanvas();
    if (canvas) canvas.style.cursor = on ? 'crosshair' : '';
  }

  // This legacy API name sets the simulation centre, not a fire-start point.
  public setCentre(point: readonly [number, number] | null): void {
    this.withStyle((map) => {
      this.centreMarker?.remove();
      this.centreMarker = point
        ? addSpawnMarker(map, point, 'Centre de la simulació', 'centre')
        : null;
    });
  }

  // setCentre sets the domain centre; these markers are the independent fire-start points.
  public setFireStarts(
    starts: readonly { readonly point: readonly [number, number]; readonly label: string }[],
  ): void {
    this.withStyle((map) => {
      for (const mark of this.fireStarts) mark.remove();
      this.fireStarts = starts.map((start) => addSpawnMarker(map, start.point, start.label));
    });
  }

  public setContours(on: boolean): void {
    this.withStyle((map) => {
      const visibility = on ? 'visible' : 'none';
      for (const id of [LAYERS.contourLines, LAYERS.contourLabels]) {
        map.setLayoutProperty(id, 'visibility', visibility);
      }
    });
  }

  // Load one province of place names so moving the domain does not require another fetch.
  public setPlaces(data: FeatureCollection | null): void {
    this.withStyle((map) => {
      const source = map.getSource(PLACES_SOURCE) as GeoJSONSource | undefined;
      writeSource(source, data ?? { type: 'FeatureCollection', features: [] });
    });
  }

  public setGroundAgents(agents: readonly GroundAgent[]): void {
    this.withStyle((map) => this.agents.setGround(map, agents));
  }

  public flyPass(pass: Pass): void {
    this.withStyle((map) => this.agents.fly(map, pass));
  }

  public landPasses(): void {
    this.agents.land();
  }

  public setAgentsMotion(on: boolean): void {
    this.agents.setMotion(on);
  }

  public setDomain(ring: readonly (readonly [number, number])[] | null): void {
    this.withStyle((map) => {
      const source = map.getSource(DOMAIN_SOURCE) as GeoJSONSource | undefined;
      writeSource(source, {
        type: 'FeatureCollection',
        features: ring ? [domainFeature(ring), maskFeature(ring)] : [],
      });
    });
  }

  // Use nearest sampling for slope classes: interpolated colours would not exist in the legend.
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

  // Use a canvas source for changing fire frames to avoid repeatedly encoding a megapixel PNG.
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
        // Upload only when the timeline changes, through refreshFire().
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
          // The fire surface is continuous; linear sampling places the front between cells.
          paint: { 'raster-resampling': 'linear', 'raster-fade-duration': 0 },
        },
        LAYERS.contourLines,
      );
    });
  }

  // Keep it above draped layers: inserting it between them splits MapLibre’s terrain render pass.
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

  // play() then pause() makes a non-animated canvas source upload its current frame once.
  public refreshFire(): void {
    this.withStyle((map) => {
      const source = map.getSource(FIRE_SOURCE) as CanvasSource | undefined;
      if (!source) return;
      source.play();
      source.pause();
      // MapLibre 6.15 keys draped tile fingerprints on this feature-state; bumping it redraws them.
      this.fireRevision += 1;
      map.setFeatureState({ source: FIRE_SOURCE, id: 0 }, { revisio: this.fireRevision });
      map.triggerRepaint();
    });
  }

  // Lighting changes colour and shading only; exaggeration stays fixed (see TERRAIN_EXAGGERATION).
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

      map.setPaintProperty(LAYERS.satellite, 'raster-saturation', on ? 0.22 : 0);
      map.setPaintProperty(LAYERS.satellite, 'raster-contrast', on ? 0.12 : 0);
    });
  }

  // The form shows the surroundings for choosing a domain; only the simulator enables this mask.
  public setDomainMask(on: boolean): void {
    this.withStyle((map) =>
      map.setLayoutProperty(LAYERS.domainMask, 'visibility', on ? 'visible' : 'none'),
    );
  }

  // Reuses the slope-sampling DEM; pitch is set by framing, to avoid competing camera animations.
  public setTerrain3D(on: boolean): void {
    if (on === this.terrain3D) return;
    this.terrain3D = on;
    this.withStyle((map) => {
      map.setTerrain(on ? { source: DEM_SOURCE, exaggeration: TERRAIN_EXAGGERATION } : null);
      this.particles?.reset();
    });
  }

  // Enable rotation separately from pan/zoom; on touch, pinch rotation also enables zoom.
  public setOrbit(on: boolean): void {
    this.withStyle((map) => {
      if (on) {
        // Linear drag avoids reversing the turn direction above and below the screen centre.
        map.dragRotate.enable({ movement: 'linear' });
        map.touchPitch.enable();
      } else {
        map.dragRotate.disable();
        map.touchPitch.disable();
      }
    });
  }

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

      // fitBounds animates, so read its target zoom rather than the current zoom.
      const framed = map.cameraForBounds([...bounds] as [number, number, number, number], FIT);
      // Allow a small tolerance below fit zoom so the fitted view is accepted.
      if (framed?.zoom !== undefined) map.setMinZoom(framed.zoom - 0.15);
      map.setMaxZoom(SANDBOX_MAX_ZOOM);

      // Clamp the centre, not maxBounds: at 55° pitch, forcing the whole view into the domain
      // zooms in excessively.
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

        // setCenter fires move again; guard against recursive corrections.
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

  public zoomBy(levels: number): void {
    this.withStyle((map) => map.easeTo({ zoom: map.getZoom() + levels, duration: 250 }));
  }

  // Ground metres per screen pixel at the view centre; MapLibre uses 512 px tiles.
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
    // Stop the figures before the map goes, while their layer can still release what it holds.
    this.agents.release(this.instance);
    this.particles = null;
    this.centreMarker?.remove();
    this.centreMarker = null;
    for (const mark of this.fireStarts) mark.remove();
    this.fireStarts = [];
    // Take the move listener off while its map is still alive, and keep no closure over it.
    this.unclamp?.();
    this.unclamp = null;
    this.clamping = false;
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

  private createInstance(container: HTMLElement): MapLibreMap {
    return new MapLibreMap({
      container,
      style: buildStyle(),
      // An unsized container would fall back to the whole world; framing happens after load.
      center: [-3.7, 40.0],
      zoom: 4.5,
      pitch: 0,
      // interactive: false disables gestures while retaining click and mousemove events.
      interactive: false,
      attributionControl: false,
      // Antialiasing keeps small 3D figures from breaking into isolated pixels.
      canvasContextAttributes: { antialias: true },
    });
  }

  private addControls(map: MapLibreMap): void {
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left');

    map.addControl(
      new AttributionControl({ compact: true, customAttribution: 'IgnisLab · TFG UOC' }),

      'bottom-left',
    );
  }

  private listenForSelection(map: MapLibreMap): void {
    // Query the whole canvas so both hotspot clicks and empty-ground clicks receive an answer.
    map.on('click', (event) => {
      if (this.picking) {
        this.picked.set([event.lngLat.lng, event.lngLat.lat]);
        return;
      }
      const feature = this.featureAt(event);
      this.select(feature ? toHotspot(feature) : null);
    });
  }

  private listenForRightClicks(map: MapLibreMap): void {
    // Judge on release: some platforms fire contextmenu on press, before a drag can be detected.
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

    map.getCanvasContainer().addEventListener('contextmenu', (event) => {
      if (this.picking) event.preventDefault();
    });
  }

  private listenForPointer(map: MapLibreMap): void {
    let overMark = false;

    map.on('mouseout', () => this.pointer.set(null));

    map.on('mousemove', (event) => {
      this.pointer.set([event.lngLat.lng, event.lngLat.lat]);
      // While picking, the whole canvas is a target; hotspot hover must not change the crosshair.
      if (this.picking) return;
      const over = this.featureAt(event) !== null;
      if (over === overMark) return;
      overMark = over;
      map.getCanvas().style.cursor = over ? 'pointer' : '';
    });
  }

  private listenForReady(map: MapLibreMap): void {
    map.once('styledata', () => {
      this.styled = true;

      // Apply the default borders before queued callbacks narrow them.
      this.showRegionsFor(INITIAL_VIEW);
      for (const run of this.queued.splice(0)) run(map);

      if (!this.framed) this.goToView(INITIAL_VIEW);
    });

    const reveal = () => this.ready.set(true);

    map.once('load', reveal);

    // Worker failure can prevent load; idle still reveals the rendered map.
    map.once('idle', reveal);

    map.on('rotate', () => this.bearing.set(map.getBearing()));
  }

  private applyProvinces(map: MapLibreMap): void {
    if (!map.getLayer(LAYERS.provincesLine)) return;
    const filter: FilterSpecification = ['==', ['get', 'region'], this.provincesOf ?? ''];
    map.setFilter(LAYERS.provincesLine, filter);
  }

  private setFocus(fill: string, line: string, id: string | null): void {
    this.withStyle((map) => {
      if (!map.getLayer(fill)) return;
      const filter: FilterSpecification = ['==', ['get', 'id'], id ?? ''];
      map.setFilter(fill, filter);
      map.setFilter(line, filter);
    });
  }

  // Selection uses a filter because replacing the source would discard feature state.
  private select(hotspot: Hotspot | null): void {
    this.selected.set(hotspot);
    this.withStyle((map) =>
      map.setFilter(LAYERS.hotspotSelected, ['==', ['get', 'id'], hotspot?.id ?? '']),
    );
  }

  // Not isStyleLoaded(): pending style changes make it false again after the startup queue drains.
  private withStyle(run: (map: MapLibreMap) => void): void {
    const map = this.instance;
    if (map && this.styled) {
      run(map);
      return;
    }
    this.queued.push(run);
  }

  // A small box keeps tiny marks hittable; the strongest detection wins when several overlap.
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
