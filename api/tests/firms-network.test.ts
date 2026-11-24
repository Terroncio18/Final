import { afterEach, beforeEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';

/* Reload the module per test to reset its cached availability table. */

const AVAILABLE_THROUGH = new Date().toISOString().slice(0, 10);
const AVAILABILITY = [
  'data_id,min_date,max_date',
  'VIIRS_SNPP_SP,2012-01-20,2026-09-30',
  `VIIRS_SNPP_NRT,2026-08-01,${AVAILABLE_THROUGH}`,
  'VIIRS_NOAA20_SP,2018-01-05,2026-09-30',
  `VIIRS_NOAA20_NRT,2026-08-01,${AVAILABLE_THROUGH}`,
  `VIIRS_NOAA21_NRT,2026-08-01,${AVAILABLE_THROUGH}`,
  'MODIS_SP,not-a-date,2026-09-30',
].join('\n');

const DETECTIONS = [
  'latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,confidence,frp,daynight',
  '39.5712,2.6501,330.1,0.4,0.4,2024-08-01,1312,N,n,12.5,D',
  '38.7312,-9.1402,350.9,0.5,0.5,2024-08-01,45,N21,h,48.25,N',
  ',,,,,2024-08-01,0100,N,l,1,D',
].join('\n');

function firmsAnswering(reply: (url: string) => { text: string; ok?: boolean; status?: number }) {
  const spy = vi.fn(async (url: string | URL) => {
    const answer = reply(String(url));
    return {
      ok: answer.ok ?? true,
      status: answer.status ?? 200,
      text: async () => answer.text,
    } as Response;
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

async function firms() {
  return await import('../src/firms.js');
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('FIRMS_MAP_KEY', 'a-key-for-the-tests');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test('the availability table is read once and then reused', async () => {
  const spy = firmsAnswering(() => ({ text: AVAILABILITY }));
  const { availability } = await firms();

  const table = await availability();
  assert.equal(table.size, 5, 'the row with a date that is not a date does not enter');
  assert.deepEqual(table.get('VIIRS_SNPP_SP'), { min: '2012-01-20', max: '2026-09-30' });
  assert.equal(table.has('MODIS_SP'), false);

  await availability();
  assert.equal(spy.mock.calls.length, 1, 'the second question is not asked of FIRMS');
});

test('an error in plain text with a 200 is not taken for a table', async () => {
  // This is FIRMS's own habit: an invalid key answers 200 with a sentence.
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  firmsAnswering(() => ({ text: 'Invalid MAP_KEY.' }));
  const { availability } = await firms();

  const table = await availability();
  assert.equal(table.size, 0);
  assert.equal(warn.mock.calls.length, 1, 'and it is said out loud');
});

test('a request that fails leaves the table empty instead of throwing', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  firmsAnswering(() => ({ text: '', ok: false, status: 503 }));
  const { availability, earliest } = await firms();

  assert.equal((await availability()).size, 0);
  assert.equal(await earliest(), null, 'and nothing is claimed about the first date');
});

test('the earliest date is the oldest any platform holds', async () => {
  firmsAnswering(() => ({ text: AVAILABILITY }));
  const { earliest } = await firms();
  assert.equal(await earliest(), '2012-01-20');
});

test('without a key nothing is asked of FIRMS at all', async () => {
  vi.stubEnv('FIRMS_MAP_KEY', '');
  const spy = firmsAnswering(() => ({ text: AVAILABILITY }));
  const { fetchHotspots } = await firms();

  await assert.rejects(() => fetchHotspots('2024-08-01', '2024-08-01'), /FIRMS_MAP_KEY/);
  assert.equal(spy.mock.calls.length, 0);
});

test('the same overpass asked twice becomes one detection, and power sorts them', async () => {
  const spy = firmsAnswering((url) =>
    url.includes('data_availability') ? { text: AVAILABILITY } : { text: DETECTIONS },
  );
  const { fetchHotspots } = await firms();

  const answer = await fetchHotspots('2024-08-01', '2024-08-01');

  assert.equal(spy.mock.calls.length, 5, 'the availability table plus four windows');
  assert.equal(answer.body.features.length, 2, 'the row without coordinates does not enter either');
  assert.deepEqual(answer.sources, ['VIIRS_NOAA20_SP', 'VIIRS_SNPP_SP'], 'named and in order');

  const [first, second] = answer.body.features;
  assert.equal(first!.properties.frp, 48.25, 'the most powerful one first');
  assert.equal(second!.properties.frp, 12.5);
  assert.equal(first!.properties.observedAt, '2024-08-01T00:45:00Z', 'a short time is padded');
  assert.equal(second!.properties.observedAt, '2024-08-01T13:12:00Z');
  assert.equal(first!.properties.satellite, 'N21');
  assert.equal(first!.properties.confidence, 'h');
  assert.equal(second!.properties.confidence, 'n');
  assert.equal(first!.properties.daynight, 'N');
  assert.equal(second!.properties.daynight, 'D');
  assert.deepEqual(second!.geometry.coordinates, [2.6501, 39.5712], 'longitude first');
  assert.equal(first!.id, first!.properties.id, 'the feature is identified by the same thing');
});

test('unknown detection codes use explicit fallback values', async () => {
  const detections = [
    'latitude,longitude,acq_date,acq_time,satellite,confidence,frp,daynight',
    '39.57,2.65,2024-08-01,1312,unexpected,unexpected,12.5,unexpected',
  ].join('\n');
  firmsAnswering((url) => ({
    text: url.includes('data_availability') ? AVAILABILITY : detections,
  }));
  const { fetchHotspots } = await firms();
  const answer = await fetchHotspots('2024-08-01', '2024-08-01');
  const properties = answer.body.features[0]!.properties;
  assert.equal(properties.satellite, '?');
  assert.equal(properties.confidence, '');
  assert.equal(properties.daynight, '');
});

test('today is asked for without a date, which is not the same as asking for today', async () => {
  const spy = firmsAnswering((url) =>
    url.includes('data_availability') ? { text: AVAILABILITY } : { text: DETECTIONS },
  );
  const { fetchHotspots, today } = await firms();

  const now = today();
  await fetchHotspots(now, now);

  const areaUrls = spy.mock.calls
    .map((call) => String(call[0]))
    .filter((url) => !url.includes('data_availability'));
  assert.ok(areaUrls.length > 0);
  for (const url of areaUrls) {
    assert.ok(url.endsWith('/1'), `the day count is the last segment: ${url}`);
  }
});

test('one platform failing is a partial answer; every platform failing is an error', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  firmsAnswering((url) => {
    if (url.includes('data_availability')) return { text: AVAILABILITY };
    return url.includes('NOAA20') ? { text: '', ok: false, status: 500 } : { text: DETECTIONS };
  });
  const { fetchHotspots } = await firms();

  const answer = await fetchHotspots('2024-08-01', '2024-08-01');
  assert.deepEqual(answer.sources, ['VIIRS_SNPP_SP'], 'only the one that answered');
  assert.equal(answer.body.features.length, 2, 'and what it answered is served');
  assert.equal(warn.mock.calls.length, 1, 'with the failure said out loud');

  vi.resetModules();
  firmsAnswering((url) =>
    url.includes('data_availability')
      ? { text: AVAILABILITY }
      : { text: '', ok: false, status: 500 },
  );
  const again = await firms();
  await assert.rejects(() => again.fetchHotspots('2024-08-01', '2024-08-01'), /answered 500/);
});

test('an empty successful area and a failed area remain a partial answer', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const empty = 'latitude,longitude,acq_date,acq_time,satellite,confidence,frp,daynight';
  firmsAnswering((url) => {
    if (url.includes('data_availability')) return { text: AVAILABILITY };
    if (url.includes('-9.9,35.8,4.4,44')) return { text: '', ok: false, status: 503 };
    return { text: empty };
  });
  const { fetchHotspots } = await firms();

  const answer = await fetchHotspots('2024-08-01', '2024-08-01');
  assert.equal(answer.body.features.length, 0);
  assert.deepEqual(answer.sources, ['VIIRS_NOAA20_SP', 'VIIRS_SNPP_SP']);
  assert.deepEqual(answer.missing, ['VIIRS_SNPP_SP/peninsula', 'VIIRS_NOAA20_SP/peninsula']);
});

const INVALID_DETECTIONS: [string, string][] = [
  ['latitude text', 'bad,2.65,2024-08-01,1312,N,n,12.5,D'],
  ['longitude text', '39.57,bad,2024-08-01,1312,N,n,12.5,D'],
  ['latitude range', '91,2.65,2024-08-01,1312,N,n,12.5,D'],
  ['longitude range', '39.57,-181,2024-08-01,1312,N,n,12.5,D'],
  ['infinite coordinate', 'Infinity,2.65,2024-08-01,1312,N,n,12.5,D'],
  ['blank coordinate', ' ,2.65,2024-08-01,1312,N,n,12.5,D'],
  ['missing power', '39.57,2.65,2024-08-01,1312,N,n,,D'],
  ['invalid power', '39.57,2.65,2024-08-01,1312,N,n,bad,D'],
  ['negative power', '39.57,2.65,2024-08-01,1312,N,n,-1,D'],
  ['infinite power', '39.57,2.65,2024-08-01,1312,N,n,Infinity,D'],
  ['invalid date', '39.57,2.65,2024-02-30,1312,N,n,12.5,D'],
  ['missing date', '39.57,2.65,,1312,N,n,12.5,D'],
  ['invalid hour', '39.57,2.65,2024-08-01,2400,N,n,12.5,D'],
  ['invalid minute', '39.57,2.65,2024-08-01,2360,N,n,12.5,D'],
  ['missing time', '39.57,2.65,2024-08-01,,N,n,12.5,D'],
  ['non-numeric time', '39.57,2.65,2024-08-01,noon,N,n,12.5,D'],
];
const DETECTION_HEADER = 'latitude,longitude,acq_date,acq_time,satellite,confidence,frp,daynight';

function detectionsAnswering(rows: string[]) {
  firmsAnswering((url) => ({
    text: url.includes('data_availability') ? AVAILABILITY : [DETECTION_HEADER, ...rows].join('\n'),
  }));
}

test.each(INVALID_DETECTIONS)(
  'invalid detection rows (%s) do not replace valid detections',
  async (_label, row) => {
    detectionsAnswering(['38.73,-9.14,2024-08-01,1312,N,n,12.5,D', row]);
    const { fetchHotspots } = await firms();
    const { body } = await fetchHotspots('2024-08-01', '2024-08-01');
    assert.equal(body.features.length, 1);
    assert.deepEqual(body.features[0]!.geometry.coordinates, [-9.14, 38.73]);
    assert.equal(body.features[0]!.properties.frp, 12.5);
  },
);

test('zero-valued coordinates and power, midnight and leap days remain valid', async () => {
  detectionsAnswering(['0,0,2024-02-29,0,N,n,0,N']);
  const { fetchHotspots } = await firms();
  const { body } = await fetchHotspots('2024-08-01', '2024-08-01');
  assert.equal(body.features.length, 1);
  assert.deepEqual(body.features[0]!.geometry.coordinates, [0, 0]);
  assert.equal(body.features[0]!.properties.frp, 0);
  assert.equal(body.features[0]!.properties.observedAt, '2024-02-29T00:00:00Z');
});

test('a wholly malformed feed fails rather than claiming there were no detections', async () => {
  detectionsAnswering([INVALID_DETECTIONS[0]![1]]);
  const { fetchHotspots } = await firms();
  await assert.rejects(() => fetchHotspots('2024-08-01', '2024-08-01'), /valid detections/);
});

test('a header-only feed is a legitimate empty answer', async () => {
  detectionsAnswering([]);
  const { fetchHotspots } = await firms();
  assert.equal((await fetchHotspots('2024-08-01', '2024-08-01')).body.features.length, 0);
});
