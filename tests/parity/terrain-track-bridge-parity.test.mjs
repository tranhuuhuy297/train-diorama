// Clone vs original World core (track frames, graded heights, pads, terrain/skirt/plinth, heightTex,
// ballast/rails/sleepers, bridge): output bytes, query results, scene signatures, UUID draws, build time.
import '../../src/core/disable-three-color-management.js';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { buildTerrain } from '../../src/world/terrain/terrain-skirt-plinth-and-water-height-texture.js';
import { createBridgeChord } from '../../src/world/bridge/bridge-arch-columns-piers-abutments.js';
import { createCloneWorld, WORLD_CORE_SKIP } from '../helpers/clone-world-factory.mjs';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import { buildOriginalWorld, toOriginalStep } from '../helpers/original-world-stepper.mjs';
import { sceneGraphSignature, compareSceneSignatures } from '../helpers/scene-graph-signature.mjs';

const ORIGINAL_FILES = ['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js', 'StationWalker.js',
  'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js'];
const skip = originalSkipReason(ORIGINAL_FILES);
const ORIGINAL_SKIP = WORLD_CORE_SKIP.map(toOriginalStep);
// BuildingPadSpec rows: centre, target height, footprint, yaw, falloff (pad 4 overlaps pad 3; pad 6 hits the grid edge).
const PAD_FIELDS = ['x', 'z', 'height', 'width', 'depth', 'rotation', 'falloff'];
const PADS = [
  [-51.759, -2.665, 8.58, 3.2, 6, -0.0381, 3], [-52.253, 2.42, 8.58, 2.1, 2.2, -0.0381, 1.3],
  [10, -20, 5.5, 2.4, 2.8, 0.7, 2.8], [12, -18.5, 6, 2.2, 2.4, -0.4, 2.8],
  [24, -10, 12, 3.64, 3.64, 2.1, 3.5], [60, -60, 4, 3, 3, 0.3, 2],
].map(row => Object.fromEntries(PAD_FIELDS.map((field, column) => [field, row[column]])));

const original = stopAfter => buildOriginalWorld({ stopAfter: toOriginalStep(stopAfter), skip: ORIGINAL_SKIP }).then(({ world }) => world);
const clone = stopAfter => createCloneWorld({ stopAfter, skip: WORLD_CORE_SKIP });
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
const assertBytes = (actual, expected, label) => assert.ok(bytes(actual).equals(bytes(expected)), `${label} bytes differ`);
const vectorBits = vectors => new Float64Array(vectors.flatMap(vector => vector.toArray()));
const median = values => [...values].sort((a, b) => a - b)[values.length >> 1];

function assertGeometryBytes(actual, expected, label) {
  assert.deepEqual(Object.keys(actual.attributes), Object.keys(expected.attributes), `${label} attribute order`);
  for (const name of Object.keys(expected.attributes)) assertBytes(actual.attributes[name].array, expected.attributes[name].array, `${label}.${name}`);
  assertBytes(actual.index.array, expected.index.array, `${label}.index`);
}

// Bridge part counts by geometry: columns 0.26 wide, braces 2.3, piers 0.5, abutments 3.4, ribs 49-frame capped sweeps.
function bridgePartCounts(world) {
  const counts = { children: world.group.children.length, sleepers: 0, posts: 0, columns: 0, braces: 0, piers: 0, abutments: 0, ribs: 0 };
  const byWidth = { 0.26: 'columns', 2.3: 'braces', 0.5: 'piers', 3.4: 'abutments' };
  for (const child of world.group.children) {
    const { geometry } = child;
    if (child.isInstancedMesh) counts[geometry.parameters.width === 0.1 ? 'posts' : 'sleepers'] += child.count;
    else if (geometry.type === 'BoxGeometry' && byWidth[geometry.parameters.width]) counts[byWidth[geometry.parameters.width]]++;
    else if (geometry.type === 'BufferGeometry' && geometry.attributes.position.count === 2 * 4 * 49 + 8) counts.ribs++;
  }
  return counts;
}

// Rank of each distinct material.id in child order: npr request order sets the ids, which break opaque sort ties.
function materialRequestRanks(world) {
  const firstSeen = [...new Set(world.group.children.map(child => child.material.id))];
  const ascending = [...firstSeen].sort((a, b) => a - b);
  return firstSeen.map(id => ascending.indexOf(id));
}

async function countDraws(build) {
  const realRandom = Math.random;
  let draws = 0;
  Math.random = () => { draws++; return realRandom(); };
  try {
    await build();
  } finally {
    Math.random = realRandom;
  }
  return draws;
}

describe('terrain, track and bridge parity with the original', { skip, timeout: 600_000 }, () => {
  const worlds = {};
  before(async () => {
    worlds.original = await original('buildTerrain');
    worlds.clone = clone('buildTerrain');
  });

  test('(a) track curve, frames, sample caches and bridge span', () => {
    const [a, b] = [worlds.original, worlds.clone];
    assert.equal(b.length, a.length);
    assert.equal(b.length, 276.13647750761754);
    for (const axis of ['p', 'r', 'u']) assertBytes(vectorBits(b.frames.map(f => f[axis])), vectorBits(a.frames.map(f => f[axis])), `frames.${axis}`);
    assertBytes(b.sx, a.sx, 'sx');
    assertBytes(b.sz, a.sz, 'sz');
    assert.deepEqual(b.bridge, a.bridge);
  });

  test('(b) graded heights and (c) building pads, then terrain over the padded heights', async () => {
    const [a, b] = [await original('buildHeightmap'), clone('buildHeightmap')];
    assertBytes(b.heights, a.heights, 'graded heights');
    for (const [index, pad] of PADS.entries()) {
      a.flattenBuildingGround({ ...pad });
      b.flattenBuildingGround({ ...pad });
      assertBytes(b.heights, a.heights, `heights after pad ${index + 1}`);
      assert.deepEqual(b.buildingFoundations, a.buildingFoundations);
    }
    a.buildTerrain();
    buildTerrain(b);
    const [terrainA, terrainB] = [a.group.children[0], b.group.children[0]];
    for (const name of ['position', 'normal', 'color']) assertBytes(terrainB.geometry.attributes[name].array, terrainA.geometry.attributes[name].array, `padded terrain ${name}`);
    assertBytes(b.heightTex.image.data, a.heightTex.image.data, 'padded heightTex');
  });

  test('(d) terrain surface, skirt and water height texture', () => {
    const [a, b] = [worlds.original.group.children, worlds.clone.group.children];
    assertGeometryBytes(b.at(-4).geometry, a.at(-4).geometry, 'terrain');
    assertGeometryBytes(b.at(-3).geometry, a.at(-3).geometry, 'skirt');
    const [texA, texB] = [worlds.original.heightTex, worlds.clone.heightTex];
    assertBytes(texB.image.data, texA.image.data, 'heightTex');
    const describeTexture = t => [t.image.width, t.image.height, t.format, t.type, t.magFilter, t.minFilter];
    assert.deepEqual(describeTexture(texB), describeTexture(texA));
    assert.equal(texB.image.width, 201);
  });

  test('(e) queries agree on 10,000 seeded samples', () => {
    const [a, b] = [worlds.original, worlds.clone];
    const draw = mulberry32(20260930);
    const samples = Array.from({ length: 10_000 }, () => ({ x: (draw() - 0.5) * 140, z: (draw() - 0.5) * 140, s: (draw() - 0.5) * 1200 }));
    for (const { x, z, s } of samples) {
      assert.deepEqual(b.nearest(x, z), a.nearest(x, z));
      assert.equal(b.heightAt(x, z), a.heightAt(x, z));
      assert.deepEqual(b.pointAtS(s).toArray(), a.pointAtS(s).toArray());
      assert.deepEqual(b.tangentAtS(s).toArray(), a.tangentAtS(s).toArray());
    }
    for (let i = -2; i <= 1202; i++) assert.equal(b.inBridge(i), a.inBridge(i), `inBridge(${i})`);
    const circles = mulberry32(7);
    for (let n = 0; n < 40; n++) {
      const [d1, d2, d3] = [circles(), circles(), circles()];
      const exclusion = { x: (d1 - 0.5) * 120, z: (d2 - 0.5) * 120, r: 0.5 + d3 * 4 };
      a.exclusions.push({ ...exclusion });
      b.exclusions.push({ ...exclusion });
    }
    for (const { x, z } of samples) {
      for (const pad of [0, 0.8, 1, 3]) assert.equal(b.excluded(x, z, pad), a.excluded(x, z, pad));
    }
    a.exclusions.length = 0;
    b.exclusions.length = 0;
  });

  test('(f) scene signatures, part counts and arch chord', () => {
    const [originalSignature, cloneSignature] = [sceneGraphSignature(worlds.original.group), sceneGraphSignature(worlds.clone.group)];
    const comparison = compareSceneSignatures(originalSignature, cloneSignature);
    assert.ok(comparison.equal, comparison.report);
    const childOrder = compareSceneSignatures(originalSignature, cloneSignature, { ordered: true });
    assert.ok(childOrder.equal, childOrder.report);
    assert.deepEqual(materialRequestRanks(worlds.clone), materialRequestRanks(worlds.original));
    assert.deepEqual(materialRequestRanks(worlds.clone), [0, 1, 2, 4, 3, 5, 6, 7, 8, 9]);
    const expected = { children: 53, sleepers: 383, posts: 76, columns: 20, braces: 7, piers: 8, abutments: 2, ribs: 2 };
    assert.deepEqual(bridgePartCounts(worlds.original), expected);
    assert.deepEqual(bridgePartCounts(worlds.clone), expected);
    const [b0, b1] = worlds.original.bridge;
    const chord = createBridgeChord(worlds.clone, worlds.clone.frames.slice(b0, b1 + 1));
    const [abutmentA, abutmentB] = worlds.original.group.children.slice(-6, -4);
    const [P0, P1] = [worlds.original.frames[b0].p, worlds.original.frames[b1].p];
    const close = (actual, wanted) => assert.ok(Math.abs(actual - wanted) < 1e-12, `${actual} vs ${wanted}`);
    close(chord.baseA, abutmentA.position.y + 0.2 - 0.6);
    close(chord.baseB, abutmentB.position.y + 0.2 - 0.6);
    close(chord.apex, (P0.y + P1.y) / 2 - 1.35);
  });

  test('(g) equal Math.random (UUID) draws on warm builds', async () => {
    const originalDraws = await countDraws(() => original('buildTerrain'));
    const cloneDraws = await countDraws(() => clone('buildTerrain'));
    assert.equal(cloneDraws, originalDraws);
    assert.equal(cloneDraws, 444);
  });

  test('(h) clone build is no slower than the original', { skip: process.env.PARITY_SKIP_PERF === '1' && 'PARITY_SKIP_PERF=1' }, async t => {
    const times = { original: [], clone: [] };
    const timed = async build => { const start = performance.now(); await build(); return performance.now() - start; };
    const builders = { original: () => original('buildTerrain'), clone: () => clone('buildTerrain') };
    // Alternating which side goes first keeps GC pauses from one build landing on the other side.
    for (let round = 0; round < 9; round++) {
      for (const side of round % 2 === 0 ? ['original', 'clone'] : ['clone', 'original']) {
        const milliseconds = await timed(builders[side]);
        if (round >= 2) times[side].push(milliseconds);
      }
    }
    t.diagnostic(`median ms original ${median(times.original).toFixed(1)} clone ${median(times.clone).toFixed(1)}`);
    assert.ok(median(times.clone) <= median(times.original));
  });
});
