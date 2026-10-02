// Per-object key builders for scene signatures: quantised uniform/material/geometry/instance keys.
// Shader source text is deliberately absent; GLSL parity is judged by rendered output elsewhere.
import { hashNumbers, hashString, quantise } from './quantised-number-hashing.mjs';

export const FINE_SCALE = 1e6;
const ATTRIBUTE_SCALE = 1e5;

// Lighting/night uniforms are shared singletons whose binding differs per build; they say nothing about a mesh.
export const SHARED_UNIFORM_NAMES = Object.freeze([
  'uLightDir', 'uLightColor', 'uShadowTint', 'uAmbient', 'uShadowMap', 'uShadowMatrix', 'uShadowTexel', 'uFogColor',
  'uFogNear', 'uFogFar', 'uTime', 'uZenith', 'uHorizon', 'uHill', 'uMist', 'uSunColor',
  'uNight', 'uSaturation', 'uHeadlightPosition', 'uHeadlightDirection',
]);
const SHARED_UNIFORMS = new Set(SHARED_UNIFORM_NAMES);

const fine = value => quantise(value, FINE_SCALE);

function textureKey(texture) {
  const image = texture.image;
  return {
    texture: texture.constructor.name, colorSpace: texture.colorSpace, anisotropy: texture.anisotropy,
    minFilter: texture.minFilter, magFilter: texture.magFilter,
    image: image ? {
      width: image.width ?? null, height: image.height ?? null,
      data: image.data ? hashNumbers(image.data, 1) : null,
      operations: image.operations ? hashString(JSON.stringify(image.operations)) : null,
    } : null,
  };
}

function serialize(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return fine(value);
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (value.isColor) return ['color', fine(value.r), fine(value.g), fine(value.b)];
  if (value.isVector2 || value.isVector3 || value.isVector4 || value.isQuaternion) return value.toArray().map(fine);
  if (value.isMatrix3 || value.isMatrix4) return hashNumbers(value.elements, FINE_SCALE);
  if (value.isTexture) return textureKey(value);
  if (ArrayBuffer.isView(value)) return hashNumbers(value, FINE_SCALE);
  return { object: value.constructor?.name ?? 'Object' };
}

export function materialKey(material) {
  if (Array.isArray(material)) return material.map(materialKey);
  const key = {
    type: material.type, name: material.name, side: material.side, transparent: material.transparent,
    opacity: fine(material.opacity), blending: material.blending, depthWrite: material.depthWrite,
    depthTest: material.depthTest, colorWrite: material.colorWrite, vertexColors: material.vertexColors,
    toneMapped: material.toneMapped,
    defines: Object.keys(material.defines ?? {}).sort().map(name => [name, serialize(material.defines[name])]),
    color: serialize(material.color), map: serialize(material.map),
  };
  if (material.isShaderMaterial) {
    const names = Object.keys(material.uniforms).filter(name => !SHARED_UNIFORMS.has(name)).sort();
    key.uniforms = names.map(name => [name, serialize(material.uniforms[name]?.value)]);
  }
  return key;
}

function attributeValues(attribute) {
  if (!attribute.isInterleavedBufferAttribute) return attribute.array;
  const { count, itemSize } = attribute;
  const values = new Float64Array(count * itemSize);
  for (let item = 0; item < count; item++) {
    for (let component = 0; component < itemSize; component++) values[item * itemSize + component] = attribute.getComponent(item, component);
  }
  return values;
}

export function geometryKey(geometry) {
  const attributes = {};
  for (const name of Object.keys(geometry.attributes).sort()) {
    const attribute = geometry.attributes[name];
    attributes[name] = {
      itemSize: attribute.itemSize, count: attribute.count, normalized: attribute.normalized,
      hash: hashNumbers(attributeValues(attribute), ATTRIBUTE_SCALE),
    };
  }
  const { index, drawRange } = geometry;
  return {
    type: geometry.type,
    index: index ? { count: index.count, hash: hashNumbers(index.array, 1) } : null,
    drawRange: [drawRange.start, Number.isFinite(drawRange.count) ? drawRange.count : 'Infinity'],
    groups: geometry.groups.length,
    attributes,
  };
}

export function instancesKey(mesh) {
  const { count, instanceMatrix, instanceColor } = mesh;
  return {
    count,
    matrices: hashNumbers(instanceMatrix.array.subarray(0, count * 16), FINE_SCALE),
    colors: instanceColor ? hashNumbers(instanceColor.array.subarray(0, count * 3), ATTRIBUTE_SCALE) : null,
  };
}
