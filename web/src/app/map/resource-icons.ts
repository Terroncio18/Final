import type { Map as MapLibreMap } from 'maplibre-gl';

import type { AgentKind } from '../simulation/agents';
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

/**
 * Who is working (12.20), in the yellow of a high-visibility vest so they
 * read apart from the green places they come from: a person for a crew, a
 * rotor for a helicopter, a plane for the rest.
 */
const AGENT_GLYPHS: Readonly<Record<AgentKind, string>> = {
  crew: 'M12 4.5a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6ZM8.5 10.5h7l-1 5h-1.3l-.7 4h-3l-.7-4H9.5Z',
  helicopter:
    'M4 6.5h16v1.4h-7.3v1.6c2.6.3 4.3 2 4.3 4.2 0 1.7-1 3-2.6 3.6l1.3 2.2h-1.7l-1.1-1.9h-2.4l-1 1.9H7.8l1.3-2.3A4 4 0 0 1 7 13.7c0-2.2 1.8-3.9 4.3-4.2V7.9H4Z',
  plane: GLYPHS.aerodrome,
};

/** Adds the marks to the style once; a new style starts without them. */
export function addResourceIcons(map: MapLibreMap): void {
  for (const kind of Object.keys(GLYPHS) as ResourceKind[])
    addIcon(map, `resource-${kind}`, GLYPHS[kind], GREEN, '#ffffff');
  for (const kind of Object.keys(AGENT_GLYPHS) as AgentKind[])
    addIcon(map, `agent-${kind}`, AGENT_GLYPHS[kind], '#f2c94c', '#1b2329');
}

function addIcon(map: MapLibreMap, id: string, glyph: string, disc: string, ink: string): void {
  if (map.hasImage(id)) return;
  {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIZE * RATIO;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(RATIO, RATIO);
    context.beginPath();
    context.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 1.5, 0, Math.PI * 2);
    context.fillStyle = disc;
    context.fill();
    context.lineWidth = 1.5;
    context.strokeStyle = ink;
    context.stroke();
    context.save();
    context.translate(SIZE / 2 - 12 * 0.75, SIZE / 2 - 12 * 0.75);
    context.scale(0.75, 0.75);
    context.fillStyle = ink;
    context.fill(new Path2D(glyph));
    context.restore();
    map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), {
      pixelRatio: RATIO,
    });
  }
}
