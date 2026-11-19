import { afterEach, beforeEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { addDays, today } from '../src/firms.js';

// The routes are asked without a socket, with `app.inject()`. What FIRMS and
// the weather services answer is replaced —they are tested on their own— but
// the dates are the real ones: what is being tested here is precisely how a
// question is turned into a range of days.
const fetchHotspots = vi.hoisted(() => vi.fn());
const earliest = vi.hoisted(() => vi.fn());
const availability = vi.hoisted(() => vi.fn());
const nearestObservation = vi.hoisted(() => vi.fn());

vi.mock('../src/firms.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/firms.js')>()),
  fetchHotspots,
  earliest,
  availability,
}));
vi.mock('../src/weather.js', () => ({ nearestObservation }));

const OBSERVATION = {
  source: 'AEMET',
  station: { id: 'B228', name: 'SON BONET', lon: 2.7, lat: 39.6 },
  observedAt: '2026-11-19T10:00:00.000Z',
  windKmh: 18,
  windFromDeg: 225,
  humidity: 55,
  temperature: 19.4,
};

function detections(count: number) {
  return {
    type: 'FeatureCollection' as const,
    features: Array.from({ length: count }, (_, i) => ({
      type: 'Feature' as const,
      id: `f${i}`,
      geometry: { type: 'Point' as const, coordinates: [2.7, 39.6] as [number, number] },
      properties: { id: `f${i}`, frp: i },
    })),
  };
}

let app: FastifyInstance;

async function serve() {
  app = (await import('../src/app.js')).app;
  return app;
}

beforeEach(() => {
  vi.resetModules();
  fetchHotspots.mockResolvedValue({ body: detections(2), sources: ['VIIRS_SNPP_NRT'] });
  earliest.mockResolvedValue('2012-01-20');
  availability.mockResolvedValue(new Map([['VIIRS_SNPP_NRT', { min: '2026-08-01', max: today() }]]));
});

afterEach(async () => {
  await app?.close();
  vi.resetAllMocks();
});

test('asking for nothing is asking for today', async () => {
  const answer = await (await serve()).inject('/api/hotspots');

  assert.equal(answer.statusCode, 200);
  assert.equal(answer.headers['x-from'], today());
  assert.equal(answer.headers['x-to'], today());
  assert.deepEqual(fetchHotspots.mock.calls[0], [today(), today()]);
  assert.equal(answer.json().features.length, 2);
});

test('a number of days is the last N, counting today', async () => {
  await (await serve()).inject('/api/hotspots?days=5');
  assert.deepEqual(fetchHotspots.mock.calls[0], [addDays(today(), -4), today()]);
});

test('more days than the ceiling is the ceiling, and nonsense is one day', async () => {
  const app = await serve();

  await app.inject('/api/hotspots?days=999');
  assert.deepEqual(fetchHotspots.mock.calls[0], [addDays(today(), -30), today()], 'a month');

  await app.inject('/api/hotspots?days=molts');
  assert.deepEqual(fetchHotspots.mock.calls[1], [today(), today()], 'and not an error');

  const zero = await app.inject('/api/hotspots?days=0');
  assert.equal(zero.headers['x-from'], today(), 'nor is zero');
  assert.equal(zero.headers['x-to'], today());
  // And it is not asked again: today has just been asked for.
  assert.equal(fetchHotspots.mock.calls.length, 2);
});

test('two dates are the two dates, and one date is that day', async () => {
  const app = await serve();

  const both = await app.inject('/api/hotspots?from=2024-08-01&to=2024-08-03');
  assert.equal(both.headers['x-from'], '2024-08-01');
  assert.equal(both.headers['x-to'], '2024-08-03');

  const one = await app.inject('/api/hotspots?from=2024-08-01');
  assert.equal(one.headers['x-to'], '2024-08-01');

  const other = await app.inject('/api/hotspots?to=2024-08-01');
  assert.equal(other.headers['x-from'], '2024-08-01');
});

test('a range that cannot be answered is refused, and the reason is said', async () => {
  const app = await serve();

  const refusals: [string, RegExp][] = [
    ['/api/hotspots?from=ahir', /YYYY-MM-DD/],
    ['/api/hotspots?from=2024-8-1&to=2024-08-02', /YYYY-MM-DD/],
    ['/api/hotspots?from=2024-08-10&to=2024-08-01', /posterior/],
    [`/api/hotspots?from=${addDays(today(), 1)}&to=${addDays(today(), 1)}`, /futures/],
    ['/api/hotspots?from=2024-08-01&to=2024-09-30', /rang màxim/],
  ];
  for (const [url, says] of refusals) {
    const answer = await app.inject(url);
    assert.equal(answer.statusCode, 400, url);
    assert.match(answer.json().error, says, url);
  }
  assert.equal(fetchHotspots.mock.calls.length, 0, 'and FIRMS is not asked any of them');
});

test('the answer carries the range, the sources, the age and the first date there is', async () => {
  const answer = await (await serve()).inject('/api/hotspots?days=1');

  assert.equal(answer.headers['x-sources'], 'VIIRS_SNPP_NRT');
  assert.equal(answer.headers['x-earliest'], '2012-01-20');
  assert.equal(answer.headers['x-stale'], 'false');
  assert.equal(answer.headers['cache-control'], 'public, max-age=300');
  assert.ok(Date.parse(String(answer.headers['x-fetched-at'])), 'an instant, so the age can be shown');
});

test('the same range twice is one question to FIRMS', async () => {
  const app = await serve();

  await app.inject('/api/hotspots?from=2024-08-01&to=2024-08-01');
  await app.inject('/api/hotspots?from=2024-08-01&to=2024-08-01');
  assert.equal(fetchHotspots.mock.calls.length, 1);

  await app.inject('/api/hotspots?from=2024-08-02&to=2024-08-02');
  assert.equal(fetchHotspots.mock.calls.length, 2, 'another range is another question');
});

test('when FIRMS falls over, what is held is served and it says that it is old', async () => {
  const app = await serve();
  await app.inject('/api/hotspots?from=2024-08-01&to=2024-08-01');

  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 15 * 60 * 1000);
  fetchHotspots.mockRejectedValue(new Error('FIRMS answered 503'));

  const answer = await app.inject('/api/hotspots?from=2024-08-01&to=2024-08-01');
  assert.equal(answer.statusCode, 200);
  assert.equal(answer.headers['x-stale'], 'true', 'an empty map would read as «nothing is burning»');
  assert.equal(answer.json().features.length, 2);
  vi.useRealTimers();
});

test('when FIRMS falls over with nothing held, the fault is said to be upstream', async () => {
  fetchHotspots.mockRejectedValue(new Error('FIRMS answered 503'));

  const answer = await (await serve()).inject('/api/hotspots?days=1');
  assert.equal(answer.statusCode, 502);
  assert.match(answer.json().error, /FIRMS/);
});

test('the weather asks for a country and a place, and refuses anything else', async () => {
  const app = await serve();

  for (const url of [
    '/api/weather?lon=2.7&lat=39.6',
    '/api/weather?country=FR&lon=2.7&lat=39.6',
    '/api/weather?country=ES&lat=39.6',
    '/api/weather?country=ES&lon=&lat=39.6',
    '/api/weather?country=ES&lon=molt&lat=39.6',
    '/api/weather?country=ES&lon=200&lat=39.6',
    '/api/weather?country=ES&lon=2.7&lat=91',
  ]) {
    assert.equal((await app.inject(url)).statusCode, 400, url);
  }
  assert.equal(nearestObservation.mock.calls.length, 0);
});

test('the nearest station answers with its distance rounded to a hundred metres', async () => {
  nearestObservation.mockResolvedValue({
    observation: OBSERVATION,
    distanceKm: 7.8912,
    stale: false,
  });

  const answer = await (await serve()).inject('/api/weather?country=ES&lon=2.65&lat=39.57');
  assert.equal(answer.statusCode, 200);
  assert.deepEqual(nearestObservation.mock.calls[0], ['ES', 2.65, 39.57]);
  assert.equal(answer.json().distanceKm, 7.9);
  assert.equal(answer.json().station.name, 'SON BONET');
  assert.equal(answer.json().stale, false);
  assert.equal(answer.headers['cache-control'], 'public, max-age=300');
});

test('a country with no station is a 404, and a service that falls over is a 502', async () => {
  const app = await serve();

  nearestObservation.mockResolvedValue(null);
  const empty = await app.inject('/api/weather?country=PT&lon=-9.14&lat=38.73');
  assert.equal(empty.statusCode, 404);

  nearestObservation.mockRejectedValue(new Error('IPMA: 503'));
  const broken = await app.inject('/api/weather?country=PT&lon=-9.14&lat=38.73');
  assert.equal(broken.statusCode, 502);
  assert.match(broken.json().error, /meteorològic/);
});

test('health tells a server that is down from a key that is missing', async () => {
  vi.stubEnv('FIRMS_MAP_KEY', '');
  vi.stubEnv('AEMET_API_KEY', 'a-key');
  const app = await serve();
  await app.inject('/api/hotspots?from=2024-08-01&to=2024-08-01');

  const answer = await app.inject('/api/health');
  const body = answer.json();
  assert.equal(body.ok, true);
  assert.equal(body.firmsKey, 'missing');
  assert.equal(body.aemetKey, 'present');
  assert.deepEqual(body.sources, { VIIRS_SNPP_NRT: `2026-08-01 → ${today()}` });
  assert.equal(body.cached.length, 1, 'and what it is holding, with its age');
  assert.equal(body.cached[0].range, '2024-08-01:2024-08-01');
  assert.equal(body.cached[0].features, 2);
  vi.unstubAllEnvs();
});
