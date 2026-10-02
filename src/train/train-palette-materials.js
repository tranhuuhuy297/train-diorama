// Train palette. Each npr option literal (keys, key order, values) is a cache identity, so it decides
// which parts share a material and therefore a merge batch and a draw call.
import '../core/disable-three-color-management.js';
import * as THREE from 'three';
import { npr } from '../materials/npr-cel-material-factory.js';

/** Coach body colours in car order: maroon, maroon, green, maroon. */
export const COACH_COLORS = Object.freeze(['#7a3b2c', '#7a3b2c', '#2f6150', '#7a3b2c']);

// Creation order fixes material ids (the opaque sort key); the cab glass slots in after the lamp lens.
const LOCOMOTIVE_PALETTE = [
  ['black', { color: '#2b2a33', stipple: 0.08 }],
  ['red', { color: '#d23a2c', stipple: 0.1, stippleScale: 3 }],
  ['supportRed', { color: '#a92d28', stipple: 0.08, stippleScale: 3 }],
  ['gold', { color: '#f0c150', stipple: 0.05 }],
  ['silver', { color: '#bfc4ca', stipple: 0.06 }],
  ['roofMaterial', { color: '#3d3a45', stipple: 0.1 }],
  ['glow', { color: '#ffe9a8', emissive: 0.12, nightGlow: true }],
  ['cabGlass', null],
  ['driverCoat', { color: '#3f7282', stipple: 0.12, stippleScale: 3 }],
  ['driverSkin', { color: '#d6a37d', stipple: 0.08 }],
  ['driverHat', { color: '#353944', stipple: 0.08 }],
  ['ravenFeathers', { color: '#171e2b', stipple: 0.04 }],
  ['ravenWings', { color: '#283344', stipple: 0.04 }],
];

const COACH_PALETTE = [
  ['cream', { color: '#f3dfae', stipple: 0.08, emissive: 0.25, nightGlow: true }],
  ['gray', { color: '#5e5864', stipple: 0.1 }],
  ['windowBar', { color: '#4c332b', stipple: 0.1 }],
];

function createCabGlass() {
  return new THREE.MeshBasicMaterial({
    color: '#c5e3ee', transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide,
  });
}

function buildPalette(entries) {
  const materials = {};
  for (const [key, options] of entries) materials[key] = options ? npr(options) : createCabGlass();
  return materials;
}

/** The 13 locomotive/driver/raven materials, created in palette order. */
export function createTrainMaterials() {
  return buildPalette(LOCOMOTIVE_PALETTE);
}

/** cream, gray, windowBar, in that order. */
export function createCoachMaterials() {
  return buildPalette(COACH_PALETTE);
}

export function createCoachBodyMaterial(color) {
  return npr({ color, stipple: 0.1, stippleScale: 3 });
}
