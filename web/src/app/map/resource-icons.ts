import type { Map as MapLibreMap } from 'maplibre-gl';

import type { AgentKind } from '../simulation/agents';

const RATIO = 2;
const AGENT_SIZE = 34;
const AGENT_YELLOW = '#ffe15a';
const AGENT_INK = '#182129';

/**
 * Original silhouettes on a 32-unit box. Their outlines carry the identity
 * even when small details disappear: limbs, tracks, wheels, rotor or floats.
 * Side views make ground vehicles readable; overhead views expose aircraft wings.
 */
const AGENT_GLYPHS: Readonly<Record<AgentKind, { silhouette: string; detail: string }>> = {
  crew: {
    silhouette:
      'M12 7V6a4 4 0 0 1 8 0v1h2v2H10V7Z M12.5 10h7v1a3.5 3.5 0 0 1-7 0Z ' +
      'M12 14h8l5 8-3 2-3-5v4l2 7h-4l-1-6-1 6h-4l2-7v-4l-3 5-3-2Z',
    detail: 'M15 3h2v4h-2Z M15 15h2v6h-2Z M12 21h8v2h-8Z',
  },
  bulldozer: {
    silhouette:
      'M7 9h11v10h5v3H4v-6h3Z M6 22h15a4 4 0 0 1 0 8H6a4 4 0 0 1 0-8Z ' +
      'M22 20h5v-6h3v16h-5l-2-3h4v-4h-5Z',
    detail: 'M10 11h6v7h-6Z M7 24h13a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4Z M5 19h16v2H5Z',
  },
  'fire-engine': {
    silhouette:
      'M3 12h16v3h7l4 6v5h-3a4 4 0 0 1-8 0h-6a4 4 0 0 1-8 0H3Z ' + 'M5 8h13v2H5Z M21 11h4v3h-4Z',
    detail: 'M21 17h4l3 5h-7Z M5 15h12v2H5Z M5 19h12v2H5Z ' + 'M7 25h4v3H7Z M21 25h4v3h-4Z',
  },
  helicopter: {
    silhouette:
      'M14 20h4l1 7h4v2h-5v1h-4v-1h-4v-2h4Z ' +
      'M9 11h2v12H9Z M21 11h2v12h-2Z ' +
      'M16 5c3 0 5 4 5 9s-2 8-5 8-5-3-5-8 2-9 5-9Z M2 8h28v2H2Z',
    detail: 'M13 12q3-3 6 0v4h-6Z M15 7h2v4h-2Z M15 23h2v5h-2Z',
  },
  scooper: {
    silhouette:
      'M13 10V7q0-4 3-5 3 1 3 5v3l11 1v4l-11 1-1 9 5 2v2l-7-1-7 1v-2l5-2-1-9-11-1v-4Z ' +
      'M4 15h3v6H4Z M25 15h3v6h-3Z M9 8h3v9H9Z M20 8h3v9h-3Z',
    detail: 'M14 6q2-2 4 0v3h-4Z M15 18h2v7h-2Z M8 7h5v1.5H8Z M19 7h5v1.5h-5Z',
  },
  tanker: {
    silhouette:
      'M15 4h2l2 7 11 6v3l-12-3v8l5 3v2l-7-2-7 2v-2l5-3v-8L2 20v-3l11-6Z ' + 'M10 2h12v2H10Z',
    detail: 'M14.5 9h3v5h-3Z M15 19h2v7h-2Z',
  },
};

/** Adds the marks to the style once; a new style starts without them. */
export function addResourceIcons(map: MapLibreMap): void {
  for (const kind of Object.keys(AGENT_GLYPHS) as AgentKind[]) addAgentIcon(map, kind);
}

function addAgentIcon(map: MapLibreMap, kind: AgentKind): void {
  const id = `agent-${kind}`;
  if (map.hasImage(id)) return;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = AGENT_SIZE * RATIO;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.scale(RATIO, RATIO);
  context.translate(1, 1);
  const glyph = AGENT_GLYPHS[kind];
  const silhouette = new Path2D(glyph.silhouette);
  // A continuous dark halo separates yellow from both the fire and bright terrain.
  context.lineJoin = 'round';
  context.lineCap = 'round';
  context.strokeStyle = AGENT_INK;
  context.lineWidth = 2.8;
  context.stroke(silhouette);
  context.fillStyle = AGENT_YELLOW;
  context.fill(silhouette);
  context.fillStyle = AGENT_INK;
  context.fill(new Path2D(glyph.detail));
  map.addImage(id, context.getImageData(0, 0, canvas.width, canvas.height), {
    pixelRatio: RATIO,
  });
}
