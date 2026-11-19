import * as THREE from 'three';

export type ModelKind = 'crew' | 'bulldozer' | 'fire-engine' | 'helicopter' | 'scooper' | 'tanker';

/** Real length along X in metres, including tools, blades and stationary rotors. */
export const MODEL_LENGTH_M: Readonly<Record<ModelKind, number>> = Object.freeze({
  crew: 4.15,
  bulldozer: 6,
  'fire-engine': 7,
  helicopter: 17.2,
  scooper: 20,
  tanker: 11,
});

type Point = [number, number, number];
const yellow = 0xf3bb28;
const red = 0xc93935;
const white = 0xf3f0dd;
const dark = 0x29323a;
const glass = 0x426d80;
const metal = 0x78858a;

// Each factory owns its resources so fading or disposing one agent cannot affect another.
class Parts {
  public readonly root = new THREE.Group();
  private readonly materials = new Map<number, THREE.MeshLambertMaterial>();
  private readonly boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly sphereGeometry = new THREE.SphereGeometry(1, 8, 6);

  public material(color: number): THREE.MeshLambertMaterial {
    let material = this.materials.get(color);
    if (!material) {
      material = new THREE.MeshLambertMaterial({ color, flatShading: true });
      this.materials.set(color, material);
    }
    return material;
  }

  public mesh(
    geometry: THREE.BufferGeometry,
    color: number,
    at: Point,
    parent = this.root,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.material(color));
    mesh.position.set(...at);
    parent.add(mesh);
    return mesh;
  }

  public box(size: Point, at: Point, color: number, parent = this.root): THREE.Mesh {
    const mesh = this.mesh(this.boxGeometry, color, at, parent);
    mesh.scale.set(...size);
    return mesh;
  }

  public ellipsoid(size: Point, at: Point, color: number, parent = this.root): THREE.Mesh {
    const mesh = this.mesh(this.sphereGeometry, color, at, parent);
    mesh.scale.set(...size);
    return mesh;
  }

  public rod(
    from: Point,
    to: Point,
    radius: number,
    color: number,
    parent = this.root,
    endRadius = radius,
    segments = 8,
  ): THREE.Mesh {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const geometry = new THREE.CylinderGeometry(endRadius, radius, direction.length(), segments);
    const mesh = this.mesh(
      geometry,
      color,
      start.add(end).multiplyScalar(0.5).toArray() as Point,
      parent,
    );
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return mesh;
  }

  // An extruded side profile gives the boat a keel and the fins crisp silhouettes.
  public profile(outline: [number, number][], width: number, at: Point, color: number): THREE.Mesh {
    const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, z)));
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: width,
      bevelEnabled: false,
      steps: 1,
    });
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, width / 2, 0);
    return this.mesh(geometry, color, at);
  }

  public wing(
    span: number,
    rootChord: number,
    tipChord: number,
    sweep: number,
    thickness: number,
    at: Point,
    color: number,
  ): THREE.Mesh {
    const shape = new THREE.Shape([
      new THREE.Vector2(rootChord / 2, 0),
      new THREE.Vector2(tipChord / 2 - sweep, span / 2),
      new THREE.Vector2(-tipChord / 2 - sweep, span / 2),
      new THREE.Vector2(-rootChord / 2, 0),
      new THREE.Vector2(-tipChord / 2 - sweep, -span / 2),
      new THREE.Vector2(tipChord / 2 - sweep, -span / 2),
    ]);
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      bevelEnabled: false,
      steps: 1,
    });
    geometry.translate(0, 0, -thickness / 2);
    return this.mesh(geometry, color, at);
  }

  public pivot(name: string, at: Point): THREE.Group {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(...at);
    this.root.add(group);
    return group;
  }

  public propeller(at: Point, radius: number): void {
    const propeller = this.pivot('propeller', at);
    // Geometry is offset around a local X pivot, leaving rotation.x free for the layer.
    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const blade = this.box(
        [0.12, radius, 0.22],
        [0, (Math.cos(angle) * radius) / 2, (Math.sin(angle) * radius) / 2],
        dark,
        propeller,
      );
      blade.rotation.x = angle;
    }
    this.rod([-0.14, 0, 0], [0.26, 0, 0], 0.23, white, propeller, 0.07);
  }

  public finish(): THREE.Group {
    // Some designs use only one primitive; release the unused factory geometries too.
    const used = new Set<THREE.BufferGeometry>();
    this.root.traverse((child) => {
      if (child instanceof THREE.Mesh) used.add(child.geometry);
    });
    for (const geometry of [this.boxGeometry, this.sphereGeometry]) {
      if (!used.has(geometry)) geometry.dispose();
    }
    return this.root;
  }
}

function crew(p: Parts): void {
  for (const x of [-1.6, 0, 1.6]) {
    const person = p.pivot('firefighter', [x, 0, 0]);
    for (const y of [-0.16, 0.16]) {
      p.box([0.42, 0.23, 0.18], [0.07, y, 0.09], dark, person);
      p.box([0.23, 0.22, 0.65], [0, y, 0.5], 0x34434c, person);
      p.rod([0, y * 2.1, 1.36], [0.14, y * 2.5, 0.94], 0.115, 0xf6a623, person);
      p.ellipsoid([0.11, 0.1, 0.11], [0.14, y * 2.5, 0.93], dark, person);
    }
    p.box([0.38, 0.57, 0.59], [0, 0, 1.1], 0xf6a623, person);
    p.box([0.39, 0.58, 0.09], [0, 0, 0.94], yellow, person);
    p.box([0.18, 0.37, 0.44], [-0.27, 0, 1.14], dark, person);
    p.ellipsoid([0.2, 0.19, 0.23], [0, 0, 1.58], 0xc99169, person);
    p.ellipsoid([0.27, 0.26, 0.18], [0, 0, 1.77], yellow, person);
    p.box([0.58, 0.56, 0.05], [0.03, 0, 1.72], yellow, person);
  }
  p.rod([1.95, -0.46, 0.16], [1.69, -0.4, 1.28], 0.035, 0x956437);
  p.box([0.48, 0.13, 0.09], [1.95, -0.46, 0.18], metal);
}

function bulldozer(p: Parts): void {
  for (const y of [-1.05, 1.05]) {
    p.box([4.8, 0.62, 0.84], [0, y, 0.42], dark);
    for (const x of [-1.8, -0.6, 0.6, 1.8]) {
      p.rod([x, y - 0.33, 0.43], [x, y + 0.33, 0.43], 0.33, metal);
    }
    for (const x of [-2.1, -1.4, -0.7, 0, 0.7, 1.4, 2.1]) {
      p.box([0.1, 0.65, 0.06], [x, y, 0.85], metal);
    }
    p.rod([-0.8, y, 0.95], [2.55, y, 0.6], 0.12, yellow);
  }
  p.box([4.8, 1.55, 0.7], [-0.6, 0, 1.08], yellow);
  p.box([1.8, 1.4, 0.72], [1, 0, 1.67], yellow);
  p.box([1.5, 1.35, 1.15], [-1.1, 0, 2.02], glass);
  for (const x of [-1.88, -0.32]) {
    for (const y of [-0.75, 0.75]) p.rod([x, y, 1.4], [x, y, 2.7], 0.075, dark);
  }
  p.box([1.85, 1.73, 0.16], [-1.1, 0, 2.73], yellow);
  p.rod([1.1, -0.55, 1.9], [1.1, -0.55, 2.6], 0.09, dark);
  p.profile(
    [
      [2.55, 0.12],
      [3, 0.12],
      [2.85, 0.4],
      [2.73, 1.42],
      [2.48, 1.42],
    ],
    3.4,
    [0, 0, 0],
    yellow,
  );
  p.box([0.44, 3.45, 0.1], [2.77, 0, 0.12], metal);
}

function fireEngine(p: Parts): void {
  p.box([6.5, 1.9, 0.35], [0, 0, 0.75], dark);
  for (const x of [-2.15, 2.1]) {
    for (const y of [-1.07, 1.07]) {
      p.rod([x, y - 0.23, 0.61], [x, y + 0.23, 0.61], 0.61, dark, p.root, 0.61, 12);
      p.rod([x, y - 0.245, 0.61], [x, y + 0.245, 0.61], 0.3, metal);
    }
  }
  p.box([4.05, 2.25, 1.7], [-1.17, 0, 1.79], red);
  p.box([2.3, 2.2, 1.95], [2.03, 0, 1.92], red);
  p.box([0.08, 1.87, 0.65], [3.2, 0, 2.34], glass);
  for (const y of [-1.11, 1.11]) {
    p.box([1.53, 0.04, 0.65], [2.08, y, 2.34], glass);
    p.box([6.35, 0.07, 0.22], [0, y * 1.03, 1.73], white);
    p.box([2.9, 0.08, 0.73], [-1.4, y * 1.03, 1.18], metal);
  }
  for (const x of [-3.35, 3.35]) p.box([0.3, 2.37, 0.23], [x, 0, 0.98], dark);
  p.box([0.08, 1.1, 0.35], [3.22, 0, 1.38], dark);
  for (const y of [-0.78, 0.78]) p.box([0.09, 0.35, 0.22], [3.23, y, 1.38], white);
  p.box([0.34, 1.5, 0.14], [2.15, 0, 2.98], dark);
  for (const y of [-0.54, 0.54]) p.box([0.32, 0.42, 0.2], [2.15, y, 3.12], 0x429fd8);
  p.box([3.6, 1.98, 0.12], [-1.17, 0, 2.7], white);
  p.rod([-1.5, 0, 2.77], [-1.5, 0, 2.89], 0.4, metal);
}

function helicopter(p: Parts): void {
  p.ellipsoid([4.1, 1.3, 1.45], [1, 0, 0], red);
  p.ellipsoid([1.7, 1.17, 1.04], [3.15, 0, 0.32], glass);
  for (const y of [-1.2, 1.2]) p.box([3.7, 0.12, 0.28], [0.65, y, -0.15], white);
  p.rod([-2.3, 0, 0.1], [-8.7, 0, 0.8], 0.65, red, p.root, 0.16);
  p.profile(
    [
      [-9.4, 0.65],
      [-8.4, 0.65],
      [-8.2, 3.1],
      [-8.95, 3.1],
    ],
    0.18,
    [0, 0, 0],
    white,
  );
  p.wing(3.4, 0.8, 0.55, 0.2, 0.12, [-7.8, 0, 0.9], red);
  const tailRotor = p.pivot('tail-rotor', [-8.65, -0.32, 1.85]);
  p.box([1.9, 0.1, 0.14], [0, 0, 0], dark, tailRotor);
  p.box([0.14, 0.1, 1.9], [0, 0, 0], dark, tailRotor);
  for (const y of [-1.65, 1.65]) {
    p.rod([-2.1, y, -2], [3.25, y, -2], 0.11, metal);
    p.rod([3.25, y, -2], [3.7, y, -1.66], 0.11, metal);
    for (const x of [-1, 2]) p.rod([x, y * 0.5, -0.95], [x, y, -2], 0.09, metal);
  }
  p.ellipsoid([1.5, 0.85, 0.58], [0.3, 0, 1.25], white);
  p.rod([1, 0, 1.4], [1, 0, 2.35], 0.14, dark);
  const rotor = p.pivot('rotor', [1, 0, 2.4]);
  p.box([13.2, 0.32, 0.09], [0, 0, 0], dark, rotor);
  p.box([0.32, 13.2, 0.09], [0, 0, 0], dark, rotor);
  p.ellipsoid([0.35, 0.35, 0.18], [0, 0, 0], white, rotor);
  // The bucket pivot is its suspension point, allowing the entire sling to sway together.
  const bucket = p.pivot('bucket', [0, 0, -1.25]);
  p.rod([0, 0, 0], [0, 0, -5.8], 0.035, dark, bucket);
  for (const y of [-0.65, 0.65]) p.rod([0, 0, -5.8], [0, y, -6.6], 0.035, metal, bucket);
  p.rod([0, 0, -7.9], [0, 0, -6.6], 0.52, red, bucket, 0.82, 10);
  p.rod([0, 0, -6.65], [0, 0, -6.55], 0.83, dark, bucket, 0.83, 10);
}

function scooper(p: Parts): void {
  p.profile(
    [
      [-10, 0.6],
      [-8.2, -0.5],
      [-2.1, -1.45],
      [1.1, -1.45],
      [1.1, -1.7],
      [6.9, -1.2],
      [9.6, -0.2],
      [10, 0.5],
      [8, 1.35],
      [4.7, 1.65],
      [-5.8, 1.35],
    ],
    2.45,
    [0, 0, 0],
    yellow,
  );
  p.profile(
    [
      [-8.2, -0.5],
      [-2.1, -1.45],
      [1.1, -1.45],
      [1.1, -1.7],
      [6.9, -1.2],
      [9.6, -0.2],
      [6.2, -0.65],
      [-2, -0.95],
    ],
    2.48,
    [0, 0, 0],
    red,
  );
  p.ellipsoid([1.85, 1.12, 0.74], [6.1, 0, 1.2], glass);
  p.wing(27, 3.7, 2.1, 0.65, 0.3, [0.1, 0, 1.85], yellow);
  for (const y of [-11.7, 11.7]) {
    p.box([2.3, 2.5, 0.32], [-0.5, y, 1.85], red);
    p.rod([-0.65, y, 1.7], [-0.65, y, -0.6], 0.1, metal);
    p.ellipsoid([1.7, 0.45, 0.5], [-0.35, y, -0.8], red);
  }
  for (const y of [-4.4, 4.4]) {
    p.rod([-1.65, y, 2.1], [2.55, y, 2.1], 0.65, yellow, p.root, 0.65, 10);
    p.rod([2.5, y, 2.1], [2.8, y, 2.1], 0.68, dark);
    p.propeller([2.96, y, 2.1], 1.9);
  }
  p.profile(
    [
      [-9.8, 0.6],
      [-7.5, 0.8],
      [-7.9, 4.7],
      [-9.4, 4.7],
    ],
    0.22,
    [0, 0, 0],
    red,
  );
  p.wing(8.4, 2.3, 1.3, 0.4, 0.18, [-8.35, 0, 4.65], yellow);
}

function tanker(p: Parts): void {
  p.ellipsoid([4.6, 0.74, 0.83], [-0.05, 0, 0.05], yellow);
  p.rod([2.05, 0, 0], [5.08, 0, 0], 0.64, 0x527c40, p.root, 0.48, 10);
  p.propeller([5.24, 0, 0], 1.65);
  p.ellipsoid([1.1, 0.69, 0.76], [-0.45, 0, 0.78], glass);
  p.box([0.13, 1.23, 0.12], [-0.7, 0, 1.4], yellow);
  p.wing(15, 2.3, 1.2, 0.55, 0.16, [0.2, 0, -0.42], yellow);
  for (const y of [-6.7, 6.7]) p.box([1.3, 1.35, 0.18], [-0.3, y, -0.42], 0x527c40);
  p.profile(
    [
      [-1.9, -0.45],
      [1.8, -0.45],
      [1.35, -1.28],
      [-1.4, -1.28],
    ],
    1.05,
    [0, 0, 0],
    0x527c40,
  );
  p.box([1.7, 0.65, 0.1], [0, 0, -1.32], metal);
  p.profile(
    [
      [-5.5, 0.05],
      [-3.4, 0.2],
      [-4.25, 2.45],
      [-5.15, 2.45],
    ],
    0.17,
    [0, 0, 0],
    0x527c40,
  );
  p.wing(5.2, 1.7, 0.8, 0.3, 0.12, [-4.3, 0, 0.25], yellow);
  for (const y of [-1.3, 1.3]) {
    p.rod([0.4, y * 0.4, -0.5], [0.7, y, -1.65], 0.07, metal);
    p.rod([0.7, y - 0.14, -1.65], [0.7, y + 0.14, -1.65], 0.35, dark);
  }
}

/**
 * A new agent at real size in metres: +X forward, +Y left, +Z up.
 * Ground origins are centred on ground contact (z = 0); aircraft origins approximate
 * the airframe centre of mass, excluding suspended equipment.
 */
export function buildModel(kind: ModelKind): THREE.Group {
  const p = new Parts();
  p.root.name = kind;
  switch (kind) {
    case 'crew':
      crew(p);
      break;
    case 'bulldozer':
      bulldozer(p);
      break;
    case 'fire-engine':
      fireEngine(p);
      break;
    case 'helicopter':
      helicopter(p);
      break;
    case 'scooper':
      scooper(p);
      break;
    case 'tanker':
      tanker(p);
      break;
  }
  return p.finish();
}

/** A trailing cloud from the release point, extending about 40 m down -Z and back -X. */
export function buildDropCurtain(kind: 'water' | 'retardant'): THREE.Object3D {
  const p = new Parts();
  p.root.name = `${kind}-drop`;
  const color = kind === 'water' ? 0xcdeefa : 0xe86d83;
  // Overlapping closed puffs stay visible from either side without double-sided planes.
  for (let i = 0; i < 9; i++) {
    const spread = 0.45 + i * 0.52;
    const depth = i === 0 ? 2.6 : 4.2;
    p.ellipsoid([spread * 1.5, spread, depth], [-i * 1.9, 0, -2.6 - i * 4.15], color);
  }
  const result = p.finish();
  setOpacity(result, 0.38);
  // Transparent clouds should not punch opaque depth holes in terrain or other puffs.
  p.material(color).depthWrite = false;
  return result;
}

function visitMaterials(object: THREE.Object3D, visit: (material: THREE.Material) => void): void {
  object.traverse((child) => {
    const material = (child as THREE.Mesh).material;
    if (material) {
      for (const entry of Array.isArray(material) ? material : [material]) visit(entry);
    }
  });
}

/** Sets all material opacities; values below one enable transparency, one restores opacity. */
export function setOpacity(object: THREE.Object3D, opacity: number): void {
  const value = THREE.MathUtils.clamp(opacity, 0, 1);
  visitMaterials(object, (material) => {
    const transparent = value < 1;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
    material.opacity = value;
  });
}

/** Releases each geometry and material once, including resources shared within the object. */
export function disposeModel(object: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  object.traverse((child) => {
    const geometry = (child as THREE.Mesh).geometry;
    if (geometry) geometries.add(geometry);
  });
  visitMaterials(object, (material) => materials.add(material));
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
}
