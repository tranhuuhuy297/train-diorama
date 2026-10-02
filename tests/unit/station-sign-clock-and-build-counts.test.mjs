// Mossbrook station without the original: sign paint recording, clock angles, placement scalars, golden
// layout values, part/merge counts, the build-step slot and the simulation-step → world-update wiring.
import '../../src/core/disable-three-color-management.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { createRecordingCanvas } from '../helpers/minimal-dom-shim.mjs';
import { fnv1aHex } from '../helpers/typed-array-fnv1a-hash.mjs';
import { WORLD_BUILD_STEPS } from '../../src/world/world-build-steps.js';
import { drawStationSign } from '../../src/world/station/station-name-board-sign.js';
import { updateStationClock, STATION_CLOCK_MINUTE_PERIOD, STATION_CLOCK_HOUR_PERIOD } from '../../src/world/station/station-wall-clock.js';
import { PLATFORM_DEPTH, PLATFORM_EXTENSION, shiftedX } from '../../src/world/station/station-site-placement.js';
import { stepSimulation } from '../../src/engine/simulation-step.js';

// Expected context writes, in order: ['set', property, value] or ['call', method, args].
const SIGN_RECORDING = [
  ['set', 'fillStyle', '#f4ead2'], ['call', 'fillRect', [0, 0, 1024, 256]],
  ['set', 'strokeStyle', '#3f7d5a'], ['set', 'lineWidth', 5], ['call', 'strokeRect', [14, 14, 996, 228]],
  ['set', 'fillStyle', '#315d45'], ['set', 'font', 'bold 106px Fredoka, sans-serif'],
  ['set', 'textAlign', 'center'], ['set', 'textBaseline', 'middle'], ['call', 'fillText', ['Mossbrook', 455, 94]],
  ['set', 'font', 'bold 31px Fredoka, sans-serif'], ['call', 'fillText', ['R A I L W A Y   S T A T I O N', 455, 171]],
  ['set', 'font', '24px Fredoka, sans-serif'], ['call', 'fillText', ['VALLEY LINE  ·  EST. 1892', 455, 215]],
  ['call', 'fillRect', [855, 38, 125, 180]], ['set', 'fillStyle', '#f4ead2'],
  ['set', 'font', 'bold 19px Fredoka, sans-serif'], ['call', 'fillText', ['PLATFORM', 918, 70]],
  ['set', 'font', 'bold 100px Fredoka, sans-serif'], ['call', 'fillText', ['1', 918, 142]],
];
// Merged building batches in first-seen material order: cream, roof, green, darkWood, window,
// shutter wood, shutter panel, wood, platform.
const MERGED_COLOURS = ['f4ead2', 'c9503c', '3f7d5a', '513b31', 'ffe6a0', '765039', 'a67850', '7a4f35', 'd9cfbd'];
const CLOCK_TIMES = [0, 0.05, 15, 61.3];
// Layout after buildStation, equal to the original's (station parity suite), pinned here without the cache.
const GOLDEN_GROUP = {
  position: [-48.20093691141995, 9, -2.0286763911901513],
  quaternion: [0, -0.01902963571458254, -0, 0.9998189200873179],
  rotationY: -0.038061568852088515,
};
const GOLDEN_FREE_CAMERA = {
  position: [-47.79460752459428, 11.1, -4.815232765893859],
  target: [-48.034337516449874, 11.1, 1.480204433459726],
};
const GOLDEN_FOUNDATIONS = [
  { x: -51.75931789201647, z: -2.664541783336154, height: 8.58, halfWidth: 2.4000000000000004, halfDepth: 3.8, rotation: -0.03806156885209076, falloff: 3 },
  { x: -52.25316775205926, z: 2.4203488070045776, height: 8.58, halfWidth: 1.85, halfDepth: 1.9000000000000001, rotation: -0.038061568852088515, falloff: 1.3 },
];
const GOLDEN_HASHES = { heights: '3094a9f3', exclusions: '0dd0f2e8', pathPosition: '5a4332f0', pathIndex: '4444a78d' };

// Reference angles with the same operation order as the clock (direction -1).
const minuteAngle = t => (((-1 * t) * Math.PI) * 2) / 60;
const hourAngle = t => -1 * ((Math.PI / 2) + (((t * Math.PI) * 2) / 720));

test('(a) the sign paints exactly the 20 recorded context writes', () => {
  const canvas = createRecordingCanvas();
  drawStationSign(canvas.getContext('2d'));
  assert.equal(canvas.operations.length, 20);
  assert.deepStrictEqual(canvas.operations, SIGN_RECORDING);
});

test('stepSimulation steps the train, then hands sim time, sim dt and the train state to the world update', () => {
  const calls = [];
  const position = { x: 1, y: 2, z: 3 };
  const train = { loco: { obj: { position } }, totalLength: 25.65 };
  const d = { time: 1, s: 7, speed: 3, train, updateTrain: dt => calls.push(['train', dt]), world: { update: (...args) => calls.push(args) } };
  stepSimulation(d, 0.25);
  assert.deepStrictEqual(calls, [['train', 0.25], [1.25, 0.25, position, { distance: 7, speed: 3, length: 25.65 }]]);
  assert.equal(calls[1][2], position, 'the locomotive position object itself, not a copy');
});

test('buildStation runs after buildBridge and before buildTerrain', () => {
  const names = WORLD_BUILD_STEPS.map(step => step.name);
  const [bridge, station, terrain] = ['buildBridge', 'buildStation', 'buildTerrain'].map(name => names.indexOf(name));
  assert.ok(bridge >= 0 && bridge < station && station < terrain, names.join(', '));
});

describe('(b) clone station build', () => {
  const world = createCloneWorld({ stopAfter: 'buildStation' });
  const site = world.stationSite;
  const station = site.group;
  const building = world.stationClockMinuteHand.parent;

  test('placement scalars and baked extension floats', () => {
    assert.equal(site.frameIndex, 1008);
    assert.equal(site.side, 1);
    assert.equal(site.localOutward, -1);
    assert.equal(PLATFORM_DEPTH, 3.3800000000000003);
    assert.equal(site.platformExtension, (2.6 * 1.3) - 2.6);
    assert.equal(PLATFORM_EXTENSION, 0.7800000000000002);
    assert.equal(shiftedX(site, -1 * 0.9), -1.6800000000000002);
    assert.equal(world.stationS, site.distance + 4.5);
    assert.equal(station.parent, world.group);
    assert.ok(world.freeCameraStart.position.isVector3 && world.freeCameraStart.target.isVector3);
  });

  test('golden layout: stop distance, group transform, free camera, pads, exclusions and footpath', () => {
    assert.equal(world.stationS, 236.45464110639873);
    assert.deepStrictEqual(station.position.toArray(), GOLDEN_GROUP.position);
    assert.deepStrictEqual(station.quaternion.toArray(), GOLDEN_GROUP.quaternion);
    assert.equal(station.rotation.y, GOLDEN_GROUP.rotationY);
    for (const field of ['position', 'target']) assert.deepStrictEqual(world.freeCameraStart[field].toArray(), GOLDEN_FREE_CAMERA[field], field);
    assert.deepStrictEqual(world.buildingFoundations, GOLDEN_FOUNDATIONS);
    const path = world.group.children.at(-1).geometry;
    const circles = Float64Array.from(world.exclusions.flatMap(({ x, z, r }) => [x, z, r]));
    assert.deepStrictEqual({
      heights: fnv1aHex(world.heights), exclusions: fnv1aHex(circles),
      pathPosition: fnv1aHex(path.attributes.position.array), pathIndex: fnv1aHex(path.index.array),
    }, GOLDEN_HASHES);
  });

  test('clock: 12:00 pose before any update, then exact angles from sim time', () => {
    assert.equal(STATION_CLOCK_MINUTE_PERIOD, 60);
    assert.equal(STATION_CLOCK_HOUR_PERIOD, 720);
    assert.equal(world.stationClockDirection, -1);
    for (const hand of [world.stationClockMinuteHand, world.stationClockHourHand]) assert.deepEqual(hand.rotation.toArray().slice(0, 3), [0, 0, 0]);
    for (const t of CLOCK_TIMES) {
      updateStationClock(world, t);
      assert.ok(Object.is(world.stationClockMinuteHand.rotation.x, minuteAngle(t)), `minute at ${t}`);
      assert.ok(Object.is(world.stationClockHourHand.rotation.x, hourAngle(t)), `hour at ${t}`);
    }
    updateStationClock(world, 0);
    assert.equal(world.stationClockHourHand.rotation.x, -Math.PI / 2);
  });

  test('exclusions, pads and shadow-hidden glows', () => {
    assert.equal(world.exclusions.length, 27);
    assert.ok(world.exclusions.slice(0, 26).every(circle => circle.r === 1.8));
    assert.equal(world.exclusions[26].r, 8);
    assert.equal(world.buildingFoundations.length, 2);
    assert.equal(world.noShadow.length, 2);
    assert.ok(world.noShadow.every(mesh => mesh.material.name === 'night-light-glow'));
    assert.deepEqual(world.noShadow.map(mesh => mesh.parent), [building, station]);
    assert.deepEqual(world.noShadow.map(mesh => mesh.geometry.instanceCount), [2, 2]);
  });

  test('child counts and merge order', () => {
    const figures = new Set(world.stationTravelers.map(traveler => traveler.figure));
    const parts = station.children.filter(child => !figures.has(child));
    assert.equal(parts.length, 70);
    assert.equal(parts.filter(child => child.isMesh).length, 69);
    assert.equal(building.parent, station);
    assert.equal(building.children.length, 20);
    const merged = building.children.slice(-9);
    assert.ok(merged.every(mesh => mesh.isMesh && mesh.geometry.index !== null));
    assert.deepEqual(merged.map(mesh => mesh.material.uniforms.uColor.value.getHexString()), MERGED_COLOURS);
    const hands = building.children.filter(child => child === world.stationClockMinuteHand || child === world.stationClockHourHand);
    assert.equal(hands.length, 2);
  });

  test('footpath ribbon and sign texture', () => {
    const path = world.group.children.at(-1);
    assert.equal(path.geometry.index.count, 600);
    assert.equal(path.geometry.attributes.position.count, 202);
    const sign = station.children.find(child => child.material?.type === 'MeshBasicMaterial');
    const { map } = sign.material;
    assert.equal(map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(map.anisotropy, 4);
    assert.deepEqual([map.image.width, map.image.height], [1024, 256]);
    assert.equal(sign.material.side, THREE.DoubleSide);
    assert.deepStrictEqual(map.image.operations, SIGN_RECORDING);
  });
});
