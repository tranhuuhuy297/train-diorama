// Singleton uniform bag shared by reference across every material here, so a writer's mutation is visible everywhere without a rebinding pass.
import '../core/disable-three-color-management.js';
import * as THREE from 'three';

export const NIGHT_LIGHT_GLOW_MATERIAL_NAME = 'night-light-glow';

// Shared by the headlight cone and the glow sprites: both must stay transparent/no-depth-write,
// or mergeStaticGeometry would bake them into an opaque batch.
export const ADDITIVE_GLOW_RENDER_STATE = Object.freeze({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
});

export const G = Object.freeze({
  uLightDir: { value: new THREE.Vector3(0.55, 0.7, 0.45).normalize() },
  uLightColor: { value: new THREE.Color(1.04, 1.0, 0.92) },
  uShadowTint: { value: new THREE.Color(0.42, 0.5, 0.72) },
  uAmbient: { value: new THREE.Color(0.55, 0.7, 0.95) },
  uShadowMap: { value: null },
  uShadowMatrix: { value: new THREE.Matrix4() },
  uShadowTexel: { value: 1 / 2048 },
  uFogColor: { value: new THREE.Color('#cfe4f2') },
  uFogNear: { value: 110 },
  uFogFar: { value: 420 },
  uTime: { value: 0 },
  uZenith: { value: new THREE.Color('#4f8fde') },
  uHorizon: { value: new THREE.Color('#cfe6f4') },
  uHill: { value: new THREE.Color('#5e9c62') },
  uMist: { value: new THREE.Color('#e4eef6') },
  uSunColor: { value: new THREE.Color('#fff6d8') },
});

export const NIGHT_UNIFORMS = Object.freeze({
  uNight: { value: 0 },
  uSaturation: { value: 1 },
  uHeadlightPosition: { value: new THREE.Vector3(0, 0, 0) },
  uHeadlightDirection: { value: new THREE.Vector3(0, 0, 1) },
});

// A view onto the three shader-facing NIGHT_UNIFORMS entries (post alone reads uSaturation).
export const SHADER_NIGHT_UNIFORMS = Object.freeze({
  uNight: NIGHT_UNIFORMS.uNight,
  uHeadlightPosition: NIGHT_UNIFORMS.uHeadlightPosition,
  uHeadlightDirection: NIGHT_UNIFORMS.uHeadlightDirection,
});

export const LIGHTING_UNIFORMS = Object.freeze({ ...G, ...NIGHT_UNIFORMS });
