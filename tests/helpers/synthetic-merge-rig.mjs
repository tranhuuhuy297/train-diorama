// Synthetic Object3D rig (mirrored/uv-less/excluded/Uint32/colour-attribute batches) for
// mergeStaticGeometry tests; materials are module singletons so two rigs compare batches by identity.
import '../../src/core/disable-three-color-management.js';
import * as THREE from 'three';

export const RIG_MATERIALS = {
  A: new THREE.MeshBasicMaterial({ name: 'A' }),
  B: new THREE.MeshBasicMaterial({ name: 'B' }),
  C: new THREE.MeshBasicMaterial({ name: 'C' }),
  D: new THREE.MeshBasicMaterial({ name: 'D' }),
  T: new THREE.MeshBasicMaterial({ name: 'T', transparent: true }),
};

function withConstantColor(geometry, value) {
  const count = geometry.attributes.position.count;
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(count * 3).fill(value), 3));
  return geometry;
}

export function buildRig() {
  const { A, B, C, D, T } = RIG_MATERIALS;
  const root = new THREE.Group();
  root.position.set(5, 0, -3);

  const a = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), A);
  a.position.set(1, 2, 3);
  a.rotation.set(0.3, 0.2, 0.1);
  a.scale.set(1, 1.5, 0.5);
  a.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), T));
  root.add(a);

  const mirrored = new THREE.Group();
  mirrored.position.set(0, 1, 0);
  mirrored.scale.set(-1, 1, 1);
  mirrored.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), A));
  mirrored.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.8).toNonIndexed(), B));
  root.add(mirrored);

  const uvLessGeometry = new THREE.BufferGeometry();
  uvLessGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  uvLessGeometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  root.add(new THREE.Mesh(uvLessGeometry, A));

  const excluded = new THREE.Group();
  excluded.rotation.y = 0.7;
  excluded.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), A));
  root.add(excluded);

  const sphere1 = new THREE.Mesh(new THREE.SphereGeometry(1, 200, 180), C);
  sphere1.position.x = 2;
  const sphere2 = new THREE.Mesh(new THREE.SphereGeometry(1, 200, 180), C);
  sphere2.position.x = -2;
  root.add(sphere1, sphere2);

  const nested = new THREE.Group();
  nested.position.set(0, 0, 4);
  nested.rotation.z = 0.4;
  const inner = new THREE.Group();
  inner.scale.set(2, 1, 1);
  inner.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 1, 12), B));
  nested.add(inner);
  root.add(nested);

  const d1 = new THREE.Mesh(withConstantColor(new THREE.BoxGeometry(0.3, 0.3, 0.3), 0.5), D);
  d1.position.z = -4;
  const d2 = new THREE.Mesh(withConstantColor(new THREE.BoxGeometry(0.3, 0.3, 0.3), 0.5), D);
  d2.position.z = -5;
  root.add(d1, d2);

  return { root, excluded, a };
}

export function describeTree(root) {
  const entries = [];
  function visit(object) {
    const entry = {
      type: object.type,
      children: object.children.length,
      material: object.material ? object.material.name : null,
      matrix: Array.from(object.matrix.elements),
    };
    if (object.isMesh) {
      const geometry = object.geometry;
      entry.index = geometry.index ? { ctor: geometry.index.array.constructor.name, array: Array.from(geometry.index.array) } : null;
      // Array, not just an object, so assert.deepEqual also catches insertion-order drift.
      entry.attributeKeys = Object.keys(geometry.attributes);
      entry.attributes = {};
      for (const key of entry.attributeKeys) {
        const attribute = geometry.attributes[key];
        entry.attributes[key] = {
          ctor: attribute.array.constructor.name,
          itemSize: attribute.itemSize,
          normalized: attribute.normalized,
          array: Array.from(attribute.array),
        };
      }
      entry.boundingSphere = geometry.boundingSphere
        ? { center: geometry.boundingSphere.center.toArray(), radius: geometry.boundingSphere.radius }
        : null;
    }
    entries.push(entry);
    for (const child of object.children) visit(child);
  }
  visit(root);
  return entries;
}
