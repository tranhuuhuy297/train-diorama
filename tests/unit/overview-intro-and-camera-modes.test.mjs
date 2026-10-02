// OrbitControls/PointerLockControls config, intro pose/easing/logs, the double reset, camera
// modes, errors and logCameraPose, driven through a fake Diorama context (no real renderer).
import '../../src/core/disable-three-color-management.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OVERVIEW_HOME, OVERVIEW_TARGET, OVERVIEW_INTRO, createOverviewControls, bindOverviewIntroInterrupt, prepareOverviewIntro, updateOverviewCamera } from '../../src/engine/cameras/overview-orbit-camera.js';
import { createFirstPersonControls } from '../../src/engine/cameras/free-fly-pointer-lock-camera.js';
import { CAMERA_FOV, setCameraMode } from '../../src/engine/cameras/camera-mode-director.js';
import { Diorama } from '../../src/engine/diorama.js';
import { G, LIGHTING_UNIFORMS } from '../../src/materials/shared-lighting-uniforms.js';
import { applyPalette } from '../../src/engine/time-of-day-palettes-and-transition.js';

beforeEach(() => {
  applyPalette(LIGHTING_UNIFORMS, 'day');
  G.uTime.value = 0;
});

function fakeContext() {
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.3, 1500);
  camera.position.copy(OVERVIEW_HOME);
  const d = {
    camera, renderer: { domElement: null }, mode: 'overview', overviewIntro: null,
    autoRotateEnabled: true, movementKeys: new Set(),
    camPos: new THREE.Vector3(), camTarget: new THREE.Vector3(), tmpA: new THREE.Vector3(), tmpB: new THREE.Vector3(),
  };
  d.controls = createOverviewControls(d);
  bindOverviewIntroInterrupt(d);
  d.firstPersonControls = createFirstPersonControls(d);
  return d;
}

test('OrbitControls configuration and position0 (float noise from the pre-target update())', () => {
  const d = fakeContext();
  const c = d.controls;
  assert.equal(c.enableDamping, true);
  assert.equal(c.dampingFactor, 0.06);
  assert.equal(c.autoRotate, true);
  assert.equal(c.autoRotateSpeed, -0.245);
  assert.equal(c.minDistance, 25);
  assert.equal(c.maxDistance, 240);
  assert.equal(c.maxPolarAngle, 1.5);
  assert.ok(c.position0.distanceTo(OVERVIEW_HOME) < 1e-9);
  assert.deepEqual(c.target0.toArray(), [0, 4, 0]);
  const keys = Object.keys(d);
  assert.deepEqual(keys.slice(keys.indexOf('controls'), keys.indexOf('controls') + 3), ['controls', 'onOverviewInteraction', 'firstPersonControls'], 'facade field order');
});

test('PointerLockControls: disabled, polar margins, unlock clears movement keys', () => {
  const d = fakeContext();
  d.movementKeys.add('KeyW');
  assert.equal(d.firstPersonControls.enabled, false);
  assert.ok(Math.abs(d.firstPersonControls.minPolarAngle - THREE.MathUtils.degToRad(5)) < 1e-12);
  assert.ok(Math.abs(d.firstPersonControls.maxPolarAngle - (Math.PI - THREE.MathUtils.degToRad(5))) < 1e-12);
  d.firstPersonControls.dispatchEvent({ type: 'unlock' });
  assert.equal(d.movementKeys.size, 0);
});

test('prepareOverviewIntro: start pose, not-yet-playing, bridge mode creates nothing', () => {
  const d = fakeContext();
  prepareOverviewIntro(d);
  assert.ok(Math.abs(d.overviewIntro.start.x - -67.737) < 1e-3);
  assert.ok(Math.abs(d.overviewIntro.start.y - 75.701) < 1e-3);
  assert.ok(Math.abs(d.overviewIntro.start.z - 159.233) < 1e-3);
  assert.equal(d.overviewIntro.playing, false);
  assert.ok(d.camera.position.distanceTo(d.overviewIntro.start) < 1e-9);
  assert.ok(d.camPos.distanceTo(d.overviewIntro.start) < 1e-9);

  const bridge = fakeContext();
  bridge.mode = 'bridge';
  prepareOverviewIntro(bridge);
  assert.equal(bridge.overviewIntro, null);
});

test('intro: frozen while not playing, eased mid-flight, completes within 65 frames with one log', t => {
  const log = t.mock.method(console, 'log');
  const d = fakeContext();
  prepareOverviewIntro(d);
  for (let i = 0; i < 10; i++) updateOverviewCamera(d, 0.05);
  assert.equal(d.overviewIntro.elapsed, 0, 'frozen while not playing');

  d.overviewIntro.playing = true;
  for (let i = 0; i < 16; i++) updateOverviewCamera(d, 0.05);
  const p = (16 * 0.05) / OVERVIEW_INTRO.duration;
  const eased = p * p * p * (p * (6 * p - 15) + 10);
  const expected = d.overviewIntro.start.clone().lerp(d.overviewIntro.target, eased);
  assert.ok(d.camera.position.distanceTo(expected) < 1e-9);

  let frames = 16;
  while (d.overviewIntro && frames < 1000) { updateOverviewCamera(d, 0.05); frames++; }
  assert.equal(d.overviewIntro, null);
  assert.ok(frames <= 65, `completed within the 65-frame budget (took ${frames})`);
  assert.ok(d.camera.position.distanceTo(OVERVIEW_HOME) < 1e-9);
  const completedLogs = log.mock.calls.filter(c => c.arguments[0] === '[CAMERA] Overview intro completed');
  assert.equal(completedLogs.length, 1);
});

test('interruptions: drag input and mode selection both clear the intro with their own log', t => {
  const log = t.mock.method(console, 'log');
  const d = fakeContext();
  prepareOverviewIntro(d);
  d.controls.dispatchEvent({ type: 'start' });
  assert.equal(d.overviewIntro, null);
  assert.equal(log.mock.calls.filter(c => c.arguments[0] === '[CAMERA] Overview intro interrupted by input').length, 1);

  prepareOverviewIntro(d);
  setCameraMode(d, 'overview');
  assert.ok(d.camera.position.distanceTo(OVERVIEW_HOME) < 1e-9);
  assert.equal(log.mock.calls.filter(c => c.arguments[0] === '[CAMERA] Overview intro interrupted by mode selection').length, 1);
});

test('setCameraMode errors and the CAMERA_FOV table', () => {
  const d = fakeContext();
  assert.throws(() => setCameraMode(d, 'x'), { message: 'Invalid camera mode: x' });
  assert.deepEqual(CAMERA_FOV, { overview: 42, orbit: 65, side: 48, bridge: 42 });
});

test('bridge mode: enter, re-select is a no-op, return to overview restores controls', () => {
  const d = fakeContext();
  setCameraMode(d, 'bridge');
  assert.equal(d.camera.fov, 42);
  assert.equal(d.controls.enabled, false);
  assert.equal(d.controls.autoRotate, false);
  assert.equal(d.firstPersonControls.enabled, false);

  d.camera.fov = 1; // sentinel: untouched only if the re-select early-return actually fires
  setCameraMode(d, 'bridge');
  assert.equal(d.mode, 'bridge');
  assert.equal(d.camera.fov, 1, 're-selecting the active mode never reassigns CAMERA_FOV');

  setCameraMode(d, 'overview');
  assert.equal(d.controls.enabled, true);
  assert.equal(d.controls.autoRotate, true);
  assert.ok(d.camera.position.distanceTo(OVERVIEW_HOME) < 1e-9);
});

test('double reset lands within 1e-9 of home; a single damping-off reset leaves the quirk offset', () => {
  const d = fakeContext();
  for (let i = 0; i < 30; i++) d.controls.update(0.05);
  setCameraMode(d, 'overview');
  assert.ok(d.camera.position.distanceTo(OVERVIEW_HOME) < 1e-9);
  assert.equal(d.controls.enableDamping, true, 'damping restored after the reset');

  const quirk = fakeContext();
  for (let i = 0; i < 30; i++) quirk.controls.update(0.05);
  quirk.controls.autoRotate = false;
  quirk.controls.enableDamping = false;
  quirk.controls.reset();
  assert.ok(quirk.camera.position.distanceTo(OVERVIEW_HOME) > 1e-3, 'single reset quirk');
});

test('setAutoRotate via the prototype: overview reflects the flag; bridge keeps it false', () => {
  const d = fakeContext();
  Diorama.prototype.setAutoRotate.call(d, false);
  assert.equal(d.autoRotateEnabled, false);
  assert.equal(d.controls.autoRotate, false);
  Diorama.prototype.setAutoRotate.call(d, true);
  assert.equal(d.controls.autoRotate, true);

  setCameraMode(d, 'bridge');
  Diorama.prototype.setAutoRotate.call(d, true);
  assert.equal(d.autoRotateEnabled, true);
  assert.equal(d.controls.autoRotate, false);
});

test('logCameraPose at home logs the exact pose string', () => {
  const d = fakeContext();
  d.camera.lookAt(OVERVIEW_TARGET);
  const logged = [];
  const original = console.log;
  console.log = message => logged.push(message);
  try {
    Diorama.prototype.logCameraPose.call(d);
  } finally {
    console.log = original;
  }
  assert.equal(logged[0], '[DEBUG] Camera pose: {"mode":"overview","position":{"x":-55.522,"y":62.771,"z":130.519},"rotationDegrees":{"x":-24.241,"y":-21.2,"z":-9.249}}');
});
