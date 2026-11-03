import { DEM_TILES } from '../map/map.config';
import { CELL_M, domainAround, GRID, SIDE_M } from './domain';
import type { Point } from './point';

/**
 * Zoom level of the elevation tiles we read.
 *
 * A Terrarium pixel at zoom z covers 156.543 * cos(lat) / 2^z metres, so at
 * zoom 12 that is 27 m in the north of the peninsula and 34 m in the Canaries:
 * either side of the 30 m cell, which is what we want. Zoom 13 would be four
 * times the tiles for detail the source does not have — underneath it is SRTM
 * and EU-DEM, both built around 30 m.
 */
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
  /** How many tiles were read, which is what the wait was spent on. */
  readonly tiles: number;
}

/**
 * Reads the elevation under a domain and works out its slope.
 *
 * The grid is regular in longitude and latitude rather than in metres. Across
 * 30 km the cosine of the latitude changes by 0,4%, so a cell is between 29,94
 * and 30,07 m wide instead of exactly 30: under a tenth of a metre, which is
 * nothing next to what a 30 m elevation model knows.
 */
export async function readTerrain(point: Point): Promise<Terrain> {
  const [west, south, east, north] = domainAround(point);

  const [x0, y0] = toWorld(west, north);
  const [x1, y1] = toWorld(east, south);

  const tileX0 = Math.floor(x0 / TILE);
  const tileY0 = Math.floor(y0 / TILE);
  const tileX1 = Math.floor(x1 / TILE);
  const tileY1 = Math.floor(y1 / TILE);

  const across = tileX1 - tileX0 + 1;
  const down = tileY1 - tileY0 + 1;

  // One canvas for every tile at once: the alternative is a getImageData per
  // tile, and that call is the expensive part, not the drawing.
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

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

  // Decoded once into metres. Doing it inside the sampling loop would decode
  // every pixel four times over, once per bilinear neighbour.
  const heights = new Float32Array(canvas.width * canvas.height);
  for (let i = 0, p = 0; i < heights.length; i += 1, p += 4) {
    heights[i] = decode(pixels[p], pixels[p + 1], pixels[p + 2]);
  }

  const originX = tileX0 * TILE;
  const originY = tileY0 * TILE;
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
      const ix = Math.min(Math.max(Math.floor(px), 0), canvas.width - 2);
      const iy = Math.min(Math.max(Math.floor(py), 0), canvas.height - 2);
      const fx = px - ix;
      const fy = py - iy;

      const index = iy * canvas.width + ix;
      const top = heights[index] * (1 - fx) + heights[index + 1] * fx;
      const bottom =
        heights[index + canvas.width] * (1 - fx) + heights[index + canvas.width + 1] * fx;
      const height = top * (1 - fy) + bottom * fy;

      elevation[row * GRID + column] = height;
      if (height < minElevation) minElevation = height;
      if (height > maxElevation) maxElevation = height;
    }
  }

  return { elevation, ...slopeOf(elevation), minElevation, maxElevation, tiles: across * down };
}

/**
 * Slope in degrees, by central differences.
 *
 * One of the three inputs Rothermel takes, which is why the elevation is read
 * at all: the model does not care how high the ground is, only how steeply it
 * tilts. The border keeps its neighbour's value rather than inventing one.
 */
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

/** The side of the domain in metres, re-exported so callers need one import. */
export { SIDE_M };
