// Three named lighting palettes plus the 3s smoothstep blend between them, all written
// in place into the shared uniform bag so no consumer ever needs a rebinding pass.
import '../core/disable-three-color-management.js';
import * as THREE from 'three';

export const TIME_OF_DAY_TRANSITION_SECONDS = 3;

// Fixed write/read order for every loop below (never Object.entries, never per-frame alloc).
const PALETTE_KEYS = Object.freeze([
  'uNight', 'uSaturation', 'uLightDir', 'uLightColor', 'uShadowTint', 'uAmbient',
  'uFogColor', 'uZenith', 'uHorizon', 'uHill', 'uMist', 'uSunColor',
]);

const rgb = (r, g, b) => new THREE.Color(r, g, b);
const dir = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

export const PALETTES = Object.freeze({
  day: Object.freeze({
    uNight: 0, uSaturation: 1, uLightDir: dir(0.55, 0.72, 0.42), uLightColor: rgb(1.04, 1.0, 0.92),
    uShadowTint: rgb(0.5, 0.57, 0.78), uAmbient: rgb(0.55, 0.7, 0.95), uFogColor: new THREE.Color('#cfe4f2'),
    uZenith: new THREE.Color('#4f8fde'), uHorizon: new THREE.Color('#cfe6f4'), uHill: new THREE.Color('#5e9c62'),
    uMist: new THREE.Color('#e4eef6'), uSunColor: new THREE.Color('#fff6d8'),
  }),
  evening: Object.freeze({
    uNight: 0, uSaturation: 1, uLightDir: dir(-0.72, 0.36, 0.4), uLightColor: rgb(1.22, 0.96, 0.72),
    uShadowTint: rgb(0.46, 0.38, 0.64), uAmbient: rgb(0.95, 0.62, 0.7), uFogColor: new THREE.Color('#f2c6a6'),
    uZenith: new THREE.Color('#6b76c4'), uHorizon: new THREE.Color('#fbc596'), uHill: new THREE.Color('#8c7488'),
    uMist: new THREE.Color('#f6d6c6'), uSunColor: new THREE.Color('#ffe0a0'),
  }),
  night: Object.freeze({
    uNight: 1, uSaturation: 2.5, uLightDir: dir(-0.42, 0.8, -0.3), uLightColor: rgb(0.44, 0.56, 0.76),
    uShadowTint: rgb(0.22, 0.31, 0.48), uAmbient: rgb(0.26, 0.34, 0.52), uFogColor: new THREE.Color('#344968'),
    uZenith: new THREE.Color('#172740'), uHorizon: new THREE.Color('#405575'), uHill: new THREE.Color('#2d4261'),
    uMist: new THREE.Color('#354966'), uSunColor: new THREE.Color('#d5e4f7'),
  }),
});

// Writes a palette into the live uniform bag in place (identity preserved); no renormalization
// needed since every palette uLightDir is already unit length.
export function applyPalette(uniforms, id) {
  const palette = PALETTES[id];
  for (let i = 0; i < PALETTE_KEYS.length; i++) {
    const key = PALETTE_KEYS[i];
    const source = palette[key];
    if (typeof source === 'number') uniforms[key].value = source;
    else uniforms[key].value.copy(source);
  }
}

// Snapshots the bag's current values as the transition's start pose; target stays a
// reference to the palette itself (palettes are read-only by convention, never mutated).
export function beginPaletteTransition(uniforms, id) {
  const start = {};
  for (let i = 0; i < PALETTE_KEYS.length; i++) {
    const key = PALETTE_KEYS[i];
    const value = uniforms[key].value;
    start[key] = typeof value === 'number' ? value : value.clone();
  }
  return { start, target: PALETTES[id], elapsed: 0 };
}

// Advances by unclamped real dt (keeps blending while the sim is paused); null once it completes.
export function stepPaletteTransition(uniforms, transition, realDt) {
  if (transition === null) return null;
  transition.elapsed = Math.min(TIME_OF_DAY_TRANSITION_SECONDS, transition.elapsed + realDt);
  const p = transition.elapsed / TIME_OF_DAY_TRANSITION_SECONDS;
  const eased = p * p * (3 - 2 * p);
  const { start, target } = transition;
  for (let i = 0; i < PALETTE_KEYS.length; i++) {
    const key = PALETTE_KEYS[i];
    const targetValue = target[key];
    if (typeof targetValue === 'number') {
      uniforms[key].value = THREE.MathUtils.lerp(start[key], targetValue, eased);
    } else {
      uniforms[key].value.copy(start[key]).lerp(targetValue, eased);
    }
  }
  uniforms.uLightDir.value.normalize();
  return p === 1 ? null : transition;
}
