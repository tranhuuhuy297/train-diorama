// setCameraMode on a minimal fake Diorama: validation, intro interruption, free-pose save on leaving
// orbit, side entry (outer side and anchor priming) and the per-mode FOV / controls flags.
import '../../src/core/disable-three-color-management.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setCameraMode } from '../../src/engine/cameras/camera-mode-director.js';

function fakeDiorama({ mode = 'overview', locked = false } = {}) {
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.3, 1500);
  const calls = [];
  const loco = new THREE.Object3D();
  return {
    mode, camera, calls, overviewIntro: null, autoRotateEnabled: true, movementKeys: new Set(),
    controls: {
      target: new THREE.Vector3(0, 4, 0), enabled: true, autoRotate: true, enableDamping: true,
      reset() { calls.push('reset'); }, update() {},
    },
    firstPersonControls: { enabled: false, isLocked: locked, lock() { calls.push('lock'); }, unlock() { calls.push('unlock'); this.isLocked = false; } },
    freeCameraPose: { position: new THREE.Vector3(1, 2, 3), target: new THREE.Vector3(1, 2, 4) },
    train: { loco: { obj: loco } },
    camPos: new THREE.Vector3(7, 8, 9), camTarget: new THREE.Vector3(-1, -2, -3),
    flyAlongElapsed: 5, flyAlongSide: 0, flyAlongVelocity: new THREE.Vector3(4, 5, 6),
    previousFlyAlongAnchor: new THREE.Vector3(), tmpA: new THREE.Vector3(), tmpB: new THREE.Vector3(),
  };
}

test('unknown and inherited mode names throw the exact message', () => {
  for (const bad of ['foo', 'toString', 'constructor']) {
    assert.throws(() => setCameraMode(fakeDiorama(), bad), { message: `Invalid camera mode: ${bad}` });
  }
});

test('re-selecting side while the intro runs clears the intro, logs once and changes nothing else', t => {
  const log = t.mock.method(console, 'log', () => {});
  const d = fakeDiorama({ mode: 'side' });
  d.overviewIntro = { elapsed: 0 };
  d.camera.fov = 1;
  setCameraMode(d, 'side');
  assert.equal(d.overviewIntro, null);
  assert.deepEqual(log.mock.calls.map(call => call.arguments[0]), ['[CAMERA] Overview intro interrupted by mode selection']);
  assert.equal(d.camera.fov, 1);
  assert.equal(d.flyAlongElapsed, 5);
});

test('leaving orbit saves position and position + unit view direction, unlocks only when locked, clears keys', () => {
  for (const locked of [true, false]) {
    const d = fakeDiorama({ mode: 'orbit', locked });
    d.camera.position.set(3, 12, -4);
    d.camera.lookAt(10, 6, 2);
    d.movementKeys.add('KeyW').add('Space');
    const direction = d.camera.getWorldDirection(new THREE.Vector3());
    setCameraMode(d, 'bridge');
    assert.deepEqual(d.freeCameraPose.position.toArray(), [3, 12, -4]);
    assert.ok(d.freeCameraPose.target.distanceTo(d.camera.position.clone().add(direction)) < 1e-12);
    assert.deepEqual(d.calls.filter(name => name === 'unlock'), locked ? ['unlock'] : []);
    assert.equal(d.movementKeys.size, 0);
  }
});

test('entering orbit restores the saved pose and snaps camPos/camTarget to it', () => {
  const d = fakeDiorama({ mode: 'bridge' });
  setCameraMode(d, 'orbit');
  assert.deepEqual(d.camera.position.toArray(), [1, 2, 3]);
  assert.ok(d.camera.getWorldDirection(new THREE.Vector3()).distanceTo(new THREE.Vector3(0, 0, 1)) < 1e-12);
  assert.deepEqual([d.camPos.toArray(), d.camTarget.toArray()], [[1, 2, 3], [1, 2, 4]]);
});

test('side entry picks the outer side by the sign of right·position and primes the driver anchor only', () => {
  for (const [x, side] of [[10, 1], [-10, -1], [0, 1]]) {
    const d = fakeDiorama({ mode: 'bridge' });
    d.train.loco.obj.position.set(x, 0, 0);
    setCameraMode(d, 'side');
    assert.equal(d.flyAlongSide, side, `loco at x ${x}`);
    assert.equal(d.flyAlongElapsed, 0);
    const anchor = d.train.loco.obj.localToWorld(new THREE.Vector3(0, 2.45, -1.4));
    assert.deepEqual(d.previousFlyAlongAnchor.toArray(), anchor.toArray());
    assert.deepEqual([d.camPos.toArray(), d.camTarget.toArray(), d.flyAlongVelocity.toArray()], [[7, 8, 9], [-1, -2, -3], [4, 5, 6]]);
  }
});

test('per-mode FOV, orbit controls enabled only in overview, auto-rotate only in overview, look controls only in orbit', () => {
  const d = fakeDiorama();
  const expected = { orbit: [65, false, false, true], side: [48, false, false, false], bridge: [42, false, false, false], overview: [42, true, true, false] };
  for (const [mode, row] of Object.entries(expected)) {
    setCameraMode(d, mode);
    assert.deepEqual([d.camera.fov, d.controls.enabled, d.controls.autoRotate, d.firstPersonControls.enabled], row, mode);
  }
  assert.deepEqual(d.calls.filter(name => name === 'reset'), ['reset', 'reset'], 'overview entry double reset');
});
