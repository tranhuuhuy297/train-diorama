// Cache-free parity harness logic: hook modes, original-site patch, perf text, diff metrics, DOM shim,
// scene signatures, hashing, build-step mapping and probe diffs.
import '../../src/core/disable-three-color-management.js';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installParityTestHook } from '../../src/engine/parity-test-hook.js';
import { formatPerformanceText } from '../../src/ui/debug-menu-panel.js';
import { ORIGINAL_HOOK_ANCHOR, ORIGINAL_HOOK_SNIPPET, patchTrainSceneSource } from '../../tools/parity/original-site-route-hooks.mjs';
import { computeDiffMetrics, evaluateThresholds } from '../../tools/parity/compare-parity-shots.mjs';
import { diffProbeResults } from '../../tools/parity/runtime-counts-probe.mjs';
import { THRESHOLDS } from '../../tools/parity/parity-shot-list.mjs';
import { installMinimalDomShim } from '../helpers/minimal-dom-shim.mjs';
import { sceneGraphSignature, compareSceneSignatures, hashNumbers } from '../helpers/scene-graph-signature.mjs';
import { toOriginalStep } from '../helpers/original-world-stepper.mjs';
import { withCapturedConsole } from '../helpers/original-simulation-oracle.mjs';

function runCloneHook(search) {
  const diorama = { paused: false };
  const { result, logs } = withCapturedConsole(() => installParityTestHook(diorama, search));
  const exposed = { diorama: globalThis.__diorama, buildInfo: globalThis.__parityBuildInfo };
  delete globalThis.__diorama;
  delete globalThis.__parityBuildInfo;
  return { diorama, result, logs, exposed };
}

function runOriginalSnippet(search) {
  const diorama = { paused: false };
  const window = {};
  const logs = [];
  new Function('location', 'document', 'window', 'console', 'diorama', ORIGINAL_HOOK_SNIPPET)({ search }, {}, window, { log: line => logs.push(line) }, diorama);
  return { diorama, logs, exposed: { diorama: window.__diorama, buildInfo: window.__parityBuildInfo } };
}

describe('parity hook', () => {
  test('stays dormant without the parity param', () => {
    assert.deepEqual(runCloneHook(''), { diorama: { paused: false }, result: 'off', logs: [], exposed: { diorama: undefined, buildInfo: undefined } });
  });
  test('?parity exposes a live diorama with build info', () => {
    for (const search of ['?parity', '?parity=1']) {
      const run = runCloneHook(search);
      assert.equal(run.result, 'live');
      assert.equal(run.exposed.diorama, run.diorama);
      assert.equal(run.diorama.paused, false);
      assert.deepEqual(run.exposed.buildInfo, { fredokaReadyAtBuild: null });
      assert.deepEqual(run.logs, ['[PARITY] Hook installed: live']);
    }
  });
  test('?parity=freeze also pauses', () => {
    for (const search of ['?parity=freeze', '?x=1&parity=freeze']) {
      const run = runCloneHook(search);
      assert.equal(run.result, 'freeze');
      assert.equal(run.diorama.paused, true);
      assert.deepEqual(run.logs, ['[PARITY] Hook installed: freeze']);
    }
  });
  test('the original-site snippet behaves like the clone hook', () => {
    for (const search of ['', '?parity', '?parity=freeze', '?parity=1']) {
      const [clone, original] = [runCloneHook(search), runOriginalSnippet(search)];
      assert.deepEqual(original.logs, clone.logs);
      assert.equal(original.diorama.paused, clone.diorama.paused);
      assert.equal(original.exposed.diorama === original.diorama, clone.exposed.diorama === clone.diorama);
      assert.deepEqual(original.exposed.buildInfo, clone.exposed.buildInfo);
    }
  });
});

test('patchTrainSceneSource inserts the snippet after exactly one anchor', () => {
  const source = `start();\n${ORIGINAL_HOOK_ANCHOR}\nkeep('$&', "$'");\n`;
  const patched = patchTrainSceneSource(source);
  assert.ok(patched.includes(ORIGINAL_HOOK_ANCHOR + ORIGINAL_HOOK_SNIPPET));
  assert.ok(patched.includes(`keep('$&', "$'");`));
  assert.equal(patched.length, source.length + ORIGINAL_HOOK_SNIPPET.length);
  assert.ok(ORIGINAL_HOOK_SNIPPET.startsWith('\n{') && ORIGINAL_HOOK_SNIPPET.endsWith('}\n'));
  assert.throws(() => patchTrainSceneSource('start();'), /expected exactly one/);
  assert.throws(() => patchTrainSceneSource(ORIGINAL_HOOK_ANCHOR + ORIGINAL_HOOK_ANCHOR), /expected exactly one/);
});

test('formatPerformanceText pads labels to 13 columns', () => {
  const text = formatPerformanceText({ frameMilliseconds: 762.4, cpuMilliseconds: 5.7 }, { render: { calls: 1411, triangles: 1773736 }, memory: { geometries: 419, textures: 6 } });
  const triangles = (1773736).toLocaleString();
  assert.equal(text, `FPS          1.3\nFrame        762.4 ms\nCPU submit   5.7 ms\nDraw calls   1411\nTriangles    ${triangles}\nGeometries   419\nTextures     6\nAll render passes · CPU excludes GPU time`);
});

test('computeDiffMetrics and evaluateThresholds', () => {
  const a = new Uint8ClampedArray(64).fill(100);
  const b = new Uint8ClampedArray(a);
  assert.deepEqual(computeDiffMetrics(a, b, 4, 4), { meanAbsDiff: 0, overThresholdFraction: 0, maxChannelDiff: 0 });
  b[20] = 120;
  assert.deepEqual(computeDiffMetrics(a, b, 4, 4), { meanAbsDiff: 20 / 48, overThresholdFraction: 1 / 16, maxChannelDiff: 20 });
  b[20] = 116;
  assert.equal(computeDiffMetrics(a, b, 4, 4).overThresholdFraction, 0);
  for (const [thresholdClass, limits] of Object.entries(THRESHOLDS)) {
    assert.equal(evaluateThresholds({ ...limits }, thresholdClass).pass, true);
    assert.equal(evaluateThresholds({ ...limits, meanAbsDiff: limits.meanAbsDiff + 1e-9 }, thresholdClass).pass, false);
    assert.equal(evaluateThresholds({ ...limits, overThresholdFraction: limits.overThresholdFraction + 1e-9 }, thresholdClass).pass, false);
  }
});

test('minimal DOM shim records 2D drawing', () => {
  const registry = installMinimalDomShim();
  const canvas = document.createElement('canvas');
  assert.ok(registry.canvases.includes(canvas));
  canvas.width = 64;
  const context = canvas.getContext('2d');
  context.fillStyle = '#123456';
  context.fillText('A', 1, 2);
  assert.deepEqual(canvas.operations, [['set', 'fillStyle', '#123456'], ['call', 'fillText', ['A', 1, 2]]]);
  assert.equal(context.fillStyle, '#123456');
  assert.equal(context.canvas, canvas);
  assert.deepEqual(context.measureText('abc'), { width: 30 });
  assert.equal(canvas.getContext('webgl'), null);
  assert.throws(() => document.createElement('div'), /unsupported element div/);
  assert.equal(installMinimalDomShim(), registry);
});

function makeScene({ shiftInstance = 0, night = 0, swap = false } = {}) {
  const scene = new THREE.Scene();
  const group = Object.assign(new THREE.Group(), { name: 'g' });
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), new THREE.MeshBasicMaterial({ color: '#ff0000' }));
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 3);
  for (let index = 0; index < 3; index++) instanced.setMatrixAt(index, new THREE.Matrix4().makeTranslation(index + (index === 1 ? shiftInstance : 0), 0, 0));
  const uniforms = { uColor: { value: new THREE.Color('#00ff00') }, uNight: { value: night } };
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.ShaderMaterial({ uniforms }));
  group.add(...(swap ? [instanced, box] : [box, instanced]), plane);
  scene.add(group);
  return { scene, instanced };
}

test('scene signatures on synthetic scenes', () => {
  const sig = (built, options) => sceneGraphSignature(built.scene, options);
  const base = makeScene();
  for (const ordered of [false, true]) assert.equal(compareSceneSignatures(sig(base), sig(makeScene()), { ordered }).equal, true);
  const shifted = makeScene({ shiftInstance: 0.5 });
  const moved = compareSceneSignatures(sig(base), sig(shifted));
  assert.equal(moved.equal, false);
  assert.equal(moved.firstMismatch.path, 'Scene/0:Group/1:InstancedMesh');
  assert.ok(moved.firstMismatch.differingFields.some(({ field }) => field.startsWith('instances')));
  assert.match(moved.report, /^Scene signature mismatch: 1 missing \/ 1 extra/);
  assert.equal(compareSceneSignatures(sig(base), sig(makeScene({ night: 1 }))).equal, true);
  const swapped = makeScene({ swap: true });
  assert.equal(compareSceneSignatures(sig(base), sig(swapped)).equal, true);
  assert.equal(compareSceneSignatures(sig(base), sig(swapped), { ordered: true }).equal, false);
  const skip = built => ({ exclude: new Set([built.instanced]) });
  assert.equal(compareSceneSignatures(sig(base, skip(base)), sig(shifted, skip(shifted))).equal, true);
});

test('hashNumbers quantises before hashing', () => {
  assert.equal(hashNumbers([0]), hashNumbers([-0]));
  assert.notEqual(hashNumbers([NaN]), hashNumbers([Infinity]));
  assert.equal(hashNumbers([1e-8], 1e6), hashNumbers([0], 1e6));
  assert.notEqual(hashNumbers([1, 2]), hashNumbers([2, 1]));
  assert.match(hashNumbers([1, 2]), /^[0-9a-f]{16}$/);
});

test('build-step mapping onto the original World', () => {
  assert.equal(toOriginalStep('buildBirdPerches'), 'buildTracksideBirdPerches');
  assert.equal(toOriginalStep('buildTerrain'), 'buildTerrain');
  for (const inline of ['buildTrackFrames', 'createVillageResidents']) assert.throws(() => toOriginalStep(inline), /inline/);
  assert.throws(() => toOriginalStep('nope'), /Unknown original build step/);
});

test('diffProbeResults reports leaf paths', () => {
  assert.deepEqual(diffProbeResults({ a: 1, b: { c: [1, 2] } }, { a: 1, b: { c: [1, 3] } }), [{ path: 'b.c.1', original: 2, clone: 3 }]);
  assert.deepEqual(diffProbeResults({ a: null }, { a: null }), []);
});
