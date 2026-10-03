// Pure camera-rig cases: constant tables, the wide-shot blend, the bridge pan, free flight and its clamps,
// the side rig's transport/elapsed/height/canopy rules, and click-to-lock plus dispose ordering.
import '../../src/core/disable-three-color-management.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAMERA_FOV, updateCameraRig } from '../../src/engine/cameras/camera-mode-director.js';
import { FREE_CAMERA_VERTICAL_MARGIN, FREE_FLY, bindClickToLock, disposeFirstPersonControls, updateFreeFlyCamera } from '../../src/engine/cameras/free-fly-pointer-lock-camera.js';
import { FLY_ALONG, wideShotBlendAtPhase, enterFlyAlong, computeFlyAlongDesired, applyFlyAlongHeight } from '../../src/engine/cameras/train-fly-along-camera-rig.js';
import { BRIDGE_TRIPOD, computeBridgeDesired } from '../../src/engine/cameras/bridge-tripod-camera.js';

const near = (actual, expected, epsilon = 1e-9) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} vs ${expected}`);

test('constant tables', () => {
  assert.deepEqual(CAMERA_FOV, { orbit: 65, side: 48, bridge: 42, overview: 42 });
  assert.deepEqual(BRIDGE_TRIPOD, { x: -3, y: 5.5, z: 60, targetXLimit: 14, targetXScale: 0.35, targetY: 8.5, targetZ: 36 });
  assert.deepEqual(FREE_FLY, { speed: 12, sprintSpeed: 24, edgeInset: 1, groundClearance: 1.2, ceiling: 200 });
  assert.equal(FREE_CAMERA_VERTICAL_MARGIN, THREE.MathUtils.degToRad(5));
  assert.deepEqual(FLY_ALONG, {
    driverPosition: new THREE.Vector3(0, 2.45, -1.4), distance: 20, distanceVariation: 4, distancePeriod: 31,
    height: 5, heightVariation: 2, heightPeriod: 23, longitudinalVariation: 7, longitudinalPeriod: 41,
    wideShotPeriod: 56, wideShotDistanceMultiplier: 2, wideShotAnticipationRadius: 14, terrainClearance: 3,
    positionResponse: 2, targetResponse: 5, canopyClearance: 1.5, canopyRadius: 1,
    canopyAnticipationRadius: 5, lookAheadSeconds: 0.8, descentResponse: 0.7, ascentResponse: 3,
  });
  assert.equal(Object.keys(FLY_ALONG).length, 21);
});

test('wide-shot blend: 0 at the start, 1 at 28 s, rising in between', () => {
  assert.equal(wideShotBlendAtPhase(0), 0);
  near(wideShotBlendAtPhase(28 * Math.PI * 2), 1, 1e-12);
  let previous = -1;
  for (let elapsed = 0; elapsed <= 28; elapsed += 0.25) {
    const blend = wideShotBlendAtPhase(elapsed * Math.PI * 2);
    assert.ok(blend >= previous, `monotonic at ${elapsed}`);
    previous = blend;
  }
});

test('bridge tripod: fixed lens, clamped then scaled pan, one reused track-point vector', () => {
  const seen = [];
  for (const [x, expected] of [[30, 4.9], [-30, -4.9], [10, 3.5], [0, 0]]) {
    const d = { s: 12, world: { pointAtS: (s, target) => (seen.push(target), target.set(x, 9, 0)) } };
    const position = new THREE.Vector3();
    const target = new THREE.Vector3();
    computeBridgeDesired(d, position, target);
    assert.deepEqual(position.toArray(), [-3, 5.5, 60]);
    near(target.x, expected, 1e-12);
    assert.deepEqual([target.y, target.z], [8.5, 36]);
  }
  assert.equal(seen[0], seen[1]);
  assert.ok(seen.every(vector => vector instanceof THREE.Vector3 && vector === seen[0]));
});

function flyer({ locked = true, keys = [], y = 10 } = {}) {
  const camera = new THREE.PerspectiveCamera(65, 1, 0.3, 1500);
  camera.position.set(0, y, 0);
  return {
    camera, world: { heightAt: () => 5 }, firstPersonControls: { isLocked: locked }, movementKeys: new Set(keys),
    camPos: new THREE.Vector3(), camTarget: new THREE.Vector3(), tmpA: new THREE.Vector3(), tmpB: new THREE.Vector3(),
  };
}
const fly = (d, frames, dt = 0.05) => { for (let i = 0; i < frames; i++) updateFreeFlyCamera(d, dt); return d.camera.position; };

test('free flight: walk and sprint speeds, unlocked hold, edge/ground/ceiling clamps, no clamp at rest', () => {
  near(fly(flyer({ keys: ['KeyW'] }), 20).z, -12);
  near(fly(flyer({ keys: ['KeyW', 'ShiftLeft'] }), 20).z, -24);
  const idle = flyer({ locked: false, keys: ['KeyW'] });
  assert.deepEqual(fly(idle, 20).toArray(), [0, 10, 0]);
  assert.deepEqual([idle.camPos.toArray(), idle.camTarget.toArray()], [[0, 10, 0], [0, 10, -1]]);
  assert.equal(fly(flyer({ keys: ['KeyD'] }), 200).x, 61);
  assert.equal(fly(flyer({ keys: ['KeyC'] }), 200).y, 6.2);
  assert.equal(fly(flyer({ keys: ['Space', 'ShiftRight'] }), 400).y, 200);
  assert.equal(fly(flyer({ y: 0 }), 5).y, 0, 'below ground and not moving: untouched');
});

function sideRig({ height = 0, canopy = () => 0 } = {}) {
  const canopyCalls = [];
  const d = {
    mode: 'side', paused: false, timeScale: 1, train: { loco: { obj: new THREE.Object3D() } },
    world: { heightAt: () => height, treeCanopyHeightAt: (x, z, r) => (canopyCalls.push([x, z, r]), canopy(canopyCalls.length)) },
    camera: new THREE.PerspectiveCamera(48, 1, 0.3, 1500), controls: { target: new THREE.Vector3() },
    camPos: new THREE.Vector3(30, 12, 5), camTarget: new THREE.Vector3(0, 2, 0),
    flyAlongElapsed: 0, flyAlongSide: 1, flyAlongAnchor: new THREE.Vector3(), flyAlongVelocity: new THREE.Vector3(),
    previousFlyAlongAnchor: new THREE.Vector3(), tmpA: new THREE.Vector3(), tmpB: new THREE.Vector3(),
  };
  enterFlyAlong(d);
  canopyCalls.length = 0;
  return { d, canopyCalls };
}

test('side rig: elapsed gated by pause and time scale while the glide continues', () => {
  for (const gate of [{ paused: true }, { timeScale: 0 }]) {
    const { d } = sideRig();
    Object.assign(d, gate);
    const before = d.camPos.clone();
    updateCameraRig(d, 0.1);
    assert.equal(d.flyAlongElapsed, 0);
    assert.ok(d.camPos.distanceTo(before) > 0.1, 'camPos still glides');
  }
});

test('side rig: transport by the anchor delta, velocity from dt, dt 0 keeps velocity, same responses object', () => {
  const { d } = sideRig();
  d.train.loco.obj.position.set(3, 0, 0);
  const position = new THREE.Vector3();
  const target = new THREE.Vector3();
  const responses = computeFlyAlongDesired(d, 0.1, position, target);
  assert.deepEqual([d.camPos.toArray(), d.camTarget.toArray()], [[33, 12, 5], [3, 2, 0]]);
  near(d.flyAlongVelocity.x, 30);
  assert.deepEqual(target.toArray(), [3, 2.45, -1.4]);
  assert.deepEqual(responses, { positionResponse: 2, targetResponse: 5 });
  assert.ok(Object.isFrozen(responses));
  d.train.loco.obj.position.set(4, 0, 0);
  assert.equal(computeFlyAlongDesired(d, 0, position, target), responses);
  near(d.flyAlongVelocity.x, 30);
  assert.ok([...d.camPos.toArray(), ...position.toArray()].every(Number.isFinite));
});

test('side rig: canopy floor uses the highest of camera, goal and look-ahead samples, in that order', () => {
  for (const tops of [[4, 9, 6], [4, 6, 30], [12, 1, 2]]) {
    const { d, canopyCalls } = sideRig({ canopy: call => tops[call - 1] });
    d.flyAlongVelocity.set(10, 0, -5);
    const position = new THREE.Vector3();
    computeFlyAlongDesired(d, 0, position, new THREE.Vector3());
    assert.equal(canopyCalls.length, 3);
    assert.deepEqual(canopyCalls[0], [30, 5, 5]);
    assert.deepEqual(canopyCalls[1], [position.x, position.z, 5]);
    assert.deepEqual(canopyCalls[2], [position.x + 10 * 0.8, position.z + -5 * 0.8, 5]);
    assert.equal(position.y, Math.max(7.45, Math.max(...tops) + 1.5));
  }
});

test('side rig: height climbs at rate 3, sinks at 0.7, floored by terrain and the local canopy', () => {
  const dt = 0.1;
  const alpha = rate => 1 - Math.exp(-dt * rate);
  for (const [goal, rate] of [[20, 3], [0, 0.7]]) {
    const { d } = sideRig();
    applyFlyAlongHeight(d, dt, 10, new THREE.Vector3(0, goal, 0));
    assert.equal(d.camPos.y, (1 - alpha(rate)) * 10 + alpha(rate) * goal);
  }
  const { d, canopyCalls } = sideRig({ height: 40, canopy: () => 50 });
  applyFlyAlongHeight(d, dt, 10, new THREE.Vector3(0, 20, 0));
  assert.equal(d.camPos.y, 51.5);
  assert.deepEqual(canopyCalls, [[30, 5, 1]]);
});

function lockRig(mode, locked) {
  const log = [];
  class SpyTarget extends EventTarget {
    removeEventListener(type, listener) { log.push(['remove', type, listener]); super.removeEventListener(type, listener); }
  }
  const look = {
    isLocked: locked, lock: unadjusted => log.push(['lock', unadjusted]), unlock: () => log.push(['unlock']), dispose: () => log.push(['dispose']),
  };
  const d = { mode, renderer: { domElement: new SpyTarget() }, firstPersonControls: look };
  bindClickToLock(d);
  return { d, log, click: () => d.renderer.domElement.dispatchEvent(new Event('click')) };
}

test('click locks with unadjusted movement only in orbit and only while unlocked', () => {
  for (const [mode, locked, expected] of [['orbit', false, [['lock', true]]], ['orbit', true, []], ['overview', false, []]]) {
    const { log, click } = lockRig(mode, locked);
    click();
    assert.deepEqual(log, expected, `${mode} locked=${locked}`);
  }
});

test('dispose: unlock (if locked), drop the click listener, then dispose; later clicks do nothing', () => {
  for (const locked of [true, false]) {
    const { d, log, click } = lockRig('orbit', locked);
    disposeFirstPersonControls(d);
    const expected = [...(locked ? [['unlock']] : []), ['remove', 'click', d.onCanvasClick], ['dispose']];
    assert.deepEqual(log, expected);
    d.firstPersonControls.isLocked = false;
    click();
    assert.equal(log.length, expected.length);
  }
});
