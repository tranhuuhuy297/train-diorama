// Deadline cadence, the frame-loop dispatch order, instance-override pickup, and the pure
// resolution table plus resizeDiorama's renderer/RT/uniform wiring.
import '../../src/core/disable-three-color-management.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { FRAME_INTERVAL_MILLISECONDS, nextFrameDeadline, createFrameLoop } from '../../src/engine/frame-loop-scheduler.js';
import { stepSimulation } from '../../src/engine/simulation-step.js';
import { computeRenderResolution, resizeDiorama } from '../../src/engine/render-resolution-resizer.js';
import { createPostPass } from '../../src/engine/post-ink-outline-dither-pass.js';
import { G, LIGHTING_UNIFORMS } from '../../src/materials/shared-lighting-uniforms.js';
import { applyPalette } from '../../src/engine/time-of-day-palettes-and-transition.js';

beforeEach(() => {
  applyPalette(LIGHTING_UNIFORMS, 'day');
  G.uTime.value = 0;
  globalThis.requestAnimationFrame = () => 0;
});

function fakeDiorama() {
  const calls = [];
  const d = {
    calls,
    last: 0, nextFrameAt: 0, time: 0, raf: 0, paused: false, timeScale: 1, s: 0, speed: 0,
    lightingUniforms: LIGHTING_UNIFORMS,
    performanceStats: { frameMilliseconds: 1000 / 60, cpuMilliseconds: 0 },
    camera: { position: new THREE.Vector3() },
    // Each nightAmount write records the calls before it and the sim time (unchanged until the sim step).
    world: {
      nightWrites: [], cloudCameraCalls: [], update() {},
      // Records the calls before it, its dt and whether it got the live camera position.
      updateCloudCamera(position, dt) { this.cloudCameraCalls.push([calls.map(c => c[0]).join(), dt, position === d.camera.position]); },
      get nightAmount() { return this.nightWrites.at(-1)?.value ?? 0; },
      set nightAmount(value) { this.nightWrites.push({ value, after: calls.map(c => c[0]).join(), simTime: d.time }); },
    },
    updateTrain() {},
    train: { loco: { obj: { position: new THREE.Vector3() } }, totalLength: 25.65, cars: [] },
    birds: { update() {} },
    updateTimeOfDay(dt) { calls.push(['tod', dt]); LIGHTING_UNIFORMS.uNight.value = 0.7; },
    updateCamera(dt) { calls.push(['cam', dt]); },
    render() { calls.push(['render']); },
  };
  return d;
}

test('nextFrameDeadline: cadence table', () => {
  const I = FRAME_INTERVAL_MILLISECONDS;
  assert.equal(nextFrameDeadline(0, 0), 8.333333333333334);
  assert.equal(nextFrameDeadline(5, I), null);
  assert.equal(nextFrameDeadline(I - 0.05, I), 2 * I);
  assert.equal(nextFrameDeadline(8.3, I), 16.666666666666668);
  assert.equal(nextFrameDeadline(100, I), 108.33333333333333);
  assert.equal(nextFrameDeadline(200, 0), 208.33333333333334);
});

test('simulated refresh rates render at the expected cadence over 10s', () => {
  for (const [hz, expected] of [[30, 30], [60, 60], [120, 120], [144, 120], [165, 120], [240, 120]]) {
    let now = 0;
    let nextFrameAt = 0;
    let rendered = 0;
    const interval = 1000 / hz;
    while (now <= 10000) {
      const deadline = nextFrameDeadline(now, nextFrameAt);
      if (deadline !== null) { nextFrameAt = deadline; rendered++; }
      now += interval;
    }
    const perSecond = rendered / 10;
    assert.ok(Math.abs(perSecond - expected) <= 0.2, `${hz}Hz -> ${perSecond}/s`);
  }
});

test('loop dispatch order and dt clamping; paused and timeScale gating', () => {
  const d = fakeDiorama();
  const loop = createFrameLoop(d);
  loop(200);
  assert.deepEqual(d.calls, [['tod', 0.2], ['cam', 0.05], ['render']]);
  assert.deepEqual(d.world.nightWrites, [{ value: 0.7, after: 'tod', simTime: 0 }], 'uNight copied after time of day, before the sim step');
  assert.deepEqual(d.world.cloudCameraCalls, [['tod,cam', 0.05, true]], 'cloud camera after the camera, before render, clamped real dt');
  assert.equal(d.time, 0.05);
  assert.equal(G.uTime.value, 0.05);
  assert.equal(d.nextFrameAt, 208.33333333333334);
  assert.ok(Math.abs(d.performanceStats.frameMilliseconds - 35) < 1e-9);

  d.calls.length = 0;
  loop(203);
  assert.deepEqual(d.calls, [], 'skipped: before the next deadline');
  assert.equal(d.world.nightWrites.length, 1, 'skipped frames write nothing');

  const paused = fakeDiorama();
  paused.paused = true;
  const pausedLoop = createFrameLoop(paused);
  pausedLoop(200);
  assert.equal(paused.time, 0, 'sim frozen while paused');
  assert.equal(paused.world.nightAmount, 0.7, 'nightAmount still follows uNight while paused');
  assert.deepEqual(paused.calls.map(c => c[0]), ['tod', 'cam', 'render'], 'camera/render still run');
  assert.deepEqual(paused.world.cloudCameraCalls, [['tod,cam', 0.05, true]], 'clouds still part around the camera while paused');

  const zeroScale = fakeDiorama();
  zeroScale.timeScale = 0;
  createFrameLoop(zeroScale)(200);
  assert.equal(zeroScale.time, 0, 'timeScale 0 behaves like paused for the sim');
  assert.equal(zeroScale.world.cloudCameraCalls.length, 1);

  const doubleScale = fakeDiorama();
  doubleScale.timeScale = 2;
  createFrameLoop(doubleScale)(200);
  assert.ok(Math.abs(doubleScale.time - 0.1) < 1e-12);
});

test('instance overrides assigned after createFrameLoop take effect on the next frame', () => {
  const tag = { updateCamera: 'cam', render: 'render', updateTimeOfDay: 'tod' };
  const expectedArgs = { updateCamera: [0.05], render: [], updateTimeOfDay: [0.05] };
  for (const member of ['updateCamera', 'render', 'updateTimeOfDay']) {
    const d = fakeDiorama();
    const loop = createFrameLoop(d);
    const overrideCalls = [];
    d[member] = (...args) => overrideCalls.push(args);
    loop(d.nextFrameAt + 50);
    assert.equal(overrideCalls.length, 1, `${member} override recorded once`);
    assert.deepEqual(overrideCalls[0], expectedArgs[member], `${member} override receives the real call args`);
    assert.ok(d.calls.every(c => c[0] !== tag[member]), 'the original spy for the overridden member records nothing');
    const othersRan = d.calls.filter(c => c[0] !== tag[member]).map(c => c[0]);
    assert.deepEqual(othersRan.sort(), Object.values(tag).filter(t => t !== tag[member]).sort(), 'the other two members still ran');

    d.calls.length = 0;
    d[member] = () => {};
    loop(d.nextFrameAt + 50);
    assert.equal(overrideCalls.length, 1, `${member} no-op stops further override recording`);
    assert.ok(d.calls.every(c => c[0] !== tag[member]), 'no call recorded for the no-op member');
    assert.deepEqual(d.calls.map(c => c[0]).sort(), Object.values(tag).filter(t => t !== tag[member]).sort(), 'other members still ran');
  }
});

test('stepSimulation writes time and uTime before the train step; a missing train or world fails loudly', () => {
  const d = fakeDiorama();
  const seen = [];
  d.updateTrain = dt => seen.push([dt, d.time, G.uTime.value]);
  stepSimulation(d, 0.05);
  assert.deepEqual(seen, [[0.05, 0.05, 0.05]]);
  assert.throws(() => stepSimulation({ ...d, updateTrain: undefined }, 0.05), TypeError);
  assert.throws(() => stepSimulation({ ...d, world: undefined }, 0.05), TypeError);
});

test('computeRenderResolution table', () => {
  const table = [
    [[1920, 1080, 1, 360], [640, 360, true, 1]],
    [[1600, 900, 1, 360], [640, 360, true, 1]],
    [[1600, 900, 1, 540], [960, 540, true, 1]],
    [[1600, 900, 1, 720], [1280, 720, true, 1]],
    [[1600, 900, 1, null], [1600, 900, false, 1]],
    [[1920, 1080, 2, null], [3840, 2160, false, 1.8]],
    [[390, 844, 2, 360], [360, 779, true, 1]],
    [[390, 844, 2, null], [780, 1688, false, 1.8]],
    [[1600, 900, 1, 1080], [1600, 900, true, 1]],
    [[1366, 768, 1.25, 360], [640, 360, true, 1]],
  ];
  for (const [input, [renderWidth, renderHeight, pixelated, thickness]] of table) {
    const result = computeRenderResolution(...input);
    assert.deepEqual(result, { renderWidth, renderHeight, pixelated, thickness }, JSON.stringify(input));
  }
});

test('resizeDiorama wires the renderer, RT, post uniforms and camera aspect', () => {
  const setSizeCalls = [];
  const mainRT = new THREE.WebGLRenderTarget(4, 4, { depthTexture: new THREE.DepthTexture(4, 4) });
  const post = createPostPass(mainRT, 0.3, 1500);
  const d = {
    container: { clientWidth: 0, clientHeight: 844 },
    renderer: { setSize: (...a) => setSizeCalls.push(a), getPixelRatio: () => 2 },
    mainRT, postMat: post.material,
    camera: new THREE.PerspectiveCamera(42, 1, 0.3, 1500),
    pixelShortSide: 360,
  };
  resizeDiorama(d);
  assert.deepEqual(setSizeCalls[0], [1, 844, true]);
  assert.equal(mainRT.width, 2);
  assert.equal(mainRT.height, 1688);
  assert.equal(mainRT.texture.minFilter, THREE.NearestFilter);
  assert.equal(mainRT.texture.magFilter, THREE.NearestFilter);
  assert.equal(d.postMat.uniforms.uPixel.value, 1);
  assert.equal(d.postMat.uniforms.uThick.value, 1);
  assert.ok(Math.abs(d.camera.aspect - 1 / 844) < 1e-12);

  d.pixelShortSide = null;
  resizeDiorama(d);
  assert.equal(mainRT.texture.minFilter, THREE.LinearFilter);
  assert.equal(d.postMat.uniforms.uThick.value, 1.8);
});
