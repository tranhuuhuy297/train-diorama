// Node driver for the clone simulation: a ctx with the same shape as the oracle's fake Diorama (sim
// fields plus camera/controls stubs), the frame stepper in the shared order, and the one train
// and life (birds, station travelers) serializers used for both ctx shapes. Math.random swapping lives
// in original-simulation-oracle.mjs.
import '../../src/core/disable-three-color-management.js';
import * as THREE from 'three';
import { installMinimalDomShim } from './minimal-dom-shim.mjs';
import { cameraRig } from './oracle-camera-controls-stub.mjs';
import { LIGHTING_UNIFORMS } from '../../src/materials/shared-lighting-uniforms.js';
import { stepSimulation } from '../../src/engine/simulation-step.js';
import { setCameraMode, updateCameraRig } from '../../src/engine/cameras/camera-mode-director.js';
import { Train } from '../../src/train/train.js';
import { BrakeSparks } from '../../src/train/brake-sparks.js';
import { LocomotiveSmokePuffPool } from '../../src/train/locomotive-smoke-puff-pool.js';
import { initTrainMotion } from '../../src/train/train-station-motion-controller.js';
import { composeDioramaScene, createWorldBirdSystem } from '../../src/engine/diorama-scene-composition.js';
import { updateTrainAndEffects, writeHeadlightUniforms } from '../../src/train/train-frame-update.js';
import { skyMaterial } from '../../src/materials/procedural-sky-dome-material.js';
import { collectNightLightGlows, applyNightGlowVisibility } from '../../src/engine/night-light-glow-registry.js';

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

// Injected-world path only: the same insertion order as composeDioramaScene, around a prebuilt World.
function composeAroundWorld(ctx, world) {
  ctx.world = world;
  ctx.scene.add(world.group);
  ctx.birds = createWorldBirdSystem(world);
  ctx.scene.add(ctx.birds.group);
  const freeStart = world.freeCameraStart;
  ctx.freeCameraPose = { position: freeStart.position.clone(), target: freeStart.target.clone() };
  ctx.train = new Train();
  ctx.scene.add(ctx.train.group);
  ctx.brakeSparks = new BrakeSparks(world.heightAt.bind(world));
  ctx.scene.add(ctx.brakeSparks.mesh);
  initTrainMotion(ctx, world.stationS);
  ctx.sky = Object.assign(new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMaterial()), { frustumCulled: false, renderOrder: -1 });
  ctx.scene.add(ctx.sky);
  ctx.puffPool = new LocomotiveSmokePuffPool(ctx.scene);
  ctx.puffs = ctx.puffPool.puffs;
  ctx.shadowHiddenObjects = [ctx.sky, ctx.brakeSparks.mesh, ...world.noShadow, ...ctx.train.noShadow, ...ctx.puffs.map(puff => puff.mesh)];
  ctx.nightGlows = collectNightLightGlows(ctx.scene);
}

/** Without `world` the runtime composeDioramaScene builds a fresh clone World and the whole scene; pass an
 * original World to isolate the train code (same insertion order, composed here around it). */
export async function createCloneSimulation({ world = null } = {}) {
  const scene = new THREE.Scene();
  scene.matrixWorldAutoUpdate = false;
  const ctx = {
    scene, lightingUniforms: LIGHTING_UNIFORMS,
    time: 0, s: 0, speed: 0, stopTimer: 0, justLeft: false,
    speedMul: 1, timeScale: 1, paused: false, mode: 'overview',
    updateTrain(dt) { return updateTrainAndEffects(this, dt); },
    ...cameraFields(),
  };
  if (world) composeAroundWorld(ctx, world);
  else composeDioramaScene(ctx);
  Object.defineProperty(ctx, 'puffTimer', {
    enumerable: true,
    get() { return this.puffPool.timer; },
    set(seconds) { this.puffPool.timer = seconds; },
  });
  ctx.camPos.copy(ctx.camera.position);
  ctx.camTarget.copy(ctx.controls.target);
  return ctx;
}

/** Clone camera-mode switch on the driver ctx (the oracle side uses setOriginalMode). */
export function setCloneMode(ctx, mode) {
  setCameraMode(ctx, mode);
}

/** Oracle and frame-loop order: night amount, gated sim at dt·timeScale, camera rig, cloud camera, then the
 * render's non-GPU side effects (glow visibility, headlight uniforms, sky follow, matrices). */
export function stepCloneFrame(ctx, dt) {
  ctx.world.nightAmount = ctx.lightingUniforms.uNight.value;
  if (!ctx.paused && ctx.timeScale > 0) stepSimulation(ctx, dt * ctx.timeScale);
  updateCameraRig(ctx, dt);
  ctx.world.updateCloudCamera(ctx.camera.position, dt);
  applyNightGlowVisibility(ctx.nightGlows, ctx.lightingUniforms.uNight.value);
  writeHeadlightUniforms(ctx.train, ctx.lightingUniforms);
  ctx.sky.position.copy(ctx.camera.position);
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

const quaternionOf = object => object.quaternion.toArray();

function birdState({ figure, body, tail, wings, velocity }) {
  return [
    xyz(figure.position), quaternionOf(figure), xyz(figure.scale),
    body.position.y, body.rotation.x, xyz(body.scale), tail.rotation.x,
    wings.map(({ pivot, tip }) => [pivot.rotation.y, pivot.rotation.z, xyz(pivot.scale), tip.rotation.y, tip.rotation.z]),
    xyz(velocity),
  ];
}

function walkerState(walker) {
  const { figure, rig } = walker;
  const transform = mesh => [xyz(mesh.position), quaternionOf(mesh), xyz(mesh.scale)];
  return {
    figure: [xyz(figure.position), figure.rotation.y],
    scalars: ['elapsed', 'bounce', 'swing', 'stopIndex', 'wait', 'progress', 'legIndex', 'turnSteps'].map(key => walker[key]),
    path: [xyz(walker.start), xyz(walker.end)],
    legs: walker.legs.map(leg => [xyz(leg.target), transform(leg.thigh), transform(leg.shin), transform(leg.shoe)]),
    body: [rig.body.position.y, xyz(rig.body.rotation), xyz(rig.body.scale)],
    head: xyz(rig.head.rotation),
    hat: [rig.hat.rotation.x, rig.hat.rotation.z],
    arms: rig.arms.map(({ arm }) => [arm.rotation.x, arm.rotation.z]),
    cane: [rig.cane.rotation.x, rig.caneShaft.scale.y, rig.caneShaft.position.y],
  };
}

/** Birds, flocks, the walker and the grandmother as plain arrays; reads parity-surface names only. */
export function snapshotLifeState(ctx) {
  const { world, birds } = ctx;
  const grandmother = world.stationTravelers[1];
  return {
    flocks: birds.flocks.map(flock => [flock.mode, flock.changedAt]),
    birds: birds.flocks.flatMap(flock => flock.birds.map(birdState)),
    walker: walkerState(world.stationWalker),
    grandmother: [grandmother.figure.rotation.x, grandmother.figure.rotation.z, grandmother.figure.scale.y, grandmother.head.rotation.y],
  };
}
