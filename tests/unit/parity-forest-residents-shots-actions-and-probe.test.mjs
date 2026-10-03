// Residents/forest parity tooling in node: the stage's shots and their validation, the water and
// figure/bird hide sets, the in-page shot actions, the probe section and the same-site checks.
import '../../src/core/disable-three-color-management.js';
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { applyHideSetsInPage } from '../../tools/parity/page-hide-set-application.mjs';
import { PARITY_SHOTS, ACTIVE_PARITY_STAGE, validateShotList, expandHideSets } from '../../tools/parity/parity-shot-list.mjs';
import { ZOOMED_ORBITED } from '../../tools/parity/parity-shot-factory-and-camera-poses.mjs';
import { IN_PAGE_CAMERA_POSES, resolveInPageCameraPose, toggleDebugLayerInPage } from '../../tools/parity/page-shot-actions.mjs';
import { collectForestResidentsProbe, compareForestResidentsProbe } from '../../tools/parity/forest-residents-runtime-probe.mjs';
import { shotActionFailures, runIntraSiteChecks } from '../../tools/parity/intra-site-shot-checks.mjs';

const world = createCloneWorld();
const byId = id => PARITY_SHOTS.find(shot => shot.id === id);
const inPage = (d, run, argument) => {
  globalThis.window = { __diorama: d, __parityHidden: globalThis.window?.__parityHidden ?? [] };
  return run(argument);
};
after(() => { delete globalThis.window; });

describe('residents and forest shots', () => {
  test('stage, masks, poses, actions and freshness', () => {
    assert.equal(ACTIVE_PARITY_STAGE, 'full-scene');
    assert.deepEqual(validateShotList(), []);
    const masked = ['puffs', 'sparks'];
    for (const id of ['overview-day-settled-masked', 'overview-zoomed-orbited-masked', 'overview-night-masked', 'village-residents-yard', 'trees-debug-hidden']) {
      const shot = byId(id);
      assert.deepEqual([shot.stage, shot.thresholdClass, shot.reportOnly, expandHideSets(shot.hide)], ['residents-and-forest', 'deterministic', false, masked]);
    }
    assert.deepEqual([byId('village-residents-yard').seconds, byId('village-residents-yard').inPageCameraPose], [8, 'villageResidentYard']);
    assert.equal(byId('overview-zoomed-orbited-masked').camera, ZOOMED_ORBITED);
    assert.deepEqual(['trees-sway-t0', 'trees-sway-t1', 'trees-sway-hold'].map(id => [byId(id).seconds, byId(id).uniformTimeOffset, byId(id).holdPausedFrames, byId(id).fresh]),
      [[0, 0, 0, true], [0, 5, 0, true], [0, 5, 20, true]]);
    assert.deepEqual([byId('trees-sway-t1').relation.to, byId('trees-sway-hold').relation], ['trees-sway-t0', { to: 'trees-sway-t1', expect: 'identical' }]);
    assert.deepEqual([byId('trees-debug-hidden').debugLayerOff, byId('trees-debug-hidden').fresh], ['Trees', true]);
    const bad = [{ ...byId('trees-sway-t1'), relation: { to: 'nope', expect: 'differs', minOverFraction: 0.1 } }, { ...byId('village-residents-yard'), inPageCameraPose: 'nowhere' }];
    const errors = validateShotList([...PARITY_SHOTS.filter(shot => !['trees-sway-t1', 'village-residents-yard'].includes(shot.id)), ...bad]);
    assert.ok(errors.some(error => error.includes('bad relation')) && errors.some(error => error.includes('unknown in-page pose nowhere')), errors.join('\n'));
  });
});

describe('hide sets and in-page actions', () => {
  test('water hides the water and waterfall meshes only; figures resolve to both station travelers', () => {
    const d = { world, scene: new THREE.Scene() };
    assert.deepEqual(inPage(d, applyHideSetsInPage, { requested: ['birds', 'stationFigures'], worldCoreKeys: [] }), { birds: 0, stationFigures: 2 });
    inPage(d, applyHideSetsInPage, { requested: [], worldCoreKeys: [] });
    assert.ok(world.stationTravelers.every(traveler => traveler.figure.visible));
    const [water, waterfall] = world.group.children.filter(child => child.isMesh && child.material.uniforms && !child.material.uniforms.uColor);
    assert.ok(water.material.uniforms.uHeight && waterfall.material.side === THREE.DoubleSide);
    assert.deepEqual(inPage(d, applyHideSetsInPage, { requested: ['water', 'clouds', 'balloon'], worldCoreKeys: [] }), { water: 2, clouds: 33, balloon: 1 });
    assert.ok(!water.visible && !waterfall.visible && !world.balloon.visible && world.clouds.every(cloud => !cloud.group.visible));
    inPage(d, applyHideSetsInPage, { requested: [], worldCoreKeys: [] });
    assert.ok(water.visible && waterfall.visible && world.balloon.visible && world.clouds.every(cloud => cloud.group.visible));
  });

  test('villageResidentYard pose sits in front of the woman, in her home frame', () => {
    const d = { world, camera: new THREE.PerspectiveCamera() };
    const { home, depth } = world.villageResidents.residents[0];
    const pose = inPage(d, resolveInPageCameraPose, 'villageResidentYard');
    assert.deepEqual(pose.position, home.localToWorld(new THREE.Vector3(-1.5, 2.4, depth / 2 + 5.5)).toArray());
    assert.deepEqual(pose.target, home.localToWorld(new THREE.Vector3(0, 0.7, depth / 2 + 0.65)).toArray());
    assert.throws(() => inPage(d, resolveInPageCameraPose, 'nowhere'), /Unknown in-page camera pose/);
  });

  test('every validated pose name resolves in the in-page registry', () => {
    const d = { world, camera: new THREE.PerspectiveCamera() };
    const finitePoint = point => point.length === 3 && point.every(Number.isFinite);
    for (const name of IN_PAGE_CAMERA_POSES) {
      const { position, target } = inPage(d, resolveInPageCameraPose, name);
      assert.ok(finitePoint(position) && finitePoint(target), name);
    }
  });

  test('debug layer switch clicks the matching checkbox and captures its log line', () => {
    const realDocument = globalThis.document;
    const checkbox = { checked: true, click() { this.checked = !this.checked; console.log(`[DEBUG] Trees: ${this.checked ? 'shown' : 'hidden'}`); } };
    const rows = ['Trees', 'Clouds'].map(label => ({ textContent: label, querySelector: () => (label === 'Trees' ? checkbox : null) }));
    globalThis.document = { querySelectorAll: selector => (selector === '#debug-layers label' ? rows : []) };
    const realLog = console.log;
    console.log = () => {};
    try {
      assert.deepEqual(toggleDebugLayerInPage('Trees'), { label: 'Trees', checked: false, logs: ['[DEBUG] Trees: hidden'] });
      assert.throws(() => toggleDebugLayerInPage('Clouds'), /Debug layer not found: Clouds/);
    } finally {
      console.log = realLog;
      globalThis.document = realDocument;
    }
  });
});

describe('forest probe section and same-site checks', () => {
  test('raw counts from parity-surface names and the exclusion delta rule', () => {
    const probe = inPage({ world }, collectForestResidentsProbe);
    assert.deepEqual(probe.treeCounts, world.treeLayers.map(layer => layer.count));
    assert.deepEqual([probe.residentMeshCount, probe.exclusionCount, probe.hasSheepFlock], [33, world.exclusions.length, true]);
    assert.ok(probe.rockCount > 0 && probe.rockCount <= 80);
    assert.equal(inPage({ world: { treeLayers: [] } }, collectForestResidentsProbe), null);
    assert.deepEqual(compareForestResidentsProbe(probe, probe), { pass: true, failures: [], exclusionDelta: 0 });
    // A site without the flock lacks exactly its three clearings.
    const flockless = { ...probe, exclusionCount: probe.exclusionCount - 3, hasSheepFlock: false };
    assert.deepEqual(compareForestResidentsProbe(flockless, probe), { pass: true, failures: [], exclusionDelta: 3 });
    assert.equal(compareForestResidentsProbe({ ...probe, rockCount: 1 }, probe).pass, false);
    assert.equal(compareForestResidentsProbe({ ...probe, hasSheepFlock: false }, probe).pass, false);
    assert.equal(compareForestResidentsProbe(null, probe).pass, false);
  });

  test('paused hold, layer log and relation verdicts', async () => {
    const hold = { holdPausedFrames: { frames: 20, paused: true, uTimeBefore: 5.05, uTimeAfter: 5.05 } };
    const layer = { debugLayerOff: { label: 'Trees', checked: false, logs: ['[DEBUG] Trees: hidden'] } };
    assert.deepEqual(shotActionFailures({ shotActions: { ...hold, ...layer } }, 'clone'), []);
    assert.equal(shotActionFailures({ shotActions: { holdPausedFrames: { ...hold.holdPausedFrames, uTimeAfter: 5.1 } } }, 'clone').length, 1);
    assert.equal(shotActionFailures({ shotActions: { debugLayerOff: { ...layer.debugLayerOff, logs: [] } } }, 'clone').length, 1);
    const run = 'run-1';
    const capture = (png, runId = run) => ({ png, meta: { runId } });
    const pngs = { 'trees-sway-t0': capture('a'), 'trees-sway-t1': capture('b') };
    const readPng = (target, id) => pngs[id] ?? null;
    const measure = async (a, b) => (a === b ? { overThresholdFraction: 0, maxChannelDiff: 0 } : { overThresholdFraction: 0.01, maxChannelDiff: 90 });
    const check = id => runIntraSiteChecks({ shot: byId(id), metas: {}, readPng, measure });
    const differs = await check('trees-sway-t1');
    assert.deepEqual([differs.pass, differs.relation.clone.pass], [true, true]);
    // Own capture missing names the shot itself, a missing relation capture names that one.
    const ownMissing = await check('trees-sway-hold');
    assert.equal(ownMissing.pass, false);
    for (const failure of ownMissing.failures) assert.match(failure, /^(original|clone): capture trees-sway-hold missing$/);
    delete pngs['trees-sway-t0'];
    const otherMissing = await check('trees-sway-t1');
    assert.deepEqual(otherMissing.failures, ['original: capture trees-sway-t0 missing', 'clone: capture trees-sway-t0 missing']);
    pngs['trees-sway-hold'] = capture('b');
    assert.deepEqual([(await check('trees-sway-hold')).pass, (await check('trees-sway-hold')).relation.original.pass], [true, true]);
    pngs['trees-sway-hold'] = capture('c');
    assert.match((await check('trees-sway-hold')).failures.join(), /^original: expected identical vs trees-sway-t1,clone: expected identical vs trees-sway-t1$/);
    // A relation capture from another run (or with no run id) is stale even when the pixels agree.
    for (const runId of ['run-2', null]) {
      pngs['trees-sway-hold'] = capture('b', runId);
      const stale = await check('trees-sway-hold');
      assert.deepEqual([stale.failures, stale.relation], [['original: stale relation capture trees-sway-t1', 'clone: stale relation capture trees-sway-t1'], {}]);
    }
  });
});
