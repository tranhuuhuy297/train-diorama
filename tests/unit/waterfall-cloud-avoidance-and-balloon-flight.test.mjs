// Water, clouds and balloon without the original: waterfall mouth and curtain grid, cloud drift/fade
// and camera push on synthetic clouds, the closed-form balloon flight, the envelope checker colours,
// and the water/waterfall material bindings. Nothing here builds a World or touches the npr cache.
import '../../src/core/disable-three-color-management.js';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { HALF } from '../../src/world/world-constants.js';
import { smoothstep } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { G, NIGHT_UNIFORMS } from '../../src/materials/shared-lighting-uniforms.js';
import { COMMON_GLSL } from '../../src/materials/glsl/npr-lighting-common-glsl.js';
import { waterMaterial, WATER_FRAGMENT_SHADER } from '../../src/materials/water-surface-material.js';
import { waterfallMaterial, WATERFALL_FRAGMENT_SHADER } from '../../src/materials/waterfall-curtain-material.js';
import { findWaterfallMouth, createWaterfallGeometry } from '../../src/world/water/river-water-and-waterfall-builder.js';
import {
  updateCloudDrift, updateCloudCamera, CLOUD_CAMERA_BUFFER, CLOUD_RETURN_RESPONSE,
} from '../../src/world/sky/cloud-drift-fade-and-camera-avoidance.js';
import { updateBalloonFlight } from '../../src/world/balloon/hot-air-balloon-burner-flame-and-flight.js';
import { createBalloonEnvelopeGeometry } from '../../src/world/balloon/hot-air-balloon-envelope-and-basket.js';
import { WORLD_BUILD_STEPS } from '../../src/world/world-build-steps.js';

const XMIN = -4.960000000000001;
const XMAX = 5.579999999999998;
const f32 = Math.fround;

function syntheticCloud({ x = 0, travelWidth = 220, fadeWidth = 28, size = 1, age = 0, scale = 1 } = {}) {
  const group = new THREE.Group();
  group.position.set(x, 30, 0);
  group.scale.setScalar(scale);
  return {
    group, colliders: [{ position: new THREE.Vector3(0, 0, 0), radius: 2 }, { position: new THREE.Vector3(1.5, 0, 0), radius: 1.5 }],
    radius: 3, position: group.position.clone(), offset: new THREE.Vector3(), speed: 1.5, travelWidth, fadeWidth, size, age,
  };
}

test('water, clouds and balloon are build steps 13-15, right after the rocks and sheep; entries stay wrappable', () => {
  const names = WORLD_BUILD_STEPS.map(step => step.name);
  const at = names.indexOf('buildRocksAndSheep');
  assert.deepEqual(names.slice(at, at + 4), ['buildRocksAndSheep', 'buildWater', 'buildClouds', 'buildBalloon']);
  assert.ok(Object.isFrozen(WORLD_BUILD_STEPS) && WORLD_BUILD_STEPS.every(step => !Object.isFrozen(step)));
});

describe('waterfall mouth and curtain', () => {
  test('the mouth spans the negative columns of the last heightmap row', () => {
    const heights = new Float32Array(201 * 201);
    for (let column = 92; column <= 109; column++) heights[200 * 201 + column] = -1;
    heights[199 * 201 + 10] = -1;
    assert.deepEqual(findWaterfallMouth(heights), { xmin: XMIN, xmax: XMAX });
    assert.deepEqual(findWaterfallMouth(new Float32Array(201 * 201)), { xmin: Infinity, xmax: -Infinity });
  });
  test('8 x 24 grid: vertex/index counts, first and last vertex, winding', () => {
    const geometry = createWaterfallGeometry(XMIN, XMAX);
    const { position, uv } = geometry.attributes;
    assert.equal(position.count, 225);
    assert.equal(geometry.index.count, 1152);
    assert.ok(geometry.index.array instanceof Uint16Array);
    assert.deepEqual(Array.from(geometry.index.array.slice(0, 6)), [0, 9, 1, 1, 9, 10]);
    assert.equal(geometry.attributes.normal, undefined);
    assert.deepEqual([position.getX(0), position.getY(0), position.getZ(0)], [f32(XMIN - 0.2), f32(0.02), f32(HALF + 0.05)]);
    assert.deepEqual([uv.getX(0), uv.getY(0)], [0, 1]);
    const last = 224;
    assert.equal(position.getX(last), f32(XMAX + 0.2));
    assert.equal(position.getY(last), f32(-18 + 0.02));
    assert.equal(position.getZ(last), f32(HALF + 0.05 + 1.35 * Math.sqrt(18)));
    assert.deepEqual([uv.getX(last), uv.getY(last)], [1, 0]);
  });
});

describe('cloud drift and fade', () => {
  test('wraps only past half the travel width and clears the offset', () => {
    const cloud = syntheticCloud({ x: 109 });
    cloud.offset.set(1, 2, 3);
    updateCloudDrift([cloud], 2 / 3);
    assert.equal(cloud.position.x, 110);
    assert.deepEqual(cloud.offset.toArray(), [1, 2, 3]);
    updateCloudDrift([cloud], 0.1);
    assert.equal(cloud.position.x, 110 + 1.5 * 0.1 - 220);
    assert.deepEqual(cloud.offset.toArray(), [0, 0, 0]);
    assert.deepEqual(cloud.group.position.toArray(), cloud.position.toArray());
  });
  test('scale is size x band fade x grow-in', () => {
    const cloud = syntheticCloud({ x: -100, size: 1.6 });
    updateCloudDrift([cloud], 0.5);
    const x = cloud.position.x;
    const fade = smoothstep(-110, -82, x) * (1 - smoothstep(82, 110, x));
    assert.equal(cloud.group.scale.x, 1.6 * fade * smoothstep(0, 2, 0.5));
    assert.equal(cloud.group.scale.y, cloud.group.scale.x);
    const fresh = syntheticCloud();
    updateCloudDrift([fresh], 0);
    assert.equal(fresh.group.scale.x, 0);
    const edge = syntheticCloud({ x: -110 - 1.5, age: 5 });
    updateCloudDrift([edge], 1);
    assert.equal(edge.group.scale.x, 0);
  });
});

describe('cloud camera avoidance', () => {
  const dt = 1 / 60;
  test('a camera at the centre pushes along +x; the push clears every buffered collider', () => {
    const cloud = syntheticCloud();
    updateCloudCamera([cloud], cloud.group.position.clone(), dt);
    const [x, y, z] = cloud.offset.toArray();
    assert.ok(x > 0 && y === 0 && z === 0);
    // Collider 1 (radius 2 + buffer, on the camera) needs the longest push; collider 2 only 3 - 1.5.
    assert.equal(x, 2 + CLOUD_CAMERA_BUFFER);
    assert.deepEqual(cloud.group.position.toArray(), cloud.position.clone().add(cloud.offset).toArray());
  });
  test('an existing offset keeps its direction; far away it only decays, then snaps to zero', () => {
    const cloud = syntheticCloud();
    cloud.offset.set(0, 0, 0.5);
    updateCloudCamera([cloud], cloud.position.clone(), dt);
    assert.equal(cloud.offset.x, 0);
    assert.ok(cloud.offset.z > 0.5);
    const before = cloud.offset.z;
    const far = new THREE.Vector3(500, 500, 500);
    updateCloudCamera([cloud], far, dt);
    assert.equal(cloud.offset.z, before * Math.exp(-CLOUD_RETURN_RESPONSE * dt));
    cloud.offset.set(0, 1e-6, 0);
    updateCloudCamera([cloud], far, dt);
    assert.deepEqual(cloud.offset.toArray(), [0, 0, 0]);
  });
  test('hidden or scale-0 clouds are never pushed but still decay', () => {
    for (const setup of [cloud => { cloud.group.visible = false; }, cloud => cloud.group.scale.setScalar(0)]) {
      const cloud = syntheticCloud();
      setup(cloud);
      cloud.offset.set(0.4, 0, 0);
      updateCloudCamera([cloud], cloud.position.clone(), dt);
      assert.equal(cloud.offset.x, 0.4 * Math.exp(-CLOUD_RETURN_RESPONSE * dt));
    }
  });
});

describe('balloon flight and envelope', () => {
  test('closed-form orbit, bob, spin and flicker', () => {
    const world = { balloon: new THREE.Object3D(), balloonFlame: new THREE.Object3D() };
    for (const t of [0, 1.3, 2, 179.5]) {
      updateBalloonFlight(world, t);
      const expected = [Math.cos(t * 0.035) * 34, 27 + Math.sin(t * 0.5) * 1.2, Math.sin(t * 0.035) * 26 - 4];
      assert.deepEqual(world.balloon.position.toArray(), expected);
      assert.equal(world.balloon.rotation.y, t * 0.1);
      assert.equal(world.balloonFlame.scale.y, 0.9 + Math.sin(t * 9) * 0.06 + Math.sin(t * 17) * 0.04);
    }
    let t = 0;
    for (let frame = 0; frame < 120; frame++) t += 1 / 60;
    updateBalloonFlight(world, t);
    assert.deepEqual(world.balloon.position.toArray(), [33.916734008611506, 28.009765181769474, -2.18148596922415]);
    assert.equal(world.balloon.rotation.y, 0.1999999999999998);
    assert.equal(world.balloonFlame.scale.y, 0.8761040726385008);
  });
  test('envelope: 672 smooth-shaded vertices in a red/cream harlequin', () => {
    const geometry = createBalloonEnvelopeGeometry();
    assert.equal(geometry.attributes.position.count, 672);
    assert.equal(geometry.index, null);
    assert.equal(geometry.attributes.uv, undefined);
    assert.ok(geometry.attributes.normal);
    const color = geometry.attributes.color;
    const red = [f32(0xd9 / 255), f32(0x3f / 255), f32(0x36 / 255)];
    let reds = 0;
    for (let vertex = 0; vertex < 672; vertex++) {
      const quad = Math.floor(vertex / 6);
      const isRed = (Math.floor(quad / 8) + (quad % 8)) % 2 === 0;
      const rgb = [color.getX(vertex), color.getY(vertex), color.getZ(vertex)];
      if (isRed) assert.deepEqual(rgb, red, `vertex ${vertex}`);
      else assert.notDeepEqual(rgb, red, `vertex ${vertex}`);
      reds += isRed ? 1 : 0;
    }
    assert.equal(reds, 336);
    assert.ok(Math.abs(red[0] - 0.8509804) < 1e-6 && Math.abs(red[1] - 0.2470588) < 1e-6 && Math.abs(red[2] - 0.2117647) < 1e-6);
  });
});

describe('water and waterfall materials', () => {
  test('water: front side, opaque, shared lighting refs, own height texture', () => {
    const texture = new THREE.DataTexture(new Uint8Array(4), 2, 2, THREE.RedFormat);
    const material = waterMaterial(texture);
    assert.equal(material.side, THREE.FrontSide);
    assert.equal(material.transparent, false);
    assert.deepEqual(Object.keys(material.uniforms), [...Object.keys(G), 'uNight', 'uHeadlightPosition', 'uHeadlightDirection', 'uHeight', 'uSize']);
    for (const name of Object.keys(G)) assert.equal(material.uniforms[name], G[name]);
    for (const name of ['uNight', 'uHeadlightPosition', 'uHeadlightDirection']) assert.equal(material.uniforms[name], NIGHT_UNIFORMS[name]);
    assert.equal(material.uniforms.uHeight.value, texture);
    assert.equal(material.uniforms.uSize.value, 124);
    assert.notEqual(waterMaterial(texture, 60), material);
    assert.ok(WATER_FRAGMENT_SHADER.includes(COMMON_GLSL));
  });
  test('waterfall: double-sided, lighting bag plus uNight only', () => {
    const material = waterfallMaterial();
    assert.equal(material.side, THREE.DoubleSide);
    assert.deepEqual(Object.keys(material.uniforms), [...Object.keys(G), 'uNight']);
    assert.equal(material.uniforms.uNight, NIGHT_UNIFORMS.uNight);
    assert.ok(WATERFALL_FRAGMENT_SHADER.includes(COMMON_GLSL));
  });
});
