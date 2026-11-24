import { createHash } from 'node:crypto';
import { readFile, readdir, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fromUrl, type GeoTIFFImage, type TypedArrayWithDimensions } from 'geotiff';
import { writeFuelCache } from './fuel-cache.js';
import { isJsonObject, type JsonValue } from './json-value.js';
import {
  encodeRuns,
  tileBounds,
  tileKeys,
  TILE_SIZE,
  UNKNOWN,
  worldCoverModel,
  type Bounds,
} from './fuel-grid.js';

const FUEL_DATA_DIR = resolve(process.env['FUEL_DATA_DIR'] ?? 'data/fuels');
const FUEL_VERSION = 'anderson13-worldcover2021-v2';
interface FuelDataset {
  id: string;
  label: string;
  sourceUrl: string;
  attribution: string;
  sourceDate: string;
  preparedAt: string;
  tiles: string[];
  priority: number;
}
interface FuelResponse {
  version: string;
  bounds: Bounds;
  size: number;
  runs: number[];
  officialCells: number;
  estimatedCells: number;
  unknownCells: number;
  nonBurnableCells: number;
  models: { id: number; cells: number }[];
  sources: {
    label: string;
    sourceUrl: string;
    sourceDate: string;
    attribution: string;
  }[];
  warnings: string[];
  generatedAt: string;
}

const WC_ROOT = 'https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/';
export function worldCoverTile(lon: number, lat: number): string {
  const x = Math.floor(lon / 3) * 3,
    y = Math.floor(lat / 3) * 3;
  return `${y < 0 ? 'S' : 'N'}${Math.abs(y).toString().padStart(2, '0')}${x < 0 ? 'W' : 'E'}${Math.abs(x).toString().padStart(3, '0')}`;
}

function needsWorldCover(
  bounds: Bounds,
  size: number,
  quality: Uint8Array,
  tileWest: number,
  tileSouth: number,
): boolean {
  const [w, s, e, n] = bounds;
  const dx = (e - w) / size,
    dy = (n - s) / size;

  for (let row = 0; row < size; row++) {
    const lat = n - (row + 0.5) * dy;
    if (lat < tileSouth || lat >= tileSouth + 3) continue;
    for (let col = 0; col < size; col++) {
      const lon = w + (col + 0.5) * dx;
      if (lon >= tileWest && lon < tileWest + 3 && quality[row * size + col] !== 1) {
        return true;
      }
    }
  }
  return false;
}

interface WorldCoverWindow {
  readonly tileWestEdge: number;
  readonly tileNorth: number;
  readonly cellX: number;
  readonly cellY: number;
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

function worldCoverWindow(
  image: GeoTIFFImage,
  bounds: Bounds,
  tileWest: number,
  tileSouth: number,
): WorldCoverWindow | null {
  const [west, south, east, north] = bounds;
  const [tileWestEdge, , tileEastEdge, tileNorth] = image.getBoundingBox() as [
    number,
    number,
    number,
    number,
  ];
  const [resolutionX, resolutionY] = image.getResolution();
  const cellX = Math.abs(resolutionX!),
    cellY = Math.abs(resolutionY!);
  const x0 = Math.max(0, Math.floor((Math.max(west, tileWest) - tileWestEdge) / cellX));
  const x1 = Math.min(
    image.getWidth(),
    Math.ceil((Math.min(east, tileEastEdge) - tileWestEdge) / cellX),
  );
  const y0 = Math.max(0, Math.floor((tileNorth - Math.min(north, tileSouth + 3)) / cellY));
  const y1 = Math.min(
    image.getHeight(),
    Math.ceil((tileNorth - Math.max(south, tileSouth)) / cellY),
  );
  if (x1 <= x0 || y1 <= y0) return null;
  return { tileWestEdge, tileNorth, cellX, cellY, x0, y0, x1, y1 };
}

function applyWorldCoverValues(
  values: TypedArrayWithDimensions,
  window: WorldCoverWindow,
  tileWest: number,
  tileSouth: number,
  bounds: Bounds,
  size: number,
  models: Uint8Array,
  quality: Uint8Array,
): boolean {
  const [west, south, east, north] = bounds;
  const dx = (east - west) / size,
    dy = (north - south) / size;
  let uncovered = false;
  for (let row = 0; row < size; row++) {
    const lat = north - (row + 0.5) * dy;
    if (lat < tileSouth || lat >= tileSouth + 3) continue;
    const pixelY = Math.floor((window.tileNorth - lat) / window.cellY) - window.y0;
    for (let col = 0; col < size; col++) {
      const lon = west + (col + 0.5) * dx;
      if (lon < tileWest || lon >= tileWest + 3) continue;
      const index = row * size + col;
      if (quality[index] === 1) continue;
      const pixelX = Math.floor((lon - window.tileWestEdge) / window.cellX) - window.x0;
      if (
        pixelY < 0 ||
        pixelY >= window.y1 - window.y0 ||
        pixelX < 0 ||
        pixelX >= window.x1 - window.x0
      ) {
        uncovered = true;
        continue;
      }
      const model = worldCoverModel(Number(values[pixelY * (window.x1 - window.x0) + pixelX]));
      models[index] = model;
      quality[index] = model === UNKNOWN ? 0 : 2;
    }
  }
  return uncovered;
}

async function applyWorldCoverTile(
  id: string,
  tileWest: number,
  tileSouth: number,
  bounds: Bounds,
  size: number,
  models: Uint8Array,
  quality: Uint8Array,
  signal: AbortSignal,
): Promise<boolean> {
  const url = `${WC_ROOT}ESA_WorldCover_10m_2021_v200_${id}_Map.tif`;
  const tiff = await fromUrl(url, { allowFullFile: false }, signal);
  try {
    const image = await tiff.getImage();
    const window = worldCoverWindow(image, bounds, tileWest, tileSouth);
    if (!window) return true;

    const values = await image.readRasters({
      window: [window.x0, window.y0, window.x1, window.y1],
      samples: [0],
      interleave: true,
      signal,
    });
    return applyWorldCoverValues(
      values,
      window,
      tileWest,
      tileSouth,
      bounds,
      size,
      models,
      quality,
    );
  } finally {
    await tiff.close();
  }
}

/** Native class pixels, not RGB colours from a WMS or averaged overviews. */
async function readWorldCover(
  bounds: Bounds,
  size: number,
  models: Uint8Array,
  quality: Uint8Array,
  warnings: string[],
): Promise<void> {
  const [west, south, east, north] = bounds;
  for (let tileSouth = Math.floor(south / 3) * 3; tileSouth < north; tileSouth += 3) {
    for (let tileWest = Math.floor(west / 3) * 3; tileWest < east; tileWest += 3) {
      // Official coverage must not depend on the availability of the fallback.
      if (!needsWorldCover(bounds, size, quality, tileWest, tileSouth)) continue;
      const id = worldCoverTile(tileWest, tileSouth);
      try {
        const uncovered = await applyWorldCoverTile(
          id,
          tileWest,
          tileSouth,
          bounds,
          size,
          models,
          quality,
          AbortSignal.timeout(60000),
        );
        if (uncovered) {
          warnings.push(
            `WorldCover ${id}: el ràster no cobreix tota la zona sol·licitada; les cel·les sense altra font queden desconegudes. Tornar-ho a provar no servirà.`,
          );
        }
      } catch {
        warnings.push(
          `WorldCover ${id}: dades no disponibles; les cel·les sense altra font queden desconegudes.`,
        );
      }
    }
  }
}

async function datasets(warnings: string[]): Promise<FuelDataset[]> {
  let names: string[];
  try {
    names = await readdir(join(FUEL_DATA_DIR, 'datasets'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      // Warn when the official dataset is absent: a full-domain estimate is different from one
      // unreachable official tile.
      warnings.push(
        "Cap conjunt de combustible oficial configurat: tot el mapa surt estimat a partir d'ESA WorldCover.",
      );
      return [];
    }
    throw e;
  }
  const result: FuelDataset[] = [];
  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    if (!/^[a-z0-9-]+$/.test(name)) continue;
    try {
      const data = JSON.parse(
        await readFile(join(FUEL_DATA_DIR, 'datasets', name, 'manifest.json'), 'utf8'),
      ) as FuelDataset;
      if (data.id !== name || !Array.isArray(data.tiles))
        throw new Error(`Invalid fuel dataset ${name}`);
      result.push(data);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  return result.sort((a, b) => a.priority - b.priority);
}

async function overlay(
  data: FuelDataset,
  bounds: Bounds,
  size: number,
  models: Uint8Array,
  quality: Uint8Array,
): Promise<boolean> {
  const available = new Set(data.tiles);
  const [w, s, e, n] = bounds;
  let used = false;
  for (const [x, y] of tileKeys(bounds)) {
    const key = `${x}_${y}`;
    if (!available.has(key)) continue;
    const tile = await readFile(join(FUEL_DATA_DIR, 'datasets', data.id, `${key}.bin`));
    if (tile.length !== TILE_SIZE * TILE_SIZE)
      throw new Error(`Invalid fuel tile ${data.id}/${key}`);
    const [tw, ts, te, tn] = tileBounds(x, y);
    for (let row = 0; row < size; row++) {
      const lat = n - ((row + 0.5) * (n - s)) / size;
      if (lat < ts || lat >= tn) continue;
      const py = Math.min(TILE_SIZE - 1, Math.floor(((tn - lat) / (tn - ts)) * TILE_SIZE));
      for (let col = 0; col < size; col++) {
        const lon = w + ((col + 0.5) * (e - w)) / size;
        if (lon < tw || lon >= te) continue;
        const px = Math.min(TILE_SIZE - 1, Math.floor(((lon - tw) / (te - tw)) * TILE_SIZE));
        const model = tile[py * TILE_SIZE + px]!;
        if (model !== UNKNOWN) {
          if (model > 13) throw new Error('Invalid official fuel code');
          models[row * size + col] = model;
          quality[row * size + col] = 1;
          used = true;
        }
      }
    }
  }
  return used;
}

const inFlight = new Map<string, Promise<FuelResponse>>();
let busy = 0;
const MAX_REQUESTS = 2;
const FUEL_CACHE_MAX_AGE_MS = 30 * 86_400_000;

function isCount(value: JsonValue | undefined): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isSource(value: JsonValue): value is FuelResponse['sources'][number] {
  return (
    isJsonObject(value) &&
    typeof value['label'] === 'string' &&
    typeof value['sourceUrl'] === 'string' &&
    value['sourceUrl'].startsWith('https://') &&
    typeof value['sourceDate'] === 'string' &&
    typeof value['attribution'] === 'string'
  );
}

function isModel(value: JsonValue): value is FuelResponse['models'][number] {
  return (
    isJsonObject(value) &&
    isCount(value['id']) &&
    value['id'] >= 1 &&
    value['id'] <= 13 &&
    isCount(value['cells']) &&
    value['cells'] > 0
  );
}

function hasFuelHeader(value: JsonValue, bounds: Bounds, size: number): boolean {
  if (!isJsonObject(value)) return false;
  const cachedBounds = value['bounds'];
  if (value['version'] !== FUEL_VERSION || value['size'] !== size) return false;
  return (
    Array.isArray(cachedBounds) &&
    cachedBounds.length === bounds.length &&
    bounds.every((part, i) => cachedBounds[i] === part)
  );
}

function hasFuelCounts(value: JsonValue, cells: number): boolean {
  if (!isJsonObject(value)) return false;
  const official = value['officialCells'];
  const estimated = value['estimatedCells'];
  const missing = value['unknownCells'];
  const nonBurnable = value['nonBurnableCells'];
  return (
    isCount(official) &&
    isCount(estimated) &&
    isCount(missing) &&
    isCount(nonBurnable) &&
    official + estimated + missing === cells
  );
}

function hasFuelMetadata(value: JsonValue): boolean {
  if (!isJsonObject(value)) return false;
  const models = value['models'];
  const sources = value['sources'];
  const warnings = value['warnings'];
  const generatedAt = value['generatedAt'];
  return (
    Array.isArray(models) &&
    models.every(isModel) &&
    Array.isArray(sources) &&
    sources.every(isSource) &&
    Array.isArray(warnings) &&
    warnings.every((warning) => typeof warning === 'string') &&
    typeof generatedAt === 'string' &&
    Number.isFinite(Date.parse(generatedAt))
  );
}

interface FuelRunSummary {
  officialCells: number;
  estimatedCells: number;
  unknownCells: number;
  nonBurnableCells: number;
  models: Map<number, number>;
}

function isValidFuelTriple(
  value: JsonValue[],
  remaining: number,
): value is [number, number, number] {
  const [model, quality, count] = value;
  return (
    isCount(model) &&
    (model <= 13 || model === UNKNOWN) &&
    isCount(quality) &&
    quality <= 2 &&
    (model === UNKNOWN) === (quality === 0) &&
    isCount(count) &&
    count > 0 &&
    count <= remaining
  );
}

function summarizeFuelRuns(value: JsonValue | undefined, cells: number): FuelRunSummary | null {
  if (!Array.isArray(value) || !value.length || value.length % 3) return null;
  let length = 0;
  const summary: FuelRunSummary = {
    officialCells: 0,
    estimatedCells: 0,
    unknownCells: 0,
    nonBurnableCells: 0,
    models: new Map(),
  };
  for (let i = 0; i < value.length; i += 3) {
    const triple = value.slice(i, i + 3);
    if (!isValidFuelTriple(triple, cells - length)) return null;
    const [model, quality, count] = triple;
    length += count;
    if (quality === 1) summary.officialCells += count;
    else if (quality === 2) summary.estimatedCells += count;
    else summary.unknownCells += count;
    if (model === 0) summary.nonBurnableCells += count;
    else if (model !== UNKNOWN) summary.models.set(model, (summary.models.get(model) ?? 0) + count);
  }
  return length === cells ? summary : null;
}

function hasFuelEnvelope(value: JsonValue, bounds: Bounds, size: number): boolean {
  return (
    hasFuelHeader(value, bounds, size) &&
    hasFuelCounts(value, size * size) &&
    hasFuelMetadata(value)
  );
}

function matchesFuelSummary(
  summary: FuelRunSummary,
  officialCells: number,
  estimatedCells: number,
  unknownCells: number,
  nonBurnableCells: number,
  models: JsonValue[],
): boolean {
  return (
    summary.officialCells === officialCells &&
    summary.estimatedCells === estimatedCells &&
    summary.unknownCells === unknownCells &&
    summary.nonBurnableCells === nonBurnableCells &&
    summary.models.size === models.length &&
    models.every((model) => isModel(model) && summary.models.get(model.id) === model.cells)
  );
}

function readFuelResponse(value: JsonValue, bounds: Bounds, size: number): FuelResponse | null {
  if (!hasFuelEnvelope(value, bounds, size) || !isJsonObject(value)) return null;
  const runs = value['runs'];
  const models = value['models'];
  const sources = value['sources'];
  const warnings = value['warnings'];
  const officialCells = value['officialCells'];
  const estimatedCells = value['estimatedCells'];
  const unknownCells = value['unknownCells'];
  const nonBurnableCells = value['nonBurnableCells'];
  const generatedAt = value['generatedAt'];
  const summary = summarizeFuelRuns(runs, size * size);
  if (
    !summary ||
    !Array.isArray(runs) ||
    !Array.isArray(models) ||
    !Array.isArray(sources) ||
    !Array.isArray(warnings) ||
    !isCount(officialCells) ||
    !isCount(estimatedCells) ||
    !isCount(unknownCells) ||
    !isCount(nonBurnableCells) ||
    typeof generatedAt !== 'string'
  )
    return null;
  if (
    !matchesFuelSummary(
      summary,
      officialCells,
      estimatedCells,
      unknownCells,
      nonBurnableCells,
      models,
    )
  )
    return null;
  return {
    version: FUEL_VERSION,
    bounds,
    size,
    runs,
    officialCells,
    estimatedCells,
    unknownCells,
    nonBurnableCells,
    models,
    sources,
    warnings,
    generatedAt,
  };
}

async function readFuelCache(
  path: string,
  bounds: Bounds,
  size: number,
): Promise<FuelResponse | null> {
  let compressed: Buffer;
  try {
    if (Date.now() - (await stat(path)).mtimeMs >= FUEL_CACHE_MAX_AGE_MS) return null;
    compressed = await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return null;
  }
  try {
    return readFuelResponse(
      JSON.parse(gunzipSync(compressed).toString()) as JsonValue,
      bounds,
      size,
    );
  } catch {
    return null;
  }
}

function summarizeCells(models: Uint8Array, quality: Uint8Array) {
  let officialCells = 0,
    estimatedCells = 0,
    unknownCells = 0,
    nonBurnableCells = 0;
  const counts = new Map<number, number>();

  for (let i = 0; i < models.length; i++) {
    if (quality[i] === 1) officialCells++;
    else if (quality[i] === 2) estimatedCells++;
    else unknownCells++;
    if (models[i] === 0) nonBurnableCells++;
    if (models[i]! >= 1 && models[i]! <= 13)
      counts.set(models[i]!, (counts.get(models[i]!) ?? 0) + 1);
  }

  return {
    officialCells,
    estimatedCells,
    unknownCells,
    nonBurnableCells,
    models: [...counts].map(([id, cells]) => ({ id, cells })).sort((a, b) => b.cells - a.cells),
  };
}

async function pruneFuelCache(cacheDir: string): Promise<void> {
  const names = (await readdir(cacheDir)).filter((name) => /^[a-f0-9]{64}\.json\.gz$/.test(name));
  if (names.length <= 96) return;

  const found = await Promise.allSettled(
    names.map(async (name) => ({
      name,
      time: (await stat(join(cacheDir, name))).mtimeMs,
    })),
  );
  const files = found
    .flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
    .sort((a, b) => a.time - b.time);
  for (const file of files.slice(0, Math.max(0, files.length - 96)))
    await rm(join(cacheDir, file.name), { force: true });
}

async function cacheFuelResponse(
  cacheDir: string,
  path: string,
  response: FuelResponse,
  rasterUnreachable: boolean,
): Promise<void> {
  // Missing static datasets are a stable deployment fact; only failed WorldCover reads block caching.
  if (rasterUnreachable || response.unknownCells) return;

  const saved = await writeFuelCache(cacheDir, path, gzipSync(JSON.stringify(response)));
  if (saved) await pruneFuelCache(cacheDir);
}

async function buildFuelResponse(
  bounds: Bounds,
  size: number,
  maps: readonly FuelDataset[],
  warnings: string[],
  cacheDir: string,
  path: string,
): Promise<FuelResponse> {
  const models = new Uint8Array(size * size).fill(UNKNOWN);
  const quality = new Uint8Array(size * size);
  const sources: FuelResponse['sources'] = [];
  for (const data of maps) {
    if (await overlay(data, bounds, size, models, quality)) sources.push(data);
  }

  const warningsBeforeRaster = warnings.length;
  await readWorldCover(bounds, size, models, quality, warnings);
  const rasterUnreachable = warnings.length > warningsBeforeRaster;
  const summary = summarizeCells(models, quality);
  if (summary.estimatedCells) {
    sources.push({
      label: 'ESA WorldCover 2021 · estimació Anderson v2',
      sourceDate: '2021',
      sourceUrl: 'https://esa-worldcover.org/en/data-access',
      attribution:
        '© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · CC BY 4.0',
    });
  }

  const response: FuelResponse = {
    version: FUEL_VERSION,
    bounds,
    size,
    runs: encodeRuns(models, quality),
    ...summary,
    sources: sources.map(({ label, sourceUrl, sourceDate, attribution }) => ({
      label,
      sourceUrl,
      sourceDate,
      attribution,
    })),
    warnings,
    generatedAt: new Date().toISOString(),
  };
  await cacheFuelResponse(cacheDir, path, response, rasterUnreachable);
  return response;
}

export async function fuelGrid(bounds: Bounds, size: number): Promise<FuelResponse> {
  const warnings: string[] = [];
  const maps = await datasets(warnings);
  const key = createHash('sha256')
    .update(JSON.stringify([FUEL_VERSION, 'official-first-v1', bounds, size, maps]))
    .digest('hex');
  const cacheDir = join(FUEL_DATA_DIR, 'cache');
  const path = join(cacheDir, `${key}.json.gz`);
  const cached = await readFuelCache(path, bounds, size);
  if (cached) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;
  if (busy >= MAX_REQUESTS) throw new Error('FUEL_BUSY');
  busy++;
  const job = buildFuelResponse(bounds, size, maps, warnings, cacheDir, path);
  inFlight.set(key, job);
  try {
    return await job;
  } finally {
    inFlight.delete(key);
    busy--;
  }
}
