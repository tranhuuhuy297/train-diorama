// Scene composition order: world, train, sparks, sky, then the 70 puffs (insertion order sets UUID,
// material.id and glow order), the shadow-hidden list, the train glows at the end of the glow registry,
// and the departure state set before the sky.
import '../../src/core/disable-three-color-management.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installMinimalDomShim } from '../helpers/minimal-dom-shim.mjs';
import { composeDioramaScene } from '../../src/engine/diorama-scene-composition.js';

installMinimalDomShim();

test('composeDioramaScene inserts world, train, sparks, sky and puffs in order with the matching shadow list', () => {
  const d = { scene: new THREE.Scene() };
  composeDioramaScene(d);
  const puffMeshes = d.puffs.map(puff => puff.mesh);
  assert.equal(d.puffs, d.puffPool.puffs, 'the parity surface exposes the pool records themselves');
  assert.equal(puffMeshes.length, 70);
  assert.deepEqual(d.scene.children, [d.world.group, d.train.group, d.brakeSparks.mesh, d.sky, ...puffMeshes]);
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

  assert.equal(d.s, d.world.stationS + 1);
  assert.equal(d.speed, 2);
  assert.equal(d.justLeft, true);
});
