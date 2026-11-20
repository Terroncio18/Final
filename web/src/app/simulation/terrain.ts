import { DEM_TILES } from '../map/map.config';
import { CELL_M, domainAround, GRID } from './domain';
import type { Point } from './point';

// At zoom 12, Terrarium pixels span about 27–34 m in the study area, matching 30 m cells. Zoom 13
// quadruples tile work without finer source detail.
const ZOOM = 12;

const TILE = 256;

/** Terrarium packs metres into the three colour channels, with a 32.768 m offset. */
function decode(red: number, green: number, blue: number): number {
  return red * 256 + green + blue / 256 - 32768;
}

/** Web Mercator pixel coordinates at our zoom, as floats. */
function toWorld(lon: number, lat: number): [number, number] {
  const scale = TILE * 2 ** ZOOM;
  const x = ((lon + 180) / 360) * scale;
  const sin = Math.sin((lat * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return [x, y];
}

async function fetchTile(x: number, y: number): Promise<ImageBitmap> {
  const url = DEM_TILES.replace('{z}', String(ZOOM))
    .replace('{x}', String(x))
    .replace('{y}', String(y));
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return createImageBitmap(await response.blob());
}

export interface Terrain {
  /** Metres above sea level, row by row from north to south. */
  readonly elevation: Float32Array;
  /** Degrees from horizontal, the same shape as the elevation. */
  readonly slope: Float32Array;
  readonly minElevation: number;
  readonly maxElevation: number;
  readonly maxSlope: number;
  readonly meanSlope: number;

  readonly tiles: number;
}

type DomainBounds = ReturnType<typeof domainAround>;

interface TerrainMosaic {
  readonly pixels: Uint8ClampedArray;
  readonly width: number;
  readonly height: number;
  readonly originX: number;
  readonly originY: number;
  readonly tiles: number;
}

async function loadTerrainTiles([west, south, east, north]: DomainBounds): Promise<TerrainMosaic> {
  const [x0, y0] = toWorld(west, north);
  const [x1, y1] = toWorld(east, south);

  const tileX0 = Math.floor(x0 / TILE);
  const tileY0 = Math.floor(y0 / TILE);
  const tileX1 = Math.floor(x1 / TILE);
  const tileY1 = Math.floor(y1 / TILE);

  const across = tileX1 - tileX0 + 1;
  const down = tileY1 - tileY0 + 1;

  // Read one assembled canvas; repeated getImageData calls cost more than tile drawing.
  const canvas = new OffscreenCanvas(across * TILE, down * TILE);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('sense context 2d');

  const requests: Promise<void>[] = [];
  for (let ty = tileY0; ty <= tileY1; ty += 1) {
    for (let tx = tileX0; tx <= tileX1; tx += 1) {
      requests.push(
        fetchTile(tx, ty).then((bitmap) => {
          context.drawImage(bitmap, (tx - tileX0) * TILE, (ty - tileY0) * TILE);
          bitmap.close();
        }),
      );
    }
  }
  await Promise.all(requests);

  return {
    pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
    originX: tileX0 * TILE,
    originY: tileY0 * TILE,
    tiles: across * down,
  };
}

function decodeHeights({ pixels, width, height }: TerrainMosaic): Float32Array {
  // Decode metres once rather than four times per bilinear sample.
  const heights = new Float32Array(width * height);
  for (let i = 0, p = 0; i < heights.length; i += 1, p += 4) {
    heights[i] = decode(pixels[p], pixels[p + 1], pixels[p + 2]);
  }
  return heights;
}

// The grid is regular in longitude and latitude; its cell widths vary slightly across the domain.
function sampleElevation(
  [west, south, east, north]: DomainBounds,
  mosaic: TerrainMosaic,
  heights: Float32Array,
): Pick<Terrain, 'elevation' | 'minElevation' | 'maxElevation'> {
  const { originX, originY, width, height: rasterHeight } = mosaic;
  const elevation = new Float32Array(GRID * GRID);

  let minElevation = Infinity;
  let maxElevation = -Infinity;

  for (let row = 0; row < GRID; row += 1) {
    // Cell centres, not edges: a cell stands for the ground under it.
    const lat = north - ((row + 0.5) / GRID) * (north - south);
    for (let column = 0; column < GRID; column += 1) {
      const lon = west + ((column + 0.5) / GRID) * (east - west);
      const [wx, wy] = toWorld(lon, lat);

      const px = wx - originX;
      const py = wy - originY;
      const ix = Math.min(Math.max(Math.floor(px), 0), width - 2);
      const iy = Math.min(Math.max(Math.floor(py), 0), rasterHeight - 2);
      const fx = px - ix;
      const fy = py - iy;

      const index = iy * width + ix;
      const top = heights[index] * (1 - fx) + heights[index + 1] * fx;
      const bottom = heights[index + width] * (1 - fx) + heights[index + width + 1] * fx;
      const height = top * (1 - fy) + bottom * fy;

      elevation[row * GRID + column] = height;
      if (height < minElevation) minElevation = height;
      if (height > maxElevation) maxElevation = height;
    }
  }

  return { elevation, minElevation, maxElevation };
}

export async function readTerrain(point: Point): Promise<Terrain> {
  const bounds = domainAround(point);
  const mosaic = await loadTerrainTiles(bounds);
  const heights = decodeHeights(mosaic);
  const sampled = sampleElevation(bounds, mosaic, heights);
  return { ...sampled, ...slopeOf(sampled.elevation), tiles: mosaic.tiles };
}

// Central-difference slope, in degrees. Border cells reuse their interior neighbour.
function slopeOf(elevation: Float32Array): {
  slope: Float32Array;
  maxSlope: number;
  meanSlope: number;
} {
  const slope = new Float32Array(GRID * GRID);
  const span = 2 * CELL_M;

  let maxSlope = 0;
  let total = 0;

  for (let row = 1; row < GRID - 1; row += 1) {
    for (let column = 1; column < GRID - 1; column += 1) {
      const index = row * GRID + column;
      const dzdx = (elevation[index + 1] - elevation[index - 1]) / span;
      const dzdy = (elevation[index + GRID] - elevation[index - GRID]) / span;
      const degrees = (Math.atan(Math.hypot(dzdx, dzdy)) * 180) / Math.PI;
      slope[index] = degrees;
      if (degrees > maxSlope) maxSlope = degrees;
      total += degrees;
    }
  }

  const inner = (GRID - 2) * (GRID - 2);
  return { slope, maxSlope, meanSlope: total / inner };
}

// Rows run north to south; coordinates select cell areas rather than grid vertices.
export function cellOf(centre: Point, place: Point): number | null {
  const [west, south, east, north] = domainAround(centre);
  const column = Math.floor(((place[0] - west) / (east - west)) * GRID);
  const row = Math.floor(((north - place[1]) / (north - south)) * GRID);
  if (column < 0 || column >= GRID || row < 0 || row >= GRID) return null;
  return row * GRID + column;
}

// Read slope one cell in from the border because slopeOf leaves its uncomputable border at zero.
export function groundAt(
  terrain: Terrain,
  centre: Point,
  place: Point,
): { elevation: number; slope: number } | null {
  const cell = cellOf(centre, place);
  if (cell === null) return null;
  const column = cell % GRID;
  const row = (cell - column) / GRID;

  const inner = (value: number) => Math.min(Math.max(value, 1), GRID - 2);
  return {
    elevation: terrain.elevation[row * GRID + column],
    slope: terrain.slope[inner(row) * GRID + inner(column)],
  };
}
