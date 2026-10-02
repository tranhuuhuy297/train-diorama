// Node driver for the clone simulation: a ctx with the same shape as the oracle's fake Diorama (sim
// fields plus camera/controls stubs), the frame stepper in the shared order, and the one train
// serializer used for both ctx shapes. Math.random swapping lives in original-simulation-oracle.mjs.
import '../../src/core/disable-three-color-management.js';
import * as THREE from 'three';
import { installMinimalDomShim } from './minimal-dom-shim.mjs';
import { cameraRig } from './oracle-camera-controls-stub.mjs';
import { LIGHTING_UNIFORMS } from '../../src/materials/shared-lighting-uniforms.js';
import { stepSimulation } from '../../src/engine/simulation-step.js';
import { updateCameraRig } from '../../src/engine/cameras/camera-mode-director.js';
import { Train } from '../../src/train/train.js';
import { BrakeSparks } from '../../src/train/brake-sparks.js';
import { LocomotiveSmokePuffPool } from '../../src/train/locomotive-smoke-puff-pool.js';
import { initTrainMotion } from '../../src/train/train-station-motion-controller.js';
import { updateTrainAndEffects } from '../../src/train/train-frame-update.js';

installMinimalDomShim();

function cameraFields() {
  const vector = () => new THREE.Vector3();
  return {
    ...cameraRig(), overviewIntro: null, autoRotateEnabled: true,
    camPos: vector(), camTarget: vector(), flyAlongElapsed: 0, flyAlongSide: 1,
    flyAlongAnchor: vector(), flyAlongVelocity: vector(), previousFlyAlongAnchor: vector(),
    movementKeys: new Set(), tmpA: vector(), tmpB: vector(),
  };
}

/** `world` defaults to a fresh clone World; pass an original World to isolate the train code. */
export async function createCloneSimulation({ world = null } = {}) {
  const builtWorld = world ?? (await import('./clone-world-factory.mjs')).createCloneWorld();
  const scene = new THREE.Scene();
  scene.matrixWorldAutoUpdate = false;
  scene.add(builtWorld.group);
  const ctx = {
    scene, world: builtWorld, lightingUniforms: LIGHTING_UNIFORMS,
    time: 0, s: 0, speed: 0, stopTimer: 0, justLeft: false,
    speedMul: 1, timeScale: 1, paused: false, mode: 'overview',
    updateTrain(dt) { return updateTrainAndEffects(this, dt); },
    ...cameraFields(),
  };
  ctx.train = new Train();
  scene.add(ctx.train.group);
  ctx.brakeSparks = new BrakeSparks(builtWorld.heightAt.bind(builtWorld));
  scene.add(ctx.brakeSparks.mesh);
  initTrainMotion(ctx, builtWorld.stationS);
  ctx.puffPool = new LocomotiveSmokePuffPool(scene);
  ctx.puffs = ctx.puffPool.puffs;
  Object.defineProperty(ctx, 'puffTimer', {
    enumerable: true,
    get() { return this.puffPool.timer; },
    set(seconds) { this.puffPool.timer = seconds; },
  });
  ctx.camPos.copy(ctx.camera.position);
  ctx.camTarget.copy(ctx.controls.target);
  return ctx;
}

/** Oracle and frame-loop order: night amount, gated sim at dt·timeScale, camera rig, cloud camera, matrices. */
export function stepCloneFrame(ctx, dt) {
  ctx.world.nightAmount = ctx.lightingUniforms.uNight.value;
  if (!ctx.paused && ctx.timeScale > 0) stepSimulation(ctx, dt * ctx.timeScale);
  updateCameraRig(ctx, dt);
  ctx.world.updateCloudCamera?.(ctx.camera.position, dt);
  ctx.scene.updateMatrixWorld();
}

const xyz = vector => [vector.x, vector.y, vector.z];
const copyBytes = array => Buffer.from(new Uint8Array(array.buffer, array.byteOffset, array.byteLength));

/** Parity-surface train state only, so it runs unchanged on the oracle ctx and on a clone ctx. */
export function snapshotTrainState(ctx) {
  const sparks = ctx.brakeSparks;
  return {
    s: ctx.s, speed: ctx.speed, stopTimer: ctx.stopTimer, justLeft: ctx.justLeft, puffTimer: ctx.puffTimer,
    puffs: ctx.puffs.map(({ life, max, size, vel, mesh }) => ({
      life, max, size, vel: xyz(vel), pos: xyz(mesh.position), rot: xyz(mesh.rotation), scale: mesh.scale.x, visible: mesh.visible,
    })),
    sparks: {
      emission: sparks.emission, nextParticle: sparks.nextParticle, nextWheel: sparks.nextWheel,
      particles: sparks.particles.map(p => [xyz(p.position), xyz(p.velocity), p.life, p.duration]),
      matrices: copyBytes(sparks.mesh.instanceMatrix.array),
    },
    cars: ctx.train.cars.map(car => ({
      position: car.obj.position.toArray(),
      quaternion: car.obj.quaternion.toArray(),
      wheelAngles: car.wheels.map(wheel => wheel.mesh.rotation.x),
    })),
  };
}
