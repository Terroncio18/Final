import { test } from 'vitest';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import {
  validateGrid,
  paintPolygon,
  encodeRuns,
  tileKeys,
  worldCoverModel,
  UNKNOWN,
} from '../src/fuel-grid.js';
import { worldCoverTile } from '../src/fuels.js';
import { registerFuelRoutes } from '../src/fuel-routes.js';

test('bbox accepts mainland and islands, rejects malformed or unbounded work', () => {
  for (const bbox of [
    '2.7,39.7,2.9,39.9',
    '-9.2,38.7,-9,38.9',
    '-31.3,39.3,-31.1,39.5',
    '-18,27.5,-17.8,27.7',
  ]) {
    assert.equal(validateGrid(bbox).size, 1024);
  }
  for (const bbox of [
    undefined,
    '',
    ',1,2,3',
    'NaN,1,2,3',
    '2,40,1,41',
    '-9,38,-7,39',
    '-40,38,-39.9,38.1',
  ]) {
    assert.throws(() => validateGrid(bbox));
  }
  for (const size of ['', '0', '1025', '32.5', 'Infinity'])
    assert.throws(() => validateGrid('2,39,2.1,39.1', size));
});

test('western tiles use floor, including the two sides of a tile boundary', () => {
  assert.equal(worldCoverTile(-9.14, 38.73), 'N36W012');
  assert.equal(worldCoverTile(-9, 39), 'N39W009');
  assert.equal(worldCoverTile(2.7, 39.75), 'N39E000');
  assert.deepEqual(tileKeys([-0.125, 0, 0.125, 0.125]), [
    [-1, 0],
    [0, 0],
  ]);
});

test('unrecognised cover never means non-burnable', () => {
  assert.equal(worldCoverModel(0), UNKNOWN);
  assert.equal(worldCoverModel(NaN), UNKNOWN);
  assert.equal(worldCoverModel(80), 0);
  assert.equal(worldCoverModel(10), 8);
  assert.equal(worldCoverModel(20), 5);
  assert.equal(worldCoverModel(40), 1);
  assert.equal(worldCoverModel(60), 0);
});

test('rasterization honours holes, geographic orientation and negative coordinates', () => {
  const grid = new Uint8Array(16).fill(UNKNOWN);
  paintPolygon(
    [
      [
        [-4, 0],
        [0, 0],
        [0, 4],
        [-4, 4],
        [-4, 0],
      ],
      [
        [-3, 1],
        [-1, 1],
        [-1, 3],
        [-3, 3],
        [-3, 1],
      ],
    ],
    [-4, 0, 0, 4],
    4,
    grid,
    6,
  );
  assert.deepEqual([...grid], [6, 6, 6, 6, 6, 255, 255, 6, 6, 255, 255, 6, 6, 6, 6, 6]);
  paintPolygon(
    [
      [
        [-4, 3],
        [-3, 3],
        [-3, 4],
        [-4, 4],
        [-4, 3],
      ],
    ],
    [-4, 0, 0, 4],
    4,
    grid,
    2,
  );
  assert.equal(grid[0], 2);
  assert.equal(grid[12], 6);
});

test('run encoding preserves model AND provenance, including unknowns', () => {
  assert.deepEqual(
    encodeRuns(Uint8Array.from([5, 5, 5, 255, 0]), Uint8Array.from([1, 1, 2, 0, 2])),
    [5, 1, 2, 5, 2, 1, 255, 0, 1, 0, 2, 1],
  );
  assert.throws(() => encodeRuns(new Uint8Array(2), new Uint8Array(1)));
});

test('HTTP rejects invalid input without consulting a remote source', async () => {
  const app = Fastify();
  registerFuelRoutes(app);
  try {
    for (const url of [
      '/api/fuels',
      '/api/fuels?bbox=2,39,3,40',
      '/api/fuels?bbox=2,39,2.1,39.1&size=99999',
    ]) {
      assert.equal((await app.inject(url)).statusCode, 400);
    }
  } finally {
    await app.close();
  }
});
