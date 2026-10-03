// Camera modes vs the original oracle, compared after every frame and every mode switch: side-entry sweep,
// a minute of the train rig (wide shot, dwell, pause, dt 0, x2, coarse dt), a minute of the bridge tripod,
// scripted free flight into every clamp, and the free pose save/restore.
import '../../src/core/disable-three-color-management.js';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import {
  createOriginalSimulation, stepOriginalFrame, setOriginalMode, runWithSeededMathRandom, withCapturedConsole,
} from '../helpers/original-simulation-oracle.mjs';
import { createCloneSimulation, stepCloneFrame, setCloneMode } from '../helpers/clone-simulation-driver.mjs';
import { wideShotBlendAtPhase } from '../../src/engine/cameras/train-fly-along-camera-rig.js';

const skip = originalSkipReason(['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js',
  'StationWalker.js', 'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js']);
const DT = 1 / 60;
const TOLERANCE = 1e-9;
const RANDOM_SEED = 4242;
const BRIDGE_TARGET_X = 14 * 0.35;

// Synchronous stand-in for pointerlockchange + 'unlock', installed identically on both ctx objects.
function lockStub(ctx) {
  return {
    enabled: false, isLocked: false, lockCalls: [],
    lock(unadjusted) { this.lockCalls.push(unadjusted); this.isLocked = true; },
    unlock() { this.isLocked = false; ctx.movementKeys.clear(); },
    addEventListener() {}, dispose() {},
  };
}

const vectorFields = ['camPos', 'camTarget', 'flyAlongAnchor', 'flyAlongVelocity', 'previousFlyAlongAnchor'];

function cameraState(ctx) {
  const state = {
    'camera.position': ctx.camera.position.toArray(), 'camera.quaternion': ctx.camera.quaternion.toArray(),
    'camera.fov': [ctx.camera.fov], 'controls.target': ctx.controls.target.toArray(),
    'freeCameraPose.position': ctx.freeCameraPose.position.toArray(), 'freeCameraPose.target': ctx.freeCameraPose.target.toArray(),
    flyAlongElapsed: [ctx.flyAlongElapsed], flyAlongSide: [ctx.flyAlongSide],
    flags: [ctx.firstPersonControls.enabled, ctx.firstPersonControls.isLocked, ctx.controls.enabled, ctx.controls.autoRotate].map(Number),
    'movementKeys.size': [ctx.movementKeys.size], s: [ctx.s], speed: [ctx.speed],
  };
  for (const field of vectorFields) state[field] = ctx[field].toArray();
  return state;
}

describe('camera modes parity with the original oracle', { skip, timeout: 600_000 }, () => {
  const sides = {};
  let frame = 0;
  const cover = { maxBlend: 0, zeroSpeedRun: 0, longestStop: 0, xMin: false, xMax: false, zMin: false, ground: false, ceiling: false };

  before(async () => {
    sides.oracle = await createOriginalSimulation();
    sides.clone = await createCloneSimulation();
    for (const ctx of [sides.oracle, sides.clone]) ctx.firstPersonControls = lockStub(ctx);
    sides.streams = [mulberry32(RANDOM_SEED), mulberry32(RANDOM_SEED)];
  });

  const both = fn => { fn(sides.oracle); fn(sides.clone); };

  function compare(label) {
    const [expected, actual] = [cameraState(sides.oracle), cameraState(sides.clone)];
    for (const [field, values] of Object.entries(expected)) {
      values.forEach((value, axis) => {
        const diff = Math.abs(actual[field][axis] - value);
        if (!(diff <= TOLERANCE) && !Object.is(actual[field][axis], value)) {
          assert.fail(`${label} frame ${frame} ${field}[${axis}]: clone ${actual[field][axis]} vs original ${value}`);
        }
      });
    }
  }

  function setMode(mode) {
    setOriginalMode(sides.oracle, mode);
    setCloneMode(sides.clone, mode);
    compare(`setMode(${mode})`);
  }

  // Steps both sides with their own Math.random stream, comparing after each frame; `check` sees the clone.
  function run(label, frames, dt = DT, check = null) {
    for (let index = 0; index < frames; index++) {
      frame++;
      runWithSeededMathRandom(sides.streams[0], () => stepOriginalFrame(sides.oracle, dt));
      runWithSeededMathRandom(sides.streams[1], () => stepCloneFrame(sides.clone, dt));
      compare(label);
      check?.(sides.clone, index);
    }
  }

  function trackSide(ctx) {
    const phase = ctx.flyAlongElapsed * Math.PI * 2;
    cover.maxBlend = Math.max(cover.maxBlend, wideShotBlendAtPhase(phase));
    cover.zeroSpeedRun = ctx.speed === 0 ? cover.zeroSpeedRun + 1 : 0;
    cover.longestStop = Math.max(cover.longestStop, cover.zeroSpeedRun);
    assert.ok(ctx.flyAlongVelocity.toArray().every(Number.isFinite), `finite rig velocity at frame ${frame}`);
  }

  function trackFree(ctx) {
    const { x, y, z } = ctx.camera.position;
    cover.xMin ||= x === -61;
    cover.xMax ||= x === 61;
    cover.zMin ||= z === -61;
    cover.ground ||= Math.abs(y - (ctx.world.heightAt(x, z) + 1.2)) < 1e-12;
    cover.ceiling ||= y === 200;
  }

  test('overview, side sweep, train rig, bridge tripod, free flight and pose restore match frame by frame', t => {
    const { logs } = withCapturedConsole(() => {
      run('overview', 60);

      for (let entry = 0; entry < 6; entry++) {
        setMode('side');
        assert.deepEqual([sides.oracle.flyAlongSide, sides.clone.flyAlongSide], [-1, -1], `outer side at entry ${entry}`);
        run(`side entry ${entry}`, 1);
        setMode('overview');
        run(`sweep gap ${entry}`, 420);
      }

      setMode('side');
      run('side first frame', 1, DT, ctx => {
        assert.ok(ctx.camPos.distanceTo(ctx.tmpA) > 1, 'the rig glides in instead of snapping');
      });
      run('side', 1200, DT, trackSide);
      both(ctx => { ctx.paused = true; });
      run('side paused', 60, DT, ctx => trackSide(ctx));
      run('side paused dt 0', 1, 0, trackSide);
      both(ctx => { ctx.paused = false; ctx.timeScale = 2; });
      run('side x2', 300, DT, trackSide);
      both(ctx => { ctx.timeScale = 1; });
      run('side dt 0.05', 40, 0.05, trackSide);
      run('side long', 2000, DT, trackSide);
      assert.ok(cover.maxBlend > 0.99, `wide-shot peak reached (max blend ${cover.maxBlend})`);
      assert.ok(cover.longestStop >= 60, `station dwell covered (${cover.longestStop} frames at speed 0)`);

      setMode('bridge');
      run('bridge', 3600, DT, ctx => {
        assert.ok(ctx.controls.target.equals(ctx.camTarget), `controls.target follows camTarget at frame ${frame}`);
        assert.ok(Math.abs(ctx.tmpB.x) <= BRIDGE_TARGET_X, `desired x ${ctx.tmpB.x} at frame ${frame}`);
      });

      setMode('orbit');
      both(ctx => {
        assert.deepEqual(ctx.camera.position.toArray(), ctx.world.freeCameraStart.position.toArray());
        ctx.firstPersonControls.isLocked = true;
      });
      const flights = [
        ['a face -X sprint', [0, Math.PI / 2], ['KeyW', 'ShiftLeft'], 90],
        ['b descend', null, ['KeyC'], 180],
        ['c down toward +X', [-1, -Math.PI / 2], ['KeyW'], 120],
        ['d sprint +X', [0, -Math.PI / 2], ['KeyW', 'ShiftLeft'], 360],
        ['e sprint -Z', [0, 0], ['KeyW', 'ShiftRight'], 360],
        ['f climb', null, ['Space', 'ShiftRight'], 600],
        ['g strafe back', null, ['KeyA', 'KeyD', 'KeyS'], 60],
      ];
      for (const [label, look, keys, frames] of flights) {
        both(ctx => {
          if (look) ctx.camera.quaternion.setFromEuler(new THREE.Euler(look[0], look[1], 0, 'YXZ'));
          ctx.movementKeys.clear();
          for (const code of keys) ctx.movementKeys.add(code);
        });
        compare(`free ${label} setup`);
        run(`free ${label}`, frames, DT, trackFree);
      }
      assert.deepEqual(cover, { ...cover, xMin: true, xMax: true, zMin: true, ground: true, ceiling: true }, JSON.stringify(cover));

      const parked = sides.clone.camera.position.clone();
      both(ctx => { ctx.firstPersonControls.isLocked = false; ctx.movementKeys.clear(); ctx.movementKeys.add('KeyW'); });
      run('free h unlocked', 30, DT, ctx => assert.ok(ctx.camera.position.equals(parked), 'no flight while unlocked'));

      both(ctx => { ctx.firstPersonControls.isLocked = true; ctx.movementKeys.add('KeyW'); });
      setMode('side');
      both(ctx => {
        const [x, y, z] = ctx.freeCameraPose.position.toArray();
        assert.ok(x === 61 && y === 200 && Math.abs(z + 49) < 1, `saved pose ${[x, y, z]}`);
        assert.equal(ctx.firstPersonControls.isLocked, false);
        assert.equal(ctx.movementKeys.size, 0);
      });
      run('side after free', 120);
      setMode('orbit');
      both(ctx => {
        assert.ok(ctx.camera.position.equals(ctx.freeCameraPose.position), 'camera back on the saved pose');
        assert.ok(ctx.camTarget.equals(ctx.freeCameraPose.target), 'camTarget back on the saved target');
      });
    });
    t.diagnostic(`compared ${frame} frames; console lines silenced: ${logs.length}`);
  });
});
