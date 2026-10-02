// Palettes, transition maths, setTimeOfDay/updateTimeOfDay via the Diorama prototype, the
// sky material's uniform identity and the night-glow registry.
import '../../src/core/disable-three-color-management.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { PALETTES, TIME_OF_DAY_TRANSITION_SECONDS, applyPalette, beginPaletteTransition, stepPaletteTransition } from '../../src/engine/time-of-day-palettes-and-transition.js';
import { skyMaterial } from '../../src/materials/procedural-sky-dome-material.js';
import { G, NIGHT_UNIFORMS, LIGHTING_UNIFORMS, NIGHT_LIGHT_GLOW_MATERIAL_NAME } from '../../src/materials/shared-lighting-uniforms.js';
import { collectNightLightGlows, applyNightGlowVisibility } from '../../src/engine/night-light-glow-registry.js';
import { Diorama } from '../../src/engine/diorama.js';
import { originalSkipReason, importOriginal } from '../helpers/original-module-loader.mjs';

const COLOR_VECTOR_KEYS = ['uLightDir', 'uLightColor', 'uShadowTint', 'uAmbient', 'uFogColor', 'uZenith', 'uHorizon', 'uHill', 'uMist', 'uSunColor'];
const PALETTE_ALL_KEYS = ['uNight', 'uSaturation', ...COLOR_VECTOR_KEYS];
const dioramaSkip = originalSkipReason(['Diorama.js']);
const materialsSkip = originalSkipReason(['Materials.js']);

let originalPalettes = null;
if (!dioramaSkip) {
  const source = await readFile(new URL('../../.parity-cache/original/Diorama.js', import.meta.url), 'utf8');
  const block = source.match(/const PALETTES = (\{[\s\S]*?\n\});/)[1];
  originalPalettes = new Function('THREE', `return ${block};`)(THREE);
}

function freshBagFromNight() {
  const bag = {};
  for (const key of PALETTE_ALL_KEYS) {
    const source = PALETTES.night[key];
    bag[key] = { value: typeof source === 'number' ? source : source.clone() };
  }
  return bag;
}

function assertValueEquals(a, b, epsilon = 0) {
  for (const axis of a.isColor ? ['r', 'g', 'b'] : ['x', 'y', 'z']) {
    assert.ok(Math.abs(a[axis] - b[axis]) <= epsilon, `${axis}: ${a[axis]} vs ${b[axis]}`);
  }
}

beforeEach(() => {
  applyPalette(LIGHTING_UNIFORMS, 'day');
  G.uTime.value = 0;
});

test('PALETTES: ids, key order, unit uLightDir, golden hex/byte values', () => {
  assert.equal(TIME_OF_DAY_TRANSITION_SECONDS, 3);
  for (const id of ['day', 'evening', 'night']) {
    assert.deepEqual(Object.keys(PALETTES[id]), PALETTE_ALL_KEYS);
    assert.ok(Math.abs(PALETTES[id].uLightDir.length() - 1) < 1e-12);
  }
  assert.equal(PALETTES.day.uZenith.getHexString(), '4f8fde');
  assert.equal(new THREE.Color('#cfe6f4').r, 207 / 255);
});

test('parity: every PALETTES component matches the original, bitwise', { skip: dioramaSkip }, () => {
  for (const id of ['day', 'evening', 'night']) {
    for (const key of PALETTE_ALL_KEYS) {
      const clone = PALETTES[id][key];
      const original = originalPalettes[id][key];
      if (typeof clone === 'number') assert.equal(clone, original, `${id}.${key}`);
      else assertValueEquals(clone, original);
    }
  }
});

test('applyPalette writes day values into the same objects, in place', () => {
  const bag = freshBagFromNight();
  const refs = {};
  for (const key of COLOR_VECTOR_KEYS) refs[key] = bag[key].value;
  applyPalette(bag, 'day');
  for (const key of COLOR_VECTOR_KEYS) {
    assert.equal(bag[key].value, refs[key], `${key} identity preserved`);
    assertValueEquals(bag[key].value, PALETTES.day[key]);
  }
  assert.equal(bag.uNight.value, 0);
  assert.equal(bag.uSaturation.value, 1);
});

test('p = 0.5 blend lerps halfway (three lerp) with a renormalised uLightDir', () => {
  const bag = freshBagFromNight();
  applyPalette(bag, 'day');
  const startSnapshot = {};
  for (const key of COLOR_VECTOR_KEYS) startSnapshot[key] = bag[key].value.clone();

  const transition = beginPaletteTransition(bag, 'evening');
  const result = stepPaletteTransition(bag, transition, 1.5);
  assert.equal(result, transition, 'returns the same transition object');
  for (const key of COLOR_VECTOR_KEYS) {
    const expected = startSnapshot[key].clone().lerp(PALETTES.evening[key], 0.5);
    // uLightDir alone is renormalised after the lerp: palette directions are unit length
    // and a lerp between two unit vectors is shorter than 1.
    if (key === 'uLightDir') expected.normalize();
    assertValueEquals(bag[key].value, expected, 1e-12);
  }
  assert.ok(Math.abs(bag.uLightDir.value.length() - 1) < 1e-12);
  // Golden value, independently reproduced: normalize(lerp(normalize(day), normalize(evening), 0.5)).
  assertValueEquals(bag.uLightDir.value, new THREE.Vector3(-0.173953, 0.779566, 0.601678), 1e-6);

  const next = stepPaletteTransition(bag, result, 1.5);
  assert.equal(next, null);
  for (const key of COLOR_VECTOR_KEYS) assertValueEquals(bag[key].value, PALETTES.evening[key], 1e-12);
  assert.equal(bag.uNight.value, PALETTES.evening.uNight);
  assert.equal(bag.uSaturation.value, PALETTES.evening.uSaturation);
});

test('unclamped real dt: large step finishes instantly; 1/60 cadence finishes within 181 steps', () => {
  const bagLarge = freshBagFromNight();
  applyPalette(bagLarge, 'day');
  assert.equal(stepPaletteTransition(bagLarge, beginPaletteTransition(bagLarge, 'evening'), 10), null);

  const bag60 = freshBagFromNight();
  applyPalette(bag60, 'day');
  let transition = beginPaletteTransition(bag60, 'evening');
  let steps = 0;
  while (transition !== null && steps < 1000) {
    transition = stepPaletteTransition(bag60, transition, 1 / 60);
    steps++;
  }
  assert.equal(transition, null);
  assert.ok(steps <= 181, `finished within the 181-step budget (took ${steps})`);
});

test('retargeting mid-transition clones the current values as the new start', () => {
  const bag = freshBagFromNight();
  applyPalette(bag, 'day');
  let transition = beginPaletteTransition(bag, 'evening');
  transition = stepPaletteTransition(bag, transition, 1.5);
  const midValues = {};
  for (const key of COLOR_VECTOR_KEYS) midValues[key] = bag[key].value.clone();

  const retarget = beginPaletteTransition(bag, 'night');
  for (const key of COLOR_VECTOR_KEYS) {
    assert.notEqual(retarget.start[key], bag[key].value, `${key} start is a clone`);
    assertValueEquals(retarget.start[key], midValues[key]);
  }
});

test('Diorama.prototype.setTimeOfDay/updateTimeOfDay via a fake instance', () => {
  const bag = freshBagFromNight();
  const fake = { lightingUniforms: bag, timeOfDay: null, timeOfDayTransition: null };
  assert.throws(() => Diorama.prototype.setTimeOfDay.call(fake, 'dusk'), { message: 'Invalid time of day: dusk' });

  Diorama.prototype.setTimeOfDay.call(fake, 'day', true);
  assert.equal(fake.timeOfDayTransition, null);
  assert.equal(bag.uZenith.value.getHexString(), '4f8fde');

  Diorama.prototype.setTimeOfDay.call(fake, 'day');
  assert.equal(fake.timeOfDayTransition, null, 'same id without immediate is a no-op');

  Diorama.prototype.setTimeOfDay.call(fake, 'evening');
  assert.notEqual(fake.timeOfDayTransition, null, 'a different id without immediate starts a blend');

  Diorama.prototype.setTimeOfDay.call(fake, 'night', true);
  assert.equal(fake.timeOfDayTransition, null, 'immediate nulls the running transition');
  assert.equal(bag.uNight.value, 1);

  Diorama.prototype.setTimeOfDay.call(fake, 'day');
  Diorama.prototype.updateTimeOfDay.call(fake, 1.5);
  assert.notEqual(fake.timeOfDayTransition, null);
});

test('skyMaterial: BackSide, depthWrite false, every uniform is a singleton reference', () => {
  const material = skyMaterial();
  assert.equal(material.side, THREE.BackSide);
  assert.equal(material.depthWrite, false);
  for (const key of Object.keys(G)) assert.equal(material.uniforms[key], G[key]);
  for (const key of ['uNight', 'uHeadlightPosition', 'uHeadlightDirection']) assert.equal(material.uniforms[key], NIGHT_UNIFORMS[key]);
});

test('parity: sky material uniform key set matches the original', { skip: materialsSkip }, async () => {
  const original = await importOriginal('Materials.js');
  const clone = skyMaterial();
  const originalMaterial = original.skyMaterial();
  assert.deepEqual(Object.keys(clone.uniforms), Object.keys(originalMaterial.uniforms));
});

test('collectNightLightGlows: traverse order; applyNightGlowVisibility threshold', () => {
  const scene = new THREE.Scene();
  const glowMaterial = () => new THREE.ShaderMaterial({ name: NIGHT_LIGHT_GLOW_MATERIAL_NAME });
  const glowA = new THREE.Mesh(new THREE.BoxGeometry(), glowMaterial());
  const glowB = new THREE.Mesh(new THREE.BoxGeometry(), glowMaterial());
  const nested = new THREE.Group();
  const glowC = new THREE.Mesh(new THREE.BoxGeometry(), glowMaterial());
  nested.add(glowC);
  const plainShader = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.ShaderMaterial());
  const plainBasic = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  scene.add(glowA, glowB, nested, plainShader, plainBasic);

  const glows = collectNightLightGlows(scene);
  assert.deepEqual(glows, [glowA, glowB, glowC]);

  applyNightGlowVisibility(glows, 0);
  assert.ok(glows.every(g => g.visible === false));
  applyNightGlowVisibility(glows, 0.001);
  assert.ok(glows.every(g => g.visible === true));
});
