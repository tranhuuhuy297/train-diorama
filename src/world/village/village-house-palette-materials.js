// Every material and shared geometry the cottages use, made on demand in one fixed order: material
// ids feed the opaque draw sort, and each npr option literal keeps its key order (cache identity).
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { jitter } from '../../geometry/procedural-geometry-helpers.js';

// Roof tint per house, picked by (house number mod 5).
export const ROOF_COLORS = Object.freeze(['#d24f3a', '#4d79b8', '#e38b3b', '#c44d6a', '#5b9a6a']);

// Icosahedron with a sin-hash wobble and smoothed normals, shared by every chimney puff.
function lumpyPuffGeometry() {
  const geometry = jitter(new THREE.IcosahedronGeometry(0.35, 1), 0.25, 7);
  geometry.computeVertexNormals();
  return geometry;
}

// [palette key, maker], evaluated top to bottom.
const PALETTE_RECIPE = [
  ['cream', () => npr({ color: '#f3e7cc', stipple: 0.15, stippleScale: 2 })],
  ['roofs', () => ROOF_COLORS.map(color => npr({ color, stipple: 0.18, stippleScale: 3 }))],
  ['dark', () => npr({ color: '#5a3b2a', stipple: 0.1 })],
  ['windowMaterial', () => npr({ color: '#ffe6a0', emissive: 0.55, nightGlow: true })],
  ['shutterWood', () => npr({ color: '#765039', stipple: 0.16, stippleScale: 3 })],
  ['shutterPanel', () => npr({ color: '#a67850', stipple: 0.12, stippleScale: 3 })],
  ['shutterGeometry', () => new THREE.BoxGeometry(0.25, 0.82, 0.045)],
  ['shutterPanelGeometry', () => new THREE.BoxGeometry(0.18, 0.66, 0.012)],
  ['smokeGeometry', lumpyPuffGeometry],
  ['smokeMaterial', () => npr({ color: '#e4dfd5', stipple: 0.1, emissive: 0.25 })],
  ['stone', () => npr({ color: '#b6ad94', stipple: 0.18 })],
  ['flowerLeaves', () => npr({ color: '#477d42', stipple: 0.12 })],
  ['flowerPetals', () => npr({ color: '#eeb581', stipple: 0.08 })],
  ['flowerGeometry', () => new THREE.IcosahedronGeometry(0.065, 0)],
];

/** One palette per village build; shutter, flower and puff geometries are shared by every house. */
export function createVillagePalette() {
  const palette = {};
  for (const [key, make] of PALETTE_RECIPE) palette[key] = make();
  return palette;
}
