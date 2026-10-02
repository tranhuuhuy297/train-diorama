// World core without the original: geometry helpers, build-step registry semantics and golden
// values (scalars plus FNV-1a hashes of the output arrays) of the terrain/track/bridge build.
import '../../src/core/disable-three-color-management.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld, WORLD_CORE_SKIP } from '../helpers/clone-world-factory.mjs';
import { fnv1aHex } from '../helpers/typed-array-fnv1a-hash.mjs';
import { WORLD_BUILD_STEPS } from '../../src/world/world-build-steps.js';
import { createBridgeChord } from '../../src/world/bridge/bridge-arch-columns-piers-abutments.js';
import { extrude } from '../../src/geometry/extrude-profile-along-frames.js';
import { box, colorize, tintGeometry, jitter } from '../../src/geometry/procedural-geometry-helpers.js';
import { addWallVent, addRoofVent } from '../../src/geometry/building-wall-and-roof-vents.js';

const CORE_STEPS = ['buildTrackFrames', 'findBridge', 'buildHeightmap', 'buildTrack', 'buildBridge', 'buildTerrain'];
const FIRST_RAND_OF_SEED_42 = 0.6011037519201636;

function countMathRandomDraws(run) {
  const realRandom = Math.random;
  let draws = 0;
  Math.random = () => { draws++; return realRandom(); };
  try {
    run();
  } finally {
    Math.random = realRandom;
  }
  return draws;
}

const constantColor = attribute => new Set(Array.from(attribute.array, value => value.toFixed(6))).size <= 3;

describe('build-step registry', () => {
  test('core steps are registered once each, in order', () => {
    const names = WORLD_BUILD_STEPS.map(step => step.name);
    assert.equal(new Set(names).size, names.length);
    const positions = CORE_STEPS.map(name => names.indexOf(name));
    assert.ok(positions.every(position => position >= 0), `missing core step in ${names}`);
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
  });
  test('stopAfter findBridge leaves heights flat and the group empty', () => {
    const world = createCloneWorld({ stopAfter: 'findBridge' });
    assert.deepEqual(world.bridge, [30, 178]);
    assert.ok(world.heights.every(height => height === 0));
    assert.equal(world.group.children.length, 0);
  });
  test('a skipped stop target still stops; unknown skips are ignored', () => {
    assert.equal(createCloneWorld({ skip: ['buildTrack'], stopAfter: 'buildTrack' }).group.children.length, 0);
    assert.equal(createCloneWorld({ skip: ['noSuchStep'], stopAfter: 'buildTrack' }).group.children.length, 4);
  });
  test('an unknown stopAfter throws', () => {
    assert.throws(() => createCloneWorld({ stopAfter: 'noSuchStep' }), { message: 'Unknown world build step: noSuchStep' });
  });
  test('skipping the heightmap builds the nearest grid lazily', () => {
    // Flat ground has no buildable house sites, so the village (and windmill) are skipped too.
    const world = createCloneWorld({ skip: ['buildHeightmap', 'buildVillage', 'buildWindmill'], stopAfter: 'buildTerrain' });
    assert.equal(world.trackNearestGrid.index.length, 201 * 201);
    assert.ok(world.heightTex.isDataTexture);
  });
});

describe('geometry helpers', () => {
  const straightFrames = [0, 1, 2].map(z => ({ p: new THREE.Vector3(0, 0, z), r: new THREE.Vector3(-1, 0, 0), u: new THREE.Vector3(0, 1, 0) }));
  const square = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
  test('extrude sizes, placement and outward bottom normals', () => {
    const walls = extrude(straightFrames, square);
    assert.equal(walls.attributes.position.count, 24);
    assert.equal(walls.index.count, 48);
    assert.deepEqual(Object.keys(walls.attributes), ['position', 'normal']);
    assert.deepEqual([walls.attributes.position.getX(0), walls.attributes.position.getY(0)], [0.5, -0.5]);
    for (let vertex = 0; vertex < 6; vertex++) assert.equal(walls.attributes.normal.getY(vertex), -1);
    const capped = extrude(straightFrames, square, true);
    assert.equal(capped.attributes.position.count, 32);
    assert.equal(capped.index.count, 60);
  });
  test('colorize expands indexed input and mutates non-indexed input', () => {
    const source = new THREE.BoxGeometry(1, 2, 3);
    const flat = colorize(source, '#336699');
    assert.notEqual(flat, source);
    assert.equal(flat.attributes.position.count, 36);
    assert.equal(flat.hasAttribute('uv'), false);
    assert.ok(constantColor(flat.attributes.color));
    assert.equal(colorize(flat, '#ffffff'), flat);
  });
  test('colorize recomputes faceted normals only when flat', () => {
    const source = new THREE.SphereGeometry(1, 8, 6);
    const [faceted, smooth] = [colorize(source, '#336699'), colorize(source, '#336699', false)];
    const normalAt = (attribute, vertex) => new THREE.Vector3().fromBufferAttribute(attribute, vertex);
    assert.equal(faceted.attributes.normal.count, source.index.count);
    for (let corner = 0; corner < source.index.count; corner++) {
      const sourceNormal = normalAt(source.attributes.normal, source.index.getX(corner));
      const facetNormal = normalAt(faceted.attributes.normal, corner);
      assert.ok(facetNormal.equals(normalAt(faceted.attributes.normal, corner - (corner % 3))), `triangle of corner ${corner} is flat`);
      assert.ok(facetNormal.distanceTo(sourceNormal) > 1e-3, `corner ${corner} normal recomputed`);
      assert.ok(normalAt(smooth.attributes.normal, corner).equals(sourceNormal), `corner ${corner} normal kept`);
    }
  });
  test('tintGeometry disposes the indexed source and keeps uv and normals', () => {
    const source = new THREE.BoxGeometry(1, 1, 1);
    let disposed = false;
    source.addEventListener('dispose', () => { disposed = true; });
    const tinted = tintGeometry(source, '#ff8800');
    assert.ok(disposed);
    assert.ok(tinted.hasAttribute('uv') && tinted.hasAttribute('normal'));
    assert.ok(constantColor(tinted.attributes.color));
  });
  test('jitter is a deterministic in-place radial scale', () => {
    const geometry = new THREE.SphereGeometry(1, 6, 4);
    const [x, y, z] = [geometry.attributes.position.getX(7), geometry.attributes.position.getY(7), geometry.attributes.position.getZ(7)];
    assert.equal(jitter(geometry, 0.3, 5), geometry);
    const k = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + 5) * 43758.5453;
    const scale = 1 + (k - Math.floor(k) - 0.5) * 0.3;
    assert.equal(geometry.attributes.position.getX(7), Math.fround(x * scale));
    assert.deepEqual(jitter(new THREE.SphereGeometry(1, 6, 4), 0.3, 5).attributes.position.array, geometry.attributes.position.array);
  });
  test('box allocates per call and parents at its position', () => {
    const parent = new THREE.Group();
    const [a, b] = [box(1, 1, 1, null, 1, 2, 3, parent), box(1, 1, 1, null, 0, 0, 0, parent)];
    assert.notEqual(a.geometry, b.geometry);
    assert.deepEqual(parent.children, [a, b]);
    assert.deepEqual(a.position.toArray(), [1, 2, 3]);
  });
  test('wall and roof vents', () => {
    const parent = new THREE.Group();
    const [wallAt, roofAt] = [new THREE.Vector3(1, 2, 3), new THREE.Vector3(4, 5, 6)];
    addWallVent(parent, wallAt, 0.5, null, null);
    addRoofVent(parent, roofAt, null);
    wallAt.set(0, 0, 0);
    roofAt.set(0, 0, 0);
    const wall = parent.children[0];
    assert.deepEqual(parent.children.map(vent => vent.position.toArray()), [[1, 2, 3], [4, 5, 6]], 'positions copied, not aliased');
    assert.ok(wall.isGroup && wall.children.length === 8 && wall.rotation.y === 0.5);
    wall.children.slice(2, 7).forEach((slat, k) => {
      assert.equal(slat.rotation.x, 0.3);
      assert.equal(slat.position.y, -0.15 + k * 0.075);
    });
    const [plate, pipe, cap] = parent.children[1].children;
    assert.equal(plate.geometry.type, 'BoxGeometry');
    assert.deepEqual(pipe.geometry.parameters, { radiusTop: 0.085, radiusBottom: 0.11, height: 0.42, radialSegments: 8, heightSegments: 1, openEnded: false, thetaStart: 0, thetaLength: Math.PI * 2 });
    assert.equal(pipe.position.y, 0.2);
    assert.deepEqual([cap.geometry.type, cap.geometry.parameters.radius, cap.geometry.parameters.height, cap.position.y], ['ConeGeometry', 0.23, 0.16, 0.47]);
  });
});

describe('terrain, track and bridge golden values', () => {
  const world = createCloneWorld({ stopAfter: 'buildTerrain', skip: WORLD_CORE_SKIP });
  const children = world.group.children;
  const [terrain, skirt] = children.slice(-4, -2);
  test('track and bridge scalars', () => {
    assert.equal(world.length, 276.13647750761754);
    assert.deepEqual(world.bridge, [30, 178]);
    assert.equal(world.frames.length, 1201);
    assert.ok(world.frames[1200].p.equals(world.frames[0].p));
    assert.deepEqual(world.frames[0].r.toArray(), [-0.4121058261388017, 0, 0.9111359876892451]);
    assert.deepEqual([children.length, children[3].count, children[9].count], [53, 383, 76]);
    assert.deepEqual(children.slice(-6, -4).map(mesh => mesh.position.y), [6.057044616149996, 1.9610518544999336]);
    const chord = createBridgeChord(world, world.frames.slice(30, 179));
    assert.deepEqual([chord.len, chord.deckY, chord.baseA, chord.baseB, chord.apex],
      [34.00832919192996, 8.994537490005957, 5.657044616149997, 1.5610518544999334, 7.644537490005957]);
  });
  test('heights, heightTex and sand', () => {
    const heights = Array.from(world.heights);
    assert.deepEqual([Math.min(...heights), Math.max(...heights)], [-1.399999976158142, 20.032737731933594]);
    const texels = Array.from(world.heightTex.image.data);
    assert.deepEqual([Math.min(...texels), Math.max(...texels)], [34, 255]);
    const surfaceY = terrain.geometry.attributes.position.array.filter((value, index) => index % 3 === 1);
    assert.equal(surfaceY.filter(height => height < 0.45).length, 3737);
  });
  test('output array hashes', () => {
    const arrays = {
      heights: world.heights, heightTex: world.heightTex.image.data, sx: world.sx, sz: world.sz,
      color: terrain.geometry.attributes.color.array, position: terrain.geometry.attributes.position.array,
      normal: terrain.geometry.attributes.normal.array, skirtPosition: skirt.geometry.attributes.position.array,
      skirtTopY: skirt.geometry.attributes.topY.array,
    };
    assert.deepEqual(Object.fromEntries(Object.entries(arrays).map(([name, array]) => [name, fnv1aHex(array)])), {
      heights: '5ed87eee', heightTex: 'bc956426', sx: 'd31db2aa', sz: '2e70149f', color: '08eff0cd',
      position: '28125716', normal: '16c83b67', skirtPosition: 'a8c32803', skirtTopY: '12717f91',
    });
  });
  test('placement PRNG untouched and 444 UUID draws on a warm build', () => {
    assert.equal(world.rand(), FIRST_RAND_OF_SEED_42);
    const draws = countMathRandomDraws(() => createCloneWorld({ stopAfter: 'buildTerrain', skip: WORLD_CORE_SKIP }));
    assert.equal(draws, 444);
  });
});
