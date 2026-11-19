import { createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { resolve, join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { fromUrl } from "geotiff";
import {
  encodeRuns,
  tileBounds,
  tileKeys,
  TILE_SIZE,
  UNKNOWN,
  worldCoverModel,
  type Bounds,
} from "./fuel-grid.js";

export const FUEL_DATA_DIR = resolve(process.env.FUEL_DATA_DIR ?? "data/fuels");
export const FUEL_VERSION = "anderson13-worldcover2021-v2";
export interface FuelDataset {
  id: string;
  label: string;
  sourceUrl: string;
  attribution: string;
  sourceDate: string;
  preparedAt: string;
  tiles: string[];
  priority: number;
}
export interface FuelResponse {
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

const WC_ROOT =
  "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/";
export function worldCoverTile(lon: number, lat: number): string {
  const x = Math.floor(lon / 3) * 3,
    y = Math.floor(lat / 3) * 3;
  return `${y < 0 ? "S" : "N"}${Math.abs(y).toString().padStart(2, "0")}${x < 0 ? "W" : "E"}${Math.abs(x).toString().padStart(3, "0")}`;
}

/** Native class pixels, not RGB colours from a WMS or averaged overviews. */
async function readWorldCover(
  bounds: Bounds,
  size: number,
  models: Uint8Array,
  quality: Uint8Array,
  warnings: string[],
) {
  const [w, s, e, n] = bounds;
  const dx = (e - w) / size,
    dy = (n - s) / size;
  for (let lat = Math.floor(s / 3) * 3; lat < n; lat += 3) {
    for (let lon = Math.floor(w / 3) * 3; lon < e; lon += 3) {
      const id = worldCoverTile(lon, lat);
      const url = `${WC_ROOT}ESA_WorldCover_10m_2021_v200_${id}_Map.tif`;
      const signal = AbortSignal.timeout(60000);
      try {
        const tiff = await fromUrl(url, { allowFullFile: false }, signal);
        try {
          const image = await tiff.getImage();
          const [tw, , te, tn] = image.getBoundingBox() as [
            number,
            number,
            number,
            number,
          ];
          const [rx, ry] = image.getResolution();
          const cellX = Math.abs(rx!),
            cellY = Math.abs(ry!);
          const x0 = Math.max(0, Math.floor((Math.max(w, lon) - tw) / cellX));
          const x1 = Math.min(
            image.getWidth(),
            Math.ceil((Math.min(e, te) - tw) / cellX),
          );
          const y0 = Math.max(
            0,
            Math.floor((tn - Math.min(n, lat + 3)) / cellY),
          );
          const y1 = Math.min(
            image.getHeight(),
            Math.ceil((tn - Math.max(s, lat)) / cellY),
          );
          if (x1 <= x0 || y1 <= y0) continue;
          const values = await image.readRasters({
            window: [x0, y0, x1, y1],
            samples: [0],
            interleave: true,
            signal,
          });
          for (let row = 0; row < size; row++) {
            const y = n - (row + 0.5) * dy;
            if (y < lat || y >= lat + 3) continue;
            const py = Math.floor((tn - y) / cellY) - y0;
            for (let col = 0; col < size; col++) {
              const x = w + (col + 0.5) * dx;
              if (x < lon || x >= lon + 3) continue;
              const px = Math.floor((x - tw) / cellX) - x0;
              const model = worldCoverModel(
                Number(values[py * (x1 - x0) + px]),
              );
              const i = row * size + col;
              models[i] = model;
              quality[i] = model === UNKNOWN ? 0 : 2;
            }
          }
        } finally {
          await tiff.close();
        }
      } catch {
        warnings.push(
          `WorldCover ${id}: dades no disponibles; les cel·les sense altra font queden desconegudes.`,
        );
      }
    }
  }
}

async function datasets(): Promise<FuelDataset[]> {
  let names: string[];
  try {
    names = await readdir(join(FUEL_DATA_DIR, "datasets"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw e;
  }
  const result: FuelDataset[] = [];
  for (const name of names.sort((a, b) => a.localeCompare(b))) {
    if (!/^[a-z0-9-]+$/.test(name)) continue;
    try {
      const data = JSON.parse(
        await readFile(
          join(FUEL_DATA_DIR, "datasets", name, "manifest.json"),
          "utf8",
        ),
      ) as FuelDataset;
      if (data.id !== name || !Array.isArray(data.tiles))
        throw new Error(`Invalid fuel dataset ${name}`);
      result.push(data);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
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
    const tile = await readFile(
      join(FUEL_DATA_DIR, "datasets", data.id, `${key}.bin`),
    );
    if (tile.length !== TILE_SIZE * TILE_SIZE)
      throw new Error(`Invalid fuel tile ${data.id}/${key}`);
    const [tw, ts, te, tn] = tileBounds(x, y);
    for (let row = 0; row < size; row++) {
      const lat = n - ((row + 0.5) * (n - s)) / size;
      if (lat < ts || lat >= tn) continue;
      const py = Math.min(
        TILE_SIZE - 1,
        Math.floor(((tn - lat) / (tn - ts)) * TILE_SIZE),
      );
      for (let col = 0; col < size; col++) {
        const lon = w + ((col + 0.5) * (e - w)) / size;
        if (lon < tw || lon >= te) continue;
        const px = Math.min(
          TILE_SIZE - 1,
          Math.floor(((lon - tw) / (te - tw)) * TILE_SIZE),
        );
        const model = tile[py * TILE_SIZE + px]!;
        if (model !== UNKNOWN) {
          if (model > 13) throw new Error("Invalid official fuel code");
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

export async function fuelGrid(
  bounds: Bounds,
  size: number,
): Promise<FuelResponse> {
  const maps = await datasets();
  const key = createHash("sha256")
    .update(JSON.stringify([FUEL_VERSION, bounds, size, maps]))
    .digest("hex");
  const cacheDir = join(FUEL_DATA_DIR, "cache");
  const path = join(cacheDir, `${key}.json.gz`);
  try {
    if (Date.now() - (await stat(path)).mtimeMs < 30 * 86400000)
      return JSON.parse(
        gunzipSync(await readFile(path)).toString(),
      ) as FuelResponse;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const pending = inFlight.get(key);
  if (pending) return pending;
  if (busy >= MAX_REQUESTS) throw new Error("FUEL_BUSY");
  busy++;
  const job = (async () => {
    const models = new Uint8Array(size * size).fill(UNKNOWN),
      quality = new Uint8Array(size * size);
    const warnings: string[] = [];
    const sources: FuelResponse["sources"] = [];
    await readWorldCover(bounds, size, models, quality, warnings);
    for (const data of maps)
      if (await overlay(data, bounds, size, models, quality))
        sources.push(data);
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
    if (estimatedCells)
      sources.push({
        label: "ESA WorldCover 2021 · estimació Anderson v2",
        sourceDate: "2021",
        sourceUrl: "https://esa-worldcover.org/en/data-access",
        attribution:
          "© ESA WorldCover project 2021 / Contains modified Copernicus Sentinel data (2021) processed by ESA WorldCover consortium · CC BY 4.0",
      });
    const result: FuelResponse = {
      version: FUEL_VERSION,
      bounds,
      size,
      runs: encodeRuns(models, quality),
      officialCells,
      estimatedCells,
      unknownCells,
      nonBurnableCells,
      models: [...counts]
        .map(([id, cells]) => ({ id, cells }))
        .sort((a, b) => b.cells - a.cells),
      sources: sources.map(({ label, sourceUrl, sourceDate, attribution }) => ({
        label,
        sourceUrl,
        sourceDate,
        attribution,
      })),
      warnings,
      generatedAt: new Date().toISOString(),
    };
    // Failed upstream reads must be retryable, not preserved for a month.
    if (!warnings.length && !unknownCells) {
      await mkdir(cacheDir, { recursive: true });
      await writeFile(path + ".tmp", gzipSync(JSON.stringify(result)));
      await rename(path + ".tmp", path);
      const names = (await readdir(cacheDir)).filter((s) =>
        /^[a-f0-9]{64}\.json\.gz$/.test(s),
      );
      if (names.length > 96) {
        const found = await Promise.allSettled(
          names.map(async (name) => ({
            name,
            time: (await stat(join(cacheDir, name))).mtimeMs,
          })),
        );
        const files = found.flatMap((result) =>
          result.status === "fulfilled" ? [result.value] : [],
        );
        files.sort((a, b) => a.time - b.time);
        for (const file of files.slice(0, Math.max(0, files.length - 96)))
          await rm(join(cacheDir, file.name), { force: true });
      }
    }
    return result;
  })();
  inFlight.set(key, job);
  try {
    return await job;
  } finally {
    inFlight.delete(key);
    busy--;
  }
}
