// Clone vs original village and windmill: draw position in the world stream, house and windmill
// transforms, smoke records, glows, pads, exclusions, shrubs, signatures, and 600 frames of smoke and
// rotor animation against the original World update.
import '../../src/core/disable-three-color-management.js';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import { buildOriginalWorld } from '../helpers/original-world-stepper.mjs';
import { sceneGraphSignature, compareSceneSignatures } from '../helpers/scene-graph-signature.mjs';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { updateChimneySmoke } from '../../src/world/village/village-chimney-smoke.js';
import { updateWindmillRotor } from '../../src/world/windmill/windmill-rotor.js';

const ORIGINAL_FILES = ['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js', 'StationWalker.js',
  'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js'];
const skip = originalSkipReason(ORIGINAL_FILES);
const SMOKE_FIELDS = ['x', 'z', 'top', 'phase', 'driftX', 'driftZ', 'wobble', 'size', 'spin'];
const GLOW_ATTRIBUTES = ['glowCenter', 'glowSize', 'glowNormal', 'glowStrength'];
const FRAME_DTS = [1 / 60, 0.05, 0.1, 0.0125];

const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const assertBytes = (actual, expected, label) => assert.ok(bytes(actual).equals(bytes(expected)), `${label} bytes differ`);
const assertSameBits = (actual, expected, label) => {
  assert.equal(actual.length, expected.length, `${label} length`);
  actual.forEach((value, index) => assert.ok(Object.is(value, expected[index]), `${label}[${index}]: ${value} vs ${expected[index]}`));
};
const housesOf = world => [...new Set(world.houseSmoke.map(puff => puff.mesh.parent))];
const shrubsOf = world => world.group.children[world.group.children.indexOf(housesOf(world).at(-1)) + 1];

// Index of `value` in the world stream (mulberry32(42)), i.e. how many draws came before it.
function drawIndexOf(value) {
  const stream = mulberry32(42);
  for (let index = 0; index < 20000; index++) if (stream() === value) return index;
  return -1;
}

function assertSameSignature(originalRoot, cloneRoot, label, exclude = new Set()) {
  const comparison = compareSceneSignatures(sceneGraphSignature(originalRoot, { exclude }), sceneGraphSignature(cloneRoot));
  assert.ok(comparison.equal, `${label}: ${comparison.report}`);
}

// Child-index chain and types from world.group down to the object.
function pathFrom(root, object) {
  const steps = [];
  for (let node = object; node !== root && node.parent; node = node.parent) steps.unshift(`${node.parent.children.indexOf(node)}:${node.type}`);
  return steps.join('/');
}

describe('village and windmill parity with the original', { skip, timeout: 600_000 }, () => {
  const worlds = {};
  // Original's first draw after the village, taken here so every subtest can run on its own.
  let villageNext, villageDrawIndex;
  before(async () => {
    worlds.villageOriginal = (await buildOriginalWorld({ stopAfter: 'buildVillage' })).world;
    worlds.villageClone = createCloneWorld({ stopAfter: 'buildVillage' });
    villageNext = worlds.villageOriginal.rand();
    villageDrawIndex = drawIndexOf(villageNext);
    worlds.original = (await buildOriginalWorld({ stopAfter: 'buildWindmill' })).world;
    worlds.clone = createCloneWorld({ stopAfter: 'buildWindmill' });
  });

  test('village: stream position, houses, smoke records, glows and homes', t => {
    const { villageOriginal: original, villageClone: clone } = worlds;
    assert.equal(clone.rand(), villageNext);
    const houses = [housesOf(original), housesOf(clone)];
    const count = houses[0].length;
    t.diagnostic(`houses ${count}, world draws after the village ${villageDrawIndex}`);
    assert.equal(houses[1].length, count);
    if (count < 8) assert.equal(villageDrawIndex, 1200 + 64 * count);
    else assert.ok(villageDrawIndex % 2 === 0 && villageDrawIndex <= 1712, `draw index ${villageDrawIndex}`);
    houses[0].forEach((house, index) => {
      for (const field of ['position', 'quaternion']) assertSameBits(houses[1][index][field].toArray(), house[field].toArray(), `house ${index} ${field}`);
      const glows = [house, houses[1][index]].map(root => root.children.find(child => child.material?.name === 'night-light-glow'));
      for (const name of GLOW_ATTRIBUTES) assertSameBits([...glows[1].geometry.attributes[name].array], [...glows[0].geometry.attributes[name].array], `house ${index} ${name}`);
    });
    assert.equal(clone.houseSmoke.length, original.houseSmoke.length);
    original.houseSmoke.forEach((puff, index) => {
      assertSameBits(SMOKE_FIELDS.map(field => clone.houseSmoke[index][field]), SMOKE_FIELDS.map(field => puff[field]), `houseSmoke[${index}]`);
    });
    assert.equal(clone.villageHomes.length, 2);
    clone.villageHomes.forEach((home, index) => {
      assert.equal(home.house, houses[1][index]);
      assertSameBits([home.width, home.depth], [original.villageHomes[index].width, original.villageHomes[index].depth], `villageHomes[${index}]`);
    });
  });

  test('village: pads, exclusions, heights, shrubs, signatures and noShadow order', () => {
    const { villageOriginal: original, villageClone: clone } = worlds;
    assert.deepStrictEqual(clone.exclusions, original.exclusions);
    assert.deepStrictEqual(clone.buildingFoundations, original.buildingFoundations);
    assertBytes(clone.heights, original.heights, 'heights');
    const shrubs = [shrubsOf(original), shrubsOf(clone)];
    assert.ok(shrubs[1].isInstancedMesh);
    assert.equal(shrubs[1].count, shrubs[0].count);
    assertBytes(shrubs[1].instanceMatrix.array, shrubs[0].instanceMatrix.array, 'shrub matrices');
    assertBytes(shrubs[1].instanceColor.array, shrubs[0].instanceColor.array, 'shrub colours');
    const houses = [housesOf(original), housesOf(clone)];
    houses[0].forEach((house, index) => assertSameSignature(house, houses[1][index], `house ${index}`));
    assert.equal(clone.noShadow.length, original.noShadow.length);
    const describeEntry = (world, entry) => `${entry.type} ${pathFrom(world.group, entry)}`;
    assert.deepStrictEqual(clone.noShadow.map(entry => describeEntry(clone, entry)), original.noShadow.map(entry => describeEntry(original, entry)));
  });

  test('windmill: stream advances 600, transform, roof height, pads and signatures', () => {
    const { original, clone } = worlds;
    const next = original.rand();
    assert.equal(clone.rand(), next);
    assert.equal(drawIndexOf(next), villageDrawIndex + 600);
    const windmills = [original.windmillBlades.parent, clone.windmillBlades.parent];
    for (const field of ['position', 'quaternion']) assertSameBits(windmills[1][field].toArray(), windmills[0][field].toArray(), `windmill ${field}`);
    assert.ok(Object.is(clone.windmillRoofHeight, original.windmillRoofHeight));
    assertBytes(clone.heights, original.heights, 'heights');
    assert.deepStrictEqual(clone.exclusions, original.exclusions);
    assert.deepStrictEqual(clone.buildingFoundations, original.buildingFoundations);
    assertSameSignature(windmills[0], windmills[1], 'windmill');
    assertSameSignature(original.group, clone.group, 'world.group');
    const ordered = compareSceneSignatures(sceneGraphSignature(original.group), sceneGraphSignature(clone.group), { ordered: true });
    assert.ok(ordered.equal, ordered.report);
  });

  test('600 frames of smoke and rotor match the original world update', () => {
    const { original, clone } = worlds;
    // The original update on a stand-in that inherits this world but has no sheep, walker, residents, clouds or balloon yet.
    const view = Object.assign(Object.create(original), {
      trackSheep: [], updateSheep() {}, stationWalker: { figure: null, update: () => undefined }, villageResidents: { update: () => null },
      stationTravelers: [], clouds: [], balloon: new THREE.Object3D(), balloonFlame: new THREE.Object3D(),
    });
    const motion = { distance: 0, speed: 0, length: 25.65 };
    let elapsed = 0;
    for (let frame = 0; frame < 600; frame++) {
      const dt = FRAME_DTS[frame % FRAME_DTS.length];
      elapsed += dt;
      original.update.call(view, elapsed, dt, new THREE.Vector3(), motion);
      updateChimneySmoke(clone.houseSmoke, elapsed, dt);
      updateWindmillRotor(clone, dt);
      assert.ok(Object.is(clone.windmillBlades.rotation.z, original.windmillBlades.rotation.z), `rotor at frame ${frame}`);
      original.houseSmoke.forEach(({ mesh }, index) => {
        const twin = clone.houseSmoke[index].mesh;
        const [a, b] = [[...mesh.position.toArray(), ...mesh.scale.toArray(), mesh.rotation.y], [...twin.position.toArray(), ...twin.scale.toArray(), twin.rotation.y]];
        if (!a.every((value, axis) => Object.is(value, b[axis]))) assert.fail(`puff ${index} at frame ${frame}: ${b} vs ${a}`);
      });
    }
  });
});
