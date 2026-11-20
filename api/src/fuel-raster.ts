import { fromFile } from 'geotiff';
import type { GeoTIFFImage } from 'geotiff';
import proj4 from 'proj4';
import { tileBounds, tileKeys, TILE_SIZE, UNKNOWN, type Bounds } from './fuel-grid.js';

type CoordinateTransform = (point: [number, number]) => number[];

interface RasterProjection {
  readonly forward: CoordinateTransform;
  readonly inverse: CoordinateTransform;
  readonly crs: string;
  readonly originX: number;
  readonly originY: number;
  readonly resolutionX: number;
  readonly resolutionY: number;
}

interface FuelRasterValues {
  readonly width: number;
  readonly height: number;
  readonly values: Uint8Array;
  readonly assigned: number;
  readonly missing: number;
}

interface PreparedFuelRaster {
  readonly assigned: number;
  readonly missing: number;
  readonly tiles: string[];
  readonly sourceCrs: string;
  readonly sourceResolution: [number, number];
  readonly sampling: 'native class at transformed pixel centre; nearest neighbour';
}

function defineUtmZones(): void {
  for (const zone of [28, 29, 30, 31]) {
    proj4.defs(`EPSG:326${zone}`, `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs`);
    proj4.defs(`EPSG:258${zone}`, `+proj=utm +zone=${zone} +ellps=GRS80 +units=m +no_defs`);
  }
}

function rasterCrs(image: GeoTIFFImage, crs?: string): string {
  const keys = image.getGeoKeys();
  const code = keys?.ProjectedCSTypeGeoKey ?? keys?.GeographicTypeGeoKey;
  if (!crs && (!code || code === 32767)) throw new Error('Raster needs a known CRS or --crs.');

  return crs ?? `EPSG:${code}`;
}

function rasterProjection(image: GeoTIFFImage, crs?: string): RasterProjection {
  const sourceCrs = rasterCrs(image, crs);
  const keys = image.getGeoKeys();

  const [originX, originY] = image.getOrigin();
  const [resolutionX, resolutionY] = image.getResolution();
  if (
    image.getSamplesPerPixel() !== 1 ||
    image.fileDirectory.getValue('ModelTransformation') ||
    ![originX, originY, resolutionX, resolutionY].every(Number.isFinite) ||
    resolutionX! <= 0 ||
    resolutionY! >= 0 ||
    keys?.GTRasterTypeGeoKey !== 1
  ) {
    throw new Error('Expected a north-up, pixel-area, single-band categorical GeoTIFF.');
  }

  const projection = proj4('EPSG:4326', sourceCrs);
  return {
    forward: (point) => projection.forward(point),
    inverse: (point) => projection.inverse(point),
    crs: sourceCrs,
    originX: originX!,
    originY: originY!,
    resolutionX: resolutionX!,
    resolutionY: resolutionY!,
  };
}

async function readFuelValues(
  image: GeoTIFFImage,
  excludedValues: readonly number[],
): Promise<FuelRasterValues> {
  const width = image.getWidth();
  const height = image.getHeight();
  if (width * height > 100_000_000) throw new Error('Raster too large; split it before importing.');

  const raw = await image.readRasters({ samples: [0], interleave: true });
  const noData = image.getGDALNoData();
  const values = new Uint8Array(width * height).fill(UNKNOWN);
  let assigned = 0,
    missing = 0;
  for (let i = 0; i < values.length; i++) {
    const value = Number(raw[i]);
    // Source 0 means 'sin modelo', not a fire barrier. NoData is checked first.
    if (
      value === noData ||
      excludedValues.includes(value) ||
      (Number.isNaN(value) && Number.isNaN(noData)) ||
      value === 0
    ) {
      missing++;
    } else if (Number.isInteger(value) && value >= 1 && value <= 13) {
      values[i] = value;
      assigned++;
    } else {
      throw new Error(`Unsupported NFFL raster code ${value}; verify the source classification.`);
    }
  }
  return { width, height, values, assigned, missing };
}

function geographicBounds(
  [west, south, east, north]: [number, number, number, number],
  inverse: CoordinateTransform,
): Bounds {
  // Densify the edges because a projected rectangle has curved geographic edges.
  const edge: number[][] = [];
  for (let i = 0; i <= 64; i++) {
    const x = west + ((east - west) * i) / 64;
    const y = south + ((north - south) * i) / 64;
    const points: [number, number][] = [
      [x, south],
      [x, north],
      [west, y],
      [east, y],
    ];
    for (const point of points) {
      edge.push(inverse(point));
    }
  }

  const bounds: Bounds = [
    Math.min(...edge.map((point) => point[0]!)),
    Math.min(...edge.map((point) => point[1]!)),
    Math.max(...edge.map((point) => point[0]!)),
    Math.max(...edge.map((point) => point[1]!)),
  ];
  if (
    !bounds.every(Number.isFinite) ||
    bounds[0] < -32 ||
    bounds[1] < 27 ||
    bounds[2] > 5 ||
    bounds[3] > 44.5
  ) {
    throw new Error('Raster outside Spain/Portugal: verify CRS.');
  }
  return bounds;
}

async function saveFuelTiles(
  bounds: Bounds,
  raster: FuelRasterValues,
  projection: RasterProjection,
  save: (key: string, values: Uint8Array) => void | Promise<void>,
): Promise<string[]> {
  const tiles: string[] = [];
  for (const [tx, ty] of tileKeys(bounds)) {
    const [west, south, east, north] = tileBounds(tx, ty);
    const tile = new Uint8Array(TILE_SIZE * TILE_SIZE).fill(UNKNOWN);
    let used = false;
    for (let row = 0; row < TILE_SIZE; row++) {
      const lat = north - ((row + 0.5) * (north - south)) / TILE_SIZE;
      for (let col = 0; col < TILE_SIZE; col++) {
        const lon = west + ((col + 0.5) * (east - west)) / TILE_SIZE;
        const [x, y] = projection.forward([lon, lat]);
        const px = Math.floor((x! - projection.originX) / projection.resolutionX);
        const py = Math.floor((y! - projection.originY) / projection.resolutionY);
        if (px < 0 || py < 0 || px >= raster.width || py >= raster.height) continue;
        const model = raster.values[py * raster.width + px]!;
        if (model === UNKNOWN) continue;
        tile[row * TILE_SIZE + col] = model;
        used = true;
      }
    }
    if (used) {
      const key = `${tx}_${ty}`;
      await save(key, tile);
      tiles.push(key);
    }
  }
  return tiles;
}

export async function prepareFuelRaster(
  input: string,
  save: (key: string, values: Uint8Array) => void | Promise<void>,
  crs?: string,
  excludedValues: readonly number[] = [],
): Promise<PreparedFuelRaster> {
  if (!excludedValues.every(Number.isFinite)) throw new Error('Invalid excluded raster codes.');
  defineUtmZones();
  const tiff = await fromFile(input);
  try {
    const image = await tiff.getImage();
    const projection = rasterProjection(image, crs);
    const raster = await readFuelValues(image, excludedValues);
    const bounds = geographicBounds(
      image.getBoundingBox() as [number, number, number, number],
      projection.inverse,
    );
    const tiles = await saveFuelTiles(bounds, raster, projection, save);
    return {
      assigned: raster.assigned,
      missing: raster.missing,
      tiles,
      sourceCrs: projection.crs,
      sourceResolution: [projection.resolutionX, Math.abs(projection.resolutionY)],
      sampling: 'native class at transformed pixel centre; nearest neighbour',
    };
  } finally {
    await tiff.close();
  }
}
