// Clone vs original station: placement scalars, pads, exclusions, scene signatures and child order,
// sign recordings, clock angles, and the pads baked into the terrain.
import '../../src/core/disable-three-color-management.js';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import { buildOriginalWorld } from '../helpers/original-world-stepper.mjs';
import { sceneGraphSignature, compareSceneSignatures } from '../helpers/scene-graph-signature.mjs';
import { updateStationClock } from '../../src/world/station/station-wall-clock.js';

const ORIGINAL_FILES = ['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js', 'StationWalker.js',
  'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js'];
const skip = originalSkipReason(ORIGINAL_FILES);
const CLOCK_TIMES = [0, 0.05, 15, 61.3];
const TERRAIN_ONLY = { stopAfter: 'buildTerrain', skip: ['buildVillage', 'buildWindmill'] };

const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const assertBytes = (actual, expected, label) => assert.ok(bytes(actual).equals(bytes(expected)), `${label} bytes differ`);
const figuresOf = world => new Set((world.stationTravelers ?? []).map(traveler => traveler.figure));
const stationGroupOf = world => world.stationClockMinuteHand.parent.parent;
const signOf = world => stationGroupOf(world).children.find(child => child.material?.type === 'MeshBasicMaterial');

// Ordered (type, material type, colour, position) per child: insertion order drives merge and draw order.
function childSequence(parent, excluded = new Set()) {
  return parent.children.filter(child => !excluded.has(child)).map(child => [
    child.type, child.material?.type ?? null, child.material?.uniforms?.uColor?.value.getHexString() ?? null, ...child.position.toArray(),
  ]);
}

function assertSameSignature(originalRoot, cloneRoot, label, exclude = new Set()) {
  const comparison = compareSceneSignatures(sceneGraphSignature(originalRoot, { exclude }), sceneGraphSignature(cloneRoot));
  assert.ok(comparison.equal, `${label}: ${comparison.report}`);
}

describe('station parity with the original', { skip, timeout: 600_000 }, () => {
  const worlds = {};
  before(async () => {
    worlds.original = (await buildOriginalWorld({ stopAfter: 'buildStation' })).world;
    worlds.clone = createCloneWorld({ stopAfter: 'buildStation' });
  });

  test('(c) stop distance, station frame, group transform and free-camera start', () => {
    const { original, clone } = worlds;
    assert.equal(clone.stationS, original.stationS);
    assert.equal(Math.round(((original.stationS - 4.5) / original.length) * original.N), 1008);
    assert.equal(clone.stationSite.frameIndex, 1008);
    const [a, b] = [stationGroupOf(original), stationGroupOf(clone)];
    for (const field of ['position', 'quaternion', 'rotation']) assert.deepStrictEqual(b[field].toArray(), a[field].toArray(), field);
    for (const field of ['position', 'target']) {
      assert.deepStrictEqual(clone.freeCameraStart[field].toArray(), original.freeCameraStart[field].toArray(), `freeCameraStart.${field}`);
    }
  });

  test('(c) heights after both pads, foundations and exclusions', () => {
    const { original, clone } = worlds;
    assertBytes(clone.heights, original.heights, 'heights');
    assert.deepStrictEqual(clone.buildingFoundations, original.buildingFoundations);
    assert.deepStrictEqual(clone.exclusions, original.exclusions);
    assert.equal(clone.exclusions.length, 27);
  });

  test('(c) world signature without the original figures, glows in order, child sequences', () => {
    const { original, clone } = worlds;
    const figures = figuresOf(original);
    assertSameSignature(original.group, clone.group, 'world.group', figures);
    const ordered = compareSceneSignatures(sceneGraphSignature(original.group, { exclude: figures }), sceneGraphSignature(clone.group), { ordered: true });
    assert.ok(ordered.equal, ordered.report);
    assert.equal(clone.noShadow.length, original.noShadow.length);
    original.noShadow.forEach((glows, index) => assertSameSignature(glows, clone.noShadow[index], `noShadow[${index}]`));
    assert.deepStrictEqual(childSequence(stationGroupOf(clone)), childSequence(stationGroupOf(original), figures));
    const buildingOf = world => world.stationClockMinuteHand.parent;
    assert.deepStrictEqual(childSequence(buildingOf(clone)), childSequence(buildingOf(original)));
  });

  test('(c) sign recordings and texture settings', () => {
    const [a, b] = [signOf(worlds.original), signOf(worlds.clone)];
    assert.ok(a.material.map.image.operations.length > 0);
    assert.deepStrictEqual(b.material.map.image.operations, a.material.map.image.operations);
    for (const field of ['colorSpace', 'anisotropy']) assert.equal(b.material.map[field], a.material.map[field], field);
    assert.deepStrictEqual(b.rotation.toArray(), a.rotation.toArray());
  });

  test('(c) clock hands match the original world update for every sim time', () => {
    const { original, clone } = worlds;
    const motion = { distance: 0, speed: 0, length: 25.65 };
    for (const t of CLOCK_TIMES) {
      // The partial original world has no track sheep yet: its update throws right after the clock.
      try {
        original.update(t, 1 / 60, new THREE.Vector3(), motion);
      } catch (error) {
        assert.ok(error instanceof TypeError, `unexpected ${error}`);
      }
      updateStationClock(clone, t);
      for (const hand of ['stationClockMinuteHand', 'stationClockHourHand']) {
        assert.ok(Object.is(clone[hand].rotation.x, original[hand].rotation.x), `${hand} at t=${t}`);
      }
    }
  });

  test('(d) both pads are baked into the terrain and the water height texture', async () => {
    const original = (await buildOriginalWorld(TERRAIN_ONLY)).world;
    const clone = createCloneWorld(TERRAIN_ONLY);
    assertBytes(clone.heights, original.heights, 'baked heights');
    assertBytes(clone.heightTex.image.data, original.heightTex.image.data, 'heightTex');
    assertSameSignature(original.group, clone.group, 'terrain world', figuresOf(original));
  });
});
