import type { Map as MapLibreMap } from 'maplibre-gl';

import type { ResourceKind } from '../simulation/resources';

/** The green of suppression: what puts the fire out, apart from the fire's orange. */
const GREEN = '#2f9e5b';
const SIZE = 22;
const RATIO = 2;

/**
 * White glyphs on a 24-unit box, as SVG path data: a house for a station, a
 * drop for a water point, a plane for an aerodrome.
 */
const GLYPHS: Readonly<Record<ResourceKind, string>> = {
  station: 'M12 5 5 11v8h5v-5h4v5h5v-8Z',
  water: 'M12 4c3 4.2 5.5 7.4 5.5 10.2A5.5 5.5 0 0 1 6.5 14.2C6.5 11.4 9 8.2 12 4Z',
  aerodrome:
    'M11 4h2l.6 6 5.9 3v2l-5.9-1.6-.5 4.1 2 1.5v1.5L12 19.6 8.9 20.5V19l2-1.5-.5-4.1L4.5 15v-2l5.9-3Z',
};

/** Adds the three marks to the style once; a new style starts without them. */
export function addResourceIcons(map: MapLibreMap): void {
  for (const kind of Object.keys(GLYPHS) as ResourceKind[]) {
    const id = `resource-${kind}`;
    if (map.hasImage(id)) continue;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE * RATIO;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(RATIO, RATIO);
    context.beginPath();
    context.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1.5, 0, Math.PI * 2);
    context.fillStyle = GREEN;
    context.fill();
    context.lineWidth = 1.5;
    context.strokeStyle = '#ffffff';
    context.stroke();
    context.save();
    context.translate(SIZE / 2 - 12 * 0.75, SIZE / 2 - 12 * 0.75);
    context.scale(0.75, 0.75);
    context.fillStyle = '#ffffff';
    context.fill(new Path2D(GLYPHS[kind]));
    context.restore();
    map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), {
      pixelRatio: RATIO,
    });
  }
}
