// Station travelers and bird flocks. Block A (clone only, fixtures): first-build draw counts, perches,
// flock init, the platform lane floats, walker events and final state, IK bone lengths, no per-frame
// draws and the [BIRDS] timeline. Block B (vs the original): perches, world and bird signatures, the
// constructed walker and rig trees, then the oracle and clone drivers in lockstep at dt 1/60 and 0.1.
import '../../src/core/disable-three-color-management.js';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { firstCloneBuild, firstOriginalBuild, rigTree, flockRecords } from '../helpers/station-travelers-and-birds-first-build.mjs';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { sceneGraphSignature, compareSceneSignatures } from '../helpers/scene-graph-signature.mjs';
import { createOriginalSimulation, stepOriginalFrame, runWithSeededMathRandom, withCapturedConsole, ORACLE_MATH_RANDOM_SEED } from '../helpers/original-simulation-oracle.mjs';
import { createCloneSimulation, stepCloneFrame, snapshotLifeState } from '../helpers/clone-simulation-driver.mjs';
import { runSheepLockstep } from '../helpers/sheep-flock-parity-lockstep.mjs';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { WALKER_LEG_SEGMENT_LENGTH } from '../../src/life/station/station-walker-leg-ik-and-body-animation.js';

const FIXTURE = JSON.parse(readFileSync(new URL('./fixtures/station-travelers-and-birds-expected.json', import.meta.url), 'utf8'));
const skip = originalSkipReason(['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js',
  'StationWalker.js', 'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js']);
const DT = 1 / 60;
const LIFE_LOGS = ['[BIRDS]', '[STATION]', '[VILLAGE]'];
const near = (actual, expected, tolerance, label) => assert.ok(Math.abs(actual - expected) <= tolerance, `${label}: ${actual} vs ${expected}`);
const stepDt = index => (index === 0 ? 0.05 : DT);

// Shared first builds: before anything else in this process touches a World or an npr cache.
const sides = { clone: firstCloneBuild(), original: null };
before(async () => {
  if (!skip) sides.original = await firstOriginalBuild();
});

describe('travelers and birds, clone against the fixtures', { timeout: 600_000 }, () => {
  test('first-build draw counts', () => {
    assert.deepEqual(sides.clone.counts, FIXTURE.draws);
  });

  test('perches: ids, positions, outward and full-precision track distances', () => {
    const perches = sides.clone.world.birdPerches;
    assert.deepEqual(perches.map(perch => perch.id), FIXTURE.perchIds);
    perches.forEach((perch, index) => {
      const expected = FIXTURE.perches[index];
      assert.equal(perch.trackDistance, expected.trackDistance, perch.id);
      assert.equal(perch.positions.length, expected.positions.length);
      perch.positions.forEach((position, k) => position.toArray().forEach((value, axis) => near(value, expected.positions[k][axis], 5e-4, `${perch.id}[${k}]`)));
      perch.outward.toArray().forEach((value, axis) => near(value, expected.outward[axis], 5e-4, `${perch.id} outward`));
    });
  });

  test('flock init: flight heights exact, centres, sizes, phases, headings and delays', () => {
    const { flocks } = sides.clone.birds;
    assert.equal(flocks.reduce((sum, flock) => sum + flock.birds.length, 0), 18);
    flocks.forEach((flock, index) => {
      const expected = FIXTURE.flocks[index];
      assert.deepEqual([flock.id, flock.mode, flock.changedAt, flock.flightHeight], [expected.id, 'perched', 0, expected.flightHeight]);
      flock.center.toArray().forEach((value, axis) => near(value, expected.center[axis], 5e-4, `${flock.id} centre`));
      flock.birds.forEach((bird, k) => {
        [bird.figure.scale.x, bird.phase, bird.heading].forEach((value, n) => near(value, expected.birds[k][n], 5e-5, `${flock.id}[${k}]`));
        assert.equal(bird.delay, k * 0.09);
        assert.equal(bird.home, sides.clone.world.birdPerches[index].positions[k], 'home is the perch vector itself');
      });
    });
  });

  test('platform lane floats: walker path and leg targets, grandmother', () => {
    const { world } = sides.clone;
    const walker = world.stationWalker;
    const xs = [walker.figure.position, walker.start, walker.end, ...walker.stops, ...walker.legs.map(leg => leg.target)].map(point => point.x);
    assert.ok(xs.every(x => x === FIXTURE.walkerLaneX), xs.join(', '));
    assert.equal(FIXTURE.walkerLaneX, 0.20999999999999985);
    assert.equal(world.stationTravelers[1].figure.position.x, FIXTURE.grandmotherX);
    assert.deepEqual(world.stationTravelers.map(({ baseScale, phase }) => [baseScale, phase]), [[0.8, 0], [0.7, 1.7]]);
    assert.equal(world.stationTravelers[0].figure, walker.figure);
  });

  test('rig structure after the merges', () => {
    const { rig, figure } = sides.clone.world.stationWalker;
    const colours = parent => parent.children.filter(child => child.isMesh).map(mesh => mesh.material.uniforms.uColor.value.getHexString());
    assert.deepEqual(figure.children.map(child => child.type), [...Array(6).fill('Mesh'), 'Group']);
    assert.deepEqual(rig.body.children.slice(0, 3), [rig.arms[0].arm, rig.arms[1].arm, rig.head]);
    assert.deepEqual(colours(rig.body), ['514a49', '526876', 'd2bc87']);
    assert.deepEqual([rig.head.children[0], colours(rig.head)], [rig.hat, ['d2a27d', 'ddd8ca', '513b31']]);
    assert.deepEqual(colours(rig.hat), ['675443', 'a66749', 'd2bc87']);
    assert.deepEqual([rig.arms[0].arm.children[0], colours(rig.arms[0].arm), colours(rig.arms[1].arm)], [rig.cane, ['526876', 'd2a27d', '514a49'], ['526876', 'd2a27d', '514a49']]);
    assert.deepEqual(rig.cane.position.toArray(), [-0.09000000000000002, -0.5800000000000001, 0.055]);
    const grandmother = sides.clone.world.stationTravelers[1];
    assert.deepEqual([grandmother.figure.children[0], colours(grandmother.figure)], [grandmother.head, ['513b31', 'b67a67', 'd2a27d', '77566f', 'd2bc87', '7b5038', '543c30']]);
    assert.deepEqual(colours(grandmother.head), ['d2a27d', 'ddd8ca', '513b31', 'd2bc87', 'b67a67']);
  });

  test('walker-only stepping: events at their frames, final state, bone lengths', () => {
    // A fresh world: the shared build's walker stays at its constructed state for block B.
    const walker = createCloneWorld().stationWalker;
    const events = [];
    for (let frame = 0; frame <= FIXTURE.walkerSteps.frames; frame++) {
      const event = walker.update(stepDt(frame));
      if (event !== undefined) events.push([frame, event]);
      assertBoneLengths(walker, frame);
    }
    assert.deepEqual(events, FIXTURE.walkerEvents);
    const final = FIXTURE.walkerFinal;
    assert.deepEqual([walker.figure.position.toArray(), walker.figure.rotation.y, walker.stopIndex, walker.wait, walker.rig.caneShaft.scale.y],
      [final.position, final.rotationY, final.stopIndex, final.wait, final.caneShaftScaleY]);
  });

  test('clone driver: no per-frame draws from the birds, the [BIRDS] timeline to 20.5 s, flock modes at 180.05 s', async () => {
    const ctx = await createCloneSimulation();
    const update = ctx.birds.update;
    let birdDraws = 0;
    ctx.birds.update = (...args) => runWithSeededMathRandom(() => { birdDraws++; return 0.5; }, () => update(...args));
    const stream = mulberry32(ORACLE_MATH_RANDOM_SEED);
    const events = [];
    withCapturedConsole(() => {
      for (let frame = 0; frame < FIXTURE.flockModesAt180.frames; frame++) {
        const { logs } = withCapturedConsole(() => runWithSeededMathRandom(stream, () => stepCloneFrame(ctx, stepDt(frame))));
        if (frame >= FIXTURE.birdEventFrames) continue;
        for (const line of logs) if (line.startsWith('[BIRDS]')) events.push([ctx.time.toFixed(3), line]);
      }
    });
    assert.equal(birdDraws, 0);
    assert.deepEqual(events, FIXTURE.birdEvents);
    near(ctx.time, 180.05, 1e-9, 'sim time');
    assert.deepEqual(ctx.birds.flocks.map(({ id, mode }) => [id, mode]), FIXTURE.flockModesAt180.modes);
  });
});


// Both IK bones keep the segment length whenever the hip-to-ankle reach allows a bent knee (d/2 <= 0.36).
// Hip and ankle come back out of the posed meshes (bones sit at segment midpoints), so a frame that
// skipped the pose but moved the body is still measured against the reach the IK actually used.
function assertBoneLengths(walker, frame) {
  for (const leg of walker.legs) {
    const ankle = leg.shoe.position.clone().setZ(leg.shoe.position.z - 0.045);
    const knee = leg.shin.position.clone().multiplyScalar(2).sub(ankle);
    const hip = leg.thigh.position.clone().multiplyScalar(2).sub(knee);
    if (ankle.distanceTo(hip) / 2 > WALKER_LEG_SEGMENT_LENGTH) continue;
    for (const bone of [leg.thigh, leg.shin]) near(bone.scale.y, WALKER_LEG_SEGMENT_LENGTH, 1e-12, `bone at frame ${frame}`);
  }
}

describe('travelers and birds against the original', { skip, timeout: 600_000 }, () => {
  test('perches, world signature, constructed walker and rig trees', () => {
    const [original, clone] = [sides.original, sides.clone];
    assert.deepStrictEqual(clone.world.birdPerches, original.world.birdPerches);
    const signatures = compareSceneSignatures(sceneGraphSignature(original.world.group), sceneGraphSignature(clone.world.group));
    assert.ok(signatures.equal, signatures.report);
    assert.deepStrictEqual(clone.walker, original.walker);
    for (const index of [0, 1]) {
      assert.deepStrictEqual(rigTree(clone.world.stationTravelers[index].figure), rigTree(original.world.stationTravelers[index].figure));
    }
  });

  test('first-build draw counts equal', () => {
    assert.deepEqual(sides.original.counts, FIXTURE.draws);
    assert.deepEqual(sides.clone.counts, sides.original.counts);
  });

  test('bird init: flock and bird records and the flock group signature', () => {
    assert.deepStrictEqual(flockRecords(sides.clone.birds), flockRecords(sides.original.birds));
    const signatures = compareSceneSignatures(sceneGraphSignature(sides.original.birds.group), sceneGraphSignature(sides.clone.birds.group), { ordered: true });
    assert.ok(signatures.equal, signatures.report);
  });

  for (const [label, frames, dt, timeScale] of [['180 s at dt 1/60', 10801, DT, 1], ['60 s at sim dt 0.1', 600, 0.05, 2]]) {
    test(`oracle lockstep, ${label}: life state every frame and the log lines`, async () => {
      const [original, clone] = [await createOriginalSimulation(), await createCloneSimulation()];
      for (const ctx of [original, clone]) ctx.timeScale = timeScale;
      const frameDt = frame => (frame === 1 ? 0.05 / timeScale : dt);
      const { mismatch, logs } = runSheepLockstep({
        frames, logPrefixes: LIFE_LOGS,
        stepOriginal: frame => stepOriginalFrame(original, frameDt(frame)),
        stepClone: frame => stepCloneFrame(clone, frameDt(frame)),
        compare: frame => {
          const [expected, actual] = [snapshotLifeState(original), snapshotLifeState(clone)];
          try { assert.deepStrictEqual(actual, expected); } catch (error) { return { error: `frame ${frame}: ${error.message.slice(0, 1500)}` }; }
          return null;
        },
      });
      assert.equal(mismatch, null, mismatch?.error);
      assert.deepStrictEqual(logs.clone, logs.original);
      assert.ok(logs.clone.some(([, line]) => line.startsWith('[STATION]')) && logs.clone.some(([, line]) => line.startsWith('[BIRDS]')));
    });
  }
});
