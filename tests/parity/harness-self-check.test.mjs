// Self-check of the node parity toolchain against the cached original: World builds, partial builds with
// prototype restore, signature stability/sensitivity and seeded simulation-oracle determinism.
import '../../src/core/disable-three-color-management.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { originalSkipReason, ORIGINAL_SOURCE_DIRECTORY } from '../helpers/original-module-loader.mjs';
import { installMinimalDomShim } from '../helpers/minimal-dom-shim.mjs';
import { ORIGINAL_BUILD_STEPS, buildOriginalWorld, loadOriginalWorldClass } from '../helpers/original-world-stepper.mjs';
import { sceneGraphSignature, compareSceneSignatures } from '../helpers/scene-graph-signature.mjs';
import {
  ORACLE_MATH_RANDOM_SEED, createOriginalSimulation, stepOriginalFrame, snapshotSimulation, runWithSeededMathRandom, withCapturedConsole,
} from '../helpers/original-simulation-oracle.mjs';
import { patchTrainSceneSource } from '../../tools/parity/original-site-route-hooks.mjs';

const ORIGINAL_FILES = [
  'Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js', 'StationWalker.js',
  'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js', 'TrainScene.js', 'LoadingScreen.js',
];
// The > 1000 entry floor holds for the full scene (1201) only, not for world.group alone.
const WORLD_GROUP_OBJECTS = 660;
const FULL_SCENE_MIN_OBJECTS = 1000;
const skip = originalSkipReason(ORIGINAL_FILES);
const HEAVY = { skip, timeout: 300_000 };

const built = {};
let prototypeMethods = null;

// Every stepper call must leave World.prototype exactly as it found it.
async function assertPrototypeRestored() {
  const World = await loadOriginalWorldClass();
  prototypeMethods ??= ORIGINAL_BUILD_STEPS.map(name => World.prototype[name]);
  ORIGINAL_BUILD_STEPS.forEach((name, index) => assert.equal(World.prototype[name], prototypeMethods[index], `${name} not restored`));
}

describe('node parity harness self-check', () => {
  test('cached TrainScene.js holds exactly one hook anchor', { skip }, async () => {
    const source = await readFile(`${ORIGINAL_SOURCE_DIRECTORY}TrainScene.js`, 'utf8');
    assert.doesNotThrow(() => patchTrainSceneSource(source));
  });

  test('full original World builds with the DOM shim', HEAVY, async t => {
    await assertPrototypeRestored();
    built.a = await buildOriginalWorld();
    await assertPrototypeRestored();
    const { world, milliseconds } = built.a;
    assert.ok(milliseconds < 60_000, `build took ${milliseconds} ms`);
    assert.equal(world.frames.length, 1201);
    assert.ok(Math.abs(world.length - 276.136) < 0.5);
    const span = world.bridge[1] - world.bridge[0];
    assert.ok(span > 100 && span < 200, `bridge span ${span}`);
    t.diagnostic(`length ${world.length} bridge ${JSON.stringify(world.bridge)} stationS ${world.stationS} build ${milliseconds.toFixed(0)} ms`);
    const signDrawn = installMinimalDomShim().canvases.some(canvas => canvas.operations.some(operation => JSON.stringify(operation) === JSON.stringify(['call', 'fillText', ['Mossbrook', 455, 94]])));
    assert.ok(signDrawn, 'station sign text was not drawn on a shim canvas');
  });

  test('two builds give identical signatures (multiset and ordered)', HEAVY, async t => {
    built.b = await buildOriginalWorld();
    const [a, b] = [sceneGraphSignature(built.a.world.group), sceneGraphSignature(built.b.world.group)];
    t.diagnostic(`world group signature entries ${a.length}`);
    let objectCount = 0;
    built.a.world.group.traverse(() => { objectCount++; });
    assert.equal(a.length, objectCount, 'signature skipped scene objects');
    assert.equal(a.length, WORLD_GROUP_OBJECTS, 'original world group size changed');
    for (const ordered of [false, true]) assert.equal(compareSceneSignatures(a, b, { ordered }).equal, true);
  });

  test('a moved mesh is reported at its path', HEAVY, () => {
    // traverse() and the signature share pre-order DFS, so indices line up.
    const entries = sceneGraphSignature(built.b.world.group);
    const objects = [];
    built.b.world.group.traverse(object => objects.push(object));
    const index = objects.findIndex(object => object.isMesh && !object.isInstancedMesh);
    const [mesh, path] = [objects[index], entries[index].path];
    const originalX = mesh.position.x;
    mesh.position.x = originalX + 0.01;
    mesh.updateMatrix();
    const moved = compareSceneSignatures(sceneGraphSignature(built.a.world.group), sceneGraphSignature(built.b.world.group));
    assert.equal(moved.equal, false);
    assert.equal(moved.firstMismatch.path, path);
    assert.ok(moved.firstMismatch.differingFields.some(({ field }) => field === 'matrixWorld'), moved.report);
    mesh.position.x = originalX;
    mesh.updateMatrix();
    assert.equal(compareSceneSignatures(sceneGraphSignature(built.a.world.group), sceneGraphSignature(built.b.world.group)).equal, true);
  });

  test('stopAfter buildHeightmap captures the graded heightmap only', HEAVY, async () => {
    const { world, stoppedAfter } = await buildOriginalWorld({ stopAfter: 'buildHeightmap' });
    await assertPrototypeRestored();
    assert.equal(stoppedAfter, 'buildHeightmap');
    assert.equal(world.group.children.length, 0);
    assert.deepEqual(world.bridge, built.a.world.bridge);
    assert.ok(world.heights.some(height => height !== 0));
    assert.equal(world.stationS, 0);
  });

  test('stopAfter buildTerrain with station/village/windmill skipped', HEAVY, async () => {
    const { world, stoppedAfter } = await buildOriginalWorld({ stopAfter: 'buildTerrain', skip: ['buildStation', 'buildVillage', 'buildWindmill'] });
    await assertPrototypeRestored();
    assert.equal(stoppedAfter, 'buildTerrain');
    assert.equal(world.stationS, 0);
    assert.equal(world.exclusions.length, 0);
    assert.equal(world.houseSmoke.length, 0);
    assert.equal(world.villageHomes, undefined);
    assert.ok(world.heightTex);
    assert.ok(world.group.children.length > 0);
    assert.equal(world.villageResidents, undefined);
  });

  test('prototype is restored after a throwing call and a full build follows cleanly', HEAVY, async () => {
    await assert.rejects(buildOriginalWorld({ stopAfter: 'buildTrack', skip: ['buildTrack'] }), /both skipped and the stop target/);
    await assertPrototypeRestored();
    await assert.rejects(buildOriginalWorld({ skip: ['nope'] }), /Unknown original build step/);
    await assertPrototypeRestored();
    // A build step failing mid-construction (not the stop sentinel) must still undo the stepper's own patches.
    const World = await loadOriginalWorldClass();
    const realVillage = World.prototype.buildVillage;
    World.prototype.buildVillage = () => { throw new Error('injected build failure'); };
    try {
      await assert.rejects(buildOriginalWorld({ stopAfter: 'buildTerrain', skip: ['buildStation'] }), /injected build failure/);
    } finally {
      World.prototype.buildVillage = realVillage;
    }
    await assertPrototypeRestored();
    const { world } = await buildOriginalWorld();
    await assertPrototypeRestored();
    assert.notEqual(world.stationS, 0);
    assert.ok(world.clouds.length > 0);
  });

  test('seeded oracles step 600 frames identically', HEAVY, async () => {
    const runs = [];
    for (const key of ['a', 'b']) {
      const ctx = await createOriginalSimulation({ world: built[key].world });
      const { logs } = withCapturedConsole(() => runWithSeededMathRandom(ORACLE_MATH_RANDOM_SEED, () => {
        stepOriginalFrame(ctx, 0.05);
        for (let frame = 0; frame < 600; frame++) stepOriginalFrame(ctx, 1 / 60);
      }));
      assert.ok(Math.abs(ctx.time - 10.05) < 1e-6, `time ${ctx.time}`);
      assert.ok(ctx.s > ctx.world.stationS + 1);
      assert.ok(ctx.puffs.some(puff => puff.mesh.visible));
      assert.ok(ctx.nightGlows.length > 0);
      assert.equal(ctx.shadowHiddenObjects[0], ctx.sky);
      runs.push({ snapshot: snapshotSimulation(ctx), signature: sceneGraphSignature(ctx.scene, { geometry: false }), logs });
    }
    const [a, b] = runs;
    assert.ok(a.signature.length > FULL_SCENE_MIN_OBJECTS, `only ${a.signature.length} scene entries`);
    assert.deepEqual(a.snapshot, b.snapshot);
    const dynamic = compareSceneSignatures(a.signature, b.signature);
    assert.equal(dynamic.equal, true, dynamic.report);
    assert.deepEqual(a.logs, b.logs);
  });
});
