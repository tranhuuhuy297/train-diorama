// Village residents, forest and riverside rocks: a clone-only build and log-timing check that always
// runs, then clone vs original layout, canopy grid, stream position, figure signatures, 60 s of resident
// animation at fixed and random steps, and the whole world.group after the rock step.
import '../../src/core/disable-three-color-management.js';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import { buildOriginalWorld } from '../helpers/original-world-stepper.mjs';
import { sceneGraphSignature, compareSceneSignatures } from '../helpers/scene-graph-signature.mjs';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { updateWorld } from '../../src/world/world-per-frame-update.js';
import { buildTrees } from '../../src/world/trees/tree-instanced-layers.js';
import { npr } from '../../src/materials/npr-cel-material-factory.js';

const ORIGINAL_FILES = ['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js', 'StationWalker.js',
  'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js'];
const skip = originalSkipReason(ORIGINAL_FILES);
const LOG_FRAMES = [241, 720, 1080, 1561, 1921, 2401, 2761, 3241];
const QUERY_RADII = [0, 1, 2, 5, 14];

const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const assertBytes = (actual, expected, label) => assert.ok(bytes(actual).equals(bytes(expected)), `${label} bytes differ`);
const rocksOf = world => world.group.children[world.group.children.indexOf(world.treeLayers[3]) + 1];
const countMeshes = roots => roots.reduce((sum, root) => { root.traverse(node => { sum += node.isMesh ? 1 : 0; }); return sum; }, 0);
const homesOf = world => world.villageResidents.residents.map(resident => resident.home);

// Every animated value of both residents and the dog, flattened in a fixed order.
function residentPose({ residents, dog, dogHead, dogTail }) {
  const values = [];
  for (const { figure, body, head, legs, arms } of residents) {
    values.push(...figure.position.toArray(), figure.rotation.x, figure.rotation.y, figure.rotation.z, ...figure.scale.toArray());
    values.push(body.position.y, body.rotation.z, body.scale.y, head.rotation.y);
    for (const limb of [...legs, ...arms]) values.push(limb.rotation.x);
  }
  values.push(...dog.position.toArray(), dog.rotation.y, dogHead.rotation.y, dogHead.rotation.z, dogTail.rotation.y);
  return values;
}

function assertSameSignature(originalRoot, cloneRoot, label, options = {}) {
  const { exclude = new Set(), ordered = false, cloneSignature = sceneGraphSignature(cloneRoot) } = options;
  const comparison = compareSceneSignatures(sceneGraphSignature(originalRoot, { exclude }), cloneSignature, { ordered });
  assert.ok(comparison.equal, `${label}: ${comparison.report}`);
}

// One full clone build per file; its group signature is taken before any test animates the world.
let fullClone;
function fullCloneBuild() {
  if (!fullClone) {
    const world = createCloneWorld();
    fullClone = { world, groupSignature: sceneGraphSignature(world.group) };
  }
  return fullClone;
}

describe('residents, trees and rocks on the clone', { timeout: 300_000 }, () => {
  test('full build: 33 resident meshes, four tree layers, rocks and the two yards', () => {
    const { world } = fullCloneBuild();
    assert.equal(countMeshes(homesOf(world)), 33);
    assert.equal(world.treeLayers.length, 4);
    assert.ok(world.treeLayers.every(layer => layer.isInstancedMesh && layer.count > 0 && layer.parent === world.group));
    assert.ok(rocksOf(world).count <= 80);
    // The two yards, then the sheep flock's three trackside clearings.
    assert.deepEqual(world.exclusions.slice(-5).map(circle => circle.r), [2.2, 2.2, 1.2, 1.2, 1.2]);
    assert.ok(world.treeCanopyHeightAt(0, 0, 70) > 10);
    const logged = [];
    const realLog = console.log;
    let frame = 0;
    console.log = (...args) => (String(args[0]).startsWith('[VILLAGE]') ? logged.push([frame, args[0]]) : realLog(...args));
    try {
      let t = 0;
      for (frame = 1; frame <= 3600; frame++) {
        t += 1 / 60;
        updateWorld(world, t, 1 / 60, new THREE.Vector3(), { distance: 0, speed: 0, length: 25.65 });
      }
      assert.equal(t, 59.999999999997875);
    } finally {
      console.log = realLog;
    }
    assert.deepEqual(logged.map(([at]) => at), LOG_FRAMES);
    logged.forEach(([, line], index) => assert.equal(line, index % 2 === 0 ? '[VILLAGE] Woman starts walking' : '[VILLAGE] Woman stops in yard'));
  });

  test('tree layers fill the array created in World init', () => {
    const world = createCloneWorld({ stopAfter: 'createVillageResidents' });
    const layers = world.treeLayers;
    assert.equal(layers.length, 0);
    buildTrees(world);
    assert.equal(world.treeLayers, layers);
    assert.equal(layers.length, 4);
  });
});

describe('residents, trees and rocks parity with the original', { skip, timeout: 600_000 }, () => {
  const worlds = {};
  before(async () => {
    worlds.original = (await buildOriginalWorld({ stopAfter: 'buildTrees' })).world;
    worlds.clone = createCloneWorld({ stopAfter: 'buildTrees' });
  });

  test('(A) yards, tree layers, canopy grid, stream position and resident figures', t => {
    const { original, clone } = worlds;
    assert.deepStrictEqual(clone.exclusions, original.exclusions);
    original.treeLayers.forEach((expected, index) => {
      const actual = clone.treeLayers[index];
      assert.equal(actual.count, expected.count, `layer ${index} count`);
      assertBytes(actual.instanceMatrix.array, expected.instanceMatrix.array, `layer ${index} matrices`);
      assertBytes(actual.instanceColor.array, expected.instanceColor.array, `layer ${index} colours`);
      for (const name of ['position', 'normal', 'color']) assertBytes(actual.geometry.attributes[name].array, expected.geometry.attributes[name].array, `layer ${index} ${name}`);
      assert.deepStrictEqual(actual.geometry.boundingBox.min.toArray().concat(actual.geometry.boundingBox.max.toArray()),
        expected.geometry.boundingBox.min.toArray().concat(expected.geometry.boundingBox.max.toArray()));
      assert.deepStrictEqual(actual.material.defines, expected.material.defines);
      assert.deepStrictEqual(Object.keys(actual.material.uniforms), Object.keys(expected.material.uniforms));
      assert.equal(Object.hasOwn(actual.material.defines, 'TREE_SWAY'), index < 3);
    });
    assertBytes(clone.treeCanopyHeights, original.treeCanopyHeights, 'treeCanopyHeights');
    const draw = mulberry32(2026);
    for (let k = 0; k < 10000; k++) {
      const [x, z, radius] = [(draw() - 0.5) * 150, (draw() - 0.5) * 150, QUERY_RADII[k % 5]];
      assert.equal(clone.treeCanopyHeightAt(x, z, radius), original.treeCanopyHeightAt(x, z, radius), `query ${k}`);
    }
    for (let k = 0; k < 3; k++) assert.equal(clone.rand(), original.rand(), `draw ${k} after the trees`);
    homesOf(original).forEach((home, index) => assertSameSignature(home, homesOf(clone)[index], `home ${index}`));
    const facts = world => world.villageResidents.residents.map(({ frontOffset, depth, index }) => [frontOffset, depth, index]);
    assert.deepStrictEqual(facts(clone), facts(original));
    assert.equal(clone.villageResidents.walking, original.villageResidents.walking);
    const accents = layer => {
      const reds = [...layer.instanceColor.array].filter((_, offset) => offset % 3 === 0);
      const autumn = reds.filter(red => red === 2).length;
      const blossom = reds.filter(red => red === Math.fround(2.3)).length;
      return `${layer.count} (autumn ${autumn}, blossom ${blossom})`;
    };
    t.diagnostic(`trees per species: ${clone.treeLayers.map(accents).join(' / ')}`);
  });

  test('(B) 60 s of resident animation at fixed and random steps', () => {
    const residents = [worlds.original.villageResidents, worlds.clone.villageResidents];
    const randomDt = mulberry32(7);
    const runs = [
      { label: 'fixed', nextDt: () => 1 / 60, finished: (frame, t) => frame >= 3600 },
      { label: 'random', nextDt: () => randomDt() * 0.1, finished: (frame, t) => t >= 60 },
    ];
    for (const { label, nextDt, finished } of runs) {
      const events = [[], []];
      let t = 0;
      for (let frame = 0; !finished(frame, t); frame++) {
        const dt = nextDt();
        t += dt;
        residents.forEach((system, side) => events[side].push(system.update(t, dt)));
        const [expected, actual] = residents.map(residentPose);
        const at = actual.findIndex((value, index) => !Object.is(value, expected[index]));
        if (at >= 0) assert.fail(`${label} frame ${frame}: value ${at} ${actual[at]} vs ${expected[at]}`);
      }
      assert.deepStrictEqual(events[1], events[0]);
      assert.ok(events[0].filter(Boolean).length >= 7, `${label} run logged ${events[0].filter(Boolean).length} events`);
    }
  });

  test('(C) rocks, whole world.group and exclusions (full builds on both sides)', async () => {
    const original = (await buildOriginalWorld()).world;
    const { world: clone, groupSignature } = fullCloneBuild();
    const [expected, actual] = [rocksOf(original), rocksOf(clone)];
    assert.equal(actual.count, expected.count);
    assertBytes(actual.instanceMatrix.array, expected.instanceMatrix.array, 'rock matrices (identity tail included)');
    for (const name of ['position', 'normal', 'color']) assertBytes(actual.geometry.attributes[name].array, expected.geometry.attributes[name].array, `rock ${name}`);
    assert.deepStrictEqual(actual.material.defines, expected.material.defines);
    assert.deepStrictEqual([actual.material.uniforms.uStipple.value, actual.material.uniforms.uStippleScale.value, actual.material.vertexColors],
      [expected.material.uniforms.uStipple.value, expected.material.uniforms.uStippleScale.value, expected.material.vertexColors]);
    assert.equal(actual.material, npr({ vertexColors: true, stipple: 0.3, stippleScale: 3 }), 'rock material cache key');
    assert.deepStrictEqual([actual.instanceColor, expected.instanceColor], [null, null]);
    assertSameSignature(original.group, clone.group, 'world.group', { cloneSignature: groupSignature });
    assertSameSignature(original.group, clone.group, 'world.group order', { ordered: true, cloneSignature: groupSignature });
    assert.deepStrictEqual(clone.exclusions, original.exclusions);
  });
});
