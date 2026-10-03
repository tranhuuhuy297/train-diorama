// Water/cloud/balloon parity tooling in node against fake pages on a full clone world: the shot records,
// the waterfall region, the probe section read from the world, and the cross-site comparison rules.
import '../../src/core/disable-three-color-management.js';
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { PARITY_SHOTS, ACTIVE_PARITY_STAGE, expandHideSets, validateShotList } from '../../tools/parity/parity-shot-list.mjs';
import { ZOOMED, HOME, TARGET } from '../../tools/parity/parity-shot-factory-and-camera-poses.mjs';
import { BALLOON_VIEW, WATER_VIEW, WATERFALL_VIEW } from '../../tools/parity/water-clouds-balloon-parity-shots.mjs';
import { computeRegionsInPage } from '../../tools/parity/shot-region-projection.mjs';
import {
  collectWaterCloudsBalloonProbe, compareWaterCloudsBalloonProbe, balloonPositionAt,
} from '../../tools/parity/water-clouds-balloon-runtime-probe.mjs';
import { updateBalloonFlight } from '../../src/world/balloon/hot-air-balloon-burner-flame-and-flight.js';

const world = createCloneWorld();
const byId = id => PARITY_SHOTS.find(shot => shot.id === id);
const inPage = (d, run, argument) => {
  globalThis.window = { innerWidth: 1600, innerHeight: 900, devicePixelRatio: 1, __diorama: d };
  return run(argument);
};
after(() => { delete globalThis.window; });

function fakeDiorama(time) {
  const camera = new THREE.PerspectiveCamera(42, 1600 / 900, 0.3, 1500);
  camera.position.fromArray(HOME);
  camera.lookAt(...TARGET);
  const renderer = { domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1600, height: 900 }) } };
  updateBalloonFlight(world, time);
  return { world, camera, renderer, time };
}

describe('water, cloud and balloon shots', () => {
  test('ten strict forest-stage shots stepped to sim time 10.05 s', () => {
    assert.deepEqual(validateShotList(), []);
    assert.equal(ACTIVE_PARITY_STAGE, 'full-scene');
    const rows = [
      ['overview-zoomed-day-masked', 'day', ZOOMED], ['overview-zoomed-night-masked', 'night', ZOOMED],
      ['overview-day-waterfall-roi', 'day', null], ['balloon-closeup-day', 'day', BALLOON_VIEW], ['balloon-closeup-night', 'night', BALLOON_VIEW],
      ['water-closeup-day', 'day', WATER_VIEW], ['water-closeup-night', 'night', WATER_VIEW],
      ['waterfall-closeup-day', 'day', WATERFALL_VIEW], ['waterfall-closeup-night', 'night', WATERFALL_VIEW], ['clouds-debug-hidden', 'day', null],
    ];
    for (const [id, timeOfDay, camera] of rows) {
      const shot = byId(id);
      assert.deepEqual([shot.stage, shot.timeOfDay, shot.seconds * 60, shot.thresholdClass, shot.fresh, shot.reportOnly, shot.camera],
        ['residents-and-forest', timeOfDay, 600, 'deterministic', true, false, camera], id);
      const hidden = ['puffs', 'sparks', ...(id.startsWith('waterfall-closeup') ? ['clouds'] : [])];
      assert.deepEqual(expandHideSets(shot.hide), hidden, id);
    }
    assert.deepEqual(byId('overview-day-waterfall-roi').regions, ['waterfall']);
    assert.equal(byId('clouds-debug-hidden').debugLayerOff, 'Clouds');
  });

  test('the balloon close-up looks at the balloon where it flies at t = 10.05 s', () => {
    const [x, y, z] = balloonPositionAt(10.05);
    assert.ok(Math.hypot(x - 31.918, y - 25.858, z - 4.958) < 1e-3);
    const view = new THREE.Vector3(...BALLOON_VIEW.target).sub(new THREE.Vector3(...BALLOON_VIEW.position)).normalize();
    const toBalloon = new THREE.Vector3(x, y, z).sub(new THREE.Vector3(...BALLOON_VIEW.position)).normalize();
    assert.ok(view.dot(toBalloon) > 0.99);
  });

  test('the waterfall region frames the curtain below the front edge', () => {
    const { regions } = inPage(fakeDiorama(0.05), computeRegionsInPage, { names: ['waterfall'], padding: 12 });
    assert.equal(regions.length, 1);
    const [{ x, y, w, h }] = regions;
    // The curtain spans about 11 m across and 18 m down near the bottom middle of the home view.
    assert.ok(x > 400 && x + w < 1200 && y > 300 && h > 40 && w > 40, JSON.stringify(regions[0]));
  });
});

describe('water, cloud and balloon probe section', () => {
  test('reads the layout, balloon and water state of a full world', () => {
    const section = inPage(fakeDiorama(10.050000000000079), collectWaterCloudsBalloonProbe);
    assert.equal(section.cloudCount, 33);
    assert.equal(section.instanceTotal, 464);
    assert.deepEqual(section.clouds.map(cloud => cloud.instanceCount).slice(0, 4), [15, 12, 14, 12]);
    assert.deepEqual(section.balloon, balloonPositionAt(10.050000000000079));
    assert.deepEqual(section.water, { heightTexBound: true, size: 124, inNoShadow: true });
    assert.deepEqual(section.waterfall, { side: 2, vertices: 225, indices: 1152, inNoShadow: true });
    assert.deepEqual(compareWaterCloudsBalloonProbe(section, structuredClone(section)), { pass: true, failures: [] });
    assert.equal(inPage({ world: createCloneWorld({ stopAfter: 'buildClouds' }), time: 0 }, collectWaterCloudsBalloonProbe), null);
  });

  test('flags a missing section, a broken expectation and any cross-site difference', () => {
    const section = inPage(fakeDiorama(3), collectWaterCloudsBalloonProbe);
    assert.match(compareWaterCloudsBalloonProbe(section, null).failures[0], /section missing/);
    const shifted = structuredClone(section);
    shifted.clouds[7].speed += 1e-12;
    assert.deepEqual(compareWaterCloudsBalloonProbe(section, shifted).failures, ['sites differ in clouds']);
    const offPath = { ...structuredClone(section), balloon: [0, 0, 0] };
    assert.ok(compareWaterCloudsBalloonProbe(section, offPath).failures.some(failure => failure.startsWith('clone balloon')));
    const dry = { ...structuredClone(section), water: null };
    assert.ok(compareWaterCloudsBalloonProbe(dry, section).failures.some(failure => failure.startsWith('original water')));
  });
});
