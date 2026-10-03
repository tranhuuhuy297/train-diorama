// Whole-scene parity with the original oracle: construction signature and its console lines, the ordered
// lists (scene children, glow registry, shadow-hidden list), the world summary and the end of the placement
// stream, then 6 x 1800 lockstep frames across every camera mode, night and a fast train with per-frame
// scalars compared bitwise, signature checkpoints every 600 frames and the full console log sequence. The
// overview segment plays the dolly-in intro to completion; a second intro is interrupted by the side switch.
import '../../src/core/disable-three-color-management.js';
import { installMinimalDomShim } from '../helpers/minimal-dom-shim.mjs';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import { createOriginalSimulation, stepOriginalFrame, setOriginalMode, ORACLE_MATH_RANDOM_SEED } from '../helpers/original-simulation-oracle.mjs';
import { createCloneSimulation, stepCloneFrame, setCloneMode } from '../helpers/clone-simulation-driver.mjs';
import { prepareOverviewIntro } from '../../src/engine/cameras/overview-orbit-camera.js';
import { sceneGraphSignature, compareSceneSignatures } from '../helpers/scene-graph-signature.mjs';
import { summarizeWorld, summarizeOrderedLists, summarizeInstancedCounts } from '../helpers/world-summary-digest.mjs';

const ORIGINAL_FILES = ['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js',
  'StationWalker.js', 'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js'];
installMinimalDomShim();
const skip = originalSkipReason(ORIGINAL_FILES) && 'original source not fetched: npm run parity:fetch';
const DT = 1 / 60;
const FRAMES_PER_SEGMENT = 1800;
const CHECKPOINT_EVERY = 600;
const BOOT_LOGS = ['[BIRDS] Take off: station-roof, train approaches', '[BIRDS] Take off: trackside-4, train approaches'];
// intro 'play': armed after the mode switch and played to completion; 'interrupt': armed before it, so setMode cuts it.
const SEGMENTS = [
  { label: 'overview', mode: 'overview', intro: 'play' },
  { label: 'side', mode: 'side', intro: 'interrupt' },
  { label: 'bridge', mode: 'bridge' },
  { label: 'orbit', mode: 'orbit' },
  { label: 'night overview', mode: 'overview', night: true },
  { label: 'overview speedMul 2.5', mode: 'overview', speedMul: 2.5 },
];
const SCALARS = ['time', 's', 'speed', 'stopTimer', 'justLeft', 'puffTimer', 'flyAlongElapsed', 'flyAlongSide'];
const VECTORS = ['camPos', 'camTarget'];

function frameScalars(ctx) {
  const values = Object.fromEntries(SCALARS.map(field => [field, ctx[field]]));
  values['brakeSparks.mesh.count'] = ctx.brakeSparks.mesh.count;
  for (const field of VECTORS) ['x', 'y', 'z'].forEach(axis => { values[`${field}.${axis}`] = ctx[field][axis]; });
  ['x', 'y', 'z'].forEach(axis => { values[`camera.position.${axis}`] = ctx.camera.position[axis]; });
  return values;
}

// Unique geometries, materials and textures reachable from the scene (materials' own maps and uniform values).
function resourceCounts(scene) {
  const sets = { geometries: new Set(), materials: new Set(), textures: new Set() };
  const addTexture = value => { if (value?.isTexture) sets.textures.add(value); };
  scene.traverse(object => {
    if (object.geometry) sets.geometries.add(object.geometry);
    for (const material of [object.material].flat().filter(Boolean)) {
      sets.materials.add(material);
      Object.values(material).forEach(addTexture);
      Object.values(material.uniforms ?? {}).forEach(uniform => addTexture(uniform?.value));
    }
  });
  return Object.fromEntries(Object.entries(sets).map(([name, set]) => [name, set.size]));
}

describe('full-scene parity with the original oracle', { skip, timeout: 900_000 }, () => {
  const sides = {};
  const logs = { original: [], clone: [] };
  const rngs = { original: mulberry32(ORACLE_MATH_RANDOM_SEED), clone: mulberry32(ORACLE_MATH_RANDOM_SEED) };

  // For the duration of `fn` only: this side's generator is Math.random and console.log appends to its log.
  function stepSide(side, fn) {
    const [realRandom, realLog] = [Math.random, console.log];
    Math.random = rngs[side];
    console.log = (...args) => { logs[side].push(args.map(String).join(' ')); };
    try {
      fn();
    } finally {
      Math.random = realRandom;
      console.log = realLog;
    }
  }

  function stepBoth(dt) {
    stepSide('original', () => stepOriginalFrame(sides.original, dt));
    stepSide('clone', () => stepCloneFrame(sides.clone, dt));
  }

  // The boot sequence's intro: original prototype method vs the clone's pose helper, then playing = true.
  function armIntroBoth() {
    stepSide('original', () => sides.original.prepareOverviewIntro());
    stepSide('clone', () => prepareOverviewIntro(sides.clone));
    for (const ctx of [sides.original, sides.clone]) {
      assert.ok(ctx.overviewIntro, 'intro armed');
      ctx.overviewIntro.playing = true;
    }
  }

  function assertSignaturesEqual(label) {
    const comparison = compareSceneSignatures(sceneGraphSignature(sides.original.scene), sceneGraphSignature(sides.clone.scene));
    assert.ok(comparison.equal, `${label}: ${comparison.report}`);
    return comparison;
  }

  before(async () => {
    const started = performance.now();
    sides.original = await createOriginalSimulation();
    const originalMs = performance.now() - started;
    sides.clone = await createCloneSimulation();
    sides.buildMs = { original: Math.round(originalMs), clone: Math.round(performance.now() - started - originalMs) };
  });

  test('construction: first frame logs, scene signature and resource counts', t => {
    t.diagnostic(`build ms ${JSON.stringify(sides.buildMs)}`);
    stepBoth(0.05);
    assert.deepEqual(logs.original, BOOT_LOGS);
    assert.deepEqual(logs.clone, logs.original);
    t.diagnostic(assertSignaturesEqual('construction').report);
    const counts = [resourceCounts(sides.original.scene), resourceCounts(sides.clone.scene)];
    t.diagnostic(`resources ${JSON.stringify(counts[0])}`);
    assert.deepEqual(counts[1], counts[0]);
    assert.deepEqual(summarizeInstancedCounts(sides.clone.scene), summarizeInstancedCounts(sides.original.scene));
  });

  test('ordered lists: scene children, glow registry and shadow-hidden list', () => {
    const [expected, actual] = [summarizeOrderedLists(sides.original), summarizeOrderedLists(sides.clone)];
    assert.equal(expected.ctxGlowsMatch, true);
    assert.equal(actual.ctxGlowsMatch, true);
    assert.deepEqual(actual, expected);
    const { clone } = sides;
    const order = [clone.sky, clone.brakeSparks.mesh, ...clone.world.noShadow, ...clone.train.noShadow, ...clone.puffs.map(puff => puff.mesh)];
    // The clone side is composed by the runtime composeDioramaScene: its shadow-hidden list follows scene insertion order (sky, sparks, world, train, then puffs).
    assert.ok(order.length === clone.shadowHiddenObjects.length && order.every((object, i) => clone.shadowHiddenObjects[i] === object));
    assert.equal(clone.puffs.length, 70);
  });

  test('world summary and the end of the placement stream', () => {
    const [expected, actual] = [summarizeWorld(sides.original), summarizeWorld(sides.clone)];
    assert.deepEqual(actual, expected);
    assert.equal(actual.stationFrameIndex, 1008);
    assert.equal(actual.clouds, 33);
    assert.deepEqual(actual.bridge, [30, 178]);
    assert.equal(sides.clone.world.rand(), sides.original.world.rand());
  });

  test('stepping: 6 segments x 1800 frames in lockstep', t => {
    const { original, clone } = sides;
    let frame = 0;
    try {
      for (const segment of SEGMENTS) {
        if (segment.intro === 'interrupt') armIntroBoth();
        stepSide('original', () => setOriginalMode(original, segment.mode));
        stepSide('clone', () => setCloneMode(clone, segment.mode));
        if (segment.intro === 'play') armIntroBoth();
        for (const ctx of [original, clone]) ctx.speedMul = segment.speedMul ?? 1;
        for (let index = 1; index <= FRAMES_PER_SEGMENT; index++) {
          frame++;
          for (const ctx of segment.night ? [original, clone] : []) {
            ctx.lightingUniforms.uNight.value = 1;
            ctx.world.nightAmount = 1;
          }
          stepBoth(DT);
          const [expected, actual] = [frameScalars(original), frameScalars(clone)];
          for (const [field, value] of Object.entries(expected)) {
            if (!Object.is(actual[field], value)) assert.fail(`${segment.label} frame ${frame} field ${field}: clone ${actual[field]} vs original ${value}`);
          }
          if (index % CHECKPOINT_EVERY === 0) assertSignaturesEqual(`${segment.label} frame ${frame}`);
        }
        if (segment.night) for (const ctx of [original, clone]) ctx.lightingUniforms.uNight.value = 0;
      }
    } finally {
      for (const ctx of [original, clone]) {
        ctx.lightingUniforms.uNight.value = 0;
        ctx.speedMul = 1;
      }
    }
    assert.deepEqual(logs.clone, logs.original);
    const tags = [...new Set(logs.original.map(line => line.slice(0, line.indexOf(']') + 1)))];
    t.diagnostic(`${frame} frames, ${logs.original.length} log lines, tags ${tags.join(' ')}`);
    assert.ok(['[SHEEP]', '[BIRDS]', '[STATION]', '[VILLAGE]', '[CAMERA]'].every(tag => tags.includes(tag)), tags.join(' '));
    // The in-sim camera lines: updateCamera's intro completion, then setMode's interrupt of the second intro.
    const cameraLines = logs.original.filter(line => line.startsWith('[CAMERA]'));
    assert.deepEqual(cameraLines, ['[CAMERA] Overview intro completed', '[CAMERA] Overview intro interrupted by mode selection']);
  });
});
