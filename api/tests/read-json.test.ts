import assert from 'node:assert/strict';
import { afterEach, test, vi } from 'vitest';
import { fetchChecked, readJson } from '../src/read-json.js';
import type { JsonValue } from '../src/json-value.js';

afterEach(() => vi.unstubAllGlobals());

test('readJson forwards AEMET headers and returns the parsed JSON', async () => {
  const fetcher = vi.fn(async () => new Response('{"estado":200}'));
  vi.stubGlobal('fetch', fetcher);
  const init = { headers: { api_key: 'test-key' } };

  assert.deepEqual(await readJson<JsonValue>('https://example.test', 'AEMET', init), {
    estado: 200,
  });
  assert.deepEqual(fetcher.mock.calls[0], ['https://example.test', init]);
});

test.each(['AEMET', 'IPMA stations', 'IPMA'])(
  'readJson keeps the %s HTTP error message',
  async (source) => {
    vi.stubGlobal('fetch', async () => new Response(null, { status: 503 }));
    await assert.rejects(readJson<JsonValue>('https://example.test', source), {
      message: `${source}: 503`,
    });
  },
);

test.each([
  ['FIRMS answered 503', (status: number) => `FIRMS answered ${status}`],
  ['FIRMS answered 503 for VIIRS', (status: number) => `FIRMS answered ${status} for VIIRS`],
  ['AEMET data: 503', (status: number) => `AEMET data: ${status}`],
] as const)('fetchChecked keeps the %s HTTP error message', async (message, format) => {
  vi.stubGlobal('fetch', async () => new Response(null, { status: 503 }));
  await assert.rejects(fetchChecked('https://example.test', format), { message });
});
