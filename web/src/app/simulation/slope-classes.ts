import { GRID } from './domain';
import type { Terrain } from './terrain';

/**
 * The bands the slope layer is painted in.
 *
 * **They are this project's and nobody else's.** There is no standard set of
 * slope classes for wildfire —as there is no FRP threshold (§2.17)— so these
 * are cuts for reading a map and not thresholds of the model, which takes the
 * slope of each cell as a number and never sees a class.
 *
 * One hue from light to dark, so the order survives a greyscale print, and
 * violet because every other candidate already means something on this map:
 * orange and red are fire (§2.22), green is what the photograph underneath is
 * made of, and white is an administrative line.
 */
export const SLOPE_CLASSES = [
  { upTo: 5, label: '0–5°', colour: '#efe6fb' },
  { upTo: 15, label: '5–15°', colour: '#cdb4f0' },
  { upTo: 25, label: '15–25°', colour: '#a57fe0' },
  { upTo: 35, label: '25–35°', colour: '#7a4bc9' },
  { upTo: Infinity, label: '> 35°', colour: '#4c1d95' },
] as const;

function rgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16, (value >> 8) & 255, value & 255];
}

/**
 * The slope of a domain as a picture: one pixel per cell, one colour per band.
 *
 * A data URL and not a set of polygons: the grid is already a raster, and a
 * million cells traced into shapes would be megabytes of geometry to say what
 * 1024 × 1024 pixels say exactly. Rows run north to south in the grid and in
 * the image alike, so there is nothing to flip.
 *
 * The border row and column take the cell inside them, as the reading under
 * the pointer does: slopeOf() has no neighbour to difference against there.
 */
export function slopeImage(terrain: Terrain): string {
  const canvas = document.createElement('canvas');
  canvas.width = GRID;
  canvas.height = GRID;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('sense context 2d');

  const colours = SLOPE_CLASSES.map((band) => rgb(band.colour));
  const image = context.createImageData(GRID, GRID);
  const inner = (value: number) => Math.min(Math.max(value, 1), GRID - 2);

  for (let row = 0; row < GRID; row += 1) {
    for (let column = 0; column < GRID; column += 1) {
      const degrees = terrain.slope[inner(row) * GRID + inner(column)];
      const band = SLOPE_CLASSES.findIndex((each) => degrees < each.upTo);
      const [red, green, blue] = colours[band];

      const pixel = (row * GRID + column) * 4;
      image.data[pixel] = red;
      image.data[pixel + 1] = green;
      image.data[pixel + 2] = blue;
      image.data[pixel + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}
