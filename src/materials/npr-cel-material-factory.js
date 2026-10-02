// Cached factory for the cel-shaded NPR ShaderMaterial, keyed by exact option-literal JSON so matching call sites share one instance.
import * as THREE from 'three';
import { G, SHADER_NIGHT_UNIFORMS } from './shared-lighting-uniforms.js';
import { NPR_VERTEX_SHADER } from './glsl/npr-vertex-shader-glsl.js';
import { NPR_FRAGMENT_SHADER } from './glsl/npr-fragment-shader-glsl.js';

const materialCache = new Map();

// Flag -> define name, in insertion order; only truthy options add their define.
const DEFINE_FLAGS = [
  ['flowers', 'FLOWERS'],
  ['strata', 'STRATA'],
  ['doubleSided', 'DOUBLE_SIDED'],
  ['treeSway', 'TREE_SWAY'],
  ['nightGlow', 'NIGHT_GLOW'],
  ['localGlow', 'LOCAL_GLOW'],
];

// Appended after the material exists, so these three keys sort last in uniforms key order.
function localGlowUniforms({ position, radius, strength }) {
  return {
    uLocalGlowPosition: { value: new THREE.Vector3(...position) },
    uLocalGlowRadius: { value: radius },
    uLocalGlowStrength: { value: strength },
  };
}

// Returns the cached material for this exact option literal, building one on a cache miss.
export function npr(options = {}) {
  const key = JSON.stringify(options);
  const cached = materialCache.get(key);
  if (cached) return cached;

  const defines = {};
  for (const [flag, define] of DEFINE_FLAGS) {
    if (options[flag]) defines[define] = '';
  }

  const material = new THREE.ShaderMaterial({
    vertexShader: NPR_VERTEX_SHADER,
    fragmentShader: NPR_FRAGMENT_SHADER,
    defines,
    vertexColors: !!options.vertexColors,
    side: options.doubleSided ? THREE.DoubleSide : THREE.FrontSide,
    uniforms: {
      ...G,
      ...SHADER_NIGHT_UNIFORMS,
      uColor: { value: new THREE.Color(options.color ?? '#ffffff') },
      uStipple: { value: options.stipple ?? 0.1 },
      uStippleScale: { value: options.stippleScale ?? 2.0 },
      uEmissive: { value: options.emissive ?? 0 },
      uOpacity: { value: 1 },
    },
  });

  if (options.localGlow) Object.assign(material.uniforms, localGlowUniforms(options.localGlow));

  materialCache.set(key, material);
  return material;
}
