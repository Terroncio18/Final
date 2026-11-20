import { afterEach, beforeEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TILE_SIZE, UNKNOWN } from '../src/fuel-grid.js';

// What is replaced here is the 10 m raster of the whole world —ESA's, read by
// HTTP ranges— and nothing else: the datasets, the tiles, the cache and the
// counting are ours and are read and written for real, in a directory of the
// system's own temporary one.
const fromUrl = vi.hoisted(() => vi.fn());
vi.mock('geotiff', () => ({ fromUrl }));

/** A box inside the tile 21_316 of our grid, and inside WorldCover's N39E000. */
const BOUNDS = [2.65, 39.55, 2.7, 39.6] as const;
const SIZE = 4;
const CELLS = SIZE * SIZE;

let dir: string;

/** An image of one cover class, with the geometry of a WorldCover tile. */
function worldCover(cover: number) {
  return {
    getImage: async () => ({
      getBoundingBox: () => [0, 39, 3, 42],
      getResolution: () => [0.0001, -0.0001],
      getWidth: () => 30000,
      getHeight: () => 30000,
      readRasters: async ({ window }: { window: [number, number, number, number] }) => {
        const [x0, y0, x1, y1] = window;
        return new Uint8Array((x1 - x0) * (y1 - y0)).fill(cover);
      },
    }),
    close: async () => {},
  };
}

/** An official dataset of one tile, every pixel the same model. */
async function dataset(id: string, model: number, priority = 1) {
  const home = join(dir, 'datasets', id);
  await mkdir(home, { recursive: true });
  await writeFile(
    join(home, 'manifest.json'),
    JSON.stringify({
      id,
      priority,
      tiles: ['21_316'],
      label: `${id} · IV Inventari`,
      sourceUrl: 'https://example.invalid/',
      sourceDate: '2014',
      attribution: 'Govern de les Illes Balears–SITIBSA',
    }),
  );
  await writeFile(join(home, '21_316.bin'), Buffer.alloc(TILE_SIZE * TILE_SIZE, model));
}

async function fuels() {
  return await import('../src/fuels.js');
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ignislab-fuels-'));
  vi.resetModules();
  vi.stubEnv('FUEL_DATA_DIR', dir);
  fromUrl.mockResolvedValue(worldCover(10));
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
  await rm(dir, { recursive: true, force: true });
});

test('with no official map, every cell is estimated from the land cover', async () => {
  const { fuelGrid } = await fuels();

  const grid = await fuelGrid([...BOUNDS], SIZE);

  assert.equal(grid.estimatedCells, CELLS);
  assert.equal(grid.officialCells, 0);
  assert.equal(grid.unknownCells, 0);
  assert.equal(grid.nonBurnableCells, 0);
  // Tree cover is the model 8 of the table in §11.21.
  assert.deepEqual(grid.models, [{ id: 8, cells: CELLS }]);
  assert.deepEqual(grid.runs, [8, 2, CELLS], 'one run: model 8, estimated, sixteen cells');
  // No datasets directory at all: the client is told there is no official
  // map anywhere, not only that this box happens to miss one.
  assert.equal(grid.warnings.length, 1);
  assert.match(grid.warnings[0]!, /[Cc]ap conjunt.*oficial/);
  assert.equal(grid.sources.length, 1);
  assert.match(grid.sources[0]!.label, /WorldCover/);
  assert.match(grid.sources[0]!.attribution, /ESA WorldCover project 2021/);
  assert.equal(grid.size, SIZE);
});

test('an official map wins over the estimate, and both are named', async () => {
  await dataset('balears', 4);
  const { fuelGrid } = await fuels();

  const grid = await fuelGrid([...BOUNDS], SIZE);

  assert.equal(grid.officialCells, CELLS, 'the official model covers the whole box');
  assert.equal(grid.estimatedCells, 0);
  assert.deepEqual(grid.models, [{ id: 4, cells: CELLS }]);
  assert.deepEqual(grid.runs, [4, 1, CELLS], 'model 4, official');
  assert.equal(fromUrl.mock.calls.length, 0, 'full official coverage never asks WorldCover');
  // Only the official one: with nothing estimated left, WorldCover is not cited.
  assert.deepEqual(
    grid.sources.map((source) => source.label),
    ['balears · IV Inventari'],
  );
});

test('an official map with holes leaves the estimate underneath', async () => {
  // The tile is unknown except for its northern half, which is where the two
  // upper rows of the box fall.
  const tile = Buffer.alloc(TILE_SIZE * TILE_SIZE, UNKNOWN);
  tile.fill(2, 0, TILE_SIZE * (TILE_SIZE / 2));
  const home = join(dir, 'datasets', 'parcial');
  await mkdir(home, { recursive: true });
  await writeFile(
    join(home, 'manifest.json'),
    JSON.stringify({
      id: 'parcial',
      priority: 1,
      tiles: ['21_316'],
      label: 'parcial',
      sourceUrl: 'https://example.invalid/',
      sourceDate: '2014',
      attribution: 'cap',
    }),
  );
  await writeFile(join(home, '21_316.bin'), tile);
  const { fuelGrid } = await fuels();

  const grid = await fuelGrid([...BOUNDS], SIZE);

  assert.ok(grid.officialCells > 0 && grid.officialCells < CELLS, 'some of each');
  assert.equal(grid.officialCells + grid.estimatedCells, CELLS);
  assert.equal(grid.sources.length, 2, 'the official map and the estimate are both cited');
});

test('a land cover that cannot be read leaves the cells unknown, and says so', async () => {
  fromUrl.mockRejectedValue(new Error('the range read timed out'));
  const { fuelGrid } = await fuels();

  const grid = await fuelGrid([...BOUNDS], SIZE);

  assert.equal(grid.unknownCells, CELLS);
  assert.equal(grid.estimatedCells, 0);
  // Both named: there is no official map at all, and on top of that the
  // fallback itself could not be read.
  assert.equal(grid.warnings.length, 2);
  assert.match(grid.warnings[1]!, /WorldCover N39E000/);
  // And nothing of this is kept: a failure upstream has to be retryable.
  assert.deepEqual(await readdir(dir), [], 'no cache is written');
});

test('a missing dataset directory is said once, and does not block caching on its own', async () => {
  const { fuelGrid } = await fuels();

  const grid = await fuelGrid([...BOUNDS], SIZE);
  assert.equal(grid.warnings.length, 1);
  assert.match(grid.warnings[0]!, /[Cc]ap conjunt.*oficial/);
  // Stable, not transient: unlike a raster that failed to load, the absence
  // of a datasets directory is a fact about the deployment and is already
  // part of the cache key through `maps`, so the answer is still cached.
  const cached = await readdir(join(dir, 'cache'));
  assert.equal(cached.length, 1);
});

test('an answer with everything known is kept, and the second question does not ask the raster', async () => {
  const { fuelGrid } = await fuels();

  const first = await fuelGrid([...BOUNDS], SIZE);
  assert.equal(fromUrl.mock.calls.length, 1);
  const cached = await readdir(join(dir, 'cache'));
  assert.equal(cached.length, 1);
  assert.match(cached[0]!, /^[a-f0-9]{64}\.json\.gz$/);

  const second = await fuelGrid([...BOUNDS], SIZE);
  assert.equal(fromUrl.mock.calls.length, 1, 'the raster is not read again');
  assert.deepEqual(second.runs, first.runs);
  assert.equal(second.generatedAt, first.generatedAt, 'it is the same answer, not a new one');
});

test('the same box asked twice at once is one job, and a third box is busy', async () => {
  // Three different boxes, so three different jobs, with the raster held up.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  fromUrl.mockImplementation(async () => {
    await held;
    return worldCover(10);
  });
  const { fuelGrid } = await fuels();

  const first = fuelGrid([...BOUNDS], SIZE);
  const same = fuelGrid([...BOUNDS], SIZE);
  const other = fuelGrid([2.7, 39.55, 2.75, 39.6], SIZE);

  try {
    // Wait until both slots are occupied so filesystem scheduling cannot
    // affect the assertion about the request limit.
    await vi.waitFor(() => assert.equal(fromUrl.mock.calls.length, 2));
    await assert.rejects(
      () => fuelGrid([2.75, 39.55, 2.8, 39.6], SIZE),
      /FUEL_BUSY/,
      'two at a time is the ceiling',
    );
  } finally {
    release();
  }
  const [a, b] = await Promise.all([first, same, other]);
  assert.equal(a!.generatedAt, b!.generatedAt, 'the repeated question waited for the first');
  assert.equal(fromUrl.mock.calls.length, 2, 'one read per box, not per question');

  // And once they are done, there is room again.
  const after = await fuelGrid([2.75, 39.55, 2.8, 39.6], SIZE);
  assert.equal(after.estimatedCells, CELLS);
});

test('official coverage remains usable when WorldCover is unavailable', async () => {
  await dataset('canarias', 7);
  fromUrl.mockRejectedValue(new Error('WorldCover is down'));
  const { fuelGrid } = await fuels();
  const grid = await fuelGrid([...BOUNDS], SIZE);
  assert.equal(grid.officialCells, CELLS);
  assert.equal(grid.unknownCells, 0);
  assert.deepEqual(grid.warnings, []);
  assert.equal(fromUrl.mock.calls.length, 0);
});

test('adding an official dataset invalidates an already cached estimated domain', async () => {
  const { fuelGrid } = await fuels();
  assert.equal((await fuelGrid([...BOUNDS], SIZE)).estimatedCells, CELLS);
  await dataset('valencia', 6);
  const grid = await fuelGrid([...BOUNDS], SIZE);
  assert.equal(grid.officialCells, CELLS);
  assert.deepEqual(grid.runs, [6, 1, CELLS]);
});

test('a higher priority map wins while its unknown pixels preserve lower priority data', async () => {
  await dataset('regional', 7, 20);
  await dataset('base', 4, 10);
  await dataset('holes', UNKNOWN, 30);
  const { fuelGrid } = await fuels();
  const grid = await fuelGrid([...BOUNDS], SIZE);
  assert.deepEqual(grid.runs, [7, 1, CELLS]);
});
