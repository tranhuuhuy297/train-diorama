// Cache semantics, uniform-bag defaults and GLSL interface parity for the npr() factory.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { G, NIGHT_UNIFORMS, SHADER_NIGHT_UNIFORMS, LIGHTING_UNIFORMS } from '../../src/materials/shared-lighting-uniforms.js';
import { npr } from '../../src/materials/npr-cel-material-factory.js';
import { COMMON_GLSL } from '../../src/materials/glsl/npr-lighting-common-glsl.js';
import { HASH_AND_VALUE_NOISE_GLSL } from '../../src/materials/glsl/hash-and-value-noise-glsl.js';
import { originalSkipReason, importOriginal, extractGlslInterface } from '../helpers/original-module-loader.mjs';

const colorManagementEnabledAtImport = THREE.ColorManagement.enabled;
const skip = originalSkipReason(['Materials.js']);
const original = skip ? null : await importOriginal('Materials.js');

const COMMON_UNIFORMS = [
  'float uFogFar', 'float uFogNear', 'float uNight', 'float uShadowTexel', 'float uTime', 'mat4 uShadowMatrix', 'sampler2D uShadowMap',
  'vec3 uAmbient', 'vec3 uFogColor', 'vec3 uHeadlightDirection', 'vec3 uHeadlightPosition', 'vec3 uLightColor', 'vec3 uLightDir', 'vec3 uShadowTint',
].sort();
const COMMON_FUNCTIONS = [
  'float hash11(float)', 'float hash12(vec2)', 'float hash13(vec3)', 'float shadowAt(vec3,vec3)', 'float vnoise(vec3)',
  'vec3 applyFog(vec3,vec3)', 'vec3 headlightAt(vec3,vec3)', 'vec3 nprShade(vec3,vec3,vec3,float,float)',
].sort();
// extractGlslInterface's full shape: COMMON_GLSL declares no attributes and has no #ifdef.
const COMMON_INTERFACE = { uniforms: COMMON_UNIFORMS, attributes: [], functions: COMMON_FUNCTIONS, conditionals: [] };
const NPR_VERTEX_CONDITIONALS = ['LOCAL_GLOW', 'STRATA', 'TREE_SWAY', 'USE_COLOR', 'USE_INSTANCING', 'USE_INSTANCING_COLOR'];
const NPR_FRAGMENT_CONDITIONALS = ['DOUBLE_SIDED', 'FLOWERS', 'LOCAL_GLOW', 'NIGHT_GLOW', 'STRATA'];

// Expected NPR vertex/fragment interfaces per the Architecture GLSL-interface table, given
// the set of defines a material actually carries (USE_* extras never gate a declaration here).
function expectedVertexInterface(defines) {
  const uniforms = defines.has('TREE_SWAY') ? ['float uTime'] : [];
  const attributes = defines.has('STRATA') ? ['float topY'] : [];
  return { uniforms, attributes, functions: [], conditionals: NPR_VERTEX_CONDITIONALS };
}
function expectedFragmentInterface(defines) {
  const uniforms = [...COMMON_UNIFORMS, 'vec3 uColor', 'float uStipple', 'float uStippleScale', 'float uEmissive', 'float uOpacity'];
  if (defines.has('LOCAL_GLOW')) uniforms.push('vec3 uLocalGlowPosition', 'float uLocalGlowRadius', 'float uLocalGlowStrength');
  return { uniforms: uniforms.sort(), attributes: [], functions: COMMON_FUNCTIONS, conditionals: NPR_FRAGMENT_CONDITIONALS };
}

const FIXTURES = {
  F1: {},
  F2: { vertexColors: true, stipple: 0.42, stippleScale: 1.3, flowers: true },
  F3: { color: '#9a6a44', strata: true, stipple: 0.2, stippleScale: 1.2, doubleSided: true },
  F4: { vertexColors: true, stipple: 0.55, stippleScale: 2.4, treeSway: true },
  F5: { color: '#ffe9a8', emissive: 0.12, nightGlow: true },
  F6: { color: '#f3dfae', stipple: 0.08, emissive: 0.25, nightGlow: true },
  F7: { localGlow: { position: [0, -1.9, 0], radius: 4.5, strength: 0.65 }, vertexColors: true, stipple: 0.12, stippleScale: 2 },
  F8: { localGlow: { position: [0, -1.9, 0], radius: 4.5, strength: 0.65 }, color: '#a47748', stipple: 0.2, stippleScale: 5 },
  F9: { vertexColors: true, stipple: 0.1, stippleScale: 4 },
  F10: { color: '#fbfbff', stipple: 0.3, stippleScale: 2.2 },
  F11: { stipple: 0.3, color: '#fbfbff', stippleScale: 2.2 },
  F12: { color: '#123456', flowers: true, strata: true, doubleSided: true, treeSway: true, nightGlow: true, localGlow: { position: [0, -1.9, 0], radius: 4.5, strength: 0.65 }, vertexColors: true },
};

function uniformValuesEqual(a, b) {
  if (a && a.isColor) return Object.is(a.r, b.r) && Object.is(a.g, b.g) && Object.is(a.b, b.b);
  if (a && a.isVector3) return Object.is(a.x, b.x) && Object.is(a.y, b.y) && Object.is(a.z, b.z);
  if (a && a.isMatrix4) return a.elements.every((v, i) => Object.is(v, b.elements[i]));
  return Object.is(a, b);
}

test('ColorManagement is disabled, before any guarded import of the original', () => {
  assert.equal(colorManagementEnabledAtImport, false);
  const source = readFileSync(new URL('../../src/materials/shared-lighting-uniforms.js', import.meta.url), 'utf8');
  const firstImport = source.split('\n').find(line => line.trim().startsWith('import '));
  assert.equal(firstImport.trim(), "import '../core/disable-three-color-management.js';");
});

test('G defaults: values and key order', () => {
  const expectedLightDir = new THREE.Vector3(0.55, 0.7, 0.45).normalize();
  for (const axis of ['x', 'y', 'z']) assert.ok(Object.is(G.uLightDir.value[axis], expectedLightDir[axis]), axis);
  const rgb = color => [color.r, color.g, color.b];
  const linearChecks = [[G.uLightColor.value, [1.04, 1, 0.92]], [G.uShadowTint.value, [0.42, 0.5, 0.72]], [G.uAmbient.value, [0.55, 0.7, 0.95]]];
  for (const [color, expected] of linearChecks) assert.deepEqual(rgb(color), expected);
  assert.equal(G.uShadowTexel.value, 1 / 2048);
  assert.deepEqual(G.uShadowMatrix.value.elements, new THREE.Matrix4().elements);
  assert.equal(G.uShadowMap.value, null);
  assert.equal(G.uFogNear.value, 110);
  assert.equal(G.uFogFar.value, 420);
  assert.equal(G.uTime.value, 0);
  const byteChecks = [
    [G.uFogColor.value, [207, 228, 242]], [G.uZenith.value, [79, 143, 222]], [G.uHorizon.value, [207, 230, 244]],
    [G.uHill.value, [94, 156, 98]], [G.uMist.value, [228, 238, 246]], [G.uSunColor.value, [255, 246, 216]],
  ];
  for (const [color, expected] of byteChecks) assert.deepEqual(rgb(color).map(c => Math.round(c * 255)), expected);
  assert.deepEqual(Object.keys(G), [
    'uLightDir', 'uLightColor', 'uShadowTint', 'uAmbient', 'uShadowMap', 'uShadowMatrix', 'uShadowTexel',
    'uFogColor', 'uFogNear', 'uFogFar', 'uTime', 'uZenith', 'uHorizon', 'uHill', 'uMist', 'uSunColor',
  ]);
});

test('bag identity and freezing', () => {
  assert.deepEqual(Object.keys(LIGHTING_UNIFORMS), [...Object.keys(G), 'uNight', 'uSaturation', 'uHeadlightPosition', 'uHeadlightDirection']);
  for (const key of Object.keys(G)) assert.equal(LIGHTING_UNIFORMS[key], G[key]);
  for (const key of ['uNight', 'uSaturation', 'uHeadlightPosition', 'uHeadlightDirection']) assert.equal(LIGHTING_UNIFORMS[key], NIGHT_UNIFORMS[key]);
  for (const key of ['uNight', 'uHeadlightPosition', 'uHeadlightDirection']) assert.equal(SHADER_NIGHT_UNIFORMS[key], NIGHT_UNIFORMS[key]);
  assert.equal(NIGHT_UNIFORMS.uNight.value, 0); assert.equal(NIGHT_UNIFORMS.uSaturation.value, 1);
  assert.deepEqual(NIGHT_UNIFORMS.uHeadlightPosition.value.toArray(), [0, 0, 0]);
  assert.deepEqual(NIGHT_UNIFORMS.uHeadlightDirection.value.toArray(), [0, 0, 1]);
  for (const bag of [G, NIGHT_UNIFORMS, SHADER_NIGHT_UNIFORMS, LIGHTING_UNIFORMS]) {
    assert.ok(Object.isFrozen(bag));
    assert.throws(() => { bag[Object.keys(bag)[0]] = {}; }, TypeError);
  }
});

test('cache semantics: identical literal and key-order variants', () => {
  assert.equal(npr(), npr({}));
  // Two separately-written, non-empty literals with the same keys/order/values still share one instance.
  assert.equal(npr({ color: '#9a6a44', strata: true }), npr({ color: '#9a6a44', strata: true }));
  assert.notEqual(npr(FIXTURES.F10), npr(FIXTURES.F11));
});

test('F12 defines, side, vertexColors, transparent and uniform set', () => {
  const material = npr(FIXTURES.F12);
  assert.deepEqual(Object.entries(material.defines), [
    ['FLOWERS', ''], ['STRATA', ''], ['DOUBLE_SIDED', ''], ['TREE_SWAY', ''], ['NIGHT_GLOW', ''], ['LOCAL_GLOW', ''],
  ]);
  assert.equal(material.side, THREE.DoubleSide);
  assert.equal(material.vertexColors, true);
  assert.equal(material.transparent, false);
  for (const key of Object.keys(G)) assert.equal(material.uniforms[key], G[key]);
  assert.equal(material.uniforms.uNight, NIGHT_UNIFORMS.uNight);
  assert.equal(material.uniforms.uHeadlightPosition, NIGHT_UNIFORMS.uHeadlightPosition);
  assert.equal(material.uniforms.uHeadlightDirection, NIGHT_UNIFORMS.uHeadlightDirection);
  assert.equal('uSaturation' in material.uniforms, false);
  assert.equal(material.uniforms.uOpacity.value, 1);
  assert.equal(Object.keys(material.uniforms).length, 27);
  assert.deepEqual(material.uniforms.uLocalGlowPosition.value.toArray(), [0, -1.9, 0]);
  assert.equal(material.uniforms.uLocalGlowRadius.value, 4.5);
  assert.equal(material.uniforms.uLocalGlowStrength.value, 0.65);
});

test('F1 defaults: no local-glow uniforms, 24 keys', () => {
  const material = npr(FIXTURES.F1);
  assert.equal(Object.keys(material.uniforms).length, 24);
  assert.equal('uLocalGlowPosition' in material.uniforms, false);
  assert.deepEqual(material.uniforms.uColor.value.toArray(), [1, 1, 1]);
  assert.equal(material.uniforms.uStipple.value, 0.1);
  assert.equal(material.uniforms.uStippleScale.value, 2);
  assert.equal(material.uniforms.uEmissive.value, 0);
});

test('GLSL interface: COMMON_GLSL equals the architecture table', () => {
  assert.ok(COMMON_GLSL.includes(HASH_AND_VALUE_NOISE_GLSL));
  assert.deepEqual(extractGlslInterface(COMMON_GLSL), COMMON_INTERFACE);
});

test('GLSL interface: NPR vertex/fragment for F1 and F12, with and without USE_* defines', () => {
  for (const id of ['F1', 'F12']) {
    const material = npr(FIXTURES[id]);
    const materialDefines = new Set(Object.keys(material.defines));
    for (const extra of [[], ['USE_INSTANCING', 'USE_COLOR', 'USE_INSTANCING_COLOR']]) {
      const active = [...materialDefines, ...extra];
      assert.deepEqual(extractGlslInterface(material.vertexShader, active), expectedVertexInterface(materialDefines), `${id} vertex`);
      assert.deepEqual(extractGlslInterface(material.fragmentShader, active), expectedFragmentInterface(materialDefines), `${id} fragment`);
    }
  }
});

test('parity: COMMON_GLSL interface matches the original', { skip }, () => {
  assert.deepEqual(extractGlslInterface(COMMON_GLSL), extractGlslInterface(original.COMMON_GLSL));
});

test('parity: G matches the original (key order and values)', { skip }, () => {
  assert.deepEqual(Object.keys(G), Object.keys(original.G));
  for (const key of Object.keys(G)) {
    assert.ok(uniformValuesEqual(G[key].value, original.G[key].value), key);
  }
});

test('parity: every fixture matches the original material', { skip }, () => {
  for (const [id, options] of Object.entries(FIXTURES)) {
    const clone = npr(options);
    const originalMaterial = original.npr(options);

    for (const extra of [[], ['USE_INSTANCING', 'USE_COLOR', 'USE_INSTANCING_COLOR']]) {
      const cloneDefines = Object.keys(clone.defines);
      const vertex = extractGlslInterface(clone.vertexShader, [...cloneDefines, ...extra]);
      const originalVertex = extractGlslInterface(originalMaterial.vertexShader, [...cloneDefines, ...extra]);
      assert.deepEqual(vertex, originalVertex, `${id} vertex interface`);
      const fragment = extractGlslInterface(clone.fragmentShader, [...cloneDefines, ...extra]);
      const originalFragment = extractGlslInterface(originalMaterial.fragmentShader, [...cloneDefines, ...extra]);
      assert.deepEqual(fragment, originalFragment, `${id} fragment interface`);
    }

    assert.deepEqual(Object.entries(clone.defines), Object.entries(originalMaterial.defines), `${id} defines`);
    assert.equal(clone.side, originalMaterial.side, `${id} side`);
    assert.equal(clone.vertexColors, originalMaterial.vertexColors, `${id} vertexColors`);
    assert.equal(clone.transparent, originalMaterial.transparent, `${id} transparent`);
    assert.equal(clone.depthWrite, originalMaterial.depthWrite, `${id} depthWrite`);
    assert.equal(clone.name, originalMaterial.name, `${id} name`);
    assert.deepEqual(Object.keys(clone.uniforms), Object.keys(originalMaterial.uniforms), `${id} uniform keys`);
    for (const key of Object.keys(clone.uniforms)) {
      assert.ok(uniformValuesEqual(clone.uniforms[key].value, originalMaterial.uniforms[key].value), `${id} uniform ${key}`);
    }
  }
});
