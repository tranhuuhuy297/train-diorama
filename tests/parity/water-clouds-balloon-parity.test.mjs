// Water, clouds and balloon vs the original: cold-cache full builds with UUID draw counts per step, the
// world-stream fingerprint, all 33 clouds bit for bit, water/waterfall/balloon signatures and material
// structure, the whole world group, then 300 sim-seconds of drift, avoidance and flight in lockstep.
import '../../src/core/disable-three-color-management.js';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { originalSkipReason } from '../helpers/original-module-loader.mjs';
import { buildCountedOriginalWorld, buildCountedCloneWorld } from '../helpers/counted-full-world-builds.mjs';
import { sceneGraphSignature, compareSceneSignatures } from '../helpers/scene-graph-signature.mjs';
import { NIGHT_UNIFORMS } from '../../src/materials/shared-lighting-uniforms.js';

const ORIGINAL_FILES = ['Diorama.js', 'World.js', 'Materials.js', 'Noise.js', 'StaticGeometry.js', 'LightGlows.js', 'StationWalker.js',
  'VillageResidents.js', 'TrackSheep.js', 'Train.js', 'BrakeSparks.js', 'BirdSystem.js'];
const skip = originalSkipReason(ORIGINAL_FILES);
const STEPS = ['buildWater', 'buildClouds', 'buildBalloon'];
const EXPECTED_DRAWS = { buildWater: 24, buildClouds: 2128, buildBalloon: 2940 };
const INSTANCE_COUNTS = [15, 12, 14, 12, 12, 16, 14, 14, 14, 15, 13, 16, 16, 15, 15, 12, 15, 15, 15, 16, 12, 13, 15, 14, 15, 14, 14, 14, 15, 12, 14, 13, 13];
const HOME = [-55.522, 62.771, 130.519];

const xyz = vector => [vector.x, vector.y, vector.z];
const figuresOf = world => new Set((world.stationTravelers ?? []).map(traveler => traveler.figure));
const waterOf = world => world.group.children.find(child => child.isMesh && child.material?.uniforms?.uHeight);
const waterfallOf = world => world.group.children[world.group.children.indexOf(waterOf(world)) + 1];

function assertBits(actual, expected, label) {
  assert.equal(actual.length, expected.length, `${label} length`);
  actual.forEach((value, index) => assert.ok(Object.is(value, expected[index]), `${label}[${index}]: ${value} vs ${expected[index]}`));
}

function assertSameSignature(original, clone, label, exclude = new Set()) {
  const comparison = compareSceneSignatures(sceneGraphSignature(original, { exclude }), sceneGraphSignature(clone));
  assert.ok(comparison.equal, `${label}: ${comparison.report}`);
}

// Camera path through each cloud layer, then into the cloud centres themselves.
function cameraAt(frame, world, out) {
  if (frame < 3600) return out.set(...HOME);
  if (frame < 7200) return out.set(-110 + (220 * (frame - 3600)) / 3600, 40, 15);
  if (frame < 10800) return out.set(110 - (220 * (frame - 7200)) / 3600, 33, -47);
  if (frame < 14400) return out.set(-62 + (124 * (frame - 10800)) / 3600, -2, 80);
  return out.copy(world.clouds[Math.floor((frame - 14400) / 600) % 33].group.position);
}

const motionState = world => [
  ...world.clouds.flatMap(cloud => [...xyz(cloud.position), ...xyz(cloud.offset), ...xyz(cloud.group.position), cloud.group.scale.x, cloud.age]),
  ...xyz(world.balloon.position), world.balloon.rotation.y, world.balloonFlame.scale.y,
];

describe('water, clouds and balloon parity with the original', { skip, timeout: 600_000 }, () => {
  const sides = {};
  before(async () => {
    // Both builds first, so neither npr cache has been touched by anything else in this process.
    sides.original = await buildCountedOriginalWorld(STEPS);
    sides.clone = buildCountedCloneWorld(STEPS);
  });

  test('(1) UUID draws per step and the world-stream fingerprint', () => {
    assert.deepEqual(sides.original.counts, EXPECTED_DRAWS);
    assert.deepEqual(sides.clone.counts, EXPECTED_DRAWS);
    const [original, clone] = [sides.original.world.rand(), sides.clone.world.rand()];
    assert.equal(clone, original);
    assert.equal(clone, 0.23735972004942596);
  });

  test('(2) every cloud bit for bit', () => {
    const [original, clone] = [sides.original.world, sides.clone.world];
    assert.equal(clone.windmillRoofHeight, 22.266444503377606);
    assert.equal(clone.clouds.length, 33);
    assert.equal(original.clouds.length, 33);
    clone.clouds.forEach((cloud, index) => {
      const twin = original.clouds[index];
      const [mesh, twinMesh] = [cloud.group.children[0], twin.group.children[0]];
      const label = `cloud ${index}`;
      assert.equal(cloud.group.children.length, 1);
      assert.equal(mesh.count, INSTANCE_COUNTS[index], `${label} instances`);
      assert.equal(mesh.count, twinMesh.count);
      assertBits(Array.from(mesh.instanceMatrix.array), Array.from(twinMesh.instanceMatrix.array), `${label} matrices`);
      assertBits(cloud.colliders.flatMap(c => [...xyz(c.position), c.radius]), twin.colliders.flatMap(c => [...xyz(c.position), c.radius]), `${label} colliders`);
      const scalars = state => [state.radius, ...xyz(state.position), state.speed, state.travelWidth, state.fadeWidth, state.size, state.age, state.group.scale.x];
      assertBits(scalars(cloud), scalars(twin), `${label} state`);
      assertBits(xyz(cloud.offset), [0, 0, 0], `${label} offset`);
      const sphere = s => [...xyz(s.center), s.radius];
      assertBits(sphere(mesh.boundingSphere), sphere(twinMesh.boundingSphere), `${label} bounding sphere`);
      assert.deepEqual(Object.keys(cloud), Object.keys(twin));
    });
    assert.equal(clone.clouds.reduce((sum, cloud) => sum + cloud.group.children[0].count, 0), 464);
  });

  test('(3) water, waterfall and balloon signatures; shadow exclusions; water bindings', () => {
    const [original, clone] = [sides.original.world, sides.clone.world];
    assertSameSignature(waterOf(original), waterOf(clone), 'water');
    assertSameSignature(waterfallOf(original), waterfallOf(clone), 'waterfall');
    assertSameSignature(original.balloon, clone.balloon, 'balloon');
    const types = world => world.balloon.children.map(child => child.type);
    assert.deepEqual(types(clone), ['Mesh', 'Group', ...Array(9).fill('Mesh'), 'Mesh', 'Mesh', 'Group', 'Mesh']);
    assert.deepEqual(types(clone), types(original));
    original.noShadow.slice(-5).forEach((object, index) => assertSameSignature(object, clone.noShadow.at(index - 5), `noShadow tail ${index}`));
    assert.equal(clone.group.children.at(-1), clone.balloon);
    const water = waterOf(clone).material;
    assert.equal(water.uniforms.uHeight.value, clone.heightTex);
    assert.equal(water.uniforms.uSize.value, 124);
    for (const name of ['uNight', 'uHeadlightPosition', 'uHeadlightDirection']) assert.equal(water.uniforms[name], NIGHT_UNIFORMS[name]);
    assert.ok(!('uSaturation' in water.uniforms));
  });

  test('(4) the whole world group, minus the original station traveler figures', () => {
    const [original, clone] = [sides.original.world, sides.clone.world];
    assert.equal(clone.group.children.length, original.group.children.length);
    assertSameSignature(original.group, clone.group, 'world.group', figuresOf(original));
  });

  test('(5) water and waterfall material structure', () => {
    const [original, clone] = [sides.original.world, sides.clone.world];
    const flags = material => [material.type, material.side, material.transparent, material.depthTest, material.depthWrite, material.vertexColors];
    for (const pick of [waterOf, waterfallOf]) assert.deepEqual(flags(pick(clone).material), flags(pick(original).material));
    assert.equal(waterOf(clone).material.side, THREE.FrontSide);
    assert.equal(waterfallOf(clone).material.side, THREE.DoubleSide);
    assert.deepEqual(Object.keys(waterOf(clone).material.uniforms), Object.keys(waterOf(original).material.uniforms));
    assert.equal(waterOf(original).material.uniforms.uHeight.value, original.heightTex);
    assert.equal(waterOf(original).material.uniforms.uSize.value, 124);
  });

  test('(6) 300 sim-seconds of drift, camera avoidance and flight in lockstep', () => {
    const worlds = [sides.original.world, sides.clone.world];
    const cameras = [new THREE.Vector3(), new THREE.Vector3()];
    const trainPosition = new THREE.Vector3(0, 9, 36);
    const motion = { distance: 0, speed: 0, length: 25.65 };
    const dt = 1 / 60;
    const realLog = console.log;
    let t = 0;
    let displacedFrames = 0;
    const wraps = new Set();
    console.log = () => {};
    try {
      for (let frame = 0; frame < 18000; frame++) {
        const paused = frame >= 5000 && frame < 5300;
        const hidden = frame >= 8000 && frame < 8600;
        for (const world of worlds) world.clouds.slice(3, 9).forEach(cloud => { cloud.group.visible = !hidden; });
        if (!paused) t += dt;
        worlds.forEach((world, side) => {
          const before = world.clouds.map(cloud => cloud.position.x);
          if (!paused) world.update(t, dt, trainPosition, motion);
          world.clouds.forEach((cloud, index) => { if (cloud.position.x < before[index]) wraps.add(index < 8 ? 'A' : index < 15 ? 'B' : 'C'); });
          world.updateCloudCamera(cameraAt(frame, world, cameras[side]), dt);
        });
        if (worlds[1].clouds.some(cloud => cloud.offset.lengthSq() > 0)) displacedFrames++;
        if (frame % 60 === 59 || frame === 17999) assertBits(motionState(worlds[1]), motionState(worlds[0]), `frame ${frame}`);
      }
    } finally {
      console.log = realLog;
    }
    assert.ok(displacedFrames > 1000, `avoidance exercised on ${displacedFrames} frames`);
    assert.deepEqual([...wraps].sort(), ['A', 'B', 'C']);
  });
});
