// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@angular/compiler';
vi.mock('./domain', () => ({ GRID: 4, domainAround: () => [0, 0, 4, 4] }));
vi.mock('./terrain', () => ({ readTerrain: vi.fn() }));
import { FuelService } from './fuel.service';
import { TerrainService } from './terrain.service';
import { readTerrain, type Terrain } from './terrain';
import { PointLocator, shapeAt } from './point-locator';
import { boundsOf, contains, type AreaGeometry } from './bounds';
import type { JsonValue } from './json-value';

const response = (body: JsonValue, status = 200) => new Response(JSON.stringify(body), { status });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};
const valid = {
  version: 'anderson13-worldcover2021-v2',
  bounds: [0, 0, 4, 4],
  size: 4,
  runs: [1, 2, 16],
  sources: [],
  warnings: [],
};
const square = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
  [0, 0],
] as const;
const hole = [
  [1, 1],
  [3, 1],
  [3, 3],
  [1, 3],
  [1, 1],
] as const;
const geometry: AreaGeometry = { type: 'Polygon', coordinates: [square, hole] };

describe('simulation input requests', () => {
  let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
  beforeEach(() => {
    fetcher = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetcher);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(readTerrain).mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('decodes fuels, deduplicates a domain and explicitly revalidates retries', async () => {
    fetcher.mockImplementation(async () => response(valid));
    const service = new FuelService();
    const pending = service.read([2, 2]);
    expect(service.reading()).toBe(true);
    await pending;
    expect(service.grid()?.models).toEqual(new Uint8Array(16).fill(1));
    expect(service.error()).toBeNull();
    expect(service.reading()).toBe(false);
    await service.read([2, 2]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    await service.read([2, 2], true);
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.stringContaining('size=4'),
      expect.objectContaining({ cache: 'reload' }),
    );
    service.clear();
    expect(service.grid()).toBeNull();
    expect(service.reading()).toBe(false);
  });

  it.each([
    [503, 'ocupat'],
    [500, 'No s’han pogut'],
  ])('reports HTTP %i as a useful fuel error', async (status, message) => {
    fetcher.mockResolvedValue(response({}, status));
    const service = new FuelService();
    await service.read([2, 2]);
    expect(service.error()).toContain(message);
    expect(service.reading()).toBe(false);
  });

  it('reports malformed payloads, network failures and timeout without retaining old state', async () => {
    const service = new FuelService();
    fetcher.mockResolvedValueOnce(response({}));
    await service.read([2, 2]);
    expect(service.error()).toContain('invàlida');
    fetcher.mockRejectedValueOnce('offline');
    await service.read([2, 2], true);
    expect(service.error()).toBe('Error carregant combustibles.');
    vi.useFakeTimers();
    fetcher.mockImplementationOnce(
      (_url, options) =>
        new Promise((_resolve, reject) =>
          options!.signal!.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    const pending = service.read([2, 2], true);
    await vi.advanceTimersByTimeAsync(150000);
    await pending;
    expect(service.error()).toContain('trigat massa');
    expect(service.reading()).toBe(false);
  });

  it('does not publish success or failure from cancelled fuel requests', async () => {
    const first = deferred<Response>(),
      second = deferred<Response>();
    fetcher.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const service = new FuelService();
    const a = service.read([2, 2]);
    const b = service.read([2, 2], true);
    first.resolve(response(valid));
    await a;
    expect(service.grid()).toBeNull();
    expect(service.reading()).toBe(true);
    service.clear();
    second.reject(new Error('old'));
    await b;
    expect(service.error()).toBeNull();
    expect(service.reading()).toBe(false);
  });

  it('publishes terrain only for the most recent domain and permits a fresh read after clear', async () => {
    const first = deferred<Terrain>(),
      latest = { elevation: new Float32Array([100]) } as Terrain;
    vi.mocked(readTerrain).mockReturnValueOnce(first.promise).mockResolvedValueOnce(latest);
    const service = new TerrainService();
    service.read([2, 2]);
    service.read([2, 2]);
    expect(readTerrain).toHaveBeenCalledTimes(1);
    service.read([3, 3]);
    await settle();
    first.resolve({ ...latest, tiles: 2 });
    await settle();
    expect(service.terrain()).toBe(latest);
    expect(service.reading()).toBe(false);
    service.clear();
    expect(service.terrain()).toBeNull();
    vi.mocked(readTerrain).mockRejectedValueOnce(new Error('missing tiles'));
    service.read([3, 3]);
    await settle();
    expect(service.failed()).toBe(true);
    const stale = deferred<Terrain>();
    vi.mocked(readTerrain).mockReturnValueOnce(stale.promise);
    service.read([4, 4]);
    service.clear();
    stale.reject(new Error('cancelled'));
    await settle();
    expect(service.failed()).toBe(false);
  });

  it('locates a municipality by its polygon, caches both reads and rejects missing files', async () => {
    fetcher
      .mockResolvedValueOnce(
        response({ features: [{ id: 'ES531', properties: { region: 'ES53' }, geometry }] }),
      )
      .mockResolvedValueOnce(response({ features: [{ properties: { id: 'one' }, geometry }] }));
    const locator = new PointLocator();
    expect(await locator.locate([0.5, 0.5])).toEqual({
      region: 'ES53',
      province: 'ES531',
      municipality: 'one',
    });
    expect(await locator.locate([0.5, 0.5])).not.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await locator.locate([2, 2])).toBeNull();
    fetcher.mockResolvedValueOnce(response({}, 404));
    await expect(new PointLocator().locate([0, 0])).rejects.toThrow('404');
  });

  it('retries a failed province read and then reuses the successful lookup', async () => {
    fetcher
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(
        response({ features: [{ id: 'ES531', properties: { region: 'ES53' }, geometry }] }),
      )
      .mockResolvedValueOnce(response({ features: [{ properties: { id: 'one' }, geometry }] }));
    const locator = new PointLocator();
    await expect(locator.locate([0.5, 0.5])).rejects.toThrow('503');
    await expect(locator.locate([0.5, 0.5])).resolves.toEqual({
      region: 'ES53',
      province: 'ES531',
      municipality: 'one',
    });
    await expect(locator.locate([0.5, 0.5])).resolves.not.toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('retries only the failed municipalities while retaining the province data', async () => {
    fetcher
      .mockResolvedValueOnce(
        response({ features: [{ id: 'ES531', properties: { region: 'ES53' }, geometry }] }),
      )
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response({ features: [{ properties: { id: 'one' }, geometry }] }));
    const locator = new PointLocator();
    await expect(locator.locate([0.5, 0.5])).rejects.toThrow('offline');
    await expect(locator.locate([0.5, 0.5])).resolves.toEqual({
      region: 'ES53',
      province: 'ES531',
      municipality: 'one',
    });
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('shares concurrent failures and concurrent retry reads', async () => {
    const initial = deferred<Response>();
    fetcher.mockReturnValueOnce(initial.promise);
    const locator = new PointLocator();
    const failed = Promise.allSettled([locator.locate([0.5, 0.5]), locator.locate([0.5, 0.5])]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    initial.reject(new Error('offline'));
    expect((await failed).every((entry) => entry.status === 'rejected')).toBe(true);
    const province = deferred<Response>();
    const municipalities = deferred<Response>();
    fetcher.mockReturnValueOnce(province.promise).mockReturnValueOnce(municipalities.promise);
    const retried = Promise.all([locator.locate([0.5, 0.5]), locator.locate([0.5, 0.5])]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    province.resolve(
      response({ features: [{ id: 'ES531', properties: { region: 'ES53' }, geometry }] }),
    );
    await settle();
    expect(fetcher).toHaveBeenCalledTimes(3);
    municipalities.resolve(response({ features: [{ properties: { id: 'one' }, geometry }] }));
    const result = { region: 'ES53', province: 'ES531', municipality: 'one' };
    expect(await retried).toEqual([result, result]);
  });

  it('returns no place for water inside a province but outside its municipalities', async () => {
    fetcher
      .mockResolvedValueOnce(
        response({
          features: [
            {
              id: 'ES531',
              properties: { region: 'ES53' },
              geometry: { type: 'Polygon', coordinates: [square] },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ features: [{ properties: { id: 'one' }, geometry }] }));
    expect(await new PointLocator().locate([2, 2])).toBeNull();
  });

  it('computes multipolygon bounds and rejects holes and every side of an extent', () => {
    const multi: AreaGeometry = {
      type: 'MultiPolygon',
      coordinates: [
        [square, hole],
        [
          [
            [5, 5],
            [6, 5],
            [6, 6],
            [5, 6],
            [5, 5],
          ],
        ],
      ],
    };
    expect(boundsOf(multi)).toEqual([0, 0, 6, 6]);
    expect(contains(multi, [5.5, 5.5])).toBe(true);
    expect(contains(multi, [2, 2])).toBe(false);
    expect(contains(multi, [0.5, 0.5])).toBe(true);
    const list = [{ id: 'one', bounds: boundsOf(geometry), geometry }];
    for (const p of [
      [-1, 0],
      [5, 0],
      [0, -1],
      [0, 5],
      [2, 2],
    ] as const)
      expect(shapeAt(list, p)).toBeNull();
    expect(shapeAt(list, [0.5, 0.5])).toBe('one');
  });
});
