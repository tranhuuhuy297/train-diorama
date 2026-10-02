// Pure + oracle-parity coverage for mergeStaticGeometry, createLightCone and createLightGlows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mergeStaticGeometry } from '../../src/geometry/merge-static-geometry-by-material.js';
import { createLightCone } from '../../src/effects/night-headlight-light-cone.js';
import { createLightGlows } from '../../src/effects/night-light-glow-sprites.js';
import { NIGHT_UNIFORMS } from '../../src/materials/shared-lighting-uniforms.js';
import { buildRig, describeTree } from '../helpers/synthetic-merge-rig.mjs';
import { originalSkipReason, importOriginal, extractGlslInterface } from '../helpers/original-module-loader.mjs';

const skip = originalSkipReason(['StaticGeometry.js', 'LightGlows.js']);
const originalStatic = skip ? null : await importOriginal('StaticGeometry.js');
const originalGlows = skip ? null : await importOriginal('LightGlows.js');

function buildMismatchRig() {
  const material = new THREE.MeshBasicMaterial({ name: 'E' });
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material));
  const colored = new THREE.BoxGeometry(1, 1, 1);
  colored.setAttribute('color', new THREE.Float32BufferAttribute(new Array(colored.attributes.position.count * 3).fill(0.5), 3));
  root.add(new THREE.Mesh(colored, material));
  return root;
}

// Full comparable shape of a cone/glow mesh: attribute order+data, index, instancing,
// bounds, material render flags, uniform keys/uNight and both shader interfaces.
function describeEffectMesh(mesh) {
  const { geometry, material } = mesh;
  const attributes = {};
  for (const key of Object.keys(geometry.attributes)) {
    const a = geometry.attributes[key];
    attributes[key] = { itemSize: a.itemSize, meshPerAttribute: a.meshPerAttribute ?? null, array: Array.from(a.array) };
  }
  return {
    attributeKeys: Object.keys(geometry.attributes),
    attributes,
    index: geometry.index ? Array.from(geometry.index.array) : null,
    instanceCount: geometry.instanceCount ?? null,
    boundingSphere: geometry.boundingSphere
      ? { center: geometry.boundingSphere.center.toArray(), radius: geometry.boundingSphere.radius } : null,
    materialName: material.name,
    transparent: material.transparent,
    depthWrite: material.depthWrite,
    side: material.side,
    blending: material.blending,
    uniformKeys: Object.keys(material.uniforms),
    uNight: material.uniforms.uNight?.value ?? null,
    vertex: extractGlslInterface(material.vertexShader),
    fragment: extractGlslInterface(material.fragmentShader),
  };
}

function trianglesWindCorrectly(geometry) {
  const pos = geometry.attributes.position;
  const nrm = geometry.attributes.normal;
  const index = geometry.index.array;
  const v = i => new THREE.Vector3().fromBufferAttribute(pos, index[i]);
  const n = i => new THREE.Vector3().fromBufferAttribute(nrm, index[i]);
  for (let i = 0; i < index.length; i += 3) {
    const edge1 = v(i + 1).clone().sub(v(i));
    const edge2 = v(i + 2).clone().sub(v(i));
    const faceNormal = edge1.cross(edge2);
    const avgNormal = n(i).add(n(i + 1)).add(n(i + 2));
    if (faceNormal.dot(avgNormal) <= 0) return false;
  }
  return true;
}

const GLOW_FIXTURE_GROUPS = {
  loco: [
    { position: [0, 2.1, 2.51], size: [2.3 * 1.5, 2.3 * 1.5], normal: [0, 0, 1], strength: 0.55 },
    { position: [-0.69, 1.08, 2.51], size: [0.8 * 1.5, 0.8 * 1.5], normal: [0, 0, 1], strength: 0.38 },
    { position: [0.69, 1.08, 2.51], size: [0.8 * 1.5, 0.8 * 1.5], normal: [0, 0, 1], strength: 0.38 },
  ],
  coach: [-1, 1].flatMap(side => Array.from({ length: 6 }, (_, i) => ({
    position: [side * 0.93, 1.65, -2.05 + (i + 0.5) * (4.1 / 6)],
    size: [1.35, 1.05],
    normal: [side, 0, 0],
    strength: 0.13,
  }))),
  station: [
    { position: [-0.9, 2.7, -5.5], size: [2.4, 2.4], normal: [0, 0, 0], strength: 0.3 },
    { position: [0.95, 2.7, 6.0], size: [2.4, 2.4], normal: [0, 0, 0], strength: 0.3 },
  ],
  burner: [{ position: [0, -2.02, -0.08], size: [1.7, 1.7], normal: [0, 0, 0], strength: 0.85 }],
  empty: [],
};

test('merge: tree shape, material batching and the root-offset-not-baked rule', () => {
  const { root, excluded, a } = buildRig();
  const excludedChild = excluded.children[0];
  const excludedChildGeometry = excludedChild.geometry;
  mergeStaticGeometry(root, new Set([excluded]));
  const names = root.children.map(c => [c.type, c.children.length, c.material?.name ?? null]);
  assert.deepEqual(names, [
    ['Group', 0, null], ['Mesh', 0, 'A'], ['Group', 1, null], ['Group', 1, null],
    ['Mesh', 0, 'A'], ['Mesh', 0, 'B'], ['Mesh', 0, 'C'], ['Mesh', 0, 'D'],
  ]);
  const mergedA = root.children.find((c, i) => i >= 4 && c.material?.name === 'A');
  const mergedC = root.children.find(c => c.material?.name === 'C');
  assert.equal(mergedA.geometry.index.array.constructor.name, 'Uint16Array');
  assert.equal(mergedC.geometry.index.array.constructor.name, 'Uint32Array');

  const expectedFirst = new THREE.BoxGeometry(1, 2, 3).applyMatrix4(a.matrix).attributes.position.array.slice(0, 72);
  assert.deepEqual(Array.from(mergedA.geometry.attributes.position.array.slice(0, 72)), Array.from(expectedFirst));
  assert.ok(trianglesWindCorrectly(mergedA.geometry));
  assert.ok(trianglesWindCorrectly(root.children.find(c => c.material?.name === 'B').geometry));

  assert.deepEqual(excluded.matrix.elements, new THREE.Matrix4().elements);
  assert.equal(excluded.children.length, 1);
  assert.equal(excluded.children[0], excludedChild, 'excluded subtree keeps its own mesh identity');
  assert.equal(excluded.children[0].geometry, excludedChildGeometry, 'excluded mesh keeps its own geometry');

  const nested = root.children[3];
  assert.equal(nested.children[0].children.length, 0, 'nested inner Group loses its merged-away mesh child');
});

test('merge: mismatched attributes throw and log the original console.error call', t => {
  const error = t.mock.method(console, 'error', () => {});
  assert.throws(() => mergeStaticGeometry(buildMismatchRig()), { message: 'Static geometry attributes must match' });
  assert.ok(error.mock.callCount() >= 1);
});

test('cone: fixture {18, 4.5, 0.2} geometry and material', () => {
  const cone = createLightCone({ length: 18, radius: 4.5, strength: 0.2 });
  assert.equal(cone.material.name, 'night-light-glow');
  assert.equal(cone.material.uniforms.uNight, NIGHT_UNIFORMS.uNight);
  assert.equal(cone.material.uniforms.uLength.value, 18);
  assert.equal(cone.material.uniforms.uStrength.value, 0.2);
  assert.equal(cone.material.side, THREE.BackSide);
  assert.equal(cone.material.blending, THREE.AdditiveBlending);
  assert.equal(cone.material.transparent, true);
  assert.equal(cone.material.depthWrite, false);
  assert.equal(cone.geometry.attributes.position.count, 98);
  assert.equal(cone.geometry.index.count, 288);
  cone.geometry.computeBoundingBox();
  assert.ok(Math.abs(cone.geometry.boundingBox.min.z - 0) < 1e-12);
  assert.ok(Math.abs(cone.geometry.boundingBox.max.z - 18) < 1e-12);

  assert.deepEqual(extractGlslInterface(cone.material.vertexShader), { uniforms: [], attributes: [], functions: [], conditionals: [] });
  assert.deepEqual(extractGlslInterface(cone.material.fragmentShader), { uniforms: ['float uLength', 'float uNight', 'float uStrength'].sort(), attributes: [], functions: [], conditionals: [] });
});

test('glow: single fixture bounds + attribute layout, empty list gives radius -1', () => {
  const glow = createLightGlows([{ position: [1, 2, 3], size: [3, 4], normal: [0, 0, 1], strength: 0.5 }]);
  assert.equal(glow.geometry.instanceCount, 1);
  assert.deepEqual(glow.geometry.boundingSphere.center.toArray(), [1, 2, 3]);
  assert.ok(Math.abs(glow.geometry.boundingSphere.radius - 2.5 * Math.sqrt(3)) < 1e-12);
  assert.equal('normal' in glow.geometry.attributes, false);
  for (const [key, itemSize] of [['glowCenter', 3], ['glowSize', 2], ['glowNormal', 3], ['glowStrength', 1]]) {
    assert.equal(glow.geometry.attributes[key].itemSize, itemSize);
    assert.equal(glow.geometry.attributes[key].meshPerAttribute, 1);
  }
  assert.equal(glow.material.side, THREE.FrontSide);
  assert.equal(glow.material.depthTest, true);
  assert.equal(glow.material.name, 'night-light-glow');
  assert.equal(glow.material.uniforms.uNight, NIGHT_UNIFORMS.uNight);

  const empty = createLightGlows([]);
  assert.equal(empty.geometry.instanceCount, 0);
  assert.equal(empty.geometry.boundingSphere.radius, -1);

  assert.deepEqual(extractGlslInterface(glow.material.vertexShader), { uniforms: [], attributes: ['float glowStrength', 'vec2 glowSize', 'vec3 glowCenter', 'vec3 glowNormal'].sort(), functions: [], conditionals: [] });
  assert.deepEqual(extractGlslInterface(glow.material.fragmentShader), { uniforms: ['float uNight'], attributes: [], functions: [], conditionals: [] });
});

test('parity: merge output deep-equals the original on the synthetic rig', { skip }, () => {
  const rigA = buildRig();
  originalStatic.mergeStaticGeometry(rigA.root, new Set([rigA.excluded]));
  const rigB = buildRig();
  mergeStaticGeometry(rigB.root, new Set([rigB.excluded]));
  assert.deepEqual(describeTree(rigB.root), describeTree(rigA.root));
});

test('parity: merge error message matches the original', { skip }, t => {
  t.mock.method(console, 'error', () => {});
  let originalMessage;
  let cloneMessage;
  try { originalStatic.mergeStaticGeometry(buildMismatchRig()); } catch (e) { originalMessage = e.message; }
  try { mergeStaticGeometry(buildMismatchRig()); } catch (e) { cloneMessage = e.message; }
  assert.ok(cloneMessage, 'clone must throw');
  assert.equal(cloneMessage, originalMessage);
});

test('parity: cone fixture matches the original', { skip }, () => {
  const clone = createLightCone({ length: 18, radius: 4.5, strength: 0.2 });
  const original = originalGlows.createLightCone({ length: 18, radius: 4.5, strength: 0.2 });
  assert.deepEqual(describeEffectMesh(clone), describeEffectMesh(original));
});

test('parity: glow fixture groups match the original', { skip }, () => {
  for (const [name, lights] of Object.entries(GLOW_FIXTURE_GROUPS)) {
    const clone = createLightGlows(lights);
    const original = originalGlows.createLightGlows(lights);
    assert.deepEqual(describeEffectMesh(clone), describeEffectMesh(original), name);
  }
});
