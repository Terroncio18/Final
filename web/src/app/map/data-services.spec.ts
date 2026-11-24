import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { vi } from 'vitest';
import type { Feature, FeatureCollection, Point } from 'geojson';
import { MapService } from './map.service';
import { RegionsService } from '../simulation/regions.service';
import { ProvincesService } from '../simulation/provinces.service';
import { MunicipalitiesService } from '../simulation/municipalities.service';
import { LevelsService } from '../simulation/levels.service';
import { SearchService } from '../simulation/search.service';
import { PlacesService } from './places.service';
import { StudyArea } from './study-area';
import { WeatherService, type Observation } from '../simulator/weather.service';
import { HotspotsService } from './hotspots.service';
import { writeSource } from './source-data';
import * as ranges from './hotspot-range';
import type { JsonValue } from '../simulation/json-value';

const polygon = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [0, 0],
      [4, 0],
      [4, 4],
      [0, 4],
      [0, 0],
    ],
    [
      [1, 1],
      [3, 1],
      [3, 3],
      [1, 3],
      [1, 1],
    ],
  ],
};
const collection = (features: Feature[]): FeatureCollection => ({
  type: 'FeatureCollection',
  features,
});
const area = (id: string, parent = 'ES531'): Feature => ({
  type: 'Feature',
  properties: {
    id,
    name: ` ${id} `,
    country: 'ES',
    scope: 'peninsula',
    region: parent,
    province: parent,
  },
  geometry: polygon,
});
const point = (
  x: number,
  y: number,
  properties: Record<string, string | number> | null = {},
): Feature<Point> => ({
  type: 'Feature',
  properties,
  geometry: { type: 'Point', coordinates: [x, y] },
});
type OneShotService = typeof RegionsService | typeof ProvincesService | typeof SearchService;
const mallorca: readonly [number, number] = [2, 39];
const portugal: readonly [number, number] = [-8, 40];
const response = (
  body: JsonValue | FeatureCollection | Observation,
  status = 200,
  headers = {},
): Response => new Response(JSON.stringify(body), { status, headers });
const settle = async () => {
  for (let i = 0; i < 15; i++) await Promise.resolve();
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('geographic and observation services', () => {
  const maps = {
    scope: signal('peninsula'),
    addProvinces: vi.fn(),
    setMunicipalities: vi.fn(),
    setPlaces: vi.fn(),
    setRegionsVisible: vi.fn(),
    showProvincesOf: vi.fn(),
    focusRegion: vi.fn(),
    focusProvince: vi.fn(),
    focusMunicipality: vi.fn(),
    setCentre: vi.fn(),
    setDomain: vi.fn(),
    setTerrain3D: vi.fn(),
    setOrbit: vi.fn(),
    setContours: vi.fn(),
    setHotspots: vi.fn(),
    setHotspotColourBy: vi.fn(),
    setHotspotDensity: vi.fn(),
  };
  let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
  beforeEach(() => {
    vi.clearAllMocks();
    fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: MapService, useValue: maps }],
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('reads and trims regions once, with bounds and lookup by code', async () => {
    fetcher.mockResolvedValue(response(collection([area('ES53'), area('PT11')])));
    const service = TestBed.inject(RegionsService);
    expect(service.regions()).toEqual([]);
    service.load();
    service.load();
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(service.find('ES53')).toMatchObject({
      name: 'ES53',
      bounds: [0, 0, 4, 4],
      country: 'ES',
    });
    expect(service.find('missing')).toBeUndefined();
    expect(service.failed()).toBe(false);
  });

  it('shares the province data with the map and filters children', async () => {
    const data = collection([area('ES531', 'ES53'), area('ES532', 'ES53'), area('PT111', 'PT11')]);
    fetcher.mockResolvedValue(response(data));
    const service = TestBed.inject(ProvincesService);
    service.load();
    service.load();
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(service.of('ES53').map((p) => p.id)).toEqual(['ES531', 'ES532']);
    expect(service.find('PT111')?.name).toBe('PT111');
    expect(service.find('missing')).toBeUndefined();
    expect(maps.addProvinces).toHaveBeenCalledWith(data);
  });

  /* Each service that reads its data once, with a body it accepts. */
  const oneShot: readonly (readonly [OneShotService, JsonValue | FeatureCollection])[] = [
    [RegionsService, collection([area('ES53')])],
    [ProvincesService, collection([area('ES53')])],
    [SearchService, { municipalities: [['Sóller', 'ES_07061', 'ES532', 'Mallorca']] }],
  ];

  for (const [Service, readable] of oneShot) {
    it(`${Service.name} exposes failed HTTP reads and reads them again later`, async () => {
      fetcher.mockResolvedValueOnce(response({}, 503));
      const service = TestBed.inject(Service as typeof RegionsService);
      service.load();
      await settle();
      expect(service.failed()).toBe(true);
      expect(console.error).toHaveBeenCalled();

      /* Asked once per session: a kept failure would leave the screen without a way back. */

      fetcher.mockResolvedValue(response(readable));
      service.load();
      await settle();
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(service.failed()).toBe(false);
    });
  }

  it('caches municipalities, tests their outlines and releases the map', async () => {
    const data = collection([area('one')]);
    fetcher.mockResolvedValue(response(data));
    const service = TestBed.inject(MunicipalitiesService);
    service.load('ES531');
    service.load('ES531');
    await settle();
    expect(service.find('one')?.name).toBe('one');
    expect(service.find('missing')).toBeUndefined();
    expect(service.at([0.5, 0.5])?.id).toBe('one');
    for (const p of [
      [-1, 0],
      [5, 0],
      [0, -1],
      [0, 5],
      [2, 2],
    ] as const)
      expect(service.at(p)).toBeNull();
    service.municipalities.set([
      { id: 'no-shape', name: 'none', province: 'ES531', bounds: [0, 0, 4, 4] },
    ]);
    expect(service.at([0.5, 0.5])).toBeNull();
    service.release();
    expect(service.municipalities()).toEqual([]);
    expect(maps.setMunicipalities).toHaveBeenLastCalledWith(null);
    service.load('ES531');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(maps.setMunicipalities).toHaveBeenLastCalledWith(data);
  });

  it('keeps late municipalities cached without replacing a newer selection', async () => {
    const old = deferred<Response>();
    fetcher.mockReturnValueOnce(old.promise).mockResolvedValue(response(collection([area('new')])));
    const service = TestBed.inject(MunicipalitiesService);
    service.load('old');
    service.load('new');
    await settle();
    old.resolve(response(collection([area('old')])));
    await settle();
    expect(service.find('new')).toBeDefined();
    service.load('old');
    expect(service.find('old')).toBeDefined();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('ignores failures after release, but reports the current municipality failure', async () => {
    const old = deferred<Response>();
    fetcher.mockReturnValueOnce(old.promise).mockResolvedValue(response({}, 500));
    const service = TestBed.inject(MunicipalitiesService);
    service.load('old');
    service.release();
    old.reject(new Error('offline'));
    await settle();
    expect(service.failed()).toBe(false);
    service.load('new');
    await settle();
    expect(service.failed()).toBe(true);

    /* The same province has to be readable again, not only another one. */

    fetcher.mockResolvedValue(response(collection([area('one')])));
    service.load('new');
    await settle();
    expect(service.failed()).toBe(false);
    expect(service.find('one')?.name).toBe('one');
  });

  it('finds accents, bilingual names, trailing articles and ranks word boundaries', async () => {
    const names = [
      'Resoller',
      'Port de Sóller',
      'Sóller',
      'Coruña, A',
      "Ametlla, L'",
      'Agurain / Salvatierra',
      ...Array.from({ length: 10 }, (_, i) => `Sant ${i}`),
    ];
    fetcher.mockResolvedValue(
      response({ municipalities: names.map((name, i) => [name, `${i}`, 'ES531', 'Mallorca']) }),
    );
    const service = TestBed.inject(SearchService);
    expect(service.ready()).toBe(false);
    expect(service.matches('s')).toEqual([]);
    service.load();
    service.load();
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(service.ready()).toBe(true);
    expect(service.matches(' SÓLLER ').map((m) => m.name)).toEqual([
      'Sóller',
      'Port de Sóller',
      'Resoller',
    ]);
    for (const query of ['a coruna', "l'ametlla", 'salvatierra'])
      expect(service.matches(query)).toHaveLength(1);
    expect(service.matches('sant')).toHaveLength(8);
    expect(service.matches('unknown')).toEqual([]);
    expect(service.matches('soller')[0].region).toBe('ES53');
  });

  it('clips places and retains only the twelve highest peaks, reusing the province cache', async () => {
    const features = [
      point(0, 0, { kind: 'town' }),
      point(-1, 0),
      point(5, 0),
      point(0, -1),
      point(0, 5),
      point(0.5, 0.5, null),
      point(1, 1, { kind: 'peak' }),
      ...Array.from({ length: 15 }, (_, ele) =>
        point(1, 1, { kind: 'peak', ...(ele ? { ele } : {}) }),
      ),
    ];
    fetcher.mockResolvedValue(response(collection(features)));
    const service = TestBed.inject(PlacesService);
    service.load('ES531');
    service.load('ES531');
    await settle();
    expect(maps.setPlaces).toHaveBeenLastCalledWith(collection(features));
    service.load('ES531', [0, 0, 4, 4]);
    const clipped = maps.setPlaces.mock.lastCall![0] as FeatureCollection;
    expect(clipped.features).toHaveLength(14);
    expect(clipped.features.slice(2).map((f) => f.properties!['ele'])).toEqual([
      14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    service.release();
    expect(maps.setPlaces).toHaveBeenLastCalledWith(null);
  });

  it('does not publish places that arrive after release and tolerates unavailable labels', async () => {
    const pending = deferred<Response>();
    fetcher.mockReturnValueOnce(pending.promise).mockResolvedValue(response({}, 404));
    const service = TestBed.inject(PlacesService);
    service.load('old');
    service.release();
    pending.resolve(response(collection([])));
    await settle();
    expect(maps.setPlaces).toHaveBeenCalledTimes(1);
    service.load('missing');
    await settle();
    expect(console.error).toHaveBeenCalled();
    expect(maps.setPlaces).toHaveBeenCalledTimes(1);

    /* A province whose labels failed must be readable again. */

    fetcher.mockResolvedValue(response(collection([point(0, 0, { kind: 'town' })])));
    service.load('missing');
    await settle();
    expect(maps.setPlaces).toHaveBeenLastCalledWith(collection([point(0, 0, { kind: 'town' })]));
  });

  it('filters detections using the study area including polygon holes', async () => {
    fetcher.mockResolvedValue(response(collection([area('ES53')])));
    const service = TestBed.inject(StudyArea);
    const inside = point(0.5, 0.5);
    expect(
      await service.inside([
        inside,
        point(2, 2),
        point(-1, 0),
        point(5, 0),
        point(0, -1),
        point(0, 5),
      ]),
    ).toEqual([inside]);
    expect(await service.inside([inside])).toEqual([inside]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('preserves detections when study outlines cannot be read, and reads them again later', async () => {
    fetcher.mockResolvedValueOnce(response({}, 500));
    const service = TestBed.inject(StudyArea),
      features = [point(0, 0)];
    expect(await service.inside(features)).toBe(features);
    expect(service.failed()).toBe(true);

    /* The outlines were never read: a later filter has to ask for them again. */

    fetcher.mockResolvedValue(response(collection([area('ES53')])));
    const inside = point(0.5, 0.5);
    expect(await service.inside([inside, point(2, 2)])).toEqual([inside]);
    expect(service.failed()).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('changes administrative levels consistently and clears the form overlays', () => {
    const municipalities = TestBed.inject(MunicipalitiesService);
    const load = vi.spyOn(municipalities, 'load').mockImplementation(() => {});
    const release = vi.spyOn(municipalities, 'release');
    const levels = TestBed.inject(LevelsService);
    levels.show('province', { region: 'ES53' });
    expect(maps.showProvincesOf).toHaveBeenLastCalledWith('ES53');
    levels.show('province');
    expect(maps.showProvincesOf).toHaveBeenLastCalledWith(null);
    levels.show('municipality', { province: 'ES531' });
    expect(load).toHaveBeenLastCalledWith('ES531');
    levels.show('municipality');
    levels.show('centre', { province: 'ES531', municipality: 'one' });
    expect(maps.focusMunicipality).toHaveBeenLastCalledWith('one');
    levels.show('centre');
    expect(maps.focusMunicipality).toHaveBeenLastCalledWith(null);
    levels.clear();
    expect(maps.setRegionsVisible).toHaveBeenLastCalledWith(true);
    expect(maps.setCentre).toHaveBeenLastCalledWith(null);
    expect(maps.setDomain).toHaveBeenLastCalledWith(null);
    expect(maps.setTerrain3D).toHaveBeenLastCalledWith(false);
    expect(release).toHaveBeenCalled();
  });

  it('keeps the weather of the domain it asked about and retains it on a refresh failure', async () => {
    const old = deferred<Response>(),
      lisbon = { station: { name: 'Lisboa' }, temperature: 30 } as Observation;
    fetcher
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(response(lisbon))
      .mockResolvedValueOnce(response({}, 503));
    const service = TestBed.inject(WeatherService);
    service.load('ES', mallorca);
    expect(service.loading()).toBe(true);
    service.load('PT', portugal);
    await settle();
    old.resolve(response({ station: { name: 'Sóller' }, temperature: 25 }));
    await settle();
    expect(service.observationFor('PT', portugal)).toEqual(lisbon);
    expect(service.observationFor('ES', mallorca)).toBeNull();
    expect(service.observationFor('PT', [-8.1, 40])).toBeNull();
    expect(service.observationFor('ES', portugal)).toBeNull();
    expect(service.observationFor('PT', null)).toBeNull();
    service.load('PT', portugal);
    await settle();
    expect(service.observationFor('PT', portugal)).toEqual(lisbon);
    expect(service.failed()).toBe(true);
    expect(service.loading()).toBe(false);
    service.clear();
    expect(service.observationFor('PT', portugal)).toBeNull();
    expect(service.failed()).toBe(false);
  });

  it('stops answering for the old domain as soon as another one is asked about', async () => {
    const pending = deferred<Response>(),
      palma = { station: { name: 'Sóller' }, temperature: 25 } as Observation;
    fetcher.mockResolvedValueOnce(response(palma)).mockReturnValueOnce(pending.promise);
    const service = TestBed.inject(WeatherService);
    service.load('ES', mallorca);
    await settle();
    expect(service.observationFor('ES', mallorca)).toEqual(palma);
    service.load('PT', portugal);
    expect(service.observationFor('PT', portugal)).toBeNull();
    expect(service.observationFor('ES', mallorca)).toBeNull();
    pending.reject(new Error('offline'));
    await settle();
    expect(service.failed()).toBe(true);
    expect(service.loading()).toBe(false);
    expect(service.observationFor('PT', portugal)).toBeNull();
  });

  it('ignores a weather rejection after leaving the simulation', async () => {
    const pending = deferred<Response>();
    fetcher.mockReturnValue(pending.promise);
    const service = TestBed.inject(WeatherService);
    service.load('ES', mallorca);
    service.clear();
    pending.reject(new Error('offline'));
    await settle();
    expect(service.failed()).toBe(false);
    expect(service.loading()).toBe(false);
    expect(service.observationFor('ES', mallorca)).toBeNull();
  });

  it('loads dated hotspots, filters by scope, and puts range choices in the URL', async () => {
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'parseUrl').mockReturnValue(
      new UrlTree(undefined, { des: '2024-08-01', fins: '2024-08-03' }),
    );
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const features = [
      point(0, 0, { scope: 'peninsula', observedAt: '2024-08-02T12:00:00Z' }),
      point(0, 0, null),
      point(0, 0, { observedAt: 'bad' }),
      point(0, 0, { observedAt: '2024-07-01' }),
      point(0, 0, { scope: 'canarias', observedAt: '2024-09-01' }),
    ];
    vi.spyOn(TestBed.inject(StudyArea), 'inside').mockImplementation(async (f) => f);
    fetcher.mockResolvedValue(response(collection(features), 200, { 'x-earliest': '2012-01-01' }));
    const service = TestBed.inject(HotspotsService);
    expect(service.countInScope()).toBe(0);
    TestBed.tick();
    await settle();
    TestBed.tick();
    expect(service.countInScope()).toBe(1);
    expect(service.earliest()).toBe('2012-01-01');
    expect(service.loading()).toBe(false);
    expect(maps.setHotspotColourBy).toHaveBeenLastCalledWith('date');
    const data = maps.setHotspots.mock.lastCall![0] as FeatureCollection;
    expect(data.features.map((f) => f.properties?.['when'])).toEqual([
      0.5,
      undefined,
      undefined,
      0,
      1,
    ]);
    service.choose({ from: '2024-08-01', to: '2024-08-03' });
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { des: '2024-08-01', fins: '2024-08-03' },
      queryParamsHandling: 'merge',
    });
    service.reset();
    expect(navigate).toHaveBeenLastCalledWith([], {
      queryParams: { des: null, fins: null },
      queryParamsHandling: 'merge',
    });
  });

  it('draws one-day hotspots by power and keeps them after a failed request', async () => {
    vi.spyOn(TestBed.inject(StudyArea), 'inside').mockImplementation(async (f) => f);
    fetcher
      .mockResolvedValueOnce(response(collection([])))
      .mockResolvedValueOnce(response({}, 500));
    const service = TestBed.inject(HotspotsService);
    TestBed.tick();
    await settle();
    expect(maps.setHotspotColourBy).toHaveBeenLastCalledWith('power');

    await TestBed.inject(Router).navigateByUrl('/?des=2024-08-01&fins=2024-08-02');
    TestBed.tick();
    await settle();
    expect(service.failed()).toBe(true);
    expect(service.missingKey()).toBe(false);
    expect(service.loading()).toBe(false);
    expect(maps.setHotspots).toHaveBeenCalledTimes(1);
  });

  it('asks a failed range again only when the retry is used', async () => {
    vi.spyOn(TestBed.inject(StudyArea), 'inside').mockImplementation(async (f) => f);
    fetcher.mockResolvedValueOnce(response({}, 500));
    const service = TestBed.inject(HotspotsService);
    TestBed.tick();
    await settle();
    expect(service.failed()).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);

    // The same range leaves the computed equal, so choosing it again re-runs nothing.
    await TestBed.inject(Router).navigateByUrl('/');
    TestBed.tick();
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(1);

    fetcher.mockResolvedValueOnce(response(collection([])));
    service.retry();
    TestBed.tick();
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(service.failed()).toBe(false);
  });

  it('does not take the earliest date from a superseded response', async () => {
    const old = deferred<Response>();
    vi.spyOn(TestBed.inject(StudyArea), 'inside').mockImplementation(async (f) => f);
    fetcher
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(response(collection([]), 200, { 'x-earliest': '2012-01-01' }));
    const service = TestBed.inject(HotspotsService);
    TestBed.tick();
    await settle();
    await TestBed.inject(Router).navigateByUrl('/?des=2024-08-01&fins=2024-08-02');
    TestBed.tick();
    await settle();
    expect(service.earliest()).toBe('2012-01-01');

    old.resolve(response(collection([]), 200, { 'x-earliest': '1999-01-01' }));
    await settle();
    expect(service.earliest()).toBe('2012-01-01');
  });

  it('reports an incomplete answer and forgets it once a whole one arrives', async () => {
    vi.spyOn(TestBed.inject(StudyArea), 'inside').mockImplementation(async (f) => f);
    fetcher
      .mockResolvedValueOnce(
        response(collection([]), 200, {
          'x-partial': 'true',
          'x-missing': 'VIIRS_NOAA20_NRT/peninsula',
        }),
      )
      .mockResolvedValueOnce(response(collection([])));
    const service = TestBed.inject(HotspotsService);
    TestBed.tick();
    await settle();
    expect(service.partial()).toBe(true);
    expect(service.missing()).toBe('VIIRS_NOAA20_NRT/peninsula');
    expect(service.failed()).toBe(false);

    // A complete answer must not leave the warning on.
    await TestBed.inject(Router).navigateByUrl('/?des=2024-08-01&fins=2024-08-02');
    TestBed.tick();
    await settle();
    expect(service.partial()).toBe(false);
    expect(service.missing()).toBeNull();
  });

  it('reports old detections with the moment they were read, and forgets them', async () => {
    vi.spyOn(TestBed.inject(StudyArea), 'inside').mockImplementation(async (f) => f);
    fetcher
      .mockResolvedValueOnce(
        response(collection([]), 200, {
          'x-stale': 'true',
          'x-fetched-at': '2024-08-02T10:00:00.000Z',
        }),
      )
      .mockResolvedValueOnce(response(collection([]), 200, { 'x-stale': 'false' }));
    const service = TestBed.inject(HotspotsService);
    TestBed.tick();
    await settle();
    expect(service.stale()).toBe(true);
    expect(service.fetchedAt()).toBe('2024-08-02T10:00:00.000Z');
    expect(service.failed()).toBe(false);

    await TestBed.inject(Router).navigateByUrl('/?des=2024-08-01&fins=2024-08-02');
    TestBed.tick();
    await settle();
    expect(service.stale()).toBe(false);
    expect(service.fetchedAt()).toBeNull();
  });

  it('tells a missing FIRMS key apart from a plain outage', async () => {
    vi.spyOn(TestBed.inject(StudyArea), 'inside').mockImplementation(async (f) => f);
    fetcher.mockResolvedValueOnce(
      response({ error: 'Falta la clau FIRMS_MAP_KEY al servidor', reason: 'missing-key' }, 503),
    );
    const service = TestBed.inject(HotspotsService);
    TestBed.tick();
    await settle();
    expect(service.failed()).toBe(true);
    expect(service.missingKey()).toBe(true);
    // A later, ordinary outage must not leave the earlier diagnosis stuck on.
    fetcher.mockResolvedValueOnce(response({}, 500));
    await TestBed.inject(Router).navigateByUrl('/?des=2024-08-01&fins=2024-08-02');
    TestBed.tick();
    await settle();
    expect(service.failed()).toBe(true);
    expect(service.missingKey()).toBe(false);
  });

  it('writes source updates and reports worker failures without an unhandled rejection', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {}),
      error = new Error('worker stopped');
    const data = collection([]),
      source = { setData: vi.fn().mockRejectedValue(error) };
    writeSource(undefined, data);
    writeSource(source, data);
    await settle();
    expect(source.setData).toHaveBeenCalledWith(data);
    expect(warn).toHaveBeenCalledWith(expect.any(String), error);
  });

  for (const phase of ['fetch', 'filter', 'failure']) {
    it(`ignores a stale hotspot ${phase} after the requested range changes`, async () => {
      const old = deferred<Response>(),
        filtered = deferred<readonly Feature<Point>[]>();
      const inside = vi
        .spyOn(TestBed.inject(StudyArea), 'inside')
        .mockImplementation(async (f) => f);
      if (phase === 'filter') inside.mockReturnValueOnce(filtered.promise);
      fetcher
        .mockReturnValueOnce(
          phase === 'filter' ? Promise.resolve(response(collection([point(1, 1)]))) : old.promise,
        )
        .mockResolvedValue(response(collection([])));
      const service = TestBed.inject(HotspotsService);
      TestBed.tick();
      await settle();
      await TestBed.inject(Router).navigateByUrl('/?des=2024-08-01&fins=2024-08-02');
      TestBed.tick();
      await settle();
      if (phase === 'fetch') old.resolve(response(collection([point(1, 1)])));
      if (phase === 'failure') old.reject(new Error('old request'));
      if (phase === 'filter') filtered.resolve([point(1, 1)]);
      await settle();
      expect(service.failed()).toBe(false);
      expect(service.loading()).toBe(false);
      expect(maps.setHotspots).toHaveBeenCalledTimes(1);
      expect(maps.setHotspots).toHaveBeenLastCalledWith(collection([]));
    });
  }
});

describe('UTC hotspot date ranges', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-19T23:30:00Z'));
  });
  afterEach(() => vi.useRealTimers());
  it('validates and normalises URL ranges', () => {
    expect(ranges.today()).toBe('2026-11-19');
    for (const value of [null, undefined, '', 'hello', '2024-99-99'])
      expect(ranges.isDay(value)).toBe(false);
    expect(ranges.isDay('2024-02-29')).toBe(true);
    for (const params of [
      {},
      { des: '2024-01-01', fins: 'bad' },
      { des: '2024-02-01', fins: '2024-01-01' },
      { des: '2027-01-01', fins: '2027-01-01' },
      { des: '2024-01-01', fins: '2024-02-01' },
    ])
      expect(ranges.rangeFrom(params)).toEqual(ranges.defaultRange());
    expect(ranges.rangeFrom({ des: '2024-01-01', fins: '2024-01-31' })).toEqual({
      from: '2024-01-01',
      to: '2024-01-31',
    });
    expect(ranges.sameRange({ from: 'a', to: 'b' }, { from: 'a', to: 'c' })).toBe(false);
    expect(ranges.sameRange({ from: 'a', to: 'b' }, { from: 'c', to: 'b' })).toBe(false);
  });
  it('labels presets and historical dates and handles month boundaries', () => {
    expect(ranges.addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(ranges.labelOf(ranges.lastDays(1))).toBe('Avui');
    expect(ranges.labelOf(ranges.lastDays(7))).toBe('Darrers 7 dies');
    expect(ranges.presetOf(ranges.lastDays(2))).toBeNull();
    expect(ranges.labelOf({ from: '2024-08-01', to: '2024-08-31' })).toContain('2024');
    expect(ranges.paramsFor(ranges.lastDays(1))).toEqual({ des: null, fins: null });
    expect(ranges.paramsFor({ from: '2024-08-01', to: '2024-08-31' })).toEqual({
      des: '2024-08-01',
      fins: '2024-08-31',
    });
  });
});
