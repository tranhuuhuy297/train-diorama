// Train simulation vs the original oracle: 5 sim-minutes on the slider schedule with Math.random replayed
// from one persistent stream per side; variant A drives the clone train on an original World, variant B
// on the clone World. Then composition layout, headlight uniforms and behaviour windows.
import '../../src/core/disable-three-color-management.js';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import { buildOriginalWorld } from '../helpers/original-world-stepper.mjs';
import {
  ORACLE_MATH_RANDOM_SEED, createOriginalSimulation, stepOriginalFrame, runWithSeededMathRandom, withCapturedConsole,
} from '../helpers/original-simulation-oracle.mjs';
import { createCloneSimulation, stepCloneFrame, snapshotTrainState } from '../helpers/clone-simulation-driver.mjs';
import { trackPuffs, assertPuffBehaviour } from '../helpers/smoke-puff-behaviour-checks.mjs';
import { composeDioramaScene } from '../../src/engine/diorama-scene-composition.js';
import { writeHeadlightUniforms } from '../../src/train/train-frame-update.js';

const skip = originalSkipReason(['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js',
  'StationWalker.js', 'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js']);
const DT = 1 / 60;
const FRAMES = 18000;
const SNAPSHOT_EVERY = 30;
const SPARK_MAX_FRAMES = Math.ceil(1.15 * 60);
const speedMulAt = frame => (frame >= 14401 ? 1 : frame >= 10801 ? 0.5 : frame >= 7201 ? 0 : frame >= 3601 ? 2.5 : 1);
const MOTION_FIELDS = ['s', 'speed', 'stopTimer', 'justLeft', 'puffTimer'];
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const sparkBytes = ctx => bytes(ctx.brakeSparks.mesh.instanceMatrix.array);
const cameraState = ctx => [ctx.camera.position.toArray(), ctx.camPos.toArray(), ctx.camTarget.toArray()];

// Records every strength handed to the spark system, without changing the call.
function recordStrengths(ctx) {
  const strengths = [];
  const update = ctx.brakeSparks.update;
  ctx.brakeSparks.update = function recordedUpdate(dt, strength, locomotive) {
    strengths.push(strength);
    return update.call(this, dt, strength, locomotive);
  };
  return strengths;
}

function assertMotionEqual(expected, actual, frame, label) {
  for (const field of MOTION_FIELDS) {
    if (!Object.is(actual[field], expected[field])) assert.fail(`${label} ${field} at frame ${frame}: ${actual[field]} vs ${expected[field]}`);
  }
}

// Labels the scene layout through parity-surface names only, so both ctx shapes describe themselves alike.
function compositionLayout(ctx) {
  const puffMeshes = new Set(ctx.puffs.map(puff => puff.mesh));
  const name = object => (object === ctx.world.group ? 'world' : object === ctx.train.group ? 'train'
    : object === ctx.brakeSparks.mesh ? 'sparks' : object === ctx.sky ? 'sky' : puffMeshes.has(object) ? 'puff'
      : ctx.world.noShadow.includes(object) ? 'world-no-shadow' : ctx.train.noShadow.includes(object) ? `train-${ctx.train.noShadow.indexOf(object)}` : 'other');
  return {
    children: ctx.scene.children.filter(child => child !== ctx.birds?.group).map(name),
    shadow: ctx.shadowHiddenObjects.map(name).filter(label => label !== 'world-no-shadow'),
    trainGlows: ctx.nightGlows.slice(-6).map(name),
    departure: [ctx.s === ctx.world.stationS + 1, ctx.speed, ctx.justLeft],
  };
}

describe('train simulation parity with the original oracle', { skip, timeout: 600_000 }, () => {
  const sims = {};
  before(async () => {
    sims.oracle = await createOriginalSimulation();
    sims.layout = compositionLayout(sims.oracle);
    sims.worldB = (await buildOriginalWorld()).world;
    sims.cloneA = await createCloneSimulation({ world: sims.worldB });
    sims.cloneB = await createCloneSimulation();
  });

  test('composition layout matches the oracle (world, train, sparks, sky, puffs; shadow list; train glows last)', () => {
    const d = { scene: new THREE.Scene() };
    composeDioramaScene(d);
    assert.deepStrictEqual(compositionLayout(d), sims.layout);
    assert.deepStrictEqual(sims.layout.trainGlows, ['train-3', 'train-4', 'train-5', 'train-6', 'train-7', 'train-8']);
  });

  test('variant A (original World) matches frame by frame; variant B (clone World) matches motion and smoke', t => {
    const { oracle, cloneA, cloneB } = sims;
    const ctxs = [oracle, cloneA, cloneB];
    const streams = ctxs.map(() => mulberry32(ORACLE_MATH_RANDOM_SEED));
    const strengths = ctxs.map(recordStrengths);
    const heightsEqual = bytes(cloneB.world.heights).equals(bytes(oracle.world.heights));
    if (!heightsEqual) t.diagnostic('[PARITY] clone World heights differ from the original: variant B spark buffers not compared');
    const { logs } = withCapturedConsole(() => {
      for (let frame = 1; frame <= FRAMES; frame++) {
        for (const ctx of ctxs) ctx.speedMul = speedMulAt(frame);
        runWithSeededMathRandom(streams[0], () => stepOriginalFrame(oracle, DT));
        runWithSeededMathRandom(streams[1], () => stepCloneFrame(cloneA, DT));
        runWithSeededMathRandom(streams[2], () => stepCloneFrame(cloneB, DT));
        assertMotionEqual(oracle, cloneA, frame, 'variant A');
        assertMotionEqual(oracle, cloneB, frame, 'variant B');
        if (!Object.is(strengths[1][frame - 1], strengths[0][frame - 1])) assert.fail(`variant A strength at frame ${frame}`);
        if (!Object.is(strengths[2][frame - 1], strengths[0][frame - 1])) assert.fail(`variant B strength at frame ${frame}`);
        if (!sparkBytes(cloneA).equals(sparkBytes(oracle))) assert.fail(`variant A spark matrices at frame ${frame}`);
        if (heightsEqual && !sparkBytes(cloneB).equals(sparkBytes(oracle))) assert.fail(`variant B spark matrices at frame ${frame}`);
        if (frame % SNAPSHOT_EVERY !== 0 && frame !== FRAMES) continue;
        const expected = snapshotTrainState(oracle);
        assert.deepStrictEqual(snapshotTrainState(cloneA), expected, `variant A snapshot at frame ${frame}`);
        assert.deepStrictEqual(cameraState(cloneA), cameraState(oracle), `variant A camera at frame ${frame}`);
        const variantB = snapshotTrainState(cloneB);
        assert.deepStrictEqual([variantB.puffs, variantB.cars], [expected.puffs, expected.cars], `variant B puffs/cars at frame ${frame}`);
        if (heightsEqual) assert.deepStrictEqual(variantB.sparks, expected.sparks, `variant B sparks at frame ${frame}`);
      }
    });
    t.diagnostic(`stepped ${FRAMES} frames; console lines silenced: ${logs.length}; braking frames: ${strengths[0].filter(s => s > 0).length}`);
    assert.ok(strengths[0].some(s => s === 1) && strengths[0].some(s => s > 0 && s < 1), 'both saturated and partial braking occurred');
  });

  test('headlight uniforms written from the clone train equal the oracle render values', () => {
    const uniforms = { uHeadlightPosition: { value: new THREE.Vector3() }, uHeadlightDirection: { value: new THREE.Vector3(0, 0, 1) } };
    writeHeadlightUniforms(sims.cloneA.train, uniforms);
    const expected = sims.oracle.lightingUniforms;
    for (const key of Object.keys(uniforms)) {
      const [a, b] = [expected[key].value.toArray(), uniforms[key].value.toArray()];
      assert.ok(a.every((value, axis) => Object.is(b[axis], value)), `${key}: ${b} vs ${a}`);
    }
    const reference = new THREE.Vector3();
    sims.oracle.train.headlight.getWorldPosition(reference);
    assert.deepStrictEqual(uniforms.uHeadlightPosition.value.toArray(), reference.toArray());
  });

  test('behaviour over 120 s at speedMul 1: strength, spark and puff windows', async () => {
    const ctx = await createCloneSimulation({ world: sims.worldB });
    const strengths = recordStrengths(ctx);
    const stream = mulberry32(ORACLE_MATH_RANDOM_SEED);
    const laps = [];
    const puffs = trackPuffs(ctx, DT);
    let liveSparkFrames = 0;
    withCapturedConsole(() => {
      for (let frame = 1; frame <= 7200; frame++) {
        const ahead = (((ctx.world.stationS - ctx.s) % ctx.world.length) + ctx.world.length) % ctx.world.length;
        const dwelling = ctx.stopTimer > 0;
        runWithSeededMathRandom(stream, () => stepCloneFrame(ctx, DT));
        puffs.record(frame);
        const strength = strengths[frame - 1];
        if (strength > 0) {
          assert.ok(!dwelling && ahead < 26, `strength ${strength} outside the brake zone at frame ${frame}`);
          if (laps.length === 0 || laps.at(-1).snap !== null) laps.push({ start: frame, snap: null });
        }
        if (ctx.stopTimer === 4 && laps.length > 0 && laps.at(-1).snap === null) laps.at(-1).snap = frame;
        if (ctx.brakeSparks.particles.some(particle => particle.life > 0)) {
          liveSparkFrames++;
          assert.ok(laps.some(lap => frame >= lap.start && frame <= (lap.snap ?? frame) + SPARK_MAX_FRAMES), `live sparks at frame ${frame}`);
        }
      }
    });
    assert.equal(laps.length, 2, JSON.stringify(laps));
    assert.ok(liveSparkFrames > 0);
    assertPuffBehaviour(puffs, { expectedDwellGaps: 16 }); // two dwells, eight 0.55/1.2 s gaps each
  });
});
