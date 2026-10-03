// Scene composition order: world, bird flocks, train, sparks, sky, then the 70 puffs (insertion order sets UUID,
// material.id and glow order), the shadow-hidden list, the train glows at the end of the glow registry,
// and the departure state set before the sky.
import '../../src/core/disable-three-color-management.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installMinimalDomShim } from '../helpers/minimal-dom-shim.mjs';
import { composeDioramaScene } from '../../src/engine/diorama-scene-composition.js';

installMinimalDomShim();

test('composeDioramaScene inserts world, birds, train, sparks, sky and puffs in order with the matching shadow list', () => {
  const d = { scene: new THREE.Scene() };
  composeDioramaScene(d);
  const puffMeshes = d.puffs.map(puff => puff.mesh);
  assert.equal(d.puffs, d.puffPool.puffs, 'the parity surface exposes the pool records themselves');
  assert.equal(puffMeshes.length, 70);
  // Identity checks: a failing deepEqual over whole scene graphs would exhaust memory while diffing.
  const expectedChildren = [d.world.group, d.birds.group, d.train.group, d.brakeSparks.mesh, d.sky, ...puffMeshes];
  assert.equal(d.scene.children.length, expectedChildren.length);
  assert.ok(d.scene.children.every((child, index) => child === expectedChildren[index]), 'scene child order');
  assert.equal(d.birds.group.name, 'Bird flocks');
  assert.equal(d.birds.flocks.length, 7);
  assert.ok(!d.shadowHiddenObjects.includes(d.birds.group), 'birds cast shadows');
  assert.ok(puffMeshes.every(mesh => !mesh.visible && mesh.geometry === puffMeshes[0].geometry && mesh.material === puffMeshes[0].material));

  const expectedShadowList = [d.sky, d.brakeSparks.mesh, ...d.world.noShadow, ...d.train.noShadow, ...puffMeshes];
  assert.equal(d.shadowHiddenObjects.length, expectedShadowList.length);
  assert.ok(d.shadowHiddenObjects.every((object, index) => object === expectedShadowList[index]));
  assert.equal(d.shadowVisibility.length, d.shadowHiddenObjects.length);

  // Halos, beam cone, then one window-halo set per coach, in scene order after the world's glows.
  const trainGlows = d.train.noShadow.slice(3);
  assert.equal(trainGlows.length, 6);
  assert.ok(d.nightGlows.slice(-6).every((glow, index) => glow === trainGlows[index]));
  assert.ok(d.nightGlows.slice(0, -6).every(glow => !trainGlows.includes(glow)));

  for (const key of ['position', 'target']) {
    assert.deepEqual(d.freeCameraPose[key].toArray(), d.world.freeCameraStart[key].toArray());
    assert.notEqual(d.freeCameraPose[key], d.world.freeCameraStart[key], 'pose owns its vectors');
  }
  assert.equal(d.s, d.world.stationS + 1);
  assert.equal(d.speed, 2);
  assert.equal(d.justLeft, true);
});
