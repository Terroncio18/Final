import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildDropCurtain,
  buildModel,
  disposeModel,
  MODEL_LENGTH_M,
  type ModelKind,
  setOpacity,
} from './agent-models';

const kinds: ModelKind[] = ['crew', 'bulldozer', 'fire-engine', 'helicopter', 'scooper', 'tanker'];
const objects: THREE.Object3D[] = [];

function track<T extends THREE.Object3D>(object: T): T {
  objects.push(object);
  return object;
}

function meshes(object: THREE.Object3D): THREE.Mesh[] {
  const result: THREE.Mesh[] = [];
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) result.push(child);
  });
  return result;
}

function materials(object: THREE.Object3D): THREE.Material[] {
  return meshes(object).flatMap((mesh) =>
    Array.isArray(mesh.material) ? mesh.material : [mesh.material],
  );
}

function triangles(object: THREE.Object3D): number {
  // Count every rendered instance, even where several meshes reuse a geometry.
  return meshes(object).reduce(
    (sum, mesh) =>
      sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3,
    0,
  );
}

afterEach(() => {
  objects.splice(0).forEach(disposeModel);
  vi.restoreAllMocks();
});

describe('agent models', () => {
  it.each(kinds)('builds a real-size %s below the triangle budget', (kind) => {
    const model = track(buildModel(kind));
    expect(model).toBeInstanceOf(THREE.Group);
    expect(meshes(model).length).toBeGreaterThan(0);
    const bounds = new THREE.Box3().setFromObject(model);
    const length = bounds.max.x - bounds.min.x;
    expect(length).toBeGreaterThanOrEqual(MODEL_LENGTH_M[kind] * 0.75);
    expect(length).toBeLessThanOrEqual(MODEL_LENGTH_M[kind] * 1.25);
    expect(triangles(model)).toBeGreaterThan(0);
    expect(triangles(model)).toBeLessThan(3000);
    expect(
      materials(model).every((material) => material instanceof THREE.MeshLambertMaterial),
    ).toBe(true);
    expect(new Set(materials(model)).size).toBeLessThan(meshes(model).length);
  });

  it.each(['crew', 'bulldozer', 'fire-engine'] as const)('grounds %s at z = 0', (kind) => {
    const bounds = new THREE.Box3().setFromObject(track(buildModel(kind)));
    expect(Math.abs(bounds.min.z)).toBeLessThan(0.05);
    expect(bounds.max.z).toBeGreaterThan(1.5);
    expect(bounds.min.x).toBeLessThan(0);
    expect(bounds.max.x).toBeGreaterThan(0);
    expect(bounds.min.y).toBeLessThan(0);
    expect(bounds.max.y).toBeGreaterThan(0);
  });

  it('builds three standing firefighters', () => {
    const model = track(buildModel('crew'));
    const people = model.children.filter((child) => child.name === 'firefighter');
    expect(people).toHaveLength(3);
    expect(new Set(people.map((person) => person.position.x)).size).toBe(3);
    for (const person of people) {
      const bounds = new THREE.Box3().setFromObject(person);
      expect(bounds.min.z).toBeCloseTo(0, 5);
      expect(bounds.max.z).toBeGreaterThan(1.7);
    }
  });

  it('provides a horizontal helicopter rotor and a suspended bucket', () => {
    const helicopter = track(buildModel('helicopter'));
    const rotor = helicopter.getObjectByName('rotor')!;
    const bucket = helicopter.getObjectByName('bucket')!;
    expect(rotor).toBeInstanceOf(THREE.Group);
    expect(bucket).toBeInstanceOf(THREE.Group);
    expect(rotor.parent).toBe(helicopter);
    expect(bucket.parent).toBe(helicopter);
    const size = new THREE.Box3().setFromObject(rotor).getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(10);
    expect(size.y).toBeGreaterThan(10);
    expect(size.z).toBeLessThan(0.5);
    expect(new THREE.Box3().setFromObject(bucket).max.z).toBeLessThan(-1);
    const bucketBefore = new THREE.Box3().setFromObject(bucket).clone();
    rotor.rotation.z = Math.PI / 4;
    expect(new THREE.Box3().setFromObject(bucket).equals(bucketBefore)).toBe(true);
  });

  it.each([
    ['scooper', 2],
    ['tanker', 1],
  ] as const)('provides %s propellers with local X pivots', (kind, count) => {
    const model = track(buildModel(kind));
    const propellers = model.children.filter((child) => child.name === 'propeller');
    expect(propellers).toHaveLength(count);
    for (const propeller of propellers) {
      expect(propeller).toBeInstanceOf(THREE.Group);
      expect(propeller.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
      for (const angle of [0, Math.PI / 3]) {
        propeller.rotation.x = angle;
        const size = new THREE.Box3().setFromObject(propeller).getSize(new THREE.Vector3());
        expect(size.x).toBeLessThan(0.5);
        expect(size.y).toBeGreaterThan(2);
        expect(size.z).toBeGreaterThan(2);
      }
    }
  });

  it.each(kinds)('fades every %s material and restores opacity', (kind) => {
    const model = track(buildModel(kind));
    setOpacity(model, 0.5);
    for (const material of materials(model)) {
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.5);
    }
    setOpacity(model, 1);
    for (const material of materials(model)) {
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
    }
  });

  it('fades material arrays and disposes shared resources once', () => {
    const object = new THREE.Group();
    const geometry = new THREE.BoxGeometry();
    const first = new THREE.MeshLambertMaterial();
    const second = new THREE.MeshLambertMaterial();
    object.add(new THREE.Mesh(geometry, [first, second]), new THREE.Mesh(geometry, first));
    const disposals = [geometry, first, second].map((resource) => vi.spyOn(resource, 'dispose'));
    setOpacity(object, 0.5);
    for (const material of [first, second]) {
      expect(material.transparent).toBe(true);
      expect(material.opacity).toBe(0.5);
    }
    setOpacity(object, 1);
    for (const material of [first, second]) {
      expect(material.transparent).toBe(false);
      expect(material.opacity).toBe(1);
    }
    expect(() => disposeModel(object)).not.toThrow();
    disposals.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  });

  it.each(kinds)('owns independent %s resources and disposes without throwing', (kind) => {
    const first = buildModel(kind);
    const second = track(buildModel(kind));
    expect(first).not.toBe(second);
    const firstGeometries = new Set(meshes(first).map((mesh) => mesh.geometry));
    const firstMaterials = new Set(materials(first));
    expect(meshes(second).some((mesh) => firstGeometries.has(mesh.geometry))).toBe(false);
    expect(materials(second).some((material) => firstMaterials.has(material))).toBe(false);
    setOpacity(first, 0.5);
    expect(
      materials(second).every((material) => material.opacity === 1 && !material.transparent),
    ).toBe(true);
    expect(() => disposeModel(first)).not.toThrow();
  });
});

describe('drop curtains', () => {
  it.each(['water', 'retardant'] as const)(
    'builds a trailing %s cloud from the release point',
    (kind) => {
      const drop = track(buildDropCurtain(kind));
      const bounds = new THREE.Box3().setFromObject(drop);
      expect(bounds.max.z).toBeCloseTo(0, 5);
      expect(bounds.min.z).toBeGreaterThan(-42);
      expect(bounds.min.z).toBeLessThan(-38);
      expect(bounds.min.x).toBeLessThan(-15);
      expect(bounds.max.x).toBeLessThan(1);
      expect(triangles(drop)).toBeLessThan(3000);
      for (const material of materials(drop)) {
        expect(material).toBeInstanceOf(THREE.MeshLambertMaterial);
        expect(material.transparent).toBe(true);
        expect(material.depthWrite).toBe(false);
      }
      drop.scale.z = 0.5;
      expect(new THREE.Box3().setFromObject(drop).min.z).toBeCloseTo(bounds.min.z / 2, 5);
      setOpacity(drop, 0.5);
      expect(materials(drop).every((material) => material.opacity === 0.5)).toBe(true);
    },
  );

  it('distinguishes pale blue water from red-pink retardant', () => {
    const water = materials(track(buildDropCurtain('water')))[0] as THREE.MeshLambertMaterial;
    const retardant = materials(
      track(buildDropCurtain('retardant')),
    )[0] as THREE.MeshLambertMaterial;
    expect(water.color.b).toBeGreaterThan(water.color.r);
    expect(retardant.color.r).toBeGreaterThan(retardant.color.b);
    expect(retardant.color.r).toBeGreaterThan(retardant.color.g);
  });
});
