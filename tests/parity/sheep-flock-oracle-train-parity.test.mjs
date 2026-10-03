// Sheep flock vs the original with the real train: the original Diorama sim oracle and the clone driver
// stepped in lockstep, comparing every sheep bit for bit on every frame and the [SHEEP] log lines.
// Runs: a day / night / wake schedule, the fastest train, and a doubled time scale (0.1 s sim steps).
import '../../src/core/disable-three-color-management.js';
import { describe, test, after } from 'node:test';
import assert from 'node:assert/strict';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import { createOriginalSimulation, stepOriginalFrame } from '../helpers/original-simulation-oracle.mjs';
import { createCloneSimulation, stepCloneFrame } from '../helpers/clone-simulation-driver.mjs';
import { firstSheepFlockMismatch, runSheepLockstep } from '../helpers/sheep-flock-parity-lockstep.mjs';
import { LIGHTING_UNIFORMS } from '../../src/materials/shared-lighting-uniforms.js';

const skip = originalSkipReason(['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js',
  'StationWalker.js', 'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js']);
const DT = 1 / 60;
const EVENTS = ['[SHEEP] Startles: approaching train', '[SHEEP] Jumps off track', '[SHEEP] Returns to track: train clear'];

// Night amount over sim time: day for 180 s, a 3 s ramp to full night held until 240 s, then day again.
const nightAt = t => (t < 180 || t >= 240 ? 0 : Math.min(1, (t - 180) / 3));

async function runPair({ frames, dt = DT, settings = {}, night = null }) {
  const original = await createOriginalSimulation();
  const clone = await createCloneSimulation();
  Object.assign(original, settings);
  Object.assign(clone, settings);
  let scheduled = 0;
  let deepestSleep = 0;
  const overwritten = [];
  const { mismatch, logs } = runSheepLockstep({
    frames,
    // Both drivers copy uNight into world.nightAmount before the world update.
    beforeFrame: frame => {
      if (night === null) return;
      scheduled = night((frame - 1) * dt);
      original.lightingUniforms.uNight.value = scheduled;
      clone.lightingUniforms.uNight.value = scheduled;
    },
    stepOriginal: () => stepOriginalFrame(original, dt),
    stepClone: () => stepCloneFrame(clone, dt),
    compare: frame => {
      if (night !== null && !(original.world.nightAmount === scheduled && clone.world.nightAmount === scheduled)) overwritten.push(frame);
      deepestSleep = Math.max(deepestSleep, clone.world.sheepStates[0].sleep);
      return firstSheepFlockMismatch(original.world, clone.world);
    },
  });
  return { mismatch, logs, overwritten, deepestSleep };
}

function assertLockstep({ mismatch, logs }) {
  assert.equal(mismatch, null, mismatch && `frame ${mismatch.frame}: sheep ${mismatch.sheepIndex} ${mismatch.field} ${mismatch.clone} vs ${mismatch.original}`);
  assert.deepStrictEqual(logs.clone, logs.original);
}

describe('sheep flock parity with the original train', { skip, timeout: 900_000 }, () => {
  // The clone's lighting uniforms are a process-wide singleton: leave it at day.
  after(() => { LIGHTING_UNIFORMS.uNight.value = 0; });

  test('run 1: 180 s day, night ramp and hold to 240 s, 20 s wake', async t => {
    const run = await runPair({ frames: 15600, night: nightAt });
    assertLockstep(run);
    assert.deepEqual(run.overwritten, [], 'a driver changed world.nightAmount after the schedule');
    assert.ok(run.deepestSleep > 0.99, `pasture sheep slept only to ${run.deepestSleep}`);
    const lines = run.logs.original.map(([, line]) => line);
    for (const event of EVENTS) assert.ok(lines.some(line => line.startsWith(event)), `no ${event}`);
    for (const id of [1, 2, 3]) assert.ok(lines.includes(`[SHEEP] Jumps off track: sheep ${id}`), `sheep ${id} never jumped`);
    t.diagnostic(`${lines.length} [SHEEP] lines`);
  });

  test('run 2: 90 s with the train at speedMul 2.5', async () => {
    const run = await runPair({ frames: 5400, settings: { speedMul: 2.5 } });
    assertLockstep(run);
    assert.ok(run.logs.original.length > 0);
  });

  test('run 3: 60 s of 0.1 s sim steps (0.05 s frames at time scale 2)', async t => {
    const run = await runPair({ frames: 600, dt: 0.05, settings: { timeScale: 2 } });
    assertLockstep(run);
    // At 0.1 s steps sheep 1 startles and jumps in one step, so only its jump line is logged.
    const lines = run.logs.original.map(([, line]) => line);
    assert.ok(lines.includes('[SHEEP] Jumps off track: sheep 1'));
    assert.ok(!lines.includes('[SHEEP] Startles: approaching train, sheep 1'));
    t.diagnostic(`${lines.length} [SHEEP] lines`);
  });
});
