import { afterEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import Fastify from 'fastify';

// What the grid is made of is the business of `fuels.ts`, and it reads
// hundreds of megabytes of GeoTIFF to say it. Here it is replaced, because
// what is being tested is the route: what it answers, with which headers, and
// what it does when the thing underneath says no.
const fuelGrid = vi.hoisted(() => vi.fn());
vi.mock('../src/fuels.js', () => ({ fuelGrid }));

const { registerFuelRoutes } = await import('../src/fuel-routes.js');

const BBOX = '/api/fuels?bbox=2.6,39.5,2.8,39.7';

async function ask(url = BBOX) {
  const app = Fastify();
  registerFuelRoutes(app);
  try {
    return await app.inject(url);
  } finally {
    await app.close();
  }
}

afterEach(() => {
  vi.resetAllMocks();
});

test('a grid with everything known is cached for an hour', async () => {
  fuelGrid.mockResolvedValue({ runs: [5, 1, 4], warnings: [], unknownCells: 0, size: 1024 });

  const answer = await ask();
  assert.equal(answer.statusCode, 200);
  assert.equal(answer.headers['cache-control'], 'public, max-age=3600');
  assert.deepEqual(answer.json(), { runs: [5, 1, 4], warnings: [], unknownCells: 0, size: 1024 });
});

test('a grid with holes or warnings is not cached at all', async () => {
  fuelGrid.mockResolvedValue({ runs: [], warnings: [], unknownCells: 12, size: 1024 });
  assert.equal((await ask()).headers['cache-control'], 'no-store');

  fuelGrid.mockResolvedValue({ runs: [], warnings: ['IDEIB did not answer'], unknownCells: 0, size: 1024 });
  assert.equal((await ask()).headers['cache-control'], 'no-store');
});

test('a busy preparation asks to come back, and says when', async () => {
  fuelGrid.mockRejectedValue(new Error('FUEL_BUSY'));

  const answer = await ask();
  assert.equal(answer.statusCode, 503);
  assert.equal(answer.headers['retry-after'], '15');
  assert.match(answer.json().error, /Torna-ho a provar/);
});

test('any other failure of the cartography is a 502, and not a 500', async () => {
  fuelGrid.mockRejectedValue(new Error('the GeoTIFF range read timed out'));

  const answer = await ask();
  assert.equal(answer.statusCode, 502, 'the fault is upstream, and the message says so');
  assert.match(answer.json().error, /combustible/);
});

test('an invalid request never reaches the cartography', async () => {
  const answer = await ask('/api/fuels?bbox=2,39,3,40');
  assert.equal(answer.statusCode, 400);
  assert.equal(fuelGrid.mock.calls.length, 0);
});
