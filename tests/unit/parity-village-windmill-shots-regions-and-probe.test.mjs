// Village and windmill parity tooling in node against fake pages on a real clone world: the shots,
// the unbuiltAfterWindmill hide set, region projection and cropping, and the probe section.
import '../../src/core/disable-three-color-management.js';
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { applyHideSetsInPage, WORLD_CORE_MATERIAL_KEYS } from '../../tools/parity/page-hide-set-application.mjs';
import { PARITY_SHOTS, ACTIVE_PARITY_STAGE, selectShots, validateShotList, expandHideSets } from '../../tools/parity/parity-shot-list.mjs';
import { ZOOMED, HOME, TARGET } from '../../tools/parity/parity-shot-factory-and-camera-poses.mjs';
import { REGION_NAMES, computeRegionsInPage, toDeviceRegion, selectRegions } from '../../tools/parity/shot-region-projection.mjs';
import { collectVillageWindmillProbe } from '../../tools/parity/village-windmill-runtime-probe.mjs';

const VILLAGE_IDS = ['village-windmill-overview-day', 'village-windmill-zoomed-day', 'village-windmill-evening', 'village-windmill-zoomed-night'];
const world = createCloneWorld({ stopAfter: 'buildTerrain' });
const VIEWPORT = { innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1 };

// Page stand-in: a diorama at the overview home pose around the shared clone world.
function fakeDiorama(extra = {}) {
  const camera = new THREE.PerspectiveCamera(42, 1600 / 900, 0.3, 1500);
  camera.position.fromArray(HOME);
  camera.lookAt(...TARGET);
  const renderer = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }) } };
  return { world, camera, renderer, ...extra };
}
const inPage = (d, run, argument) => {
  globalThis.window = { ...VIEWPORT, __diorama: d, __parityHidden: globalThis.window?.__parityHidden ?? [] };
  return run(argument);
};

after(() => { delete globalThis.window; });

describe('village and windmill shots', () => {
  test('four strict regional shots in the village-and-windmill stage', () => {
    assert.deepEqual(validateShotList(), []);
    assert.equal(ACTIVE_PARITY_STAGE, 'residents-and-forest');
    const shots = VILLAGE_IDS.map(id => PARITY_SHOTS.find(shot => shot.id === id));
    assert.deepEqual(selectShots({ stage: 'village-and-windmill' }).map(shot => shot.id).slice(-VILLAGE_IDS.length), VILLAGE_IDS);
    for (const shot of shots) {
      assert.deepEqual([shot.stage, shot.reportOnly, shot.seconds, shot.thresholdClass, shot.regions], ['village-and-windmill', false, 3, 'deterministic', ['village', 'windmill']]);
      assert.deepEqual(expandHideSets(shot.hide), ['unbuiltAfterWindmill', 'puffs', 'sparks']);
    }
    assert.deepEqual(shots.map(shot => [shot.timeOfDay, shot.camera, shot.reference]), [
      ['day', null, '14-overview-day-settled.png'], ['day', ZOOMED, '12-overview-zoomed-in.png'],
      ['evening', null, '03-overview-evening.png'], ['night', ZOOMED, '17-night-overview-zoomed.png'],
    ]);
    assert.ok(validateShotList([{ ...shots[0], regions: ['pond'] }]).some(error => error.includes('unknown region pond')));
  });
});

describe('unbuiltAfterWindmill hide set', () => {
  test('keeps the windmill and its four terrain meshes, hides later children, figures and birds', () => {
    const later = [new THREE.Group(), new THREE.Mesh()];
    const figure = new THREE.Group();
    const birds = new THREE.Group();
    world.group.add(...later);
    try {
      const d = fakeDiorama({ birds: { group: birds } });
      world.stationTravelers.push({ figure });
      const counts = inPage(d, applyHideSetsInPage, { requested: ['unbuiltAfterWindmill'], worldCoreKeys: WORLD_CORE_MATERIAL_KEYS });
      assert.deepEqual(counts, { unbuiltAfterWindmill: 4 });
      assert.ok([...later, figure, birds].every(object => !object.visible));
      assert.ok(world.group.children.slice(0, -2).every(object => object.visible));
      inPage(d, applyHideSetsInPage, { requested: [], worldCoreKeys: WORLD_CORE_MATERIAL_KEYS });
      assert.ok([...later, figure, birds].every(object => object.visible));
    } finally {
      world.stationTravelers.length = 0;
      world.group.remove(...later);
    }
    assert.deepEqual(inPage(fakeDiorama(), applyHideSetsInPage, { requested: ['unbuiltAfterWindmill'], worldCoreKeys: [] }), { unbuiltAfterWindmill: 0 });
  });
});

describe('regions', () => {
  test('village and windmill project inside the viewport around their parts', () => {
    const { devicePixelRatio, regions } = inPage(fakeDiorama(), computeRegionsInPage, { names: REGION_NAMES, padding: 12 });
    assert.equal(devicePixelRatio, 1);
    assert.deepEqual(regions.map(region => region.name), ['village', 'windmill']);
    const d = fakeDiorama();
    d.camera.updateMatrixWorld();
    const centres = [...new Set(world.houseSmoke.map(puff => puff.mesh.parent)), world.windmillBlades.parent];
    for (const [index, object] of centres.entries()) {
      const { x, y } = object.getWorldPosition(new THREE.Vector3()).project(d.camera);
      const [px, py] = [((x + 1) / 2) * 1600, ((1 - y) / 2) * 900];
      const region = regions[index === centres.length - 1 ? 1 : 0];
      assert.ok(px > region.x && px < region.x + region.w && py > region.y && py < region.y + region.h, `${region.name} misses part ${index}`);
    }
    for (const region of regions) assert.ok(region.x >= 0 && region.y >= 0 && region.x + region.w <= 1600 && region.y + region.h <= 900);
  });

  test('device crops scale, round outward and clamp; selection by name', () => {
    assert.deepEqual(toDeviceRegion({ name: 'a', x: 10.5, y: 3, w: 20, h: 7.2 }, 2, 1000, 1000), { name: 'a', x: 21, y: 6, w: 40, h: 15 });
    assert.deepEqual(toDeviceRegion({ name: 'b', x: 390, y: 800, w: 50, h: 100 }, 2, 800, 1688), { name: 'b', x: 780, y: 1600, w: 20, h: 88 });
    assert.equal(toDeviceRegion({ name: 'c', x: 900, y: 0, w: 10, h: 10 }, 1, 800, 600), null);
    const regions = [{ name: 'village' }, { name: 'windmill' }];
    assert.deepEqual(selectRegions(regions), regions);
    assert.deepEqual(selectRegions(regions, 'none'), []);
    assert.deepEqual(selectRegions(regions, 'windmill'), [regions[1]]);
    assert.deepEqual(selectRegions(undefined), []);
  });
});

describe('village probe section', () => {
  test('exact layout and animation fields from parity-surface names', () => {
    const probe = inPage(fakeDiorama(), collectVillageWindmillProbe);
    const windmill = world.windmillBlades.parent;
    assert.equal(probe.houseCount, world.houseSmoke.length / 12);
    assert.deepEqual(probe.villageHomePositions, world.villageHomes.map(home => home.house.position.toArray()));
    assert.deepEqual(probe.windmillPosition, windmill.position.toArray());
    assert.deepEqual(probe.windmillQuaternion, windmill.quaternion.toArray());
    assert.deepEqual([probe.windmillRoofHeight, probe.bladeChildCount, probe.bladeRotationZ], [world.windmillRoofHeight, 5, 0]);
    assert.equal(probe.smokeTransforms.length, world.houseSmoke.length);
    assert.deepEqual(probe.smokeTransforms[0], [0, 0, 0, 0, 0, 0, 0]);
    assert.equal(inPage({ world: { houseSmoke: [] } }, collectVillageWindmillProbe), null);
  });
});
