import { GRID } from './domain';
import type { Terrain } from './terrain';

// These slope bands are presentation choices, not thresholds used by the model. A monotonic
// light/dark ramp preserves order in greyscale.
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

// One image pixel per grid cell, north to south. Border samples use the nearest interior cell
// because central slope differences need neighbours.
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
