import { afterEach, beforeEach, test, vi } from 'vitest';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { TILE_SIZE, UNKNOWN } from '../src/fuel-grid.js';

/* Mock only WorldCover HTTP reads; use real datasets, tiles and cache under a temporary directory. */

const fromUrl = vi.hoisted(() => vi.fn());
vi.mock('geotiff', () => ({ fromUrl }));

/** A box inside the tile 21_316 of our grid, and inside WorldCover's N39E000. */
const BOUNDS = [2.65, 39.55, 2.7, 39.6] as const;
const SIZE = 4;
const CELLS = SIZE * SIZE;

let dir: string;

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

  assert.deepEqual(grid.models, [{ id: 8, cells: CELLS }]);
  assert.deepEqual(grid.runs, [8, 2, CELLS], 'one run: model 8, estimated, sixteen cells');

  assert.equal(grid.warnings.length, 1);
  assert.match(grid.warnings[0]!, /[Cc]ap conjunt.*oficial/);
  assert.equal(grid.sources.length, 1);
  assert.match(grid.sources[0]!.label, /WorldCover/);
  assert.match(grid.sources[0]!.attribution, /ESA WorldCover project 2021/);
  assert.equal(grid.size, SIZE);
});

test('partial WorldCover coverage and an inaccessible source have distinct warnings', async () => {
  fromUrl.mockResolvedValue({
    getImage: async () => ({
      getBoundingBox: () => [2.66, 39.55, 2.68, 39.6],
      getResolution: () => [0.01, -0.01],
      getWidth: () => 2,
      getHeight: () => 5,
      readRasters: async () => Uint8Array.from([10, 10, 20, 20, 20, 20, 20, 20, 20, 20]),
    }),
    close: async () => {},
  });
  const { fuelGrid } = await fuels();

  const grid = await fuelGrid([...BOUNDS], SIZE);

  assert.deepEqual(grid.runs.slice(0, 9), [255, 0, 1, 8, 2, 1, 255, 0, 3]);
  assert.equal(grid.unknownCells, 12);
  assert.equal(grid.estimatedCells, 4);
  assert.equal(grid.warnings.length, 2);
  assert.match(grid.warnings[0]!, /[Cc]ap conjunt.*oficial/);
  assert.match(grid.warnings[1]!, /WorldCover N39E000.*no cobreix.*Tornar-ho a provar no servirà/);
  assert.deepEqual(await readdir(dir), [], 'partial coverage is not cached');

  fromUrl.mockRejectedValue(new Error('the range read timed out'));
  const inaccessible = await fuelGrid([...BOUNDS], SIZE);
  assert.equal(inaccessible.unknownCells, CELLS);
  assert.equal(inaccessible.estimatedCells, 0);
  assert.equal(inaccessible.warnings.length, 2);
  assert.match(inaccessible.warnings[0]!, /[Cc]ap conjunt.*oficial/);
  assert.match(inaccessible.warnings[1]!, /WorldCover N39E000.*dades no disponibles/);
  assert.notEqual(inaccessible.warnings[1], grid.warnings[1]);
  assert.deepEqual(await readdir(dir), [], 'inaccessible source is not cached');
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

  assert.deepEqual(
    grid.sources.map((source) => source.label),
    ['balears · IV Inventari'],
  );
});

test('an official map with holes leaves the estimate underneath', async () => {
  /* Only the northern half has known fuel, covering the box’s top two rows. */

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

test('a missing dataset directory is said once, and does not block caching on its own', async () => {
  const { fuelGrid } = await fuels();

  const grid = await fuelGrid([...BOUNDS], SIZE);
  assert.equal(grid.warnings.length, 1);
  assert.match(grid.warnings[0]!, /[Cc]ap conjunt.*oficial/);
  /* An absent static dataset is a stable deployment fact already included in the cache key. */

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

test.each(['broken gzip', 'broken JSON', 'wrong response shape', 'invalid runs'])(
  'a cache with %s is rebuilt from source',
  async (kind) => {
    const { fuelGrid } = await fuels();
    const first = await fuelGrid([...BOUNDS], SIZE);
    const name = (await readdir(join(dir, 'cache')))[0]!;
    const broken =
      kind === 'broken gzip'
        ? Buffer.from('not a gzip file')
        : kind === 'broken JSON'
          ? gzipSync('{broken')
          : gzipSync(
              JSON.stringify(
                kind === 'wrong response shape'
                  ? { ...first, warnings: 'bad' }
                  : { ...first, runs: [8, 2, CELLS + 1] },
              ),
            );
    await writeFile(join(dir, 'cache', name), broken);

    const rebuilt = await fuelGrid([...BOUNDS], SIZE);
    assert.deepEqual(rebuilt.runs, [8, 2, CELLS]);
    assert.equal(fromUrl.mock.calls.length, 2, 'the damaged entry cannot be served');
  },
);

test.each([
  [
    'UNKNOWN with estimated quality',
    (grid: { runs: number[] }) => ({ ...grid, runs: [255, 2, CELLS] }),
  ],
  [
    'mismatched provenance totals',
    (grid: { runs: number[] }) => ({ ...grid, officialCells: CELLS, estimatedCells: 0 }),
  ],
  [
    'mismatched non-burnable total',
    (grid: { runs: number[] }) => ({ ...grid, nonBurnableCells: 1 }),
  ],
  [
    'mismatched model counts',
    (grid: { runs: number[] }) => ({ ...grid, models: [{ id: 8, cells: CELLS - 1 }] }),
  ],
  [
    'insecure source URL',
    (grid: { runs: number[]; sources: { sourceUrl: string }[] }) => ({
      ...grid,
      sources: grid.sources.map((source) => ({ ...source, sourceUrl: 'http://example.invalid/' })),
    }),
  ],
] as const)('a cache with %s is rebuilt from source', async (_kind, corrupt) => {
  const { fuelGrid } = await fuels();
  const first = await fuelGrid([...BOUNDS], SIZE);
  const name = (await readdir(join(dir, 'cache')))[0]!;
  await writeFile(join(dir, 'cache', name), gzipSync(JSON.stringify(corrupt(first))));

  const rebuilt = await fuelGrid([...BOUNDS], SIZE);
  assert.deepEqual(rebuilt.runs, [8, 2, CELLS]);
  assert.equal(fromUrl.mock.calls.length, 2, 'the incoherent entry cannot be served');
});

test('the same box asked twice at once is one job, and a third box is busy', async () => {
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
    /* Occupy both slots before asserting the limit, independently of filesystem scheduling. */

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
