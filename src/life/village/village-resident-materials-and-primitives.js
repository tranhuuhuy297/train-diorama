// Building blocks for the village figures: the ten-colour palette, unit-icosphere and box parts
// (each call allocates its own geometry) and the head every resident shares.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';

/** Mirror order for paired parts: every row of a pair runs for the left side (-1), then the right (+1). */
export const SIDES = Object.freeze([-1, 1]);

// [name, colour, stipple] in creation order; npr ids follow this order and feed the opaque sort.
const RESIDENT_PALETTE = [
  ['skin', '#d8a078', 0.1],
  ['dark', '#47332b', 0.1],
  ['hair', '#713f28', 0.13],
  ['blouse', '#e1bd85', 0.1],
  ['dress', '#49847d', 0.15],
  ['apron', '#f0dfbd', 0.14],
  ['shorts', '#536d89', 0.15],
  ['dogCoat', '#b47943', 0.16],
  ['dogCream', '#ebd5a9', 0.1],
  ['collar', '#b8493b', 0.1],
];

export function createVillageResidentMaterials() {
  const materials = {};
  for (const [name, color, stipple] of RESIDENT_PALETTE) materials[name] = npr({ color, stipple });
  return materials;
}

function placeOn(parent, mesh, position) {
  mesh.position.fromArray(position);
  parent.add(mesh);
  return mesh;
}

/** Icosphere blob: radius-1 detail-1 geometry stretched by `scale`. */
export function shape(parent, material, position, scale) {
  const mesh = placeOn(parent, new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), material), position);
  mesh.scale.fromArray(scale);
  return mesh;
}

/** Box part sized by its geometry; the mesh scale stays 1. */
export function block(parent, material, position, size) {
  const [width, height, depth] = size;
  return placeOn(parent, new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material), position);
}

const PART_BUILDERS = { shape, block };

/**
 * Emits rows `[kind, materialName, [x, y, z], dims]` in order onto `parent`.
 * With a `side`, x is mirrored as side·x; without one, positions are used untouched.
 */
export function addPartRows(parent, materials, rows, side = null) {
  for (const [kind, materialName, [x, y, z], dims] of rows) {
    const position = [side === null ? x : side * x, y, z];
    PART_BUILDERS[kind](parent, materials[materialName], position, dims);
  }
}

/** Runs the same rows once per side, left then right. */
export function addMirroredRows(parent, materials, rows) {
  for (const side of SIDES) addPartRows(parent, materials, rows, side);
}

const SKULL_AND_CAP = [
  ['shape', 'skin', [0, 0.19, 0], [0.22, 0.27, 0.22]],
  ['shape', 'hair', [0, 0.35, -0.03], [0.23, 0.14, 0.22]],
];
// Ear, eye and brow, mirrored.
const PAIRED_FEATURES = [
  ['shape', 'skin', [0.21, 0.19, 0], [0.055, 0.075, 0.055]],
  ['shape', 'dark', [0.08, 0.23, 0.205], [0.025, 0.033, 0.022]],
  ['block', 'hair', [0.08, 0.29, 0.204], [0.075, 0.025, 0.025]],
];
const NOSE_AND_MOUTH = [
  ['shape', 'skin', [0, 0.16, 0.23], [0.055, 0.065, 0.07]],
  ['block', 'dark', [0, 0.075, 0.203], [0.075, 0.018, 0.02]],
];

/** Head pivot on `body` at y = height (attached before its 11 parts are added). */
export function makeHead(body, skin, hair, dark, height) {
  const head = new THREE.Group();
  head.position.y = height;
  body.add(head);
  const materials = { skin, hair, dark };
  addPartRows(head, materials, SKULL_AND_CAP);
  addMirroredRows(head, materials, PAIRED_FEATURES);
  addPartRows(head, materials, NOSE_AND_MOUTH);
  return head;
}
