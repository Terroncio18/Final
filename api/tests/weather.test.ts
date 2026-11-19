import { afterEach, beforeEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';

// AEMET and IPMA are replaced; everything else here is ours. Each test loads
// the module again, because it holds its observations and its station list in
// variables of its own.

const AEMET_POINTER = { estado: 200, datos: 'https://opendata.aemet.es/the-data.json' };

const AEMET_ROWS = [
  // Son Bonet, two hours of it: the newer row is the one that must win.
  { idema: 'B228', ubi: 'SON BONET, AEROPUERTO', lon: 2.7, lat: 39.6, fint: '2026-11-19T09:00:00', vv: 2, dv: 180, ta: 17, hr: 60 },
  { idema: 'B228', ubi: 'SON BONET, AEROPUERTO', lon: 2.7, lat: 39.6, fint: '2026-11-19T10:00:00', vv: 5, dv: 225, ta: 19.4, hr: 55 },
  // A station with a broken Ñ if the answer is read as UTF-8.
  { idema: 'C659', ubi: 'LA AÑEJA', lon: -16.5, lat: 28.5, fint: '2026-11-19T10:00:00', vv: 1, dv: 90, ta: 21, hr: 70 },
  // The wind is missing: a station that cannot say how a fire would run.
  { idema: 'B013', ubi: 'EIVISSA', lon: 1.4, lat: 38.9, fint: '2026-11-19T10:00:00', dv: 10, ta: 18, hr: 65 },
];

const IPMA_STATIONS_JSON = [
  { geometry: { coordinates: [-9.14, 38.73] }, properties: { idEstacao: 1200535, localEstacao: 'Lisboa, Gago Coutinho' } },
  { geometry: { coordinates: [-8.61, 41.15] }, properties: { idEstacao: 1210762, localEstacao: 'Porto, Pedras Rubras' } },
];

const IPMA_OBSERVATIONS_JSON = {
  '2026-11-19T09:00': {
    '1200535': { intensidadeVentoKM: 11, idDireccVento: 5, temperatura: 15, humidade: 70 },
    '1210762': { intensidadeVentoKM: 7, idDireccVento: 3, temperatura: 13, humidade: 80 },
  },
  '2026-11-19T10:00': {
    // The newest hour: Lisbon has it, Porto is still empty, and a station
    // nobody has heard of reports as well.
    '1200535': { intensidadeVentoKM: 18, idDireccVento: 3, temperatura: 16.5, humidade: 65 },
    '1210762': null,
    '9999999': { intensidadeVentoKM: 5, idDireccVento: 1, temperatura: 10, humidade: 50 },
  },
};

function answering(reply: (url: string) => unknown) {
  const spy = vi.fn(async (url: string | URL) => {
    const answer = reply(String(url));
    if (answer === null) return { ok: false, status: 503 } as Response;
    const text = JSON.stringify(answer);
    return {
      ok: true,
      status: 200,
      json: async () => answer,
      // AEMET's data is ISO-8859-15, and the two bytes that matter are the
      // same there as in latin1.
      arrayBuffer: async () => Buffer.from(text, 'latin1'),
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

const aemetAnswers = (url: string) => (url.includes('/api/observacion') ? AEMET_POINTER : AEMET_ROWS);
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
  // `fint` comes without a zone and AEMET publishes in UTC: ten o'clock is
  // ten o'clock whatever zone this machine is in.
  assert.equal(answer.observation.observedAt, '2026-11-19T10:00:00.000Z');
  // Five metres per second is eighteen kilometres per hour, and it is the
  // ten o'clock row and not the nine o'clock one.
  assert.equal(answer.observation.windKmh, 18);
  assert.equal(answer.observation.windFromDeg, 225);
  assert.equal(answer.observation.temperature, 19.4);
  assert.equal(answer.observation.source, 'AEMET');
  assert.ok(answer.distanceKm < 10, 'and it says how far away it is');
  assert.equal(answer.stale, false);

  // Two requests: the address of the data, and the data.
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

  // Eivissa is the closest station to Eivissa, and it is not the answer.
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
  // The ten o'clock row, where the wind comes from the east.
  assert.equal(answer.observation.windKmh, 18);
  assert.equal(answer.observation.windFromDeg, 90);
  assert.equal(answer.observation.observedAt, '2026-11-19T10:00:00.000Z', 'the hour is UTC');

  // Porto has nothing at ten, so it keeps the nine o'clock row.
  const porto = await nearestObservation('PT', -8.61, 41.15);
  assert.equal(porto?.observation.station.id, '1210762');
  assert.equal(porto?.observation.windFromDeg, 90, 'at nine the wind was from the east there');

  assert.equal(spy.mock.calls.length, 2, 'the stations and the observations, once each');
});

test('a station IPMA does not list is not placed on the map', async () => {
  answering(ipmaAnswers);
  const { nearestObservation } = await weather();

  const answer = await nearestObservation('PT', -9.14, 38.73);
  // 9999999 reports and has no coordinates; the nearest to Lisbon is Lisbon.
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

  // The clock moves past the twenty minutes, and now IPMA is down.
  vi.useFakeTimers();
  vi.setSystemTime(Date.now() + 25 * 60 * 1000);
  spy.mockImplementation(async () => ({ ok: false, status: 503 }) as Response);

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
