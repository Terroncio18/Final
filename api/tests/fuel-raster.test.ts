import { afterEach, beforeEach, test } from 'vitest';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeArrayBuffer, type GeotiffWriterMetadata } from 'geotiff';
import { prepareFuelRaster } from '../src/fuel-raster.js';
import { TILE_SIZE, UNKNOWN } from '../src/fuel-grid.js';

let dir: string;
test('source-specific ambiguous classes fall back instead of being labelled official', async () => {
  const input = await raster([4, 7, 21, 8]);
  const tiles = new Map<string, Uint8Array>();
  const result = await prepareFuelRaster(
    input,
    (key, tile) => {
      tiles.set(key, tile);
    },
    undefined,
    [-128, 7, 21],
  );
  assert.equal(result.assigned, 2);
  assert.equal(result.missing, 2);
  const tile = tiles.get('-132_227')!;
  assert.equal(tile[0], 4);
  assert.equal(tile[TILE_SIZE - 1], UNKNOWN);
  assert.equal(tile[tile.length - 1], 8);
});
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'ignislab-raster-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function raster(values: number[], metadata: GeotiffWriterMetadata = {}) {
  const path = join(dir, 'official.tif');
  const bytes = writeArrayBuffer(new Uint16Array(values), {
    width: 2,
    height: 2,
    BitsPerSample: [16],
    SamplesPerPixel: 1,
    ModelPixelScale: [0.0625, 0.0625, 0],
    ModelTiepoint: [0, 0, 0, -16.5, 28.5, 0],
    GeographicTypeGeoKey: 4326,
    GTModelTypeGeoKey: 2,
    GTRasterTypeGeoKey: 1,
    GDAL_NODATA: '32767',
    ...metadata,
  });
  await writeFile(path, Buffer.from(bytes));
  return path;
}

test('native categorical pixels retain north/south orientation; zero and NoData stay unknown', async () => {
  const input = await raster([1, 8, 0, 32767]);
  const tiles = new Map<string, Uint8Array>();
  const result = await prepareFuelRaster(input, (key, tile) => {
    tiles.set(key, tile);
  });
  assert.equal(result.assigned, 2);
  assert.equal(result.missing, 2);
  assert.equal(result.sourceCrs, 'EPSG:4326');
  assert.deepEqual(result.tiles, ['-132_227']);
  const tile = tiles.get('-132_227')!;
  assert.equal(tile[0], 1);
  assert.equal(tile[TILE_SIZE - 1], 8);
  assert.equal(tile[TILE_SIZE * (TILE_SIZE - 1)], UNKNOWN);
  assert.equal(tile[tile.length - 1], UNKNOWN);
  assert.deepEqual(
    [...new Set(tile)].sort((a, b) => a - b),
    [1, 8, UNKNOWN],
  );
});

test('UTM class pixels are sampled in WGS84 at cell centres without class interpolation', async () => {
  const input = await raster([4, 7, 8, 9], {
    GeographicTypeGeoKey: undefined,
    ProjectedCSTypeGeoKey: 32628,
    GTModelTypeGeoKey: 1,
    ModelPixelScale: [1000, 1000, 0],
    ModelTiepoint: [0, 0, 0, 350000, 3150000, 0],
  });
  const all = new Set<number>();
  const result = await prepareFuelRaster(input, (_, tile) => {
    for (const value of tile) all.add(value);
  });
  assert.equal(result.sourceCrs, 'EPSG:32628');
  assert.deepEqual(result.sourceResolution, [1000, 1000]);
  assert.deepEqual(
    [...all].sort((a, b) => a - b),
    [4, 7, 8, 9, UNKNOWN],
  );
});

test('national Portuguese or Canary subtype codes cannot silently become Anderson models', async () => {
  for (const code of [227, 41, 99]) {
    const input = await raster([1, 2, code, 3]);
    let writes = 0;
    await assert.rejects(
      prepareFuelRaster(input, () => {
        writes++;
      }),
      /Unsupported NFFL raster code/,
    );
    assert.equal(writes, 0, 'validation happens before any tile is written');
  }
});

test('NoData takes precedence even when its numeric value is a valid model', async () => {
  const input = await raster([1, 1, 1, 1], { GDAL_NODATA: '1' });
  const result = await prepareFuelRaster(input, () => {
    assert.fail('empty tiles must not be published');
  });
  assert.equal(result.assigned, 0);
  assert.deepEqual(result.tiles, []);
});

test('a wrongly georeferenced raster fails instead of painting a different country', async () => {
  const input = await raster([1, 2, 3, 4], {
    ModelTiepoint: [0, 0, 0, 80, 50, 0],
  });
  await assert.rejects(
    prepareFuelRaster(input, () => {}),
    /outside Spain\/Portugal/,
  );
});

test('pixel-point rasters need an explicit alignment adaptation', async () => {
  const input = await raster([1, 2, 3, 4], { GTRasterTypeGeoKey: 2 });
  await assert.rejects(
    prepareFuelRaster(input, () => {}),
    /pixel-area/,
  );
});
