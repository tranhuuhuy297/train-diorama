// Village and windmill logic on stub worlds (no oracle): shutter angle cycle, the smoke formula,
// rotor spin, shrub instances, the windmill site search and the windmill's structure.
import '../../src/core/disable-three-color-management.js';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { wrapAngle } from '../../src/core/scalar-math-helpers.js';
import { SHUTTER_ANGLES, shutterAngleIndex } from '../../src/world/village/village-house-windows-and-shutters.js';
import { updateChimneySmoke } from '../../src/world/village/village-chimney-smoke.js';
import { buildVillageShrubs, SHRUB_COLORS } from '../../src/world/village/village-shrubs-instanced.js';
import { buildVillage } from '../../src/world/village/village-house-placement.js';
import { findWindmillSite, buildWindmill } from '../../src/world/windmill/windmill-site-and-body.js';
import { updateWindmillRotor } from '../../src/world/windmill/windmill-rotor.js';

const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);

// Splits one instance matrix back into position, scale and yaw (from where the local +Z axis points).
function instanceTransform(mesh, index) {
  const matrix = new THREE.Matrix4();
  mesh.getMatrixAt(index, matrix);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  matrix.decompose(position, new THREE.Quaternion(), scale);
  return { position, scale, yaw: Math.atan2(matrix.elements[8], matrix.elements[10]) };
}

describe('cottage details', () => {
  test('shutter angle index cycles over windows, sides and houses', () => {
    const table = n => [[0, -1], [0, 1], [1, -1], [1, 1]].map(([w, side]) => shutterAngleIndex(n, w, side));
    assert.deepEqual([1, 2, 3, 4].map(table), [[3, 0, 1, 2], [2, 3, 0, 1], [1, 2, 3, 0], [0, 1, 2, 3]]);
    assert.deepEqual(table(5), table(1));
    assert.deepEqual(SHUTTER_ANGLES, [0.18, 0.55, 1.05, 1.42]);
  });

  test('chimney smoke starts hidden at the chimney, swells mid-cycle and spins by dt', () => {
    const puff = { mesh: new THREE.Mesh(), x: 0.5, z: -0.4, top: 3, phase: 0, driftX: 0.5, driftZ: 0, wobble: 0, size: 1, spin: 0.4 };
    updateChimneySmoke([puff], 0, 0.1);
    assert.deepEqual(puff.mesh.position.toArray(), [0.5, 3, -0.4]);
    assert.deepEqual(puff.mesh.scale.toArray(), [0, 0, 0]);
    updateChimneySmoke([puff], 1.75, 0.1);
    const { y } = puff.mesh.position;
    assert.ok(y > 4.47 && y < 4.53, `mid-cycle height ${y}`);
    [0.85 * 0.85, 0.85 * 1.18, 0.85 * 0.85].forEach((expected, axis) => near(puff.mesh.scale.getComponent(axis), expected, 1e-12, `scale ${axis}`));
    near(puff.mesh.rotation.y, 0.08, 1e-12, 'spin');
  });

  test('the rotor rolls back by dt times 0.9, step by step', () => {
    const world = { windmillBlades: new THREE.Group() };
    for (const dt of [1 / 60, 0.05]) updateWindmillRotor(world, dt);
    assert.ok(Object.is(world.windmillBlades.rotation.z, 0 - (1 / 60) * 0.9 - 0.05 * 0.9));
  });
});

describe('village shrubs', () => {
  const stub = { heightAt: () => 1, group: new THREE.Group() };
  const far = new THREE.Group();
  far.position.set(10, 0, 0);
  const shrubs = buildVillageShrubs(stub, [{ house: new THREE.Group(), width: 2, depth: 2.2 }, { house: far, width: 2.4, depth: 3 }]);

  test('six instances per house on house-local spots, sized and tinted by index', () => {
    assert.equal(shrubs.count, 12);
    assert.equal(shrubs.parent, stub.group);
    const first = instanceTransform(shrubs, 0);
    [-0.54, 1 + 0.38 * 0.48, -1.22].forEach((expected, axis) => near(first.position.getComponent(axis), expected, 1e-6, `position ${axis}`));
    [0.38, 0.38 * 0.83, 0.38 * 0.9].forEach((expected, axis) => near(first.scale.getComponent(axis), expected, 1e-6, `scale ${axis}`));
    near(instanceTransform(shrubs, 5).scale.x, 0.435, 1e-6, 'instance 5 size');
    const seventh = instanceTransform(shrubs, 6);
    near(seventh.yaw, wrapAngle(14.4), 1e-6, 'instance 6 yaw');
    near(seventh.position.x, 10 + -2.4 * 0.27, 1e-6, 'instance 6 sits behind the second house');
    const tint = index => new THREE.Color().fromArray(shrubs.instanceColor.array, index * 3);
    assert.equal(tint(6).getHexString(), SHRUB_COLORS[2].slice(1));
    assert.equal(SHRUB_COLORS[2], '#3f873d');
    // Instance colours are stored as float32.
    assert.deepEqual(tint(1).toArray(), new THREE.Color('#65ab41').toArray().map(Math.fround));
  });
});

describe('village placement guard', () => {
  test('a valley with no buildable ground spends all 600 tries, then throws', () => {
    const rand = mulberry32(42);
    const stub = {
      rand, heightAt: () => 0, nearest: () => ({ i: 0, d: 50 }), excluded: () => false,
      exclusions: [], houseSmoke: [], noShadow: [], group: new THREE.Group(),
    };
    assert.throws(() => buildVillage(stub), { message: 'Village residents require two houses' });
    const reference = mulberry32(42);
    for (let draw = 0; draw < 1200; draw++) reference();
    assert.equal(rand(), reference());
    assert.equal(stub.group.children.length, 0);
  });
});

describe('windmill site search', () => {
  test('keeps the first strictly highest clear sample and always draws 600 times', () => {
    const stub = { rand: mulberry32(42), nearest: x => ({ i: 0, d: x < 22 ? 5 : 10 }), heightAt: (x, z) => -Math.abs(z + 10) };
    const site = findWindmillSite(stub);
    const replay = mulberry32(42);
    let expected = null;
    for (let sample = 0; sample < 300; sample++) {
      const x = 24 + (replay() - 0.5) * 16;
      const z = -10 + (replay() - 0.5) * 16;
      if (x >= 22 && (expected === null || -Math.abs(z + 10) > expected.y)) expected = { x, y: -Math.abs(z + 10), z };
    }
    assert.deepEqual(site.toArray(), [expected.x, expected.y, expected.z]);
    assert.equal(stub.rand(), replay());
  });

  test('falls back to (24, 0, -10) when every sample is too close to the track', () => {
    const rand = mulberry32(7);
    assert.deepEqual(findWindmillSite({ rand, nearest: () => ({ i: 0, d: 0 }), heightAt: () => 5 }).toArray(), [24, 0, -10]);
    const replay = mulberry32(7);
    for (let draw = 0; draw < 600; draw++) replay();
    assert.equal(rand(), replay());
  });
});

describe('windmill structure', () => {
  const pads = [];
  const stub = {
    rand: mulberry32(42), nearest: () => ({ i: 0, d: 10 }), heightAt: () => 2, flattenBuildingGround: pad => pads.push(pad),
    exclusions: [], group: new THREE.Group(), windmillBlades: new THREE.Group(),
  };
  buildWindmill(stub);
  const windmill = stub.windmillBlades.parent;

  test('fourteen children in build order and 65 unmerged meshes', () => {
    assert.equal(windmill.parent, stub.group);
    const kinds = windmill.children.map(child => (child.isMesh ? child.geometry.type : child.type));
    assert.deepEqual(kinds, [
      'CylinderGeometry', 'CylinderGeometry', 'ConeGeometry', ...Array(8).fill('BoxGeometry'), 'Group', 'Group', 'Group',
    ]);
    assert.equal(windmill.children[13], stub.windmillBlades);
    let meshes = 0;
    windmill.traverse(object => { if (object.isMesh) meshes++; });
    assert.equal(meshes, 65);
  });

  test('rotor, roof height, pad, exclusion and bale stacks on the levelled ground', () => {
    const { x, y, z } = windmill.position;
    assert.deepEqual(stub.windmillBlades.position.toArray(), [0, 5.4, 1.3]);
    assert.equal(stub.windmillBlades.children.length, 5);
    assert.ok(Object.is(stub.windmillRoofHeight, y + 6.3 + 0.8));
    assert.equal(pads.length, 1);
    const [pad] = pads;
    assert.deepEqual([pad.width, pad.depth, pad.falloff, pad.height, pad.x, pad.z], [3.64, 3.64, 3.5, 2, x, z]);
    assert.ok(Object.is(pad.rotation, Math.atan2(-pad.x, 30 - pad.z)));
    assert.deepEqual(stub.exclusions.at(-1), { x: pad.x, z: pad.z, r: 4.5 });
    for (const stack of windmill.children.slice(11, 13)) assert.ok(Object.is(stack.position.y, 2 - y - 0.05));
  });
});
