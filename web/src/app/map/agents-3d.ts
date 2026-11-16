import {
  MercatorCoordinate,
  type CustomLayerInterface,
  type CustomRenderMethodInput,
  type Map as MapLibreMap,
} from 'maplibre-gl';
import * as THREE from 'three';

import {
  buildDropCurtain,
  buildModel,
  disposeModel,
  MODEL_LENGTH_M,
  setOpacity,
  type ModelKind,
} from './agent-models';
import type { GroundAgent, Pass } from '../simulation/agents';
import type { Point } from '../simulation/point';

/**
 * How big a figure is drawn: about this many pixels long. At the domain's
 * framing a metre is a tenth of a pixel, and a firefighter at real size would
 * not be there at all; close up, the figure is never smaller than it is.
 */
const SCREEN_LENGTH_PX = 38;

/**
 * A pass, in seconds of the clock on the wall and not of the simulation: one
 * pass is less than a minute of fire, which plays in a fraction of a second.
 * In from afar and high, low over the drop, the load falls, and away climbing
 * while it fades: never gone in one frame (§11.50).
 */
const PASS = {
  seconds: 7,
  /** Fade in, then the drop at `release`, then fading out from `fadeOut`. */
  fadeIn: 0.8,
  release: 3.2,
  fadeOut: 4.6,
  /** In figure lengths: how far it starts and ends, and how high. */
  reach: 9,
  highAltitude: 4,
  lowAltitude: 1.4,
} as const;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

interface Flight {
  readonly pass: Pass;
  readonly started: number;
  readonly model: THREE.Group;
  readonly curtain: THREE.Object3D;
}

/**
 * The 3D figures of whoever works on the fire: crews and machinery standing on
 * the relief at the head of their line, and aircraft making their passes. A
 * MapLibre custom layer drawn with three.js on the map's own WebGL context.
 *
 * Purely a drawing of what the model already computed (§11.43): nothing here
 * changes the fire.
 */
export class Agents3D implements CustomLayerInterface {
  readonly id: string;
  readonly type = 'custom' as const;
  /** Drawn against the terrain's depth, so a ridge hides what is behind it. */
  readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  /** One figure per ground agent, kept while the agent is: they only move. */
  private readonly ground = new Map<string, { kind: ModelKind; model: THREE.Group }>();
  private groundAgents: readonly GroundAgent[] = [];
  private flights: Flight[] = [];
  private motion = true;

  constructor(id: string) {
    this.id = id;
    // Flat colours read best with a soft light from all round and one sun.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x445544, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(0.5, -0.7, 1);
    this.scene.add(sun);
  }

  onAdd(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    this.map = map;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      // MapLibre owns the frame: three.js draws into it and clears nothing.
      this.renderer.autoClear = false;
    } catch (error) {
      // Figures that cannot be drawn must cost the figures and not the map.
      console.error('[agents-3d]', error);
      this.renderer = null;
    }
  }

  onRemove(): void {
    for (const { model } of this.ground.values()) disposeModel(model);
    for (const flight of this.flights) {
      disposeModel(flight.model);
      disposeModel(flight.curtain);
    }
    this.ground.clear();
    this.flights = [];
    this.renderer?.dispose();
    this.renderer = null;
    this.map = null;
  }

  /** Who is on the ground now; figures come and go with the list. */
  setGround(agents: readonly GroundAgent[]): void {
    this.groundAgents = agents;
    const wanted = new Set(agents.map((a) => a.id));
    for (const [id, figure] of this.ground)
      if (!wanted.has(id)) {
        this.scene.remove(figure.model);
        disposeModel(figure.model);
        this.ground.delete(id);
      }
    for (const agent of agents) {
      const figure = this.ground.get(agent.id);
      if (figure && figure.kind === agent.kind) continue;
      if (figure) {
        this.scene.remove(figure.model);
        disposeModel(figure.model);
      }
      const model = buildModel(agent.kind);
      model.matrixAutoUpdate = false;
      this.scene.add(model);
      this.ground.set(agent.id, { kind: agent.kind, model });
    }
    this.map?.triggerRepaint();
  }

  /** An aircraft makes one pass now, in real time (§11.50). */
  fly(pass: Pass): void {
    if (!this.motion) return;
    const model = buildModel(pass.kind);
    const curtain = buildDropCurtain(pass.liquid);
    for (const object of [model, curtain]) {
      object.matrixAutoUpdate = false;
      setOpacity(object, 0);
      this.scene.add(object);
    }
    this.flights.push({ pass, started: performance.now(), model, curtain });
    this.map?.triggerRepaint();
  }

  /** Every pass in the air is put away: a new fire, or another minute. */
  land(): void {
    for (const flight of this.flights) this.dispose(flight);
    this.flights = [];
    this.map?.triggerRepaint();
  }

  /** Under `prefers-reduced-motion` there are no passes and rotors stand still. */
  setMotion(on: boolean): void {
    this.motion = on;
    if (!on) this.land();
  }

  render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const map = this.map,
      renderer = this.renderer;
    if (!map || !renderer || (!this.ground.size && !this.flights.length)) return;

    const now = performance.now();
    // Metres per pixel at the centre of the view: what makes a figure about
    // SCREEN_LENGTH_PX long whatever the zoom, and never below real size.
    const centre = map.getCenter();
    const metresPerPixel =
      (40_075_016.686 * Math.cos((centre.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
    const grow = (kind: ModelKind) =>
      Math.max(1, (SCREEN_LENGTH_PX * metresPerPixel) / MODEL_LENGTH_M[kind]);

    for (const agent of this.groundAgents) {
      const figure = this.ground.get(agent.id);
      if (!figure) continue;
      place(figure.model, map, agent.point, 0, agent.heading, grow(agent.kind));
    }

    for (const flight of [...this.flights]) {
      const t = (now - flight.started) / 1000;
      if (t >= PASS.seconds) {
        this.dispose(flight);
        this.flights.splice(this.flights.indexOf(flight), 1);
        continue;
      }
      this.animate(flight, t, grow(flight.pass.kind), map);
    }

    this.camera.projectionMatrix.fromArray(
      options.defaultProjectionData.mainMatrix as unknown as number[],
    );
    renderer.resetState();
    renderer.render(this.scene, this.camera);
    // Passes move by themselves: keep drawing only while one is in the air.
    if (this.flights.length && !document.hidden) map.triggerRepaint();
  }

  private animate(flight: Flight, t: number, grow: number, map: MapLibreMap): void {
    const { pass, model, curtain } = flight;
    const length = MODEL_LENGTH_M[pass.kind] * grow;
    const heading = (pass.heading * Math.PI) / 180;
    // Along the track: from -reach before the drop to +reach after it, faster
    // on the way in and slowing over the drop, as a real run does.
    const along =
      t < PASS.release
        ? -PASS.reach * length * (1 - smooth(t / PASS.release))
        : PASS.reach * length * smooth((t - PASS.release) / (PASS.seconds - PASS.release)) ** 1.4;
    const height =
      t < PASS.release
        ? PASS.lowAltitude + (PASS.highAltitude - PASS.lowAltitude) * (1 - smooth(t / PASS.release))
        : PASS.lowAltitude +
          (PASS.highAltitude - PASS.lowAltitude) *
            smooth(clamp01((t - PASS.release - 0.4) / (PASS.seconds - PASS.release)));
    const east = Math.sin(heading) * along,
      north = Math.cos(heading) * along;
    const point = offset(pass.drop, east, north);
    // A gentle climb and dive along the pitch of the path.
    const pitch = t < PASS.release ? -0.12 : 0.18 * clamp01((t - PASS.release - 0.3) / 1.5);
    place(model, map, point, height * length, pass.heading, grow, pitch);

    const opacity =
      t < PASS.fadeIn
        ? smooth(t / PASS.fadeIn)
        : t < PASS.fadeOut
          ? 1
          : 1 - smooth((t - PASS.fadeOut) / (PASS.seconds - PASS.fadeOut));
    setOpacity(model, opacity);
    spin(model, t);

    // The load falls from the release point and drifts back, then thins out.
    const fall = clamp01((t - PASS.release) / 1.2);
    const curtainOpacity =
      fall === 0 ? 0 : 0.75 * (1 - smooth(clamp01((t - PASS.release - 1.2) / 2.4)));
    place(
      curtain,
      map,
      pass.drop,
      PASS.lowAltitude * length,
      pass.heading,
      grow * 0.6,
      0,
      Math.max(0.01, fall),
    );
    setOpacity(curtain, curtainOpacity);
  }

  private dispose(flight: Flight): void {
    this.scene.remove(flight.model);
    this.scene.remove(flight.curtain);
    disposeModel(flight.model);
    disposeModel(flight.curtain);
  }
}

/** Metres east and north of a point, flat-earth: a few kilometres can afford it. */
function offset([lon, lat]: Point, east: number, north: number): Point {
  return [lon + east / (111_320 * Math.cos((lat * Math.PI) / 180)), lat + north / 111_320];
}

/** Rotors and propellers turn; a figure without them is left alone. */
function spin(model: THREE.Object3D, t: number): void {
  model.traverse((child) => {
    if (child.name === 'rotor') child.rotation.z = t * 28;
    if (child.name === 'propeller') child.rotation.x = t * 40;
  });
  model.updateMatrixWorld(true);
}

/**
 * Puts a figure at a point of the relief, `above` metres over the ground,
 * facing `heading`, `grow` times its real size. The model's axes are +X
 * forward, +Y left, +Z up (agent-models.ts); mercator's y grows southwards,
 * which the negative y scale turns round (three.js flips the winding).
 */
function place(
  object: THREE.Object3D,
  map: MapLibreMap,
  [lon, lat]: Point,
  above: number,
  heading: number,
  grow: number,
  pitch = 0,
  stretchZ = 1,
): void {
  const ground = map.getTerrain() ? (map.queryTerrainElevation({ lng: lon, lat }) ?? 0) : 0;
  const at = MercatorCoordinate.fromLngLat({ lng: lon, lat }, ground + above);
  const unit = at.meterInMercatorCoordinateUnits() * grow;
  // Heading is clockwise from north; the model faces +X (east) at rest.
  const yaw = Math.PI / 2 - (heading * Math.PI) / 180;
  const matrix = new THREE.Matrix4()
    .makeTranslation(at.x, at.y, at.z)
    .multiply(new THREE.Matrix4().makeScale(unit, -unit, unit))
    .multiply(new THREE.Matrix4().makeRotationZ(yaw))
    .multiply(new THREE.Matrix4().makeRotationY(-pitch))
    .multiply(new THREE.Matrix4().makeScale(1, 1, stretchZ));
  object.matrix.copy(matrix);
  object.matrixWorldNeedsUpdate = true;
  object.updateMatrixWorld(true);
}
