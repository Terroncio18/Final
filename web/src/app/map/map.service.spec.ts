import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import type { FeatureCollection } from 'geojson';
import type {
  Map as LibreMap,
  MapMouseEvent,
  StyleSpecification,
  MapOptions,
  SourceSpecification,
} from 'maplibre-gl';
import { MapService } from './map.service';
import {
  DOMAIN_SOURCE,
  FIRE_SOURCE,
  HOTSPOTS_SOURCE,
  LAYERS,
  MUNICIPALITIES_SOURCE,
  PLACES_SOURCE,
  SLOPES_SOURCE,
} from './map.style';
import { CountermeasureDisplay } from './countermeasure-display';
import { SpottingDisplay, spotPoint } from './spotting-display';
import { GRID } from '../simulation/domain';
import type { GroundAgent, Pass } from '../simulation/agents';

type TestMapEvent = Partial<ReturnType<typeof event>> & { error?: Error | string };

const doubles = vi.hoisted(() => ({
  makeMap: (_options: MapOptions): object => ({}),
  markers: [] as { options: { element: HTMLElement }; remove: ReturnType<typeof vi.fn> }[],
}));
vi.mock('maplibre-gl', async () => {
  const { vi } = await import('vitest');
  return {
    MapLibreMap: class {
      public constructor(options: MapOptions) {
        return doubles.makeMap(options) as object;
      }
    },
    Marker: class {
      public remove = vi.fn();
      public constructor(public options: { element: HTMLElement }) {
        doubles.markers.push(this);
      }
      public setLngLat() {
        return this;
      }
      public addTo() {
        return this;
      }
    },
    ScaleControl: class {},
    AttributionControl: class {},
    setWorkerUrl: vi.fn(),
    addProtocol: vi.fn(),
  };
});
vi.mock('maplibre-contour', () => ({
  default: {
    DemSource: class {
      public setupMaplibre() {}
      public contourProtocolUrl = () => 'contour://test';
    },
  },
}));

function mapDouble() {
  const sources = new Map<string, ReturnType<typeof source>>(),
    layers = new Map<string, { id: string }>();
  const handlers = new Map<string, Set<(event: TestMapEvent) => void>>();
  const canvas = document.createElement('canvas'),
    container = document.createElement('div');
  const handler = () => ({ enable: vi.fn(), disable: vi.fn() });
  const map = {
    sources,
    layers,
    canvas,
    container,
    handlers,
    on: vi.fn((name: string, fn: (event: TestMapEvent) => void) => {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name)!.add(fn);
    }),
    off: vi.fn((name: string, fn: (event: TestMapEvent) => void) => {
      handlers.get(name)?.delete(fn);
    }),
    once: vi.fn((name: string, fn: (event: TestMapEvent) => void) => {
      const once = (event: TestMapEvent) => {
        handlers.get(name)?.delete(once);
        fn(event);
      };
      map.on(name, once);
    }),
    emit: (name: string, event: TestMapEvent = {}) => {
      for (const fn of [...(handlers.get(name) ?? [])]) fn(event);
    },
    addControl: vi.fn(),
    getCanvas: () => canvas,
    getCanvasContainer: () => container,
    addSource: vi.fn((id: string, options: SourceSpecification) => {
      sources.set(id, source(options));
    }),
    getSource: (id: string) => sources.get(id),
    removeSource: vi.fn((id: string) => sources.delete(id)),
    addLayer: vi.fn((layer: { id: string }) => {
      layers.set(layer.id, layer);
    }),
    getLayer: (id: string) => layers.get(id),
    removeLayer: vi.fn((id: string) => layers.delete(id)),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
    setLayoutProperty: vi.fn(),
    fitBounds: vi.fn(),
    easeTo: vi.fn(),
    getZoom: vi.fn(() => 10),
    getPitch: vi.fn(() => 55),
    getBearing: vi.fn(() => 30),
    getCenter: vi.fn(() => ({ lng: 2, lat: 3 })),
    setCenter: vi.fn((_point: number[]) => map.emit('move')),
    cameraForBounds: vi.fn((): { zoom?: number } | undefined => ({ zoom: 10 })),
    setMinZoom: vi.fn(),
    setMaxZoom: vi.fn(),
    setTerrain: vi.fn(),
    setFeatureState: vi.fn(),
    triggerRepaint: vi.fn(),
    remove: vi.fn(),
    queryRenderedFeatures: vi.fn(
      (): {
        properties: { id: string | number; frp?: number };
        geometry?: { type: string; coordinates: number[] };
      }[] => [],
    ),
    dragRotate: handler(),
    touchPitch: handler(),
    dragPan: handler(),
    scrollZoom: handler(),
  };
  return map;
}
function source(options: SourceSpecification) {
  return {
    options,
    setData: vi.fn().mockResolvedValue(undefined),
    updateImage: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
  };
}

function mapBoundary(map: ReturnType<typeof mapDouble>): LibreMap {
  const boundary: Partial<LibreMap> = {
    getCanvas: map.getCanvas,
    getZoom: map.getZoom,
    getBearing: map.getBearing,
  };
  Object.assign(boundary, map);
  return boundary as LibreMap;
}

const empty: FeatureCollection = { type: 'FeatureCollection', features: [] };
const bounds: [number, number, number, number] = [0, 0, 4, 4];
const settle = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const event = (button = 0, x = 10, y = 10) => ({
  point: { x, y },
  lngLat: { lng: 2, lat: 3 },
  originalEvent: { button },
});

describe('MapService and map overlays', () => {
  let service: MapService, map: ReturnType<typeof mapDouble>;
  const start = (load = true) => {
    service.create(document.createElement('div'));
    if (load) map.emit('styledata');
  };
  const install =
    (target: ReturnType<typeof mapDouble>) =>
    (options: MapOptions): object => {
      const { style } = options as { style: StyleSpecification };
      for (const [id, value] of Object.entries(style.sources)) target.addSource(id, value);
      for (const layer of style.layers) target.addLayer(layer);
      return target;
    };
  beforeEach(() => {
    map = mapDouble();
    doubles.markers.length = 0;
    doubles.makeMap = install(map);
    service = TestBed.inject(MapService);
  });
  afterEach(() => {
    service.destroy();
    vi.restoreAllMocks();
  });

  it('queues changes until the style is ready and frames only after initialisation', () => {
    expect(service.map).toBeNull();
    expect(service.metresPerPixel()).toBeNull();
    service.setPicking(true);
    service.setPicking(false);
    service.goToView('canaries', true);
    start(false);
    expect(service.metresPerPixel()).toBeNull();
    expect(map.fitBounds).not.toHaveBeenCalled();
    service.create(document.createElement('div'));
    expect(map.addControl).toHaveBeenCalledTimes(2);
    map.emit('styledata');
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(map.fitBounds.mock.calls[0][1]).toMatchObject({
      duration: 0,
      padding: { right: 344 },
      pitch: 0,
    });
    service.goToBounds(bounds);
    expect(map.fitBounds.mock.lastCall![1]).toMatchObject({ duration: 900, padding: 24 });
    map.emit('load');
    map.emit('idle');
    expect(service.ready()).toBe(true);
    map.emit('rotate');
    expect(service.bearing()).toBe(30);
    expect(service.metresPerPixel()).toBeGreaterThan(0);
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    map.emit('error', { error: new Error('worker') });
    map.emit('error', { error: 'unknown' });
    map.emit('error', {});
    expect(error).toHaveBeenCalledWith('[mapa]', 'worker');
    service.destroy();
    expect(service.map).toBeNull();
    expect(service.ready()).toBe(false);
    expect(map.remove).toHaveBeenCalledTimes(1);
  });

  it('picks the strongest overlapping detection and distinguishes clicks from rotations', () => {
    expect(service['featureAt'](event() as MapMouseEvent)).toBeNull();
    start();
    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    map.layers.delete(LAYERS.hotspots);
    map.emit('click', event());
    expect(service.selected()).toBeNull();
    map.layers.set(LAYERS.hotspots, { id: LAYERS.hotspots });
    const feature = (id: string, frp?: number) => ({
      properties: { id, frp },
      geometry: { type: 'Point', coordinates: [2, 3] },
    });
    map.queryRenderedFeatures.mockReturnValue([
      feature('weak'),
      feature('strong', 50),
      feature('middle', 5),
    ]);
    map.emit('click', event());
    expect(service.selected()).toMatchObject({ id: 'strong', lon: 2, lat: 3 });
    expect(map.queryRenderedFeatures).toHaveBeenCalledWith(
      [
        [8, 8],
        [12, 12],
      ],
      { layers: [LAYERS.hotspots] },
    );
    map.emit('mousemove', event());
    map.emit('mousemove', event());
    expect(map.canvas.style.cursor).toBe('pointer');
    map.queryRenderedFeatures.mockReturnValue([]);
    map.emit('mousemove', event());
    expect(map.canvas.style.cursor).toBe('');
    map.emit('click', event());
    expect(service.selected()).toBeNull();
    map.emit('mouseup', event(2));
    map.emit('mousedown', event(0));
    map.emit('mouseup', event(0));
    map.emit('mousedown', event(2));
    map.emit('mouseup', event(2));
    expect(service.rightClicks()).toBe(0);
    const menu = new Event('contextmenu', { cancelable: true });
    map.container.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(false);
    service.setPicking(true);
    expect(map.canvas.style.cursor).toBe('crosshair');
    map.emit('click', event());
    expect(service.picked()).toEqual([2, 3]);
    map.emit('mousemove', event());
    expect(service.pointer()).toEqual([2, 3]);
    expect(map.canvas.style.cursor).toBe('crosshair');
    map.emit('mouseout');
    expect(service.pointer()).toBeNull();
    map.emit('mousedown', event(2));
    map.emit('mouseup', event(2, 20, 20));
    expect(service.rightClicks()).toBe(0);
    map.emit('mousedown', event(2));
    map.emit('mouseup', event(2, 12, 12));
    expect(service.rightClicks()).toBe(1);
    map.container.dispatchEvent(menu);
    expect(menu.defaultPrevented).toBe(true);
    service.setPicking(false);
    expect(service.picked()).toBeNull();
    expect(map.canvas.style.cursor).toBe('');
    service.clearSelection();
  });

  it('loads administrative layers once and restores visibility with replacement data', () => {
    start();
    service.showProvincesOf('ES53');
    service.focusProvince('missing');
    service.focusMunicipality(null);
    service.addProvinces(empty);
    const calls = map.addSource.mock.calls.length;
    service.addProvinces(empty);
    expect(map.addSource).toHaveBeenCalledTimes(calls);
    expect(map.setFilter).toHaveBeenCalledWith(LAYERS.provincesLine, [
      '==',
      ['get', 'region'],
      'ES53',
    ]);
    service.showProvincesOf(null);
    service.focusProvince('ES531');
    service.focusRegion(null);
    service.focusRegion('ES53');
    service.setMunicipalities(null);
    expect(map.getSource(MUNICIPALITIES_SOURCE)).toBeUndefined();
    service.setMunicipalities(empty);
    service.focusMunicipality('one');
    service.setMunicipalities(null);
    service.setMunicipalities(empty);
    expect(map.getSource(MUNICIPALITIES_SOURCE)!.setData).toHaveBeenCalledWith(empty);
    expect(map.setLayoutProperty).toHaveBeenCalledWith(
      LAYERS.municipalitiesLine,
      'visibility',
      'none',
    );
    for (const visible of [false, true]) {
      service.setRegionsVisible(visible);
      service.setHotspotsVisible(visible);
      service.setContours(visible);
      service.setDomainMask(visible);
      service.setReliefEmphasis(visible);
    }
    service.setHotspots(empty);
    expect(map.getSource(HOTSPOTS_SOURCE)!.setData).toHaveBeenCalledWith(empty);
    service.setHotspotColourBy('date');
    expect(service.hotspotColourBy()).toBe('date');
    service.setHotspotColourBy('power');
    for (const count of [0, 100, 1000, 10000]) service.setHotspotDensity(count);
    expect(service.hotspotScale()).toBeLessThan(1);
    service.setPlaces(empty);
    service.setPlaces(null);
    expect(map.getSource(PLACES_SOURCE)!.setData).toHaveBeenLastCalledWith(empty);
  });

  it('owns source textures, domain masks and safe DOM location markers', () => {
    start();
    service.setDomain([
      [0, -89],
      [4, -89],
      [4, 89],
      [0, 89],
      [0, -89],
    ]);
    const data = map.getSource(DOMAIN_SOURCE)!.setData.mock.lastCall![0] as FeatureCollection;
    expect(data.features).toHaveLength(2);
    expect(data.features[1].geometry).toMatchObject({
      coordinates: [
        [
          [-3, -90],
          [-3, 90],
          [7, 90],
          [7, -90],
          [-3, -90],
        ],
        [
          [0, -89],
          [4, -89],
          [4, 89],
          [0, 89],
          [0, -89],
        ],
      ],
    });
    service.setDomain(null);
    expect(map.getSource(DOMAIN_SOURCE)!.setData).toHaveBeenLastCalledWith(empty);
    service.setIgnition([2, 3]);
    service.setIgnition(null);
    expect(doubles.markers[0].remove).toHaveBeenCalled();
    service.setFireStarts([{ point: [2, 3], label: '<img src=x>' }]);
    expect(doubles.markers[3].options.element.querySelector('.spawn-label')?.textContent).toBe(
      '<img src=x>',
    );
    expect(doubles.markers[3].options.element.querySelector('img')).toBeNull();
    service.setFireStarts([]);
    expect(doubles.markers[3].remove).toHaveBeenCalled();
    service.setIgnition([2, 3]);
    service.setFireStarts([{ point: [2, 3], label: 'fire' }]);
    service.setSlopes(null);
    service.setSlopes('data:image/png;base64,first');
    service.setSlopes('first', bounds);
    const slopes = map.getSource(SLOPES_SOURCE)!;
    service.setSlopes('second', bounds);
    expect(slopes.updateImage).toHaveBeenCalledWith({
      url: 'second',
      coordinates: [
        [0, 4],
        [4, 4],
        [4, 0],
        [0, 0],
      ],
    });
    service.setSlopes(null);
    expect(map.getSource(SLOPES_SOURCE)).toBeUndefined();
    service.refreshFire();
    service.setFire(null);
    service.setFire(document.createElement('canvas'));
    service.setFire(document.createElement('canvas'), bounds);
    const fire = map.getSource(FIRE_SOURCE)!;
    service.refreshFire();
    service.refreshFire();
    expect(fire.play).toHaveBeenCalledTimes(2);
    expect(fire.pause).toHaveBeenCalledTimes(2);
    expect(map.setFeatureState).toHaveBeenLastCalledWith(
      { source: FIRE_SOURCE, id: 0 },
      { revisio: 2 },
    );
    service.setFire(null);
    expect(map.getSource(FIRE_SOURCE)).toBeUndefined();
    service.destroy();
    expect(doubles.markers.every((m) => m.remove.mock.calls.length === 1)).toBe(true);
  });

  it('constrains sandbox movement without recursively reacting to its own corrections', () => {
    start();
    service.setTerrain3D(false);
    expect(map.setTerrain).not.toHaveBeenCalled();
    service.setTerrain3D(true);
    service.goToBounds(bounds);
    expect(map.fitBounds.mock.lastCall![1]).toMatchObject({ pitch: 55, bearing: 30 });
    service.setTerrain3D(false);
    expect(map.setTerrain).toHaveBeenLastCalledWith(null);
    service.setOrbit(true);
    service.setOrbit(false);
    expect(map.dragRotate.enable).toHaveBeenCalledWith({ movement: 'linear' });
    expect(map.touchPitch.disable).toHaveBeenCalled();
    service.setSandboxBounds(null);
    service.setSandboxBounds(bounds);
    expect(map.setMinZoom).toHaveBeenLastCalledWith(9.85);
    expect(map.setMaxZoom).toHaveBeenLastCalledWith(16);
    map.emit('move');
    expect(map.setCenter).not.toHaveBeenCalled();
    map.getCenter.mockReturnValue({ lng: 100, lat: -100 });
    map.emit('move');
    expect(map.setCenter).toHaveBeenLastCalledWith([7.2, -3.2]);
    map.cameraForBounds.mockReturnValue(undefined);
    service.setSandboxBounds(bounds);
    map.cameraForBounds.mockReturnValue({});
    service.setSandboxBounds(bounds);
    service.setSandboxBounds(null);
    expect(map.handlers.get('move')?.size).toBe(0);
    expect(map.scrollZoom.disable).toHaveBeenCalled();
    service.zoomBy(2);
    expect(map.easeTo).toHaveBeenCalledWith({ zoom: 12, duration: 250 });
    service.focusFire(bounds);
    expect(map.fitBounds.mock.lastCall![1]).toMatchObject({ maxZoom: 15, duration: 850 });
  });

  it('creates fire and agent layers lazily and applies motion preferences', async () => {
    start();
    service.setFireMotion(false);
    service.resetFireParticles();
    service.setFireParticles(null);
    service.setFireParticles({
      positions: new Float32Array(3),
      count: 1,
      unitsPerMetre: 1e-8,
      strength: new Float32Array([1]),
      weights: new Float32Array([1]),
    });
    service.setFireMotion(false);
    service.resetFireParticles();
    service.setTerrain3D(true);
    service.setFireParticles(
      {
        positions: new Float32Array(3),
        count: 1,
        unitsPerMetre: 1e-8,
        strength: new Float32Array([1]),
        weights: new Float32Array([1]),
      },
      90,
      20,
    );
    service.setFireParticles(null);
    service.setFireParticles(null);
    service.landPasses();
    service.setAgentsMotion(false);
    service.setGroundAgents([]);
    const pass = {
      id: 'air',
      kind: 'helicopter',
      drop: [2, 3],
      heading: 90,
      liquid: 'water',
    } as Pass;
    service.flyPass(pass);
    expect(map.getLayer(LAYERS.agents)).toBeUndefined();
    service.setAgentsMotion(true);
    const ground = {
      id: 'crew',
      kind: 'crew',
      point: [2, 3],
      heading: 90,
    } as GroundAgent;
    service.setGroundAgents([ground]);
    await vi.waitFor(() => expect(map.getLayer(LAYERS.agents)).toBeDefined());
    service.setGroundAgents([]);
    service.flyPass(pass);
    service.landPasses();
    service.setAgentsMotion(false);
    map.layers.delete(LAYERS.agents);
    service.setGroundAgents([ground]);
    await Promise.resolve();
    expect(map.getLayer(LAYERS.agents)).toBeDefined();
  });

  it('drops 3D figures whose map was destroyed or replaced while three.js loaded', async () => {
    const pass = {
      id: 'air',
      kind: 'helicopter',
      drop: [2, 3],
      heading: 90,
      liquid: 'water',
    } as Pass;
    const ground = { id: 'crew', kind: 'crew', point: [2, 3], heading: 90 } as GroundAgent;
    start();
    service.setGroundAgents([ground]);
    service.flyPass(pass);
    expect(map.getLayer(LAYERS.agents)).toBeUndefined();
    service.destroy();
    await settle();
    expect(map.getLayer(LAYERS.agents)).toBeUndefined();

    const second = mapDouble();
    doubles.makeMap = install(second);
    service.create(document.createElement('div'));
    second.emit('styledata');
    await settle();
    expect(second.getLayer(LAYERS.agents)).toBeUndefined();

    service.setGroundAgents([ground]);
    await vi.waitFor(() => expect(second.getLayer(LAYERS.agents)).toBeDefined());
    expect(map.getLayer(LAYERS.agents)).toBeUndefined();
  });

  it('draws and selects countermeasures, previews brushes and safely detaches', () => {
    const display = new CountermeasureDisplay(),
      selected = vi.fn();
    const libre = mapBoundary(map);
    display.setMeasures([], null);
    display.setDraft(null);
    display['clicked'](event() as MapMouseEvent);
    display.detach();
    display.attach(libre, selected);
    display.attach(libre, selected);
    expect(map.addSource).toHaveBeenCalledTimes(2);
    const measure = {
      id: 'line',
      points: [
        [0, 0],
        [1, 1],
      ] as const,
      widthM: 30,
      colour: '#fff',
      disc: false,
    };
    display.setMeasures(
      [
        measure,
        { ...measure, id: 'disc', disc: true },
        { ...measure, points: [] },
        { ...measure, disc: true, points: [] },
      ],
      'line',
    );
    const data = map.getSource('countermeasures')!.setData.mock.lastCall![0] as FeatureCollection;
    expect(data.features).toHaveLength(2);
    expect(data.features[0].properties!['selected']).toBe(true);
    expect(data.features[1].geometry.type).toBe('Polygon');
    map.queryRenderedFeatures.mockReturnValue([{ properties: { id: 'line' } }]);
    map.emit('click', event());
    expect(selected).toHaveBeenLastCalledWith('line');
    map.queryRenderedFeatures.mockReturnValue([{ properties: { id: 3 } }]);
    map.emit('click', event());
    expect(selected).toHaveBeenLastCalledWith(null);
    map.queryRenderedFeatures.mockReturnValue([]);
    map.emit('click', event());
    expect(selected).toHaveBeenLastCalledWith(null);
    const draft = { points: [], pointer: null, widthM: 30, colour: '#fff', disc: true };
    display.setDraft(draft);
    map.emit('click', event());
    expect(selected).toHaveBeenCalledTimes(3);
    display.setDraft({ ...draft, pointer: [1, 1] });
    expect(map.getSource('countermeasure-draft')!.setData.mock.lastCall![0].features).toHaveLength(
      1,
    );
    display.setDraft({ ...draft, disc: false, pointer: [1, 1] });
    expect(map.getSource('countermeasure-draft')!.setData.mock.lastCall![0].features).toHaveLength(
      1,
    );
    display.setDraft({ ...draft, disc: false, points: [[0, 0]], pointer: [1, 1] });
    expect(map.getSource('countermeasure-draft')!.setData.mock.lastCall![0].features).toHaveLength(
      2,
    );
    display.setDraft({
      ...draft,
      disc: false,
      points: [
        [0, 0],
        [1, 1],
      ],
    });
    display.setDraft({ ...draft, disc: false });
    display.setDraft(null);
    display.detach();
    expect(map.sources.size).toBe(0);
    expect(map.layers.size).toBe(0);
    display.attach(libre, selected);
    map.layers.clear();
    map.sources.clear();
    display.detach();
    display.attach(libre, selected);
    map.off.mockImplementationOnce(() => {
      throw new Error('removed');
    });
    expect(() => display.detach()).not.toThrow();
  });

  it('places spotting ignitions at cell centres and transfers its layer between maps', () => {
    const display = new SpottingDisplay();
    display.detach();
    const libre = mapBoundary(map);
    const spot = { cell: 0, minute: 5 } as Parameters<SpottingDisplay['set']>[2][number];
    display.set(libre, [2, 39], [spot]);
    expect(map.getSource('spot-ignitions')!.options).toMatchObject({
      data: {
        features: [{ properties: { minute: 5 }, geometry: { coordinates: spotPoint(0, [2, 39]) } }],
      },
    });
    const nw = spotPoint(0, [2, 39]),
      se = spotPoint(GRID * GRID - 1, [2, 39]);
    expect(nw[0]).toBeLessThan(se[0]);
    expect(nw[1]).toBeGreaterThan(se[1]);
    display.set(libre, [2, 39], []);
    expect(map.getSource('spot-ignitions')!.setData).toHaveBeenCalledWith(empty);
    const other = mapDouble();
    display.set(mapBoundary(other), [2, 39], []);
    expect(map.sources.size).toBe(0);
    other.layers.clear();
    other.sources.clear();
    display.detach();
  });
});
