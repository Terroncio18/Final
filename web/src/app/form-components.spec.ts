import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { vi } from 'vitest';
import { RegionsService } from './simulation/regions.service';
import { ProvincesService } from './simulation/provinces.service';
import { MunicipalitiesService } from './simulation/municipalities.service';
import { LevelsService } from './simulation/levels.service';
import { TerrainService } from './simulation/terrain.service';
import { SearchService, type Match } from './simulation/search.service';
import { PointLocator, type Place } from './simulation/point-locator';
import { MapService } from './map/map.service';
import { HotspotsService } from './map/hotspots.service';
import { RegionStep } from './simulation/region-step';
import { ProvinceStep } from './simulation/province-step';
import { MunicipalityStep } from './simulation/municipality-step';
import { IgnitionStep } from './simulation/ignition-step';
import { SearchBox } from './simulation/search-box';
import { SimulationFlow } from './simulation/simulation-flow';
import { MapShell } from './map/map-shell';
import { MapView } from './map/map-view';
import { RangePicker } from './top-bar/range-picker';
import { HotspotPanel } from './hotspot-panel/hotspot-panel';
import { Icon, iconOr } from './simulator/icon';
import type { Hotspot } from './map/hotspot';
import type { Terrain } from './simulation/terrain';
import type { Point } from './simulation/point';
import { GRID } from './simulation/domain';
import { inputEvent } from '../testing/events';

const bounds = [0, 0, 4, 4] as const;
const region = { id: 'ES53', name: 'Balears', country: 'ES', scope: 'peninsula' as const, bounds };
const province = { id: 'ES531', name: 'Mallorca', region: 'ES53', bounds };
const municipality = { id: 'one', name: 'Sóller', province: 'ES531', bounds };
const match: Match = {
  id: 'one',
  name: 'Sóller',
  province: 'ES531',
  provinceName: 'Mallorca',
  region: 'ES53',
};
const hotspot: Hotspot = {
  id: 'fire',
  scope: 'peninsula',
  satellite: 'N',
  observedAt: '2024-08-01T12:00:00Z',
  frp: 4.5,
  confidence: 'n',
  daynight: 'D',
  lon: 2.7,
  lat: 39.7,
};

describe('form, navigation and overview components', () => {
  let maps: ReturnType<typeof mapDouble>;
  function mapDouble() {
    return {
      scope: signal('peninsula'),
      ready: signal(true),
      picked: signal<Point | null>(null),
      selected: signal<Hotspot | null>(null),
      hotspotColourBy: signal('power'),
      hotspotScale: signal(1),
      focusRegion: vi.fn(),
      focusProvince: vi.fn(),
      focusMunicipality: vi.fn(),
      goToView: vi.fn(),
      goToBounds: vi.fn(),
      setIgnition: vi.fn(),
      setDomain: vi.fn(),
      setPicking: vi.fn(),
      setHotspotsVisible: vi.fn(),
      create: vi.fn(),
      destroy: vi.fn(),
      showRegionsFor: vi.fn(),
      clearSelection: vi.fn(),
    };
  }
  let regions: {
    regions: ReturnType<typeof signal<readonly (typeof region)[]>>;
    failed: ReturnType<typeof signal<boolean>>;
    load: ReturnType<typeof vi.fn>;
    find: (id: string) => typeof region | undefined;
  };
  const levels = { show: vi.fn(), clear: vi.fn() };
  const provinces = {
    load: vi.fn(),
    failed: signal(false),
    find: (id: string) => (id === province.id ? province : undefined),
    of: (id: string) =>
      id === 'ES53'
        ? [province, { ...province, id: 'ES532', name: 'Eivissa' }]
        : id === 'single'
          ? [province]
          : [],
  };
  let municipalities: {
    municipalities: ReturnType<typeof signal<readonly (typeof municipality)[]>>;
    failed: ReturnType<typeof signal<boolean>>;
    find: (id: string) => typeof municipality | undefined;
    at: ReturnType<typeof vi.fn>;
  };
  let terrain: {
    terrain: ReturnType<typeof signal<Terrain | null>>;
    reading: ReturnType<typeof signal<boolean>>;
    failed: ReturnType<typeof signal<boolean>>;
    read: ReturnType<typeof vi.fn>;
    clear: ReturnType<typeof vi.fn>;
  };
  let hotspots: {
    range: ReturnType<typeof signal<{ from: string; to: string }>>;
    loading: ReturnType<typeof signal<boolean>>;
    failed: ReturnType<typeof signal<boolean>>;
    missingKey: ReturnType<typeof signal<boolean>>;
    countInScope: ReturnType<typeof signal<number>>;
    earliest: ReturnType<typeof signal<string | null>>;
    choose: ReturnType<typeof vi.fn>;
  };
  const search = {
    ready: signal(true),
    failed: signal(false),
    load: vi.fn(),
    matches: vi.fn<(query: string) => readonly Match[]>(),
  };
  const locator = { locate: vi.fn<(p: Point) => Promise<Place | null>>() };
  beforeEach(() => {
    vi.clearAllMocks();
    maps = mapDouble();
    regions = {
      regions: signal([region, { ...region, id: 'ES51', name: 'Catalunya' }]),
      failed: signal(false),
      load: vi.fn(),
      find: (id) => regions.regions().find((r) => r.id === id),
    };
    municipalities = {
      municipalities: signal([municipality]),
      failed: signal(false),
      find: (id) => municipalities.municipalities().find((m) => m.id === id),
      at: vi.fn().mockReturnValue(municipality),
    };
    terrain = {
      terrain: signal<Terrain | null>(null),
      reading: signal(false),
      failed: signal(false),
      read: vi.fn(),
      clear: vi.fn(),
    };
    hotspots = {
      range: signal({ from: '2024-08-01', to: '2024-08-03' }),
      loading: signal(false),
      failed: signal(false),
      missingKey: signal(false),
      countInScope: signal(3),
      earliest: signal<string | null>(null),
      choose: vi.fn(),
    };
    search.matches.mockImplementation((q) =>
      q.trim().length >= 2 ? [match, { ...match, id: 'two', name: 'Port' }] : [],
    );
    locator.locate.mockResolvedValue({ region: 'ES53', province: 'ES531', municipality: 'one' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MapService, useValue: maps },
        { provide: RegionsService, useValue: regions },
        { provide: ProvincesService, useValue: provinces },
        { provide: MunicipalitiesService, useValue: municipalities },
        { provide: LevelsService, useValue: levels },
        { provide: TerrainService, useValue: terrain },
        { provide: HotspotsService, useValue: hotspots },
        { provide: SearchService, useValue: search },
        { provide: PointLocator, useValue: locator },
      ],
    });
  });
  afterEach(() => vi.restoreAllMocks());

  it('groups regions by country, sorts names and previews focus', async () => {
    const fixture = TestBed.createComponent(RegionStep),
      c = fixture.componentInstance;
    await fixture.whenStable();
    expect(c['groups']().map((g) => g.code)).toEqual(['ES']);
    expect(c['groups']()[0].regions.map((r) => r.name)).toEqual(['Balears', 'Catalunya']);
    expect(regions.load).toHaveBeenCalled();
    expect(levels.show).toHaveBeenCalledWith('region');
    expect(maps.goToView).toHaveBeenCalledWith('peninsula', true);
    c['focus']('ES53');
    c['focus'](null);
    expect(maps.focusRegion.mock.calls).toEqual([['ES53'], [null]]);
  });

  it('handles valid and unknown province routes without skipping single options', async () => {
    const fixture = TestBed.createComponent(ProvinceStep),
      c = fixture.componentInstance;
    fixture.componentRef.setInput('region', 'missing');
    await fixture.whenStable();
    expect(c['chosen']()).toBeUndefined();
    expect(maps.goToBounds).not.toHaveBeenCalled();
    fixture.componentRef.setInput('region', 'ES53');
    await fixture.whenStable();
    expect(c['options']().map((p) => p.name)).toEqual(['Eivissa', 'Mallorca']);
    expect(c['single']()).toBe(false);
    expect(levels.show).toHaveBeenLastCalledWith('province', { region: 'ES53' });
    expect(maps.goToBounds).toHaveBeenCalledWith(bounds, true);
    fixture.componentRef.setInput('region', 'single');
    await fixture.whenStable();
    expect(c['single']()).toBe(true);
    c['focus']('ES531');
    c['focus'](null);
    expect(maps.focusProvince).toHaveBeenLastCalledWith(null);
  });

  it('labels Portuguese parishes and frames known provinces', async () => {
    const fixture = TestBed.createComponent(MunicipalityStep),
      c = fixture.componentInstance;
    fixture.componentRef.setInput('region', 'PT11');
    fixture.componentRef.setInput('province', 'PT111');
    await fixture.whenStable();
    expect(c['label']()).toBe('una freguesia');
    expect(maps.goToBounds).not.toHaveBeenCalled();
    fixture.componentRef.setInput('province', 'ES531');
    await fixture.whenStable();
    expect(c['label']()).toBe('un municipi');
    expect(c['options']()).toEqual([municipality]);
    expect(levels.show).toHaveBeenLastCalledWith('municipality', { province: 'ES531' });
    c['focus']('one');
    c['focus'](null);
    expect(maps.focusMunicipality).toHaveBeenLastCalledWith(null);
  });

  it('navigates search results by keyboard with wrapping and empty-result guards', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SearchBox),
      c = fixture.componentInstance;
    await fixture.whenStable();
    c['enter']();
    expect(c['open']()).toBe(false);
    expect(c['current']()).toBeNull();
    c['key'](new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    c['key'](new KeyboardEvent('keydown', { key: 'Enter' }));
    c['type'](inputEvent('s'));
    expect(c['open']()).toBe(false);
    c['type'](inputEvent('so'));
    c['enter']();
    expect(c['current']()).toBe('search-result-0');
    await fixture.whenStable();
    const field = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    field.focus();
    const option = fixture.nativeElement.querySelector('.result') as HTMLElement;
    const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    option.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(field);
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    expect(c['highlighted']()).toBe(1);
    c['key'](new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(c['highlighted']()).toBe(0);
    c['key'](new KeyboardEvent('keydown', { key: 'a' }));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(navigate).toHaveBeenCalledWith(['/simulacio', 'ES53', 'ES531', 'one']);
    expect(c['query']()).toBe('');
    c['type'](inputEvent('so'));
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(c['open']()).toBe(false);
    expect(c['query']()).toBe('');
  });

  it('validates range drafts and synchronises endpoints before applying them', async () => {
    const fixture = TestBed.createComponent(RangePicker),
      c = fixture.componentInstance;
    await fixture.whenStable();
    c['toggle']();
    expect(c['open']()).toBe(true);
    c['from'].set('');
    expect(c['problem']()).toBe('Falta una data.');
    c['apply']();
    expect(hotspots.choose).not.toHaveBeenCalled();
    c['from'].set('2024-08-01');
    c['to'].set('');
    expect(c['problem']()).toBe('Falta una data.');
    c['to'].set('2024-07-01');
    expect(c['problem']()).toContain('posterior');
    c['to'].set('2099-01-01');
    expect(c['problem']()).toContain('futures');
    c['to'].set('2024-08-03');
    hotspots.earliest.set('2024-08-02');
    expect(c['problem']()).toContain('anteriors');
    hotspots.earliest.set(null);
    c['to'].set('2024-09-01');
    expect(c['problem']()).toContain('màxim');
    c['edit']('from', inputEvent('2024-10-01'));
    expect(c['to']()).toBe('2024-10-01');
    c['edit']('to', inputEvent('2024-09-01'));
    expect(c['from']()).toBe('2024-09-01');
    c['edit']('from', inputEvent('2024-08-31'));
    c['edit']('to', inputEvent('2024-09-02'));
    expect(c['problem']()).toBeNull();
    c['apply']();
    expect(hotspots.choose).toHaveBeenLastCalledWith({ from: '2024-08-31', to: '2024-09-02' });
    c['toggle']();
    expect(c['from']()).toBe('2024-08-01');
    c['toggle']();
    expect(c['open']()).toBe(false);
    c['choosePreset'](7);
    expect(hotspots.choose).toHaveBeenCalledTimes(2);
    expect(c['open']()).toBe(false);
  });

  it('closes the date picker only when focus leaves it or Escape is pressed', async () => {
    const fixture = TestBed.createComponent(RangePicker),
      c = fixture.componentInstance;
    await fixture.whenStable();
    c['toggle']();
    c['leave'](
      new FocusEvent('focusout', { relatedTarget: fixture.nativeElement.querySelector('button') }),
    );
    expect(c['open']()).toBe(true);
    c['key'](new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(c['open']()).toBe(true);
    await fixture.whenStable();
    const date = fixture.nativeElement.querySelector('input[type="date"]') as HTMLInputElement;
    date.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(c['open']()).toBe(false);
    c['toggle']();
    c['leave'](new FocusEvent('focusout', { relatedTarget: document.body }));
    expect(c['open']()).toBe(false);
    c['toggle']();
    c['leave'](new FocusEvent('focusout'));
    expect(c['open']()).toBe(false);
  });

  it('owns map and form lifetimes and restores the overview on exit', async () => {
    const shell = TestBed.createComponent(MapShell);
    await shell.whenStable();
    expect(maps.create).toHaveBeenCalledWith(shell.nativeElement.querySelector('.map-canvas'));
    const flow = TestBed.createComponent(SimulationFlow);
    await flow.whenStable();
    expect(maps.setHotspotsVisible).toHaveBeenLastCalledWith(false);
    flow.destroy();
    expect(maps.setHotspotsVisible).toHaveBeenLastCalledWith(true);
    expect(levels.clear).toHaveBeenCalled();
    expect(maps.setPicking).toHaveBeenCalledWith(false);
    shell.destroy();
    expect(maps.destroy).toHaveBeenCalledTimes(1);
  });

  it('selects a valid overview scope and keeps legend dates and selection consistent', async () => {
    const fixture = TestBed.createComponent(MapView),
      c = fixture.componentInstance;
    await fixture.whenStable();
    expect(maps.goToView).toHaveBeenLastCalledWith('peninsula');
    fixture.componentRef.setInput('scope', 'invalid');
    await fixture.whenStable();
    expect(maps.goToView).toHaveBeenLastCalledWith('peninsula');
    fixture.componentRef.setInput('scope', 'canaries');
    await fixture.whenStable();
    expect(maps.showRegionsFor).toHaveBeenLastCalledWith('canaries');
    expect(c['byDate']()).toBe(false);
    maps.hotspotColourBy.set('date');
    expect(c['byDate']()).toBe(true);
    expect(c['ends']().from).toContain('1');
    expect(c['ends']().to).toContain('3');
    expect(c['stops'].at(-1)?.label).toContain('o més');
    c['clearSelection']();
    expect(maps.clearSelection).toHaveBeenCalled();
  });

  it('formats detection details and builds a simulator link from the located municipality', async () => {
    const fixture = TestBed.createComponent(HotspotPanel),
      c = fixture.componentInstance;
    fixture.componentRef.setInput('hotspot', hotspot);
    expect(c['simulation']()).toBeNull();
    expect(c['simulationStatus']()).toContain('Buscant');
    await fixture.whenStable();
    expect(c['simulation']()?.link).toEqual([
      '/simulador',
      'ES53',
      'ES531',
      'one',
      '@2.70000,39.70000',
    ]);
    expect(c['simulationStatus']()).toBeNull();
    expect(c['observed']()).toContain('UTC');
    expect(c['platform']()).toBe('Suomi NPP');
    expect(c['confidence']()).toBe('nominal');
    expect(c['moment']()).toBe('dia');
    expect(c['band']()).toBe('baixa');
    expect(c['coordinates']()).toBe('39.70000, 2.70000');
    expect(c['power']()).toBe('4,5');
    fixture.componentRef.setInput('hotspot', {
      ...hotspot,
      satellite: '?',
      confidence: '',
      daynight: 'N',
      frp: 5,
    });
    await fixture.whenStable();
    expect(c['platform']()).toBe('?');
    expect(c['confidence']()).toBe('desconeguda');
    expect(c['moment']()).toBe('nit');
    expect(c['band']()).toBe('moderada');
    fixture.componentRef.setInput('hotspot', { ...hotspot, frp: 50, daynight: '' });
    await fixture.whenStable();
    expect(c['band']()).toBe('alta');
    expect(c['moment']()).toBe('desconegut');
    // Intl throws on an invalid date, and the template reads this.
    fixture.componentRef.setInput('hotspot', { ...hotspot, observedAt: 'no és una data' });
    await fixture.whenStable();
    expect(c['observed']()).toBe('data desconeguda');
  });

  it('shows unavailable locations and ignores a location that arrives for a deselected detection', async () => {
    let resolve!: (p: Place | null) => void;
    locator.locate
      .mockReturnValueOnce(
        new Promise((r) => {
          resolve = r;
        }),
      )
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('offline'));
    const fixture = TestBed.createComponent(HotspotPanel),
      c = fixture.componentInstance;
    fixture.componentRef.setInput('hotspot', hotspot);
    await fixture.whenStable();
    fixture.componentRef.setInput('hotspot', { ...hotspot, lon: 3 });
    await fixture.whenStable();
    resolve({ region: 'old', province: 'old', municipality: 'old' });
    await fixture.whenStable();
    expect(c['simulation']()).toBeNull();
    expect(c['simulationStatus']()).toContain('cap municipi');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fixture.componentRef.setInput('hotspot', { ...hotspot, lat: 40 });
    await fixture.whenStable();
    expect(c['simulationStatus']()).toContain('No s’ha pogut');
    expect(c['simulation']()).toBeNull();
  });

  it('draws registered icons and rejects inherited object names', async () => {
    expect(iconOr('flame', 'map')).toBe('flame');
    expect(iconOr('toString', 'map')).toBe('map');
    const fixture = TestBed.createComponent(Icon);
    fixture.componentRef.setInput('name', 'flame');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('path').getAttribute('d')).toContain('M12');
  });

  it('centres the ignition domain, changes municipality on click and clears picking on exit', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(IgnitionStep),
      c = fixture.componentInstance;
    for (const [key, value] of Object.entries({
      region: 'ES53',
      province: 'missing',
      municipality: 'missing',
    }))
      fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
    expect(c['simulation']()).toBeNull();
    expect(c['coordinates']()).toBe('');
    expect(c['outside']()).toBe(false);
    expect(c['slopes']()).toBeNull();
    fixture.componentRef.setInput('province', 'ES531');
    fixture.componentRef.setInput('municipality', 'one');
    await fixture.whenStable();
    expect(maps.goToBounds).toHaveBeenLastCalledWith(bounds, true);
    expect(maps.setDomain).toHaveBeenLastCalledWith(null);
    maps.picked.set([2, 3]);
    await fixture.whenStable();
    expect(navigate).toHaveBeenLastCalledWith(
      ['/simulacio', 'ES53', 'ES531', 'one', '@2.00000,3.00000'],
      { replaceUrl: false },
    );
    fixture.componentRef.setInput('point', '@2,3');
    await fixture.whenStable();
    expect(c['coordinates']()).toBe('3.00000, 2.00000');
    expect(c['simulation']()?.[0]).toBe('/simulador');
    expect(c['outside']()).toBe(false);
    expect(terrain.read).toHaveBeenCalledWith([2, 3]);
    municipalities.at.mockReturnValue(null);
    maps.picked.set([5, 5]);
    await fixture.whenStable();
    expect(navigate).toHaveBeenLastCalledWith(
      ['/simulacio', 'ES53', 'ES531', 'one', '@5.00000,5.00000'],
      { replaceUrl: true },
    );
    fixture.componentRef.setInput('point', '@5,5');
    await fixture.whenStable();
    expect(c['outside']()).toBe(true);
    municipalities.municipalities.set([]);
    expect(c['outside']()).toBe(false);
    fixture.destroy();
    expect(maps.setPicking).toHaveBeenLastCalledWith(false);
    expect(terrain.clear).toHaveBeenCalled();
  });

  it('re-resolves the whole address when a click lands outside the province, in another country', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(IgnitionStep);
    for (const [key, value] of Object.entries({
      region: 'ES53',
      province: 'ES531',
      municipality: 'one',
      point: '@2,3',
    }))
      fixture.componentRef.setInput(key, value);
    await fixture.whenStable();

    /* The local Spanish province misses this point, but the global lookup locates it in Portugal. */

    municipalities.at.mockReturnValue(null);
    locator.locate.mockResolvedValueOnce({
      region: 'PT11',
      province: 'PT111',
      municipality: 'lisboa',
    });
    maps.picked.set([-9, 38.7]);
    await fixture.whenStable();
    expect(navigate).toHaveBeenLastCalledWith(
      ['/simulacio', 'PT11', 'PT111', 'lisboa', '@-9.00000,38.70000'],
      { replaceUrl: true },
    );

    /* For sea points keep the old address. Router navigation is a spy here, so route inputs remain unchanged. */

    locator.locate.mockResolvedValueOnce(null);
    maps.picked.set([1, 1]);
    await fixture.whenStable();
    expect(navigate).toHaveBeenLastCalledWith(
      ['/simulacio', 'ES53', 'ES531', 'one', '@1.00000,1.00000'],
      { replaceUrl: true },
    );
  });

  it('renders terrain statistics and the relief preview, tolerating a missing canvas context', async () => {
    const createImageData = vi.fn((size: number | ImageData, height?: number): ImageData => {
      const w = typeof size === 'number' ? size : size.width;
      const h = typeof size === 'number' ? height! : size.height;
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h, colorSpace: 'srgb' };
    });
    const putImageData = vi.fn();
    const context: Partial<CanvasRenderingContext2D> = { createImageData, putImageData };
    const getContext = vi
      .spyOn(HTMLCanvasElement.prototype, 'getContext')
      .mockReturnValue(context as CanvasRenderingContext2D);
    const fixture = TestBed.createComponent(IgnitionStep),
      c = fixture.componentInstance;
    for (const [key, value] of Object.entries({
      region: 'ES53',
      province: 'ES531',
      municipality: 'one',
      point: '@2,3',
    }))
      fixture.componentRef.setInput(key, value);
    await fixture.whenStable();
    const ground = {
      elevation: new Float32Array(GRID * GRID),
      slope: new Float32Array(GRID * GRID),
      minElevation: 1.2,
      maxElevation: 101.8,
      meanSlope: 5.12,
      maxSlope: 30.12,
      tiles: 4,
    } as Terrain;
    terrain.terrain.set(ground);
    await fixture.whenStable();
    expect(c['slopes']()).toMatchObject({ low: 1, high: 102, mean: '5,1', max: '30,1', tiles: 4 });
    expect(putImageData).toHaveBeenCalled();
    expect(createImageData.mock.results[0].value.data[3]).toBe(255);
    getContext.mockReturnValue(null);
    terrain.terrain.set({ ...ground });
    await fixture.whenStable();
    expect(putImageData).toHaveBeenCalledTimes(1);
  });
});
