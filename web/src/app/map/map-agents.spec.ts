import { vi } from 'vitest';
import type { MapLibreMap } from 'maplibre-gl';
import { MapAgents } from './map-agents';
import { LAYERS } from './map.style';
import type { GroundAgent } from '../simulation/agents';

const crew = { id: 'crew', kind: 'crew', point: [2, 3], heading: 90 } as GroundAgent;
const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

function mapDouble() {
  const layers = new Map<string, { id: string }>();
  const boundary: Partial<MapLibreMap> = {};
  Object.assign(boundary, {
    getLayer: (id: string) => layers.get(id),
    addLayer: (layer: { id: string }) => layers.set(layer.id, layer),
    removeLayer: (id: string) => layers.delete(id),
  });
  return { layers, map: boundary as MapLibreMap };
}

describe('MapAgents', () => {
  let module: typeof import('./agents-3d');
  let load: ReturnType<typeof vi.fn<() => Promise<typeof import('./agents-3d')>>>;
  let logged: Error[];
  beforeEach(async () => {
    module = await import('./agents-3d');
    load = vi.fn(() => Promise.resolve(module));
    logged = [];
    vi.spyOn(console, 'error').mockImplementation((_prefix, error: Error) => logged.push(error));
  });
  afterEach(() => vi.restoreAllMocks());

  it('reports a failed three.js load and lets the next agent try again', async () => {
    const { layers, map } = mapDouble();
    load.mockRejectedValueOnce(new Error('chunk'));
    const agents = new MapAgents(() => true, load);

    agents.setGround(map, [crew]);
    await settle();
    expect(layers.size).toBe(0);
    expect(logged).toEqual([new Error('chunk')]);

    agents.setGround(map, [crew]);
    await settle();
    expect(layers.get(LAYERS.agents)).toBeDefined();
    expect(load).toHaveBeenCalledTimes(2);
    agents.release(map);
    expect(layers.size).toBe(0);
  });

  it('asks for three.js once while the load is in flight', async () => {
    const { layers, map } = mapDouble();
    const agents = new MapAgents(() => true, load);

    agents.setGround(map, [crew]);
    agents.fly(map, { id: 'air', kind: 'helicopter', drop: [2, 3], heading: 90, liquid: 'water' });
    await settle();
    expect(layers.get(LAYERS.agents)).toBeDefined();
    expect(load).toHaveBeenCalledTimes(1);
    agents.release(null);
    expect(layers.get(LAYERS.agents)).toBeDefined();
  });

  it('keeps still without a layer and drops the work the map no longer wants', async () => {
    const { layers, map } = mapDouble();
    const agents = new MapAgents(() => false, load);

    agents.land();
    agents.setMotion(false);
    agents.release(map);
    agents.setGround(map, []);
    agents.fly(map, { id: 'air', kind: 'helicopter', drop: [2, 3], heading: 90, liquid: 'water' });
    expect(load).not.toHaveBeenCalled();

    agents.setMotion(true);
    agents.setGround(map, [crew]);
    await settle();
    expect(layers.size).toBe(0);
    expect(load).toHaveBeenCalledTimes(1);
  });
});
