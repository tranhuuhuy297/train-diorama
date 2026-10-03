// Sheep flock vs the original: the build after the rock-and-sheep step (stream position, pasture ground
// query, every state and route, the clearing, exclusions, the three instanced layers, the whole world
// group), then 60 s of flock motion against a synthetic train compared bit for bit on every frame.
import '../../src/core/disable-three-color-management.js';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import { buildOriginalWorld } from '../helpers/original-world-stepper.mjs';
import { sceneGraphSignature, compareSceneSignatures } from '../helpers/scene-graph-signature.mjs';
import { firstSheepFlockMismatch, runSheepLockstep } from '../helpers/sheep-flock-parity-lockstep.mjs';
import { findTracksideFlockSite } from '../../src/life/sheep/trackside-sheep-flock-site.js';
import { TRACK_SHEEP_PRESETS } from '../../src/life/sheep/track-sheep-escape-state-machine.js';

const ORIGINAL_FILES = ['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js', 'StationWalker.js',
  'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js'];
const skip = originalSkipReason(ORIGINAL_FILES);
const STOP = { stopAfter: 'buildRocksAndSheep' };
const SENTINEL = 7;
// A pasture sheep this close to a rail-sheep clearing may lose all valid ground (null-height sink).
const STRANDING_RANGE = 2.2;

const xyz = vector => [vector.x, vector.y, vector.z];
const sameBits = (actual, expected, label) => actual.forEach((value, at) => assert.ok(Object.is(value, expected[at]), `${label}[${at}]: ${value} vs ${expected[at]}`));
const layersOf = world => world.group.children.slice(-3);

// Station traveler figures arrive in a later build stage; everything else must match.
function assertSameSignature(originalRoot, cloneRoot, label, { ordered = false, exclude = new Set() } = {}) {
  const comparison = compareSceneSignatures(sceneGraphSignature(originalRoot, { exclude }), sceneGraphSignature(cloneRoot), { ordered });
  assert.ok(comparison.equal, `${label}: ${comparison.report}`);
}

// Pasture sheep (index) within reach of any of the three clearings.
function strandingCandidates(world) {
  const clearings = world.exclusions.slice(-3);
  return world.sheepStates.slice(0, -3).flatMap((sheep, index) => (
    clearings.some(spot => Math.hypot(spot.x - sheep.x, spot.z - sheep.z) < STRANDING_RANGE) ? [index] : []));
}

describe('sheep flock build parity with the original', { skip, timeout: 300_000 }, () => {
  const worlds = {};
  before(async () => {
    worlds.original = (await buildOriginalWorld(STOP)).world;
    worlds.clone = createCloneWorld(STOP);
  });

  test('(A1) the random stream continues identically after the step', () => {
    for (let draw = 0; draw < 5; draw++) assert.equal(worlds.clone.rand(), worlds.original.rand(), `draw ${draw}`);
  });

  test('(A2) pasture ground query on a 100 x 100 grid, values and normals', () => {
    const { original, clone } = worlds;
    const coordinate = i => -62 + (i + 0.37) * 1.24;
    let accepted = 0;
    for (let i = 0; i < 100; i++) {
      for (let k = 0; k < 100; k++) {
        const [x, z] = [coordinate(i), coordinate(k)];
        const normals = [new THREE.Vector3(SENTINEL, SENTINEL, SENTINEL), new THREE.Vector3(SENTINEL, SENTINEL, SENTINEL)];
        const expected = original.sheepGroundAt(x, z, normals[0]);
        const actual = clone.sheepGroundAt(x, z, normals[1]);
        assert.ok(Object.is(actual, expected), `height at (${x}, ${z}): ${actual} vs ${expected}`);
        sameBits(xyz(normals[1]), xyz(normals[0]), `normal at (${x}, ${z})`);
        accepted += expected === null ? 0 : 1;
      }
    }
    assert.ok(accepted > 0 && accepted < 10000);
  });

  test('(A3) every sheep state, route and instance matrix', t => {
    const { original, clone } = worlds;
    assert.equal(firstSheepFlockMismatch(original, clone), null);
    const count = clone.sheepStates.length;
    assert.deepEqual(clone.trackSheep.map(sheep => sheep.route.id), original.trackSheep.map(sheep => sheep.route.id));
    clone.trackSheep.forEach((sheep, index) => assert.equal(sheep, clone.sheepStates[count - 3 + index]));
    t.diagnostic(`pasture sheep: ${count - 3} (original ${original.sheepStates.length - 3})`);
  });

  test('(A4) the clearing frame and side, and the three routes', () => {
    const { original, clone } = worlds;
    const first = original.trackSheep[0].route;
    const frameIndex = Math.round(((first.distance - TRACK_SHEEP_PRESETS[0].spacing) / original.length) * original.N);
    const side = Math.sign(first.outward.dot(original.frames[frameIndex].r)) * TRACK_SHEEP_PRESETS[0].side;
    // The search ran before the rail sheep and their clearings existed.
    const before = Object.assign(Object.create(clone), { sheepStates: clone.sheepStates.slice(0, -3), exclusions: clone.exclusions.slice(0, -3) });
    const site = findTracksideFlockSite(before);
    assert.deepEqual([site.frameIndex, site.side], [frameIndex, side]);
    original.trackSheep.forEach(({ route }, index) => {
      const twin = clone.trackSheep[index].route;
      assert.ok(Object.is(twin.distance, route.distance), `route ${index} distance`);
      for (const field of ['center', 'tangent', 'outward']) sameBits(xyz(twin[field]), xyz(route[field]), `route ${index} ${field}`);
      assert.equal(twin.preset, TRACK_SHEEP_PRESETS[index]);
    });
  });

  test('(A5) exclusions end with the three r 1.2 clearings', () => {
    assert.deepStrictEqual(worlds.clone.exclusions, worlds.original.exclusions);
    assert.deepEqual(worlds.clone.exclusions.slice(-3).map(circle => circle.r), [1.2, 1.2, 1.2]);
  });

  test('(A6, A7) the three instanced layers and the whole world group', () => {
    const { original, clone } = worlds;
    assert.notEqual(clone.sheep, null);
    assert.deepEqual(layersOf(clone), [clone.sheep, clone.sheepLegs, clone.sheepEars]);
    layersOf(original).forEach((layer, index) => {
      const twin = layersOf(clone)[index];
      assert.deepEqual([twin.count, twin.instanceMatrix.count, twin.frustumCulled], [layer.count, layer.instanceMatrix.count, false]);
      assertSameSignature(layer, twin, `layer ${index}`);
    });
    assert.deepEqual(clone.sheepLegs.instanceMatrix.count, 108);
    const exclude = new Set(original.stationTravelers.map(traveler => traveler.figure));
    assertSameSignature(original.group, clone.group, 'world.group', { exclude });
    assertSameSignature(original.group, clone.group, 'world.group order', { exclude, ordered: true });
  });

  test('(A8) pasture sheep near a clearing (null-height sink candidates)', t => {
    const candidates = strandingCandidates(worlds.clone);
    assert.deepEqual(candidates, strandingCandidates(worlds.original));
    t.diagnostic(`stranding candidates: [${candidates.join(', ')}]`);
  });
});

describe('sheep flock motion parity with a synthetic train', { skip, timeout: 300_000 }, () => {
  test('(B) 60 s at 1/60 s against a train circling at 7.5 m/s', async () => {
    const original = (await buildOriginalWorld()).world;
    const clone = createCloneWorld();
    const loop = original.length;
    const trainPosition = new THREE.Vector3();
    let t = 0;
    const step = world => () => world.update(t, 1 / 60, trainPosition, { distance: (7.5 * t) % loop, speed: 7.5, length: 25.65 });
    const { mismatch, logs } = runSheepLockstep({
      frames: 3600, stepOriginal: step(original), stepClone: step(clone), beforeFrame: () => { t += 1 / 60; },
      compare: () => firstSheepFlockMismatch(original, clone),
    });
    assert.equal(mismatch, null);
    assert.deepStrictEqual(logs.clone, logs.original);
    assert.ok(logs.original.some(([, line]) => line.startsWith('[SHEEP] Jumps off track')), 'the train reached the flock');
  });
});
