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
import { offsetBy } from '../simulation/geo';

// Figures keep a minimum screen length so real-size crews remain visible at domain scale.
const SCREEN_LENGTH_PX = 56;

// Aircraft passes use wall-clock seconds; simulation time would make them disappear in a fraction
// of a second.
const PASS = {
  seconds: 7,
  fadeIn: 0.8,
  release: 3.2,
  fadeOut: 4.6,
  // Distances are in figure lengths.
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

export class Agents3D implements CustomLayerInterface {
  public readonly id: string;
  public readonly type = 'custom' as const;

  public readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly ground = new Map<string, { kind: ModelKind; model: THREE.Group }>();
  private groundAgents: readonly GroundAgent[] = [];
  private flights: Flight[] = [];
  private motion = true;

  public constructor(id: string) {
    this.id = id;
    // Lambert surfaces reflect intensity / π; low values leave shaded faces nearly black.
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc8d0c8, 3.2));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(0.5, -0.7, 1);
    this.scene.add(sun);
  }

  public onAdd(map: MapLibreMap, gl: WebGL2RenderingContext): void {
    this.map = map;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: map.getCanvas(),
        context: gl,
        antialias: true,
      });
      // MapLibre owns the frame; three.js must not clear it.
      this.renderer.autoClear = false;
    } catch (error) {
      console.error('[agents-3d]', error);
      this.renderer = null;
    }
  }

  public onRemove(): void {
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

  public setGround(agents: readonly GroundAgent[]): void {
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

  public fly(pass: Pass): void {
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

  public land(): void {
    for (const flight of this.flights) this.dispose(flight);
    this.flights = [];
    this.map?.triggerRepaint();
  }

  // Reduced motion disables passes and rotor animation.
  public setMotion(on: boolean): void {
    this.motion = on;
    if (!on) this.land();
  }

  public render(_gl: WebGL2RenderingContext, options: CustomRenderMethodInput): void {
    const map = this.map,
      renderer = this.renderer;
    if (!map || !renderer || (!this.ground.size && !this.flights.length)) return;

    const now = performance.now();

    const centre = map.getCenter();
    const metresPerPixel =
      (40_075_016.686 * Math.cos((centre.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
    const grow = (kind: ModelKind) =>
      Math.max(1, (SCREEN_LENGTH_PX * metresPerPixel) / MODEL_LENGTH_M[kind]);
    // Use metre offsets from a double-precision origin: whole-world Mercator coordinates lose
    // local detail in GPU single precision.
    const origin = MercatorCoordinate.fromLngLat(centre, 0);
    const frame: Frame = { map, origin, unit: origin.meterInMercatorCoordinateUnits() };

    for (const agent of this.groundAgents) {
      const figure = this.ground.get(agent.id);
      if (!figure) continue;
      // Lift figures above ground because rendered terrain and queried elevation use different
      // meshes.
      const lift = 0.03 * MODEL_LENGTH_M[agent.kind] * grow(agent.kind);
      place(figure.model, frame, agent.point, lift, agent.heading, grow(agent.kind));
    }

    for (const flight of [...this.flights]) {
      const t = (now - flight.started) / 1000;
      if (t >= PASS.seconds) {
        this.dispose(flight);
        this.flights.splice(this.flights.indexOf(flight), 1);
        continue;
      }
      this.animate(flight, t, grow(flight.pass.kind), frame);
    }

    this.camera.projectionMatrix
      .fromArray(options.defaultProjectionData.mainMatrix)
      .multiply(new THREE.Matrix4().makeTranslation(origin.x, origin.y, origin.z))
      .multiply(new THREE.Matrix4().makeScale(frame.unit, frame.unit, frame.unit));
    renderer.resetState();
    renderer.render(this.scene, this.camera);

    if (this.flights.length && !document.hidden) map.triggerRepaint();
  }

  private animate(flight: Flight, t: number, grow: number, frame: Frame): void {
    const { pass, model, curtain } = flight;
    const length = MODEL_LENGTH_M[pass.kind] * grow;
    const heading = (pass.heading * Math.PI) / 180;
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
    const point = offsetBy(pass.drop, east, north);
    const pitch = t < PASS.release ? -0.12 : 0.18 * clamp01((t - PASS.release - 0.3) / 1.5);
    place(model, frame, point, height * length, pass.heading, grow, pitch);

    const opacity =
      t < PASS.fadeIn
        ? smooth(t / PASS.fadeIn)
        : t < PASS.fadeOut
          ? 1
          : 1 - smooth((t - PASS.fadeOut) / (PASS.seconds - PASS.fadeOut));
    setOpacity(model, opacity);
    spin(model, t);

    const fall = clamp01((t - PASS.release) / 1.2);

    const curtainOpacity =
      fall === 0 ? 0 : 0.4 * (1 - smooth(clamp01((t - PASS.release - 1.2) / 2.4)));
    place(
      curtain,
      frame,
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

function spin(model: THREE.Object3D, t: number): void {
  model.traverse((child) => {
    if (child.name === 'rotor') child.rotation.z = t * 28;
    if (child.name === 'propeller') child.rotation.x = t * 40;
  });
  model.updateMatrixWorld(true);
}

interface Frame {
  readonly map: MapLibreMap;
  readonly origin: MercatorCoordinate;
  // Mercator units per metre at the origin.
  readonly unit: number;
}

// Model +Y points left; Mercator y grows south, so the negative y scale reverses it. three.js
// handles the reversed winding.
function place(
  object: THREE.Object3D,
  { map, origin, unit: originUnit }: Frame,
  [lon, lat]: Point,
  above: number,
  heading: number,
  grow: number,
  pitch = 0,
  stretchZ = 1,
): void {
  const ground = map.getTerrain() ? (map.queryTerrainElevation({ lng: lon, lat }) ?? 0) : 0;
  const at = MercatorCoordinate.fromLngLat({ lng: lon, lat }, ground + above);
  // Mercator scale varies with latitude; retain the local real size.
  const size = (at.meterInMercatorCoordinateUnits() / originUnit) * grow;
  // Heading is clockwise from north; the model faces +X (east) at rest.
  const yaw = Math.PI / 2 - (heading * Math.PI) / 180;
  const matrix = new THREE.Matrix4()
    .makeTranslation(
      (at.x - origin.x) / originUnit,
      (at.y - origin.y) / originUnit,
      (at.z - origin.z) / originUnit,
    )
    .multiply(new THREE.Matrix4().makeScale(size, -size, size))
    .multiply(new THREE.Matrix4().makeRotationZ(yaw))
    .multiply(new THREE.Matrix4().makeRotationY(-pitch))
    .multiply(new THREE.Matrix4().makeScale(1, 1, stretchZ));
  object.matrix.copy(matrix);
  object.matrixWorldNeedsUpdate = true;
  object.updateMatrixWorld(true);
}
