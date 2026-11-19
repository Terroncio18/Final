import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi, type Mock } from 'vitest';
import { SimulatorView, SIMULATE_FIRE } from './simulator-view';
import { Chrome } from '../chrome';
import { MapService } from '../map/map.service';
import { PlacesService } from '../map/places.service';
import { CountermeasureDisplay } from '../map/countermeasure-display';
import { SpottingDisplay } from '../map/spotting-display';
import { ProvincesService } from '../simulation/provinces.service';
import { MunicipalitiesService } from '../simulation/municipalities.service';
import { TerrainService } from '../simulation/terrain.service';
import { FuelService } from '../simulation/fuel.service';
import { WeatherService, type Observation } from './weather.service';
import { spread, type SpreadResult } from '../simulation/fire-spread';
import { type Terrain, cellOf } from '../simulation/terrain';
import type { FuelGrid } from '../simulation/fuel-data';
import type { FuelTreatments } from '../simulation/fuel-treatments';
import { type Point, formatPoints } from '../simulation/point';
import { GRID, domainAround } from '../simulation/domain';
import { COUNTERMEASURE_CATALOG, type Countermeasure } from '../simulation/countermeasures';
import { formatScenario, MAX_SCENARIO_SIZE, type Scenario } from '../simulation/scenario';
import { routes } from '../app.routes';
import { appConfig } from '../app.config';

const centre: Point = [2.7, 39.7],
  centreCell = cellOf(centre, centre)!;
const input = (value: string) => ({ target: { value } }) as unknown as Event;
const measure = (patch: Partial<Countermeasure> = {}): Countermeasure => ({
  id: 'm1',
  kind: 'defense-line',
  points: [
    [2.7, 39.7],
    [2.71, 39.7],
  ],
  widthM: 30,
  strength: 0,
  durationMin: 0,
  ...patch,
});
const ground = (): Terrain => ({
  elevation: new Float32Array(GRID * GRID).fill(100),
  slope: new Float32Array(GRID * GRID).fill(5),
  minElevation: 100,
  maxElevation: 100,
  meanSlope: 5,
  maxSlope: 5,
  tiles: 4,
});
const fuelGrid = (): FuelGrid => ({
  version: 'anderson13-worldcover2021-v2',
  bounds: domainAround(centre),
  size: GRID,
  models: new Uint8Array(GRID * GRID).fill(1),
  quality: new Uint8Array(GRID * GRID).fill(2),
  officialCells: 0,
  estimatedCells: GRID * GRID,
  unknownCells: 0,
  nonBurnableCells: 0,
  counts: [{ id: 1, cells: GRID * GRID }],
  sources: [],
  warnings: [],
});
function resultFor(patch: Partial<SpreadResult> = {}): SpreadResult {
  const arrival = new Float32Array(GRID * GRID).fill(Infinity);
  arrival[centreCell] = 0;
  arrival[centreCell + 1] = 2;
  arrival[centreCell + GRID] = 4;
  arrival[centreCell + GRID + 1] = 6;
  const values = (scale: number) => Float32Array.from({ length: 1111 }, (_, i) => i * scale);
  return {
    arrival,
    horizon: 1110,
    burnable: GRID * GRID,
    heat: new Float32Array(GRID * GRID).fill(1000),
    reachedEdge: Infinity,
    baseRate: 1,
    series: {
      area: values(1),
      perimeter: values(0.1),
      rate: values(0.5),
      heading: new Float32Array(1111).fill(90),
      intensity: values(100),
      run: values(0.01),
    },
    ...patch,
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

const MAP_METHODS = [
  'setGroundAgents',
  'setAgentsMotion',
  'landPasses',
  'flyPass',
  'create',
  'setHotspotsVisible',
  'setRegionsVisible',
  'showProvincesOf',
  'focusMunicipality',
  'setIgnition',
  'setDomain',
  'setDomainMask',
  'setTerrain3D',
  'setOrbit',
  'goToBounds',
  'setSandboxBounds',
  'setContours',
  'setReliefEmphasis',
  'setPicking',
  'setFireStarts',
  'setSlopes',
  'setFire',
  'setFireParticles',
  'refreshFire',
  'resetFireParticles',
  'setFireMotion',
  'destroy',
  'zoomBy',
  'focusFire',
] as const;
function mapsDouble() {
  const methods = Object.fromEntries(MAP_METHODS.map((name) => [name, vi.fn()])) as Record<
    (typeof MAP_METHODS)[number],
    Mock
  >;
  return {
    ready: signal(false),
    bearing: signal(30),
    pointer: signal<Point | null>(null),
    picked: signal<Point | null>(null),
    rightClicks: signal(0),
    map: null as object | null,
    ...methods,
    metresPerPixel: vi.fn((): number | null => null),
  };
}
function terrainDouble() {
  return {
    terrain: signal<Terrain | null>(null),
    reading: signal(false),
    failed: signal(false),
    read: vi.fn(),
    clear: vi.fn(),
  };
}
function fuelsDouble() {
  return {
    grid: signal<FuelGrid | null>(null),
    reading: signal(false),
    error: signal<string | null>(null),
    read: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn(),
  };
}
function weatherDouble() {
  return {
    observation: signal<Observation | null>(null),
    loading: signal(false),
    failed: signal(false),
    load: vi.fn(),
    clear: vi.fn(),
  };
}
function placesDouble() {
  return { load: vi.fn(), release: vi.fn() };
}
function municipalitiesDouble() {
  return {
    load: vi.fn(),
    find: vi.fn((id: string) => (id === 'ES_07061' ? { name: 'Sóller' } : undefined)),
  };
}
describe('simulator screen', () => {
  let fixture: ComponentFixture<SimulatorView>, c: SimulatorView;
  let maps: ReturnType<typeof mapsDouble>,
    terrain: ReturnType<typeof terrainDouble>,
    fuels: ReturnType<typeof fuelsDouble>,
    weather: ReturnType<typeof weatherDouble>,
    places: ReturnType<typeof placesDouble>,
    municipalities: ReturnType<typeof municipalitiesDouble>;
  let simulate: ReturnType<typeof vi.fn<typeof spread>>,
    navigate: ReturnType<typeof vi.fn<Router['navigate']>>;
  let frames: Map<number, FrameRequestCallback>,
    frameId: number,
    reduced: { matches: boolean },
    clock: number;
  beforeEach(() => {
    localStorage.clear();
    frames = new Map();
    frameId = 0;
    clock = 0;
    reduced = { matches: true };
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => reduced),
    );
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        frames.set(++frameId, callback);
        return frameId;
      }),
    );
    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn((id: number) => frames.delete(id)),
    );
    vi.spyOn(performance, 'now').mockImplementation(() => clock);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const gl = new Proxy(
      {
        getShaderParameter: () => true,
        getProgramParameter: () => true,
        createProgram: () => ({}),
        createShader: () => ({}),
        createTexture: () => ({}),
        getExtension: () => null,
        isContextLost: () => false,
        createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      } as Record<string, unknown>,
      { get: (target, name: string) => (target[name] ??= vi.fn()) },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      gl as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;slope');
    for (const method of ['attach', 'detach', 'setMeasures', 'setDraft'] as const)
      vi.spyOn(CountermeasureDisplay.prototype, method).mockImplementation(() => {});
    for (const method of ['set', 'detach'] as const)
      vi.spyOn(SpottingDisplay.prototype, method).mockImplementation(() => {});
    maps = mapsDouble();
    terrain = terrainDouble();
    fuels = fuelsDouble();
    weather = weatherDouble();
    places = placesDouble();
    municipalities = municipalitiesDouble();
    simulate = vi.fn<typeof spread>();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MapService, useValue: maps },
        { provide: PlacesService, useValue: places },
        { provide: TerrainService, useValue: terrain },
        { provide: FuelService, useValue: fuels },
        { provide: WeatherService, useValue: weather },
        {
          provide: ProvincesService,
          useValue: {
            load: vi.fn(),
            find: (id: string) => (id === 'ES532' ? { name: 'Mallorca' } : undefined),
          },
        },
        { provide: MunicipalitiesService, useValue: municipalities },
        { provide: SIMULATE_FIRE, useValue: simulate },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });
  afterEach(() => {
    fixture?.destroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  async function open(point = '@2.7,39.7', loaded = false) {
    if (loaded) {
      terrain.terrain.set(ground());
      fuels.grid.set(fuelGrid());
    }
    fixture = TestBed.createComponent(SimulatorView);
    c = fixture.componentInstance;
    for (const [key, value] of Object.entries({
      region: 'ES53',
      province: 'ES532',
      municipality: 'ES_07061',
      point,
    }))
      fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
  }
  async function ignition() {
    fixture.componentRef.setInput('ignicions', formatPoints([centre]));
    await fixture.whenStable();
  }
  async function frame(ms: number) {
    clock = ms;
    const callbacks = [...frames.values()];
    frames.clear();
    for (const fn of callbacks) fn(ms);
    await fixture.whenStable();
  }
  async function publish(result = resultFor()) {
    c['result'].set(result);
    await fixture.whenStable();
    return result;
  }

  it('opens the simulation, controls its layers and restores the application on exit', async () => {
    await open();
    expect(TestBed.inject(Chrome).visible()).toBe(false);
    expect(maps.create).toHaveBeenCalledWith(fixture.nativeElement.querySelector('.map-canvas'));
    expect(c['coordinates']()).toBe('39.7000° N, 2.7000° E');
    expect(c['compassTurn']()).toBe('rotate(-30deg)');
    expect(c['provinceName']()).toBe('Mallorca');
    expect(c['ground']()).toBeNull();
    expect(c['under']()).toBeNull();
    expect(c['state']().short).toBe('Llegint el terreny');
    expect(c['charts']().area.line).toBe('M0.0 100.0 L300.0 100.0');
    expect(maps.setTerrain3D).toHaveBeenCalledWith(true);
    c['relief'].set(false);
    c['labels'].set(false);
    c['contours'].set(false);
    await fixture.whenStable();
    expect(maps.setTerrain3D).toHaveBeenLastCalledWith(false);
    expect(places.release).toHaveBeenCalled();
    expect(maps.setContours).toHaveBeenLastCalledWith(false);
    terrain.terrain.set(ground());
    await fixture.whenStable();
    expect(c['ground']()).toMatchObject({ low: 100, high: 100, max: '5' });
    expect(c['state']().short).toBe('Falta una ignició');
    maps.pointer.set(centre);
    expect(c['under']()).toMatchObject({ elevation: 100, slope: '5' });
    maps.pointer.set([0, 0]);
    expect(c['under']()).toBeNull();
    c['slopes'].set(true);
    await fixture.whenStable();
    expect(maps.setSlopes).toHaveBeenLastCalledWith('data:image/png;slope', domainAround(centre));
    c['recentre']();
    c['zoom'](-1);
    c['focusSpot'](centreCell);
    expect(maps.zoomBy).toHaveBeenCalledWith(-1);
    c['refreshWeather']();
    c['retryFuels']();
    expect(weather.load).toHaveBeenCalledWith('ES', centre);
    expect(fuels.read).toHaveBeenLastCalledWith(centre, true);
    expect(c['fill'](-1, 0, 100)).toBe('0%');
    expect(c['fill'](150, 0, 100)).toBe('100%');
    expect(c['fill'](50, 0, 100)).toBe('50%');
    fixture.destroy();
    expect(TestBed.inject(Chrome).visible()).toBe(true);
    expect(weather.clear).toHaveBeenCalled();
    expect(maps.destroy).toHaveBeenCalled();
  });

  it('handles invalid domains and uses route names when geographic data is missing', async () => {
    await open('invalid');
    fixture.componentRef.setInput('province', 'missing');
    fixture.componentRef.setInput('municipality', 'missing');
    fixture.componentRef.setInput('region', 'PT11');
    await fixture.whenStable();
    expect(c['coordinates']()).toBe('');
    expect(c['starts']()).toEqual([]);
    expect(c['provinceName']()).toBe('missing');
    expect(c['weatherSource']().name).toBe('IPMA');
    expect(terrain.clear).toHaveBeenCalled();
    c['retryFuels']();
    c['refreshWeather']();
    c['recentre']();
    c['focusSpot'](0);
    c['focusFire']();
    c['saveScenario']();
    await c['start']();
    expect(simulate).not.toHaveBeenCalled();
    expect(weather.load).not.toHaveBeenCalled();
    fixture.componentRef.setInput('point', '@-2,-3');
    await fixture.whenStable();
    expect(c['coordinates']()).toBe('3.0000° S, 2.0000° O');
  });

  it('keeps manual weather while reading live observations and supports wind pointer and keyboard controls', async () => {
    await open();
    expect(c['station']()).toBeNull();
    expect(c['liveState']().tag).toBe('SENSE CONNEXIÓ');
    c['weatherMode'].set('live');
    weather.loading.set(true);
    await fixture.whenStable();
    expect(c['liveState']().tag).toBe('LLEGINT');
    expect(weather.load).toHaveBeenCalled();
    const seen: Observation = {
      source: 'AEMET',
      station: { id: 'one', name: 'Station', lon: 2.7, lat: 39.7 },
      observedAt: '2024-08-01T12:00:00Z',
      windKmh: 31.6,
      windFromDeg: 90,
      humidity: 25.6,
      temperature: 30.2,
      distanceKm: 2.5,
      stale: false,
    };
    weather.observation.set(seen);
    weather.loading.set(false);
    expect(c['now']()).toMatchObject({ wind: 32, humidity: 26, fromDeg: 90, live: true });
    expect(c['station']()!.name).toBe('Station');
    expect(c['station']()!.observedAt).toContain('UTC');
    expect(c['liveState']().tag).toBe('EN DIRECTE');
    expect(c['fromPhrase']()).toBe("de l'est");
    weather.failed.set(true);
    expect(c['liveState']().tag).toBe('DADA ANTIGA');
    weather.failed.set(false);
    weather.observation.set({ ...seen, stale: true });
    expect(c['liveState']().warn).toBe(true);
    c['nudgeWind'](new KeyboardEvent('keydown', { key: 'Home' }));
    expect(c['direction']()).toBe(315);
    const dial = {
      setPointerCapture: vi.fn(),
      hasPointerCapture: vi.fn(() => false),
      focus: vi.fn(),
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    };
    const pointer = (type: string, clientX: number, clientY: number) =>
      ({ type, clientX, clientY, pointerId: 1, currentTarget: dial }) as unknown as PointerEvent;
    c['turnWind'](pointer('pointerdown', 100, 50));
    expect(dial.focus).not.toHaveBeenCalled();
    c['weatherMode'].set('manual');
    c['setNumber']('humidity', input('40'));
    c['setNumber']('temperature', input('35'));
    c['setNumber']('wind', input('20'));
    c['windChanges'].set([
      { startMin: 0, speedKmh: 10, fromDeg: 0 },
      { startMin: 10, speedKmh: 30, fromDeg: 45 },
    ]);
    c['setNumber']('wind', input('21'));
    expect(c['windChanges']()).toHaveLength(1);
    c['nudgeWind'](new KeyboardEvent('keydown', { key: 'Home' }));
    expect(c['fromPhrase']()).toBe('del nord');
    c['nudgeWind'](new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(c['direction']()).toBe(355);
    c['nudgeWind'](new KeyboardEvent('keydown', { key: 'PageUp' }));
    expect(c['direction']()).toBe(40);
    c['nudgeWind'](new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(c['direction']()).toBe(40);
    c['turnWind'](pointer('pointermove', 100, 50));
    expect(c['direction']()).toBe(40);
    c['turnWind'](pointer('pointerdown', 50, 50));
    expect(c['direction']()).toBe(40);
    dial.setPointerCapture.mockImplementation(() => {
      throw new Error('synthetic');
    });
    c['turnWind'](pointer('pointerdown', 100, 50));
    expect(c['direction']()).toBe(270);
    dial.hasPointerCapture.mockReturnValue(true);
    c['turnWind'](pointer('pointermove', 50, 0));
    expect(c['direction']()).toBe(180);
    c['computing'].set(true);
    c['setNumber']('wind', input('50'));
    c['turnWind'](pointer('pointerdown', 100, 50));
    c['nudgeWind'](new KeyboardEvent('keydown', { key: 'Home' }));
    c['editWind']({ fromDeg: 0 });
    expect(c['wind']()).toBe(21);
    expect(c['direction']()).toBe(180);
  });

  it('validates fuel availability, burnable ignitions and the spotting seed before starting', async () => {
    await open();
    expect(c['conditions']().base).toBe('—');
    expect(c['burnableShare']()).toBe('—');
    expect(c['canStart']()).toBe(false);
    await ignition();
    expect(c['startRows']()[0].ground).toBeNull();
    terrain.terrain.set(ground());
    await fixture.whenStable();
    expect(c['fuelIssue']()).toContain('Falta');
    fuels.reading.set(true);
    expect(c['fuelIssue']()).toContain('Llegint');
    fuels.reading.set(false);
    fuels.error.set('offline');
    expect(c['fuelIssue']()).toBe('offline');
    fuels.error.set(null);
    const grid = fuelGrid();
    grid.models[0] = 255;
    fuels.grid.set(grid);
    expect(c['fuelIssue']()).toContain('sense dades');
    grid.models[0] = 0;
    grid.models[centreCell] = 0;
    fuels.grid.set({ ...grid });
    expect(c['fuelIssue']()).toContain('Mou');
    grid.models[centreCell] = 1;
    const land = ground();
    land.elevation[centreCell] = 0;
    terrain.terrain.set(land);
    expect(c['fuelIssue']()).toContain('Mou');
    terrain.terrain.set(ground());
    fuels.grid.set({
      ...grid,
      counts: [
        { id: 1, cells: 100 },
        { id: 8, cells: 200 },
      ],
    });
    await fixture.whenStable();
    expect(c['canStart']()).toBe(true);
    expect(c['state']().short).toBe('A punt');
    expect(c['conditions']().base).toContain('–');
    expect(c['fuelModels']()).toHaveLength(2);
    expect(c['burnableShare']()).toBe('100 %');
    c['runError'].set('failed');
    expect(c['state']().detail).toBe('failed');
    for (const value of ['2', '-1', '1.5', '4294967296', 'bad']) {
      const event = input(value);
      c['setSpottingSeed'](event);
      expect((event.target as HTMLInputElement).value).toBe('2');
    }
    c['computing'].set(true);
    c['setSpottingSeed'](input('5'));
    expect(c['spottingSeed']()).toBe(2);
    expect(c['state']().tag).toBe('CALCULANT');
    c['computing'].set(false);
    fixture.componentRef.setInput(
      'ignicions',
      formatPoints([centre, [0, 0], [10, 39.7], [2.7, 0], [2.7, 60]]),
    );
    await fixture.whenStable();
    expect(c['starts']()).toEqual([centre]);
    expect(c['startRows']()[0].ground).toContain('100 m');
  });

  it('writes ignition tools to the URL and gives countermeasure tools exclusive ownership of clicks', async () => {
    await open(undefined, true);
    maps.picked.set(centre);
    await fixture.whenStable();
    expect(navigate).not.toHaveBeenCalled();
    c['toggleTool']('ignition');
    maps.picked.set([...centre]);
    await fixture.whenStable();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { ignicions: '2.70000,39.70000' }, replaceUrl: true }),
    );
    c['toggleTool']('ignition');
    expect(c['tool']()).toBeNull();
    await ignition();
    c['removeStart'](0);
    c['clearStarts']();
    expect(navigate).toHaveBeenLastCalledWith(
      [],
      expect.objectContaining({ queryParams: { ignicions: null } }),
    );
    c['pickMeasure']('firebreak');
    c['applySettings']();
    maps.picked.set(centre);
    await fixture.whenStable();
    maps.picked.set([2.71, 39.7]);
    await fixture.whenStable();
    expect(c['plan'].draft()).toHaveLength(2);
    maps.rightClicks.set(1);
    await fixture.whenStable();
    expect(c['plan'].draft()).toHaveLength(1);
    maps.rightClicks.set(2);
    await fixture.whenStable();
    expect(c['plan'].kind()).toBeNull();
    maps.rightClicks.set(3);
    await fixture.whenStable();
    c['plan'].begin('helicopter');
    maps.rightClicks.set(4);
    await fixture.whenStable();
    expect(c['plan'].kind()).toBeNull();
    c['plan'].begin('firebreak');
    c['computing'].set(true);
    maps.picked.set([2.72, 39.7]);
    maps.rightClicks.set(5);
    await fixture.whenStable();
    expect(c['plan'].kind()).toBe('firebreak');
    expect(c['plan'].draft()).toEqual([]);
    c['computing'].set(false);
    c['cancelTool']();
    maps.ready.set(true);
    maps.map = {};
    await fixture.whenStable();
    expect(CountermeasureDisplay.prototype.attach).toHaveBeenCalled();
    expect(SpottingDisplay.prototype.set).toHaveBeenCalled();
    c['plan'].measures.set([measure()]);
    await fixture.whenStable();
    const select = vi.mocked(CountermeasureDisplay.prototype.attach).mock.lastCall![1];
    select('m1');
    expect(c['plan'].selected()).toBe('m1');
    c['plan'].begin('backfire');
    maps.pointer.set(centre);
    await fixture.whenStable();
    expect(CountermeasureDisplay.prototype.setDraft).toHaveBeenLastCalledWith(
      expect.objectContaining({ pointer: centre, disc: false }),
    );
  });

  it('validates countermeasure settings, remembers choices and warns before editing history', async () => {
    await open();
    expect(c['configView']()).toBeNull();
    c['setSetting']('widthM', input('50'));
    c['resetSettings']();
    c['applySettings']();
    c['confirmPastMeasure']();
    c['computing'].set(true);
    c['pickMeasure']('firebreak');
    expect(c['configuring']()).toBeNull();
    c['computing'].set(false);
    for (const entry of COUNTERMEASURE_CATALOG) {
      c['pickMeasure'](entry.kind);
      expect(c['configView']()?.label).toBe(entry.label);
      c['cancelSettings']();
    }
    c['pickMeasure']('clearing');
    c['setSetting']('fuelRemaining', input('25,5'));
    expect(c['configuring']()!.settings.fuelRemaining).toBe(0.255);
    c['setSetting']('widthM', input(''));
    c['applySettings']();
    expect(c['configuring']()?.error).toBeTruthy();
    c['resetSettings']();
    c['applySettings']();
    expect(c['plan'].kind()).toBe('clearing');
    c['pickMeasure']('clearing');
    expect(c['plan'].kind()).toBeNull();
    c['pickMeasure']('clearing');
    c['pickMeasure']('clearing');
    expect(c['configuring']()).toBeNull();
    expect(c['shown'](undefined)).toBe('');
    expect(c['shown'](NaN)).toBe('');
    expect(c['shown'](0.25, true)).toBe(25);
    expect(c['shown'](30)).toBe(30);
    c['result'].set(resultFor());
    c['minutes'].set(10);
    c['plan'].measures.set([measure({ startMin: 20 })]);
    c['pickMeasure']('backfire');
    expect(c['pastWarning']()).toEqual({ kind: 'backfire', count: 1 });
    c['cancelPastMeasure']();
    expect(c['pastWarning']()).toBeNull();
    c['pickMeasure']('backfire');
    c['confirmPastMeasure']();
    expect(c['configuring']()?.discard).toBe(true);
    c['applySettings']();
    expect(c['plan'].kind()).toBe('backfire');
    c['cancelTool']();
    expect(c['configuring']()).toBeNull();
  });

  it('publishes model progress, plays a completed run and prevents abandoned runs from publishing', async () => {
    await open(undefined, true);
    await c['start']();
    expect(simulate).not.toHaveBeenCalled();
    await ignition();
    const first = deferred<SpreadResult>();
    simulate.mockImplementationOnce((_data, progress) => {
      progress?.(0.5);
      return first.promise;
    });
    const pending = c['start']();
    expect(c['computing']()).toBe(true);
    expect(c['progress']()).toBe(0.5);
    expect(c['state']().short).toContain('50 %');
    expect(simulate.mock.calls[0][0]).toMatchObject({ ignitions: [centreCell], horizon: 1110 });
    c['reset']();
    simulate.mock.calls[0][1]?.(0.9);
    expect(c['progress']()).toBe(0.5);
    first.resolve(resultFor());
    await pending;
    expect(c['result']()).toBeNull();
    simulate.mockResolvedValue(resultFor());
    await c['start']();
    expect(c['result']()).not.toBeNull();
    expect(c['playing']()).toBe(true);
    expect(c['computing']()).toBe(false);
    await fixture.whenStable();
    await frame(1000);
    expect(c['minutes']()).toBe(0.5);
    c['setSpeed'](input('60'));
    await frame(2000);
    expect(c['minutes']()).toBe(30.5);
    c['minutes'].set(719);
    await frame(4000);
    expect(c['minutes']()).toBe(720);
    expect(c['playing']()).toBe(false);
    c['togglePlay']();
    expect(c['minutes']()).toBe(0);
    expect(c['playing']()).toBe(true);
    c['togglePlay']();
    expect(c['playing']()).toBe(false);
    c['windDraft'].set({ speedKmh: 20, fromDeg: 0 });
    c['togglePlay']();
    expect(c['playing']()).toBe(false);
    c['windDraft'].set(null);
    c['computing'].set(true);
    c['togglePlay']();
    c['setMinutes'](input('10'));
    expect(c['minutes']()).toBe(0);
    c['computing'].set(false);
    c['setMinutes'](input('10'));
    expect(c['minutes']()).toBe(10);
    c['reset']();
    c['togglePlay']();
    expect(c['playing']()).toBe(false);
  });

  it('rolls failed forecast changes back and reports both Error and non-Error rejections', async () => {
    await open(undefined, true);
    await ignition();
    const previous = [measure()],
      winds = [{ startMin: 5, speedKmh: 30, fromDeg: 90 }];
    c['plan'].measures.set(previous);
    const result = await publish();
    c['minutes'].set(10);
    simulate.mockRejectedValueOnce(new Error('failed'));
    await c['start'](10, previous, winds);
    expect(c['result']()).toBe(result);
    expect(c['runError']()).toBe('failed');
    expect(c['plan'].measures()).toBe(previous);
    expect(c['windChanges']()).toBe(winds);
    simulate.mockRejectedValueOnce('offline');
    await c['start'](10);
    expect(c['runError']()).toContain('No s’ha pogut');
    const pending = deferred<SpreadResult>();
    simulate.mockReturnValueOnce(pending.promise);
    const running = c['start'](10);
    c['reset']();
    pending.reject(new Error('old'));
    await running;
    expect(c['runError']()).toBeNull();
    await publish();
    c['editWind']({ speedKmh: 200 });
    expect(c['windDraft']()).not.toBeNull();
    await c['applyWind']();
    expect(c['runError']()).toBeTruthy();
    c['windDraft'].set({ speedKmh: 25, fromDeg: 180 });
    simulate.mockResolvedValue(resultFor());
    await c['applyWind']();
    expect(c['windDraft']()).toBeNull();
    expect(c['planStale']()).toBe(true);
    expect(c['playing']()).toBe(false);
    await c['applyWind']();
    c['windDraft'].set({ speedKmh: 20, fromDeg: 0 });
    c['result'].set(null);
    await c['applyWind']();
    expect(c['windDraft']()).not.toBeNull();
  });

  it('keeps cursor history when measures change and uses the plan guard for mop-up', async () => {
    await open(undefined, true);
    await ignition();
    const plan = c['plan'];
    expect(plan.guard?.(measure())).toBeNull();
    expect(plan.guard?.(measure({ kind: 'mop-up' }))).toContain('calculat');
    const result = await publish();
    expect(plan.guard?.(measure({ kind: 'mop-up', startMin: -1 }))).toContain('no ha cremat');
    expect(plan.guard?.(measure({ kind: 'mop-up', startMin: 100 }))).toBeNull();
    simulate.mockResolvedValue(resultFor());
    plan.measures.set([measure()]);
    await fixture.whenStable();
    c['removeMeasure']('m1');
    await Promise.resolve();
    expect(simulate).toHaveBeenCalled();
    await fixture.whenStable();
    plan.measures.set([measure()]);
    c['clearMeasures']();
    await Promise.resolve();
    await fixture.whenStable();
    expect(plan.measures()).toEqual([]);
    c['finishMeasure']();
    c['computing'].set(true);
    c['clearMeasures']();
    c['computing'].set(false);
    c['result'].set(null);
    plan.begin('backfire');
    plan.click(centre, domainAround(centre));
    plan.click([2.71, 39.7], domainAround(centre));
    c['finishMeasure']();
    expect(plan.measures()).toHaveLength(1);
    c['result'].set(result);
    c['minutes'].set(30);
    c['windChanges'].set([{ startMin: 20, speedKmh: 40, fromDeg: 180 }]);
    expect(c['now']().wind).toBe(40);
    expect(c['windRows']()[0]).toMatchObject({ time: '00:20', origin: 'S', pending: false });
  });

  it('derives figures, forecasts, charts and burned-fuel composition from the current minute', async () => {
    await open(undefined, true);
    await ignition();
    expect(c['figures']()).toBeNull();
    expect(c['forecastRows']()).toEqual([]);
    expect(c['burnedFuels']()).toEqual([]);
    const result = await publish();
    c['minutes'].set(120);
    expect(c['figures']()).toMatchObject({
      area: '120',
      heading: 'E',
      edge: 'No hi arriba',
      edgeReached: false,
    });
    expect(c['charts']().area.line).toContain('L');
    expect(c['forecastRows']().every((r) => r.available)).toBe(true);
    expect(c['burnedFuels']()[0]).toMatchObject({ id: 1, share: 100 });
    c['toggleItem']('burnedFuels');
    expect(c['burnedFuels']()).toEqual([]);
    c['toggleItem']('burnedFuels');
    const zero = new Float32Array(1111),
      heading = new Float32Array(1111).fill(NaN);
    c['result'].set({
      ...result,
      reachedEdge: 100,
      burnable: 0,
      horizon: 100,
      series: { ...result.series, rate: zero, intensity: zero, heading },
    });
    c['minutes'].set(0);
    expect(c['figures']()).toMatchObject({
      rateNote: 'Front aturat',
      intensity: '—',
      heading: '—',
      share: '0',
      edgeReached: false,
    });
    expect(c['forecastRows']().some((r) => !r.available)).toBe(true);
    c['minutes'].set(120);
    expect(c['figures']()?.edgeReached).toBe(true);
    c['computing'].set(true);
    expect(c['forecastRows']()).toEqual([]);
    expect(c['state']().short).toContain('Actualitzant');
    c['computing'].set(false);
    c['focusFire']();
    expect(maps.focusFire).toHaveBeenCalled();
    c['forecasts'].set(false);
    c['focusFire']();
    const empty = new Float32Array(GRID * GRID).fill(Infinity);
    c['result'].set({ ...result, arrival: empty });
    c['focusFire']();
    expect(maps.focusFire).toHaveBeenCalledTimes(2);
    c['result'].set({
      ...result,
      spotIgnitions: [{ cell: centreCell, source: centreCell, minute: 1, distanceM: 100.4 }],
    });
    expect(c['spotRows']()[0]).toMatchObject({
      label: 'Focus per brasa 1',
      time: '00:01',
      distance: 100,
    });
    expect(c['treatedCell']()).toBeNull();
    maps.pointer.set(centre);
    const treatment = {
      at: vi.fn(() => ({ moisture1h: 0.15, bed: { loadTonHa: 8 }, remaining: 0.5 })),
    };
    c['result'].set({ ...result, fuelTreatments: treatment as unknown as FuelTreatments });
    expect(c['treatedCell']()).toMatchObject({
      where: 'Cel·la sota el cursor',
      moisture: '15',
      load: '8',
      remaining: 50,
    });
    maps.pointer.set(null);
    c['plan'].measures.set([measure()]);
    c['plan'].selected.set('m1');
    expect(c['treatedCell']()?.where).toContain('seleccionada');
    maps.pointer.set([0, 0]);
    expect(c['treatedCell']()).toBeNull();
  });

  it('saves reproducible scenarios and rejects pending changes or malformed files', async () => {
    await open(undefined, true);
    await ignition();
    const createURL = vi.fn(() => 'blob:scenario');
    vi.stubGlobal(
      'URL',
      class extends URL {
        public static override createObjectURL = createURL;
        public static override revokeObjectURL = vi.fn();
      },
    );
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    c['setScenarioName'](input('My scenario'));
    c['saveScenario']();
    expect(createURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(c['scenarioNote']()?.failed).toBe(false);
    c['scenarioName'].set('');
    c['saveScenario']();
    expect(c['scenarioNote']()?.text).toContain('soller');
    c['plan'].draft.set([centre]);
    c['saveScenario']();
    expect(c['scenarioNote']()?.failed).toBe(true);
    c['plan'].draft.set([]);
    c['windDraft'].set({ speedKmh: 20, fromDeg: 0 });
    c['saveScenario']();
    c['windDraft'].set(null);
    c['computing'].set(true);
    c['saveScenario']();
    c['computing'].set(false);
    const fileEvent = (file?: object) =>
      ({ target: { files: file ? [file] : [], value: 'old' } }) as unknown as Event;
    await c['loadScenario'](fileEvent());
    await c['loadScenario']({ target: { value: 'old' } } as unknown as Event);
    await c['loadScenario'](fileEvent({ size: MAX_SCENARIO_SIZE + 1 }));
    expect(c['scenarioNote']()?.failed).toBe(true);
    await c['loadScenario'](fileEvent({ size: 10, text: async () => 'bad' }));
    expect(c['scenarioNote']()?.failed).toBe(true);
    const scenario: Scenario = {
      name: 'Imported',
      region: 'ES53',
      province: 'ES532',
      municipality: 'ES_07061',
      centre,
      ignitions: [centre],
      wind: 30,
      windFrom: 90,
      humidity: 25,
      temperature: 35,
      countermeasures: [],
      windChanges: [],
      spotting: { enabled: true, seed: 5 },
    };
    const text = formatScenario(scenario, new Date(0));
    await c['loadScenario'](
      fileEvent({ name: 'saved.txt', size: text.length, text: async () => text }),
    );
    expect(c['scenarioName']()).toBe('Imported');
    expect(c['spottingSeed']()).toBe(5);
    expect(c['scenarioNote']()).toEqual({ text: 'Carregat: Imported', failed: false });
    const old = formatScenario(
      {
        ...scenario,
        name: '',
        ignitions: [],
        spotting: undefined,
        windChanges: undefined,
        countermeasures: undefined,
      },
      new Date(0),
    ).replace('versio = 7', 'versio = 1');
    await c['loadScenario'](
      fileEvent({ name: 'old.txt', size: old.length, text: async () => old }),
    );
    expect(c['scenarioNote']()?.outdated).toBe(true);
    expect(c['scenarioNote']()?.text).toContain('old.txt');
    const missing = old.replace(/^vent = .*$/m, '');
    await c['loadScenario'](
      fileEvent({ name: 'partial.txt', size: missing.length, text: async () => missing }),
    );
    expect(c['scenarioNote']()?.text).toContain('per defecte');
  });

  it('keeps analysis preferences when storage works and falls back when it does not', async () => {
    localStorage.setItem('ignislab.analysis.hidden', '["area"]');
    await open();
    expect(c['shows']('area')).toBe(false);
    c['toggleItem']('area');
    expect(c['shows']('area')).toBe(true);
    expect(localStorage.getItem('ignislab.analysis.hidden')).toBe('[]');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(c['storedHidden']().has('base')).toBe(true);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    c['toggleItem']('area');
    expect(c['shows']('area')).toBe(false);
  });

  it('repaints on seeking and on visible frames, freezes reduced motion and cleans up animation', async () => {
    await open(undefined, true);
    await ignition();
    reduced.matches = false;
    await publish();
    expect(maps.setFire).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), expect.any(Array));
    await frame(40);
    await frame(50);
    c['minutes'].set(1);
    await frame(150);
    c['minutes'].set(10);
    await frame(170);
    expect(maps.resetFireParticles).toHaveBeenCalled();
    c['minutes'].set(2);
    await frame(200);
    reduced.matches = true;
    await frame(250);
    const count = maps.refreshFire.mock.calls.length;
    await frame(300);
    expect(maps.refreshFire).toHaveBeenCalledTimes(count);
    maps.metresPerPixel.mockReturnValue(30);
    await frame(350);
    expect(maps.refreshFire.mock.calls.length).toBeGreaterThan(count);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    c['minutes'].set(3);
    await fixture.whenStable();
    expect(maps.resetFireParticles).toHaveBeenCalled();
    await frame(400);
    c['result'].set(null);
    await fixture.whenStable();
    expect(frames.size).toBe(0);
    expect(maps.setFire).toHaveBeenLastCalledWith(null);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    await publish();
    expect(c['runError']()).toContain('dibuixar');
  });

  it('shows measures only during their deployment and animates newly reached aircraft passes', async () => {
    await open(undefined, true);
    await ignition();
    const result = await publish();
    const aircraft = measure({
      id: 'air',
      kind: 'helicopter',
      points: [centre],
      startMin: 1,
      litresPerPass: 1000,
      passes: 2,
      passIntervalMin: 5,
    });
    c['plan'].measures.set([
      measure(),
      measure({ id: 'later', startMin: 20 }),
      measure({ id: 'expired', durationMin: 5 }),
      aircraft,
    ]);
    expect(c['shownMeasures']().map((m) => m.id)).toEqual(['m1', 'expired']);
    await fixture.whenStable();
    c['playing'].set(true);
    c['minutes'].set(1);
    await fixture.whenStable();
    expect(maps.flyPass).toHaveBeenCalledWith(expect.objectContaining({ id: 'air-0' }));
    c['minutes'].set(10);
    expect(c['shownMeasures']().map((m) => m.id)).toEqual(['m1']);
    await fixture.whenStable();
    c['plan'].measures.update((m: readonly Countermeasure[]) => [
      ...m,
      { ...aircraft, id: 'now', startMin: 10 },
    ]);
    await fixture.whenStable();
    expect(maps.flyPass).toHaveBeenCalledWith(expect.objectContaining({ id: 'now-0' }));
    c['plan'].measures.update((m: readonly Countermeasure[]) => [...m]);
    await fixture.whenStable();
    c['minutes'].set(50);
    await fixture.whenStable();
    c['editWind']({ speedKmh: 35 });
    expect(c['now']().wind).toBe(35);
    expect(c['now']().towardsDeg).toBe((c['now']().fromDeg + 180) % 360);
    const burning = measure({ kind: 'mop-up', startMin: 1 });
    expect(c['plan'].guard?.(burning)).toContain('Front massa intens');
    c['result'].set({ ...result, heat: new Float32Array(GRID * GRID).fill(Infinity) });
    expect(c['plan'].guard?.(burning)).toContain('més de 12');
    c['result'].set({
      ...result,
      fuelTreatments: { at: () => ({ bed: { heatPerArea: 2000 } }) } as unknown as FuelTreatments,
    });
    expect(c['plan'].guard?.(burning)).toContain('Front massa intens');
    c['result'].set({ ...result, heat: new Float32Array(GRID * GRID) });
    expect(c['plan'].guard?.(measure({ kind: 'mop-up' }))).toBeNull();
    c['result'].set(null);
    expect(c['shownMeasures']()).toHaveLength(5);
  });

  it('reports unknown burned fuel and preserves rendering with reduced motion while hidden', async () => {
    await open(undefined, true);
    await ignition();
    const grid = fuelGrid();
    grid.models[centreCell] = 255;
    grid.models[centreCell + 1] = 2;
    fuels.grid.set(grid);
    await fixture.whenStable();
    const result = await publish();
    c['minutes'].set(10);
    expect(c['burnedFuels']().find((f) => f.id === 255)?.name).toBe('Sense model');
    expect(c['unknownLand']()).toBe(1);
    c['plan'].measures.set([measure()]);
    expect(c['scenarioSummary']()).toContain('1 contramesura');
    c['plan'].measures.set([measure(), measure({ id: 'm2' })]);
    expect(c['scenarioSummary']()).toContain('2 contramesures');
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    c['minutes'].set(11);
    await fixture.whenStable();
    expect(maps.refreshFire).toHaveBeenCalled();
    reduced.matches = false;
    c['minutes'].set(12);
    await fixture.whenStable();
    expect(maps.setFireParticles).toHaveBeenCalled();
    fixture.componentRef.setInput('point', 'invalid');
    await fixture.whenStable();
    c['plan'].begin('firebreak');
    maps.picked.set(centre);
    await fixture.whenStable();
    expect(c['plan'].draft()).toEqual([]);
    c['result'].set(result);
    c['windDraft'].set({ speedKmh: 10, fromDeg: 0 });
    await c['applyWind']();
    expect(c['windDraft']()).not.toBeNull();
  });

  it('saves an unknown municipality by its route code and reads an old complete scenario', async () => {
    await open();
    fixture.componentRef.setInput('municipality', 'missing');
    await fixture.whenStable();
    vi.stubGlobal(
      'URL',
      class extends URL {
        public static override revokeObjectURL = vi.fn();

        public static override createObjectURL = () => 'blob:scenario';
      },
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    c['saveScenario']();
    expect(c['scenarioNote']()?.text).toContain('missing');
    const scenario: Scenario = {
      name: 'Old complete',
      region: 'ES53',
      province: 'ES532',
      municipality: 'ES_07061',
      centre,
      ignitions: [],
      wind: 20,
      windFrom: 0,
      humidity: 30,
      temperature: 30,
      countermeasures: [],
      windChanges: [],
      spotting: { enabled: false, seed: 1 },
    };
    const text = formatScenario(scenario, new Date(0)).replace('versio = 7', 'versio = 1');
    await c['loadScenario']({
      target: { files: [{ size: text.length, text: async () => text, name: 'old.txt' }] },
    } as unknown as Event);
    expect(c['scenarioNote']()?.outdated).toBe(true);
    expect(c['scenarioNote']()?.text).not.toContain('per defecte');
    fixture.nativeElement.ownerDocument.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape' }),
    );
    expect(c['tool']()).toBeNull();
  });
});

describe('application configuration', () => {
  it('provides the real model and lazily loads the simulator route', async () => {
    expect(TestBed.inject(SIMULATE_FIRE)).toBe(spread);
    expect(appConfig.providers.length).toBeGreaterThan(0);
    const load = routes[0].loadComponent!;
    expect(await TestBed.runInInjectionContext(() => load())).toBe(SimulatorView);
  });
});
