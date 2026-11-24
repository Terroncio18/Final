import { afterEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';

const pointer = { estado: 200, datos: 'https://opendata.aemet.es/observations.json' };
const observations = [
  {
    idema: 'NEAR',
    ubi: 'ESTACIÓ PROPERA',
    lon: 2.65,
    lat: 39.67,
    fint: '2026-11-19T10:00:00',
    vv: 5,
    dv: 225,
    ta: 19.4,
    hr: 55,
  },
  {
    idema: 'FAR',
    ubi: 'ESTACIÓ LLUNYANA',
    lon: 3.2,
    lat: 40.1,
    fint: '2026-11-19T10:00:00',
    vv: 10,
    dv: 90,
    ta: 20,
    hr: 40,
  },
];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

test('the weather route carries the nearest parsed observation, distance and stale state', async () => {
  vi.resetModules();
  vi.stubEnv('AEMET_API_KEY', 'test-key');
  const fetcher = vi.fn(
    async (url: string | URL) =>
      new Response(
        String(url).includes('observations.json')
          ? Buffer.from(JSON.stringify(observations), 'latin1')
          : JSON.stringify(pointer),
      ),
  );
  vi.stubGlobal('fetch', fetcher);
  const app: FastifyInstance = (await import('../src/app.js')).app;
  const url = '/api/weather?country=ES&lon=2.65&lat=39.57';

  try {
    const fresh = await app.inject(url);
    assert.equal(fresh.statusCode, 200);
    assert.deepEqual(fresh.json(), {
      source: 'AEMET',
      station: { id: 'NEAR', name: 'ESTACIÓ PROPERA', lon: 2.65, lat: 39.67 },
      observedAt: '2026-11-19T10:00:00.000Z',
      windKmh: 18,
      windFromDeg: 225,
      humidity: 55,
      temperature: 19.4,
      distanceKm: 11.1,
      stale: false,
    });
    assert.equal(fetcher.mock.calls.length, 2);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 25 * 60 * 1000);
    fetcher.mockImplementation(async () => new Response(null, { status: 503 }));
    const old = await app.inject(url);
    assert.equal(old.statusCode, 200);
    assert.deepEqual(old.json(), { ...fresh.json(), stale: true });
    assert.equal(fetcher.mock.calls.length, 3);
  } finally {
    await app.close();
  }
});
