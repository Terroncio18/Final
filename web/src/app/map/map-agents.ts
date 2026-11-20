import type { MapLibreMap } from 'maplibre-gl';
import { LAYERS } from './map.style';
import type { Agents3D } from './agents-3d';
import type { GroundAgent, Pass } from '../simulation/agents';

type AgentsModule = typeof import('./agents-3d');

// three.js and the figure models are the heaviest chunk of the simulator: load them only when an
// agent is first displayed.
function loadAgents(): Promise<AgentsModule> {
  return import('./agents-3d');
}

// The crews and aircraft of one map: its layer, the deferred three.js load and the resources both
// hold. The map decides whether the figures are still wanted, through `current`.
export class MapAgents {
  private layer: Agents3D | null = null;
  private module: Promise<AgentsModule> | null = null;
  private wanted: readonly GroundAgent[] = [];
  private motion = true;

  public constructor(
    private readonly current: (map: MapLibreMap) => boolean,
    private readonly load: () => Promise<AgentsModule> = loadAgents,
  ) {}

  public setGround(map: MapLibreMap, agents: readonly GroundAgent[]): void {
    this.wanted = agents;
    if (!agents.length && !this.layer) return;
    this.withLayer(map, (layer) => layer.setGround(this.wanted));
  }

  public fly(map: MapLibreMap, pass: Pass): void {
    if (!this.motion) return;
    this.withLayer(map, (layer) => layer.fly(pass));
  }

  public land(): void {
    this.layer?.land();
  }

  public setMotion(on: boolean): void {
    this.motion = on;
    this.layer?.setMotion(on);
  }

  // Stop the figures and let go of their GPU resources before the map that holds them goes away.
  public release(map: MapLibreMap | null): void {
    const layer = this.layer;
    this.layer = null;
    this.wanted = [];
    if (!layer) return;
    layer.land();
    if (map?.getLayer(layer.id)) map.removeLayer(layer.id);
  }

  private withLayer(map: MapLibreMap, then: (layer: Agents3D) => void): void {
    if (this.layer && map.getLayer(this.layer.id)) return then(this.layer);
    const pending = (this.module ??= this.load());
    pending.then(
      ({ Agents3D }) => {
        // three.js may arrive after the map was destroyed or replaced: that work is superseded.
        if (!this.current(map)) return;
        if (!this.layer || !map.getLayer(this.layer.id)) {
          this.layer = new Agents3D(LAYERS.agents);
          map.addLayer(this.layer);
          this.layer.setMotion(this.motion);
          this.layer.setGround(this.wanted);
        }
        then(this.layer);
      },
      (error: Error) => {
        console.error('[mapa]', error);
        // Forget the failed load so the next agent asks for three.js again.
        if (this.module === pending) this.module = null;
      },
    );
  }
}
