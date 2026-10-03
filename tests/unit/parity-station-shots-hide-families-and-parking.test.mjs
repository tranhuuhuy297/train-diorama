// Station parity tooling in node against fake pages: shot definitions, the station-era hide
// families, train parking and the station / free-camera-start camera frames.
import '../../src/core/disable-three-color-management.js';
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { applyHideSetsInPage, WORLD_CORE_MATERIAL_KEYS } from '../../tools/parity/page-hide-set-application.mjs';
import { applyCameraPose, parkTrainAway } from '../../tools/parity/page-parity-helpers.mjs';
import { PARITY_SHOTS, HIDE_PRESETS, selectShots, validateShotList, expandHideSets } from '../../tools/parity/parity-shot-list.mjs';

const CLOSEUPS = ['station-trackside-closeup-day', 'station-trackside-closeup-night'];
const FREE_STARTS = ['station-free-start-day', 'station-free-start-night'];
const world = createCloneWorld({ stopAfter: 'buildStation' });

// page.evaluate stand-in: runs the in-page function synchronously against window.__diorama.
const fakePage = d => ({ evaluate: async (run, argument) => {
  globalThis.window = { __diorama: d, __parityHidden: globalThis.window?.__parityHidden ?? [] };
  return run(argument);
} });
const shotById = id => PARITY_SHOTS.find(shot => shot.id === id);

after(() => { delete globalThis.window; });

describe('station shots', () => {
  test('closeups are strict shell-stage shots with every moving family hidden and the train parked', () => {
    assert.deepEqual(validateShotList(), []);
    const stage = selectShots({ stage: 'shell-and-sky' }).map(shot => shot.id);
    for (const id of CLOSEUPS) {
      const shot = shotById(id);
      assert.ok(stage.includes(id));
      assert.deepEqual([shot.reportOnly, shot.parkTrain, shot.mode, shot.seconds, shot.thresholdClass], [false, true, 'overview', 0, 'deterministic']);
      assert.deepEqual(shot.camera, { relativeTo: 'station', position: [8, 3.5, -6], target: [-3, 1.5, 0.5] });
      assert.deepEqual(expandHideSets(shot.hide), [...HIDE_PRESETS.allFamilies]);
    }
    assert.deepEqual(CLOSEUPS.map(id => shotById(id).timeOfDay), ['day', 'night']);
  });

  test('free-camera starts are strict forest-stage shots with the unbuilt systems masked', () => {
    const stage = selectShots({ stage: 'residents-and-forest' }).map(shot => shot.id);
    for (const id of FREE_STARTS) {
      const shot = shotById(id);
      assert.ok(stage.includes(id) && !selectShots({ stage: 'village-and-windmill' }).some(earlier => earlier.id === id));
      assert.deepEqual([shot.stage, shot.reportOnly, shot.parkTrain], ['residents-and-forest', false, true]);
      assert.deepEqual(shot.camera, { relativeTo: 'freeCameraStart', fov: 65 });
      assert.deepEqual(expandHideSets(shot.hide), ['sheep', 'water', 'clouds', 'balloon', 'birds', 'stationFigures', 'train', 'puffs', 'sparks']);
    }
    assert.deepEqual(FREE_STARTS.map(id => shotById(id).reference), ['07-free-camera.png', '17-night-overview-zoomed.png']);
  });
});

describe('station-era hide families', () => {
  test('resolve on a populated world and hide nothing on a world that lacks them', async () => {
    const meshes = Array.from({ length: 8 }, () => new THREE.Object3D());
    const populated = { world: {
      stationTravelers: [{ figure: meshes[0] }, { figure: meshes[1] }], sheep: meshes[2], sheepLegs: meshes[3], sheepEars: null,
      balloon: meshes[4], villageResidents: { residents: [{ figure: meshes[5] }], dog: meshes[6] }, houseSmoke: [{ mesh: meshes[7] }],
    } };
    const names = ['stationFigures', 'sheep', 'balloon', 'villageResidents', 'houseSmoke'];
    const hideIn = d => fakePage(d).evaluate(applyHideSetsInPage, { requested: names, worldCoreKeys: WORLD_CORE_MATERIAL_KEYS });
    assert.deepEqual(await hideIn(populated), { stationFigures: 2, sheep: 2, balloon: 1, villageResidents: 2, houseSmoke: 1 });
    assert.ok(meshes.every(object => !object.visible));
    assert.deepEqual(await hideIn({ world: { stationTravelers: [], houseSmoke: [] } }), { stationFigures: 0, sheep: 0, balloon: 0, villageResidents: 0, houseSmoke: 0 });
    assert.ok(meshes.every(object => object.visible), 'previous hide set restored');
  });
});

describe('train parking and station camera frames', () => {
  test('parkTrainAway moves the train half a loop on, and is a no-op without a train', async () => {
    const parked = [];
    const d = { s: 237.5, world: { length: 276 }, train: { update: (target, distance) => parked.push([target, distance]) } };
    assert.equal(await parkTrainAway(fakePage(d)), 99.5);
    assert.deepEqual(parked, [[d.world, 99.5]]);
    assert.equal(await parkTrainAway(fakePage({ s: 0, world: { length: 276 } })), null);
  });

  const cameraRig = () => {
    const camera = new THREE.PerspectiveCamera(42, 1, 0.3, 1500);
    return { camera, camPos: new THREE.Vector3(), camTarget: new THREE.Vector3(), controls: { target: new THREE.Vector3() }, world };
  };

  test('relativeTo station maps both points through the station group, fov unchanged', async () => {
    const d = cameraRig();
    const pose = await applyCameraPose(fakePage(d), shotById(CLOSEUPS[0]).camera);
    const station = world.stationClockMinuteHand.parent.parent;
    assert.equal(station, world.stationSite.group);
    assert.deepEqual(pose.position, station.localToWorld(new THREE.Vector3(8, 3.5, -6)).toArray());
    assert.deepEqual(pose.target, station.localToWorld(new THREE.Vector3(-3, 1.5, 0.5)).toArray());
    assert.deepEqual([d.camera.fov, d.camPos.toArray(), d.controls.target.toArray()], [42, pose.position, pose.target]);
  });

  test('relativeTo freeCameraStart copies the start pose and applies fov 65', async () => {
    const d = cameraRig();
    const pose = await applyCameraPose(fakePage(d), shotById(FREE_STARTS[0]).camera);
    assert.deepEqual(pose, { position: world.freeCameraStart.position.toArray(), target: world.freeCameraStart.target.toArray() });
    assert.equal(d.camera.fov, 65);
    assert.notEqual(d.camPos, world.freeCameraStart.position);
  });
});
