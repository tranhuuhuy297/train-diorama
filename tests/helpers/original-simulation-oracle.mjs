// Node simulation oracle: an object on the original Diorama prototype (its constructor never runs) holding
// the same fields, so the unmodified original sim/camera methods step in node without a renderer.
import '../../src/core/disable-three-color-management.js';
import * as THREE from 'three';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { importOriginal } from './original-module-loader.mjs';
import { buildOriginalWorld } from './original-world-stepper.mjs';
import { installMinimalDomShim } from './minimal-dom-shim.mjs';
import { hashNumbers } from './quantised-number-hashing.mjs';
import { cameraRig } from './oracle-camera-controls-stub.mjs';

export const ORACLE_MATH_RANDOM_SEED = 20260930;

// Constructor facts of the original, typed here so a clone constant regression cannot leak in.
const PUFF_POOL_SIZE = 70;
const SKY_RADIUS = 700;
const GLOW_MATERIAL_NAME = 'night-light-glow';

async function loadOriginalModules() {
  installMinimalDomShim();
  // Diorama first so the original graph evaluates in browser order before the leaf modules are requested.
  const { Diorama } = await importOriginal('Diorama.js');
  const [materials, { Train }, { BrakeSparks }, { createBirdSystem }] = await Promise.all(
    ['Materials.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js'].map(name => importOriginal(name)),
  );
  return { Diorama, G: materials.G, npr: materials.npr, skyMaterial: materials.skyMaterial, Train, BrakeSparks, createBirdSystem };
}

function initialFields(G) {
  const zero = () => new THREE.Vector3();
  return {
    scene: Object.assign(new THREE.Scene(), { matrixWorldAutoUpdate: false }),
    lightingUniforms: {
      ...G,
      uNight: { value: 0 },
      uSaturation: { value: 1 },
      uHeadlightPosition: { value: new THREE.Vector3(0, 0, 0) },
      uHeadlightDirection: { value: new THREE.Vector3(0, 0, 1) },
    },
    mode: 'overview', overviewIntro: null, autoRotateEnabled: true, speedMul: 1, timeScale: 1, paused: false,
    pixelShortSide: null, outline: true, timeOfDay: null, timeOfDayTransition: null,
    time: 0, s: 0, speed: 0, stopTimer: 0, puffTimer: 0, justLeft: false, puffs: [],
    camPos: zero(), camTarget: zero(), flyAlongAnchor: zero(), flyAlongVelocity: zero(),
    previousFlyAlongAnchor: zero(), tmpA: zero(), tmpB: zero(),
    flyAlongElapsed: 0, flyAlongSide: 1, movementKeys: new Set(),
  };
}

// Same insertion order as the original constructor; scene child order is part of ordered signatures.
function compose(ctx, world, modules) {
  const { npr, skyMaterial, Train, BrakeSparks, createBirdSystem } = modules;
  const heightAt = world.heightAt.bind(world);
  ctx.world = world;
  ctx.scene.add(world.group);
  ctx.birds = createBirdSystem({
    perches: world.birdPerches, trackLength: world.length, heightAt,
    canopyHeightAt: world.treeCanopyHeightAt.bind(world),
    material: npr({ vertexColors: true, stipple: 0.1, stippleScale: 4 }),
  });
  ctx.scene.add(ctx.birds.group);
  ctx.freeCameraPose = { position: world.freeCameraStart.position.clone(), target: world.freeCameraStart.target.clone() };
  ctx.train = new Train();
  ctx.scene.add(ctx.train.group);
  ctx.brakeSparks = new BrakeSparks(heightAt);
  ctx.scene.add(ctx.brakeSparks.mesh);
  Object.assign(ctx, { s: world.stationS + 1, justLeft: true, speed: 2 });
  ctx.sky = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 32, 16), skyMaterial());
  Object.assign(ctx.sky, { frustumCulled: false, renderOrder: -1 });
  ctx.scene.add(ctx.sky);
  const puffGeometry = new THREE.IcosahedronGeometry(0.5, 1);
  const puffMaterial = npr({ color: '#fbfbff', stipple: 0.3, stippleScale: 2.2 });
  for (let index = 0; index < PUFF_POOL_SIZE; index++) {
    const mesh = new THREE.Mesh(puffGeometry, puffMaterial);
    mesh.visible = false;
    ctx.scene.add(mesh);
    ctx.puffs.push({ mesh, life: 0, max: 1, size: 1, vel: new THREE.Vector3() });
  }
  ctx.shadowHiddenObjects = [ctx.sky, ctx.brakeSparks.mesh, ...world.noShadow, ...ctx.train.noShadow, ...ctx.puffs.map(puff => puff.mesh)];
  ctx.shadowVisibility = new Array(ctx.shadowHiddenObjects.length);
  // Shared-uniform rebinding is skipped: the npr cache is process-wide, so rebinding would cross-wire oracles.
  ctx.nightGlows = [];
  ctx.scene.traverse(object => {
    if (object.isMesh && object.material?.isShaderMaterial && object.material.name === GLOW_MATERIAL_NAME) ctx.nightGlows.push(object);
  });
}

export async function createOriginalSimulation({ world = null } = {}) {
  const modules = await loadOriginalModules();
  const builtWorld = world ?? (await buildOriginalWorld()).world;
  const ctx = Object.create(modules.Diorama.prototype);
  Object.assign(ctx, initialFields(modules.G), cameraRig());
  compose(ctx, builtWorld, modules);
  ctx.setTimeOfDay('day', true);
  ctx.camPos.copy(ctx.camera.position);
  ctx.camTarget.copy(ctx.controls.target);
  return ctx;
}

const HEADLIGHT_AIM = new THREE.Vector3(0, -0.08, 1).normalize();

// The sim-visible side effects of the original render(); no GPU work.
function renderSideEffects(ctx) {
  const uniforms = ctx.lightingUniforms;
  for (const glow of ctx.nightGlows) glow.visible = uniforms.uNight.value > 0;
  ctx.train.headlight.getWorldPosition(uniforms.uHeadlightPosition.value);
  uniforms.uHeadlightDirection.value.copy(HEADLIGHT_AIM).applyQuaternion(ctx.train.loco.obj.quaternion);
  ctx.sky.position.copy(ctx.camera.position);
  ctx.scene.updateMatrixWorld();
}

export function stepOriginalFrame(ctx, dt) {
  ctx.updateTimeOfDay(dt);
  ctx.world.nightAmount = ctx.lightingUniforms.uNight.value;
  if (!ctx.paused && ctx.timeScale > 0) {
    const simDt = dt * ctx.timeScale;
    ctx.time += simDt;
    ctx.lightingUniforms.uTime.value = ctx.time;
    ctx.updateTrain(simDt);
    ctx.world.update(ctx.time, simDt, ctx.train.loco.obj.position, { distance: ctx.s, speed: ctx.speed, length: ctx.train.totalLength });
    ctx.birds.update(ctx.time, ctx.s, ctx.speed, ctx.train.cars);
  }
  ctx.updateCamera(dt);
  ctx.world.updateCloudCamera(ctx.camera.position, dt);
  renderSideEffects(ctx);
}

export function setOriginalMode(ctx, mode) {
  ctx.setMode(mode);
}

export function snapshotSimulation(ctx) {
  const { camera, lightingUniforms: uniforms } = ctx;
  return {
    time: ctx.time, s: ctx.s, speed: ctx.speed, stopTimer: ctx.stopTimer, justLeft: ctx.justLeft,
    puffTimer: ctx.puffTimer, mode: ctx.mode, flyAlongElapsed: ctx.flyAlongElapsed, flyAlongSide: ctx.flyAlongSide,
    camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov },
    controlsTarget: ctx.controls.target.toArray(), camPos: ctx.camPos.toArray(), camTarget: ctx.camTarget.toArray(),
    lighting: {
      night: uniforms.uNight.value,
      headlightPosition: uniforms.uHeadlightPosition.value.toArray(),
      headlightDirection: uniforms.uHeadlightDirection.value.toArray(),
    },
    puffs: (ctx.puffs ?? []).map(({ life, max, size, mesh }) => ({
      life, max, size, visible: mesh.visible, position: mesh.position.toArray(), scale: mesh.scale.x,
    })),
    sparks: ctx.brakeSparks ? hashNumbers(ctx.brakeSparks.mesh.instanceMatrix.array, 1e6) : null,
  };
}

function assertSynchronous(result, helperName) {
  if (result && typeof result.then === 'function') throw new Error(`${helperName} needs a synchronous function`);
  return result;
}

// A seed restarts the stream per call; a generator function keeps one stream running across calls.
export function runWithSeededMathRandom(seedOrGenerator, fn) {
  const previousRandom = Math.random;
  Math.random = typeof seedOrGenerator === 'function' ? seedOrGenerator : mulberry32(seedOrGenerator);
  try {
    return assertSynchronous(fn(), 'runWithSeededMathRandom');
  } finally {
    Math.random = previousRandom;
  }
}

export function withCapturedConsole(fn) {
  const previousLog = console.log;
  const logs = [];
  console.log = (...args) => { logs.push(args.map(String).join(' ')); };
  try {
    return { result: assertSynchronous(fn(), 'withCapturedConsole'), logs };
  } finally {
    console.log = previousLog;
  }
}
