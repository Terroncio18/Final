import { afterEach, beforeEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import type { JsonValue } from '../src/json-value.js';

/* Reload the module per test to reset observation and station caches. */

const AEMET_POINTER = { estado: 200, datos: 'https://opendata.aemet.es/the-data.json' };

const AEMET_ROWS: JsonValue[] = [
  {
    idema: 'B228',
    ubi: 'SON BONET, AEROPUERTO',
    lon: 2.7,
    lat: 39.6,
    fint: '2026-11-19T09:00:00',
    vv: 2,
    dv: 180,
    ta: 17,
    hr: 60,
  },
  {
    idema: 'B228',
    ubi: 'SON BONET, AEROPUERTO',
    lon: 2.7,
    lat: 39.6,
    fint: '2026-11-19T10:00:00',
    vv: 5,
    dv: 225,
    ta: 19.4,
    hr: 55,
  },
  // A station with a broken Ñ if the answer is read as UTF-8.
  {
    idema: 'C659',
    ubi: 'LA AÑEJA',
    lon: -16.5,
    lat: 28.5,
    fint: '2026-11-19T10:00:00',
    vv: 1,
    dv: 90,
    ta: 21,
    hr: 70,
  },

  {
    idema: 'B013',
    ubi: 'EIVISSA',
    lon: 1.4,
    lat: 38.9,
    fint: '2026-11-19T10:00:00',
    dv: 10,
    ta: 18,
    hr: 65,
  },
];

const IPMA_STATIONS_JSON = [
  {
    geometry: { coordinates: [-9.14, 38.73] },
    properties: { idEstacao: 1200535, localEstacao: 'Lisboa, Gago Coutinho' },
  },
  {
    geometry: { coordinates: [-8.61, 41.15] },
    properties: { idEstacao: 1210762, localEstacao: 'Porto, Pedras Rubras' },
  },
];

const IPMA_OBSERVATIONS_JSON = {
  '2026-11-19T09:00': {
    '1200535': { intensidadeVentoKM: 11, idDireccVento: 5, temperatura: 15, humidade: 70 },
    '1210762': { intensidadeVentoKM: 7, idDireccVento: 3, temperatura: 13, humidade: 80 },
  },
  '2026-11-19T10:00': {
    '1200535': { intensidadeVentoKM: 18, idDireccVento: 3, temperatura: 16.5, humidade: 65 },
    '1210762': null,
    '9999999': { intensidadeVentoKM: 5, idDireccVento: 1, temperatura: 10, humidade: 50 },
  },
};

function answering(reply: (url: string) => JsonValue) {
  const spy = vi.fn(async (url: string | URL, _options?: RequestInit) => {
    const answer = reply(String(url));
    if (answer === null) return new Response(null, { status: 503 });
    const text = JSON.stringify(answer);
    // AEMET's data is ISO-8859-15; the test characters share latin1 bytes.
    const body = String(url).includes('opendata.aemet.es/the-data')
      ? Buffer.from(text, 'latin1')
      : text;
    return new Response(body, { status: 200 });
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

const aemetAnswers = (url: string) =>
  url.includes('/api/observacion') ? AEMET_POINTER : AEMET_ROWS;
const ipmaAnswers = (url: string) =>
  url.includes('stations.json') ? IPMA_STATIONS_JSON : IPMA_OBSERVATIONS_JSON;

async function weather() {
  return await import('../src/weather.js');
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('AEMET_API_KEY', 'a-key-for-the-tests');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('AEMET answers in two steps, in its own encoding, and the latest complete row wins', async () => {
  const spy = answering(aemetAnswers);
  const { nearestObservation } = await weather();

  const answer = await nearestObservation('ES', 2.65, 39.57);
  assert.ok(answer, 'Son Bonet is the closest station to Palma');
  assert.equal(answer.observation.station.id, 'B228');
  /* Provider times are UTC even when the test machine uses another zone. */

  assert.equal(answer.observation.observedAt, '2026-11-19T10:00:00.000Z');

  assert.equal(answer.observation.windKmh, 18);
  assert.equal(answer.observation.windFromDeg, 225);
  assert.equal(answer.observation.temperature, 19.4);
  assert.equal(answer.observation.source, 'AEMET');
  assert.ok(answer.distanceKm < 10, 'and it says how far away it is');
  assert.equal(answer.stale, false);

  assert.equal(spy.mock.calls.length, 2);
  assert.deepEqual(spy.mock.calls[0]![1], { headers: { api_key: 'a-key-for-the-tests' } });
});

test('a station whose name has an Ñ keeps it', async () => {
  answering(aemetAnswers);
  const { nearestObservation } = await weather();

  const answer = await nearestObservation('ES', -16.5, 28.5);
  assert.equal(answer?.observation.station.name, 'LA AÑEJA');
});

test('a station that measured no wind does not speak for the domain', async () => {
  answering(aemetAnswers);
  const { nearestObservation } = await weather();

  const answer = await nearestObservation('ES', 1.4, 38.9);
  assert.notEqual(answer?.observation.station.id, 'B013');
});

test('without the AEMET key nothing is asked of it', async () => {
  vi.stubEnv('AEMET_API_KEY', '');
  const spy = answering(aemetAnswers);
  const { nearestObservation } = await weather();

  await assert.rejects(() => nearestObservation('ES', 2.65, 39.57), /AEMET_API_KEY/);
  assert.equal(spy.mock.calls.length, 0);
});

test('IPMA is read newest hour first, and a point of the compass becomes a bearing', async () => {
  const spy = answering(ipmaAnswers);
  const { nearestObservation } = await weather();

  const answer = await nearestObservation('PT', -9.14, 38.73);
  assert.ok(answer);
  assert.equal(answer.observation.source, 'IPMA');
  assert.equal(answer.observation.station.name, 'Lisboa, Gago Coutinho');

  assert.equal(answer.observation.windKmh, 18);
  assert.equal(answer.observation.windFromDeg, 90);
  assert.equal(answer.observation.observedAt, '2026-11-19T10:00:00.000Z', 'the hour is UTC');

  const porto = await nearestObservation('PT', -8.61, 41.15);
  assert.equal(porto?.observation.station.id, '1210762');
  assert.equal(porto?.observation.windFromDeg, 90, 'at nine the wind was from the east there');

  assert.equal(spy.mock.calls.length, 2, 'the stations and the observations, once each');
});

test('a station IPMA does not list is not placed on the map', async () => {
  answering(ipmaAnswers);
  const { nearestObservation } = await weather();

  const answer = await nearestObservation('PT', -9.14, 38.73);

  assert.equal(answer?.observation.station.id, '1200535');
});

test('an observation already asked for is not asked for again', async () => {
  const spy = answering(ipmaAnswers);
  const { nearestObservation } = await weather();

  await nearestObservation('PT', -9.14, 38.73);
  const calls = spy.mock.calls.length;
  await nearestObservation('PT', -8.61, 41.15);
  assert.equal(spy.mock.calls.length, calls, 'the second question is answered from what is held');
});

test('when the service fails, the last answer is served and says that it is old', async () => {
  const spy = answering(ipmaAnswers);
  const { nearestObservation } = await weather();
  await nearestObservation('PT', -9.14, 38.73);

  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 25 * 60 * 1000);
  spy.mockImplementation(async () => new Response(null, { status: 503 }));

  const answer = await nearestObservation('PT', -9.14, 38.73);
  assert.equal(answer?.stale, true, 'an hour-old wind with its time on it beats no wind');
  assert.equal(answer?.observation.windKmh, 18);
  vi.useRealTimers();
});

test('a country with no station at all answers nothing, and not a zero', async () => {
  answering((url) => (url.includes('stations.json') ? [] : {}));
  const { nearestObservation } = await weather();

  assert.equal(await nearestObservation('PT', -9.14, 38.73), null);
});

const INVALID_PROVIDER_SHAPES: [string, 'ES' | 'PT', (url: string) => JsonValue][] = [
  ['AEMET pointer', 'ES', () => false],
  ['AEMET data', 'ES', (url) => (url.includes('/api/observacion') ? AEMET_POINTER : { rows: [] })],
  [
    'IPMA station list',
    'PT',
    (url) => (url.includes('stations.json') ? {} : IPMA_OBSERVATIONS_JSON),
  ],
  ['IPMA hours', 'PT', (url) => (url.includes('stations.json') ? IPMA_STATIONS_JSON : [])],
];

test.each(INVALID_PROVIDER_SHAPES)(
  '%s rejects an incompatible JSON envelope',
  async (_label, country, reply) => {
    answering(reply);
    const { nearestObservation } = await weather();
    await assert.rejects(() => nearestObservation(country, 2.65, 39.57), /resposta invàlida/);
  },
);

const INVALID_AEMET_ROWS: [string, JsonValue][] = [
  ['null row', null],
  ['missing station', { idema: 'BAD' }],
  [
    'bad coordinates',
    {
      idema: 'BAD',
      ubi: 'Bad',
      lon: '2.65',
      lat: 39.57,
      fint: '2026-11-19T10:00:00',
      vv: 10,
      dv: 90,
      ta: 20,
      hr: 50,
    },
  ],
  [
    'invalid date',
    {
      idema: 'BAD',
      ubi: 'Bad',
      lon: 2.65,
      lat: 39.57,
      fint: '2026-02-30T10:00:00',
      vv: 10,
      dv: 90,
      ta: 20,
      hr: 50,
    },
  ],
  [
    'text wind',
    {
      idema: 'BAD',
      ubi: 'Bad',
      lon: 2.65,
      lat: 39.57,
      fint: '2026-11-19T10:00:00',
      vv: 'fast',
      dv: 90,
      ta: 20,
      hr: 50,
    },
  ],
  [
    'invalid bearing',
    {
      idema: 'BAD',
      ubi: 'Bad',
      lon: 2.65,
      lat: 39.57,
      fint: '2026-11-19T10:00:00',
      vv: 10,
      dv: 999,
      ta: 20,
      hr: 50,
    },
  ],
];

test.each(INVALID_AEMET_ROWS)(
  'AEMET ignores %s without losing complete stations',
  async (_label, row) => {
    answering((url) => (url.includes('/api/observacion') ? AEMET_POINTER : [...AEMET_ROWS, row]));
    const { nearestObservation } = await weather();
    const answer = await nearestObservation('ES', 2.65, 39.57);
    assert.equal(answer?.observation.station.id, 'B228');
    assert.equal(answer?.observation.windKmh, 18);
  },
);

test('IPMA skips malformed station geometry and retains the valid station', async () => {
  answering((url) =>
    url.includes('stations.json')
      ? [
          null,
          { geometry: { coordinates: 'bad' }, properties: { idEstacao: 99, localEstacao: 'Bad' } },
          ...IPMA_STATIONS_JSON,
        ]
      : IPMA_OBSERVATIONS_JSON,
  );
  const { nearestObservation } = await weather();
  const answer = await nearestObservation('PT', -9.14, 38.73);
  assert.equal(answer?.observation.station.id, '1200535');
});

test('an invalid latest IPMA row falls back to the previous complete hour', async () => {
  answering((url) =>
    url.includes('stations.json')
      ? IPMA_STATIONS_JSON
      : {
          'not-an-hour': {
            '1200535': { intensidadeVentoKM: 50, idDireccVento: 1, temperatura: 20, humidade: 50 },
          },
          '2026-11-19T10:00': {
            '1200535': {
              intensidadeVentoKM: 50,
              idDireccVento: 1,
              temperatura: 20,
              humidade: 'wet',
            },
          },
          '2026-11-19T09:00': IPMA_OBSERVATIONS_JSON['2026-11-19T09:00'],
        },
  );
  const { nearestObservation } = await weather();
  const answer = await nearestObservation('PT', -9.14, 38.73);
  assert.equal(answer?.observation.observedAt, '2026-11-19T09:00:00.000Z');
  assert.equal(answer?.observation.windKmh, 11);
});

test('a malformed refresh keeps the last valid observations marked stale', async () => {
  const spy = answering(ipmaAnswers);
  const { nearestObservation } = await weather();
  await nearestObservation('PT', -9.14, 38.73);
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 25 * 60 * 1000);
  spy.mockImplementation(async () => new Response('false', { status: 200 }));
  const answer = await nearestObservation('PT', -9.14, 38.73);
  assert.equal(answer?.stale, true);
  assert.equal(answer?.observation.windKmh, 18);
});

test('AEMET rows that are all invalid preserve the last good observation', async () => {
  const spy = answering(aemetAnswers);
  const { nearestObservation } = await weather();
  await nearestObservation('ES', 2.65, 39.57);
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 25 * 60 * 1000);
  spy.mockImplementation(
    async (url: string | URL) =>
      new Response(
        String(url).includes('/api/observacion')
          ? JSON.stringify(AEMET_POINTER)
          : JSON.stringify([AEMET_ROWS[3]]),
        { status: 200 },
      ),
  );

  const answer = await nearestObservation('ES', 2.65, 39.57);
  assert.equal(answer?.stale, true);
  assert.equal(answer?.observation.windKmh, 18);
});

test('IPMA rows that are all invalid preserve the last good observation', async () => {
  const spy = answering(ipmaAnswers);
  const { nearestObservation } = await weather();
  await nearestObservation('PT', -9.14, 38.73);
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 25 * 60 * 1000);
  spy.mockImplementation(
    async (url: string | URL) =>
      new Response(
        JSON.stringify(
          String(url).includes('stations.json')
            ? IPMA_STATIONS_JSON
            : { '2026-11-19T11:00': { '1200535': { humidade: 'wet' } } },
        ),
        { status: 200 },
      ),
  );

  const answer = await nearestObservation('PT', -9.14, 38.73);
  assert.equal(answer?.stale, true);
  assert.equal(answer?.observation.windKmh, 18);
});

test('an empty AEMET station list is a legitimate empty answer', async () => {
  answering((url) => (url.includes('/api/observacion') ? AEMET_POINTER : []));
  const { nearestObservation } = await weather();
  assert.equal(await nearestObservation('ES', 2.65, 39.57), null);
});
