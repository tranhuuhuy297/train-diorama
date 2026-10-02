// The allButWorldCore hide set (run in node against a fake page diorama) and the strict world-core
// shots: membership, stage gating and validation.
import '../../src/core/disable-three-color-management.js';
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { npr } from '../../src/materials/npr-cel-material-factory.js';
import { createCloneWorld, WORLD_CORE_SKIP } from '../helpers/clone-world-factory.mjs';
import { applyHideSetsInPage, WORLD_CORE_MATERIAL_KEYS } from '../../tools/parity/page-hide-set-application.mjs';
import { PARITY_SHOTS, selectShots, validateShotList } from '../../tools/parity/parity-shot-list.mjs';

const world = createCloneWorld({ stopAfter: 'buildTerrain', skip: WORLD_CORE_SKIP });

function fakePageDiorama() {
  const scene = new THREE.Scene();
  scene.add(world.group);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial());
  const villageWood = new THREE.Mesh(new THREE.BoxGeometry(), npr({ color: '#6e4a32', stipple: 0.1, stippleScale: 3 }));
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial({ name: 'night-light-glow' }));
  const puff = new THREE.Mesh(new THREE.BoxGeometry(), npr({ color: '#fbfbff', stipple: 0.3, stippleScale: 2.2 }));
  scene.add(sky, villageWood, glow, puff);
  return { scene, sky, world, puffs: [{ mesh: puff }], extras: [villageWood, glow, puff] };
}

const runInPage = (d, requested) => {
  globalThis.window = { __diorama: d, __parityHidden: globalThis.window?.__parityHidden ?? [] };
  return applyHideSetsInPage({ requested, worldCoreKeys: WORLD_CORE_MATERIAL_KEYS });
};

after(() => { delete globalThis.window; });

describe('allButWorldCore hide set', () => {
  test('material keys cover exactly the flat-coloured world-core materials', () => {
    const keys = new Set();
    world.group.traverse(object => {
      const { material } = object;
      if (!object.isMesh || 'FLOWERS' in material.defines || 'STRATA' in material.defines) return;
      keys.add(`${material.uniforms.uColor.value.getHexString()}|${material.uniforms.uStipple.value}`);
    });
    assert.deepEqual([...keys].sort(), [...WORLD_CORE_MATERIAL_KEYS].sort());
  });

  test('hides every other mesh, keeps the sky and the 53 world-core meshes', () => {
    const d = fakePageDiorama();
    assert.deepEqual(runInPage(d, ['allButWorldCore']), { allButWorldCore: 3 });
    assert.ok(d.extras.every(mesh => !mesh.visible));
    assert.ok(d.sky.visible && world.group.children.every(mesh => mesh.visible));
    runInPage(d, []);
    assert.ok(d.extras.every(mesh => mesh.visible));
  });

  test('overlapping families restore the original visibility', () => {
    const d = fakePageDiorama();
    d.extras[0].visible = false;
    runInPage(d, ['allButWorldCore', 'puffs']);
    runInPage(d, []);
    assert.deepEqual(d.extras.map(mesh => mesh.visible), [false, true, true]);
  });

  test('unknown family throws', () => {
    assert.throws(() => runInPage(fakePageDiorama(), ['nope']), /Unknown hide set: nope/);
  });
});

describe('world-core shots', () => {
  const ids = ['world-core-overview', 'world-core-bridge'];
  test('are valid strict shell-stage shots once every building pad exists on both sites', () => {
    assert.deepEqual(validateShotList(), []);
    const shots = ids.map(id => PARITY_SHOTS.find(shot => shot.id === id));
    for (const shot of shots) {
      assert.deepEqual([shot.reportOnly, shot.hide, shot.seconds, shot.timeOfDay, shot.pixelShortSide, shot.outline], [false, ['allButWorldCore'], 0, 'day', null, true]);
    }
    assert.deepEqual(shots.map(shot => shot.reference), ['14-overview-day-settled.png', '06b-bridge-camera-later.png']);
    assert.equal(shots[0].camera, null);
    assert.deepEqual(shots[1].camera, { position: [-3, 5.5, 60], target: [0, 8.5, 36], fov: 42 });
    const shell = selectShots({ stage: 'shell-and-sky' }).map(shot => shot.id);
    assert.ok(ids.every(id => shell.includes(id)));
    assert.deepEqual(selectShots({ ids }).map(shot => shot.id), ids);
  });
});
