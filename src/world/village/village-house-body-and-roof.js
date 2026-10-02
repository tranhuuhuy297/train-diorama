// Cottage shell (walls, prism roof, vents, ridge, chimney) and the front door with its trim, in the
// house's local frame: origin on the ground at the centre, +Z = the facade that faces the pond.
import * as THREE from 'three';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { addWallVent, addRoofVent } from '../../geometry/building-wall-and-roof-vents.js';

const SIDES = [-1, 1];

/** Chimney centre on the roof: a quarter width to the right, a fifth of the depth toward the back. */
export function chimneyCentre({ width, depth }) {
  return { x: width * 0.25, z: -depth * 0.2 };
}

// Three-sided cylinder lying along Z: a gable prism, stretched to the walls' width plus overhang.
function addRoofPrism(house, { width, depth, wallHeight: wallTop }, material) {
  const prism = new THREE.CylinderGeometry(1, 1, depth + 0.4, 3);
  prism.rotateX(-Math.PI / 2);
  const gable = new THREE.Mesh(prism, material);
  gable.scale.set((width + 0.4) / 1.732, 0.75, 1);
  gable.position.set(0, wallTop + 0.36, 0);
  house.add(gable);
}

/** Walls (sunk 1 unit below ground), roof, side and back vents, ridge, roof vent and chimney stack. */
export function addHouseShell(house, dims, palette, houseNumber) {
  const { width, depth, wallHeight: wallTop } = dims;
  const { cream, dark, shutterWood, roofs } = palette;
  box(width, wallTop + 1, depth, cream, 0, (wallTop - 1) / 2, 0, house);
  addRoofPrism(house, dims, roofs[houseNumber % roofs.length]);
  for (const side of SIDES) {
    const ventPosition = new THREE.Vector3(side * (width / 2 + 0.04), wallTop * 0.65, -depth * 0.18);
    addWallVent(house, ventPosition, (side * Math.PI) / 2, shutterWood, dark);
  }
  addWallVent(house, new THREE.Vector3(0, wallTop * 0.7, -depth / 2 - 0.04), Math.PI, shutterWood, dark);
  const ridgeY = wallTop + 1.12;
  box(0.13, 0.09, depth + 0.44, dark, 0, ridgeY, 0, house);
  addRoofVent(house, new THREE.Vector3(0, ridgeY, depth * 0.22), dark);
  const chimney = chimneyCentre(dims);
  box(0.3, 0.9, 0.3, dark, chimney.x, wallTop + 0.9, chimney.z, house);
}

// Door-and-trim parts as [size, palette key, position]; a side's corner post and eave beam stay adjacent.
function doorAndTrimParts({ width, depth, wallHeight: wallTop }) {
  const facade = depth / 2;
  const chimney = chimneyCentre({ width, depth });
  const parts = [
    [[0.55, 0.95, 0.06], 'dark', [0, 0.45, facade + 0.01]],
    [[0.4, 0.65, 0.025], 'shutterWood', [0, 0.48, facade + 0.055]],
    [[0.06, 0.06, 0.06], 'flowerPetals', [-0.17, 0.47, facade + 0.09]],
    [[0.8, 0.14, 0.4], 'stone', [0, 0.02, facade + 0.18]],
    [[width + 0.06, 0.16, 0.1], 'stone', [0, 0.02, facade + 0.025]],
    [[0.4, 0.1, 0.4], 'dark', [chimney.x, wallTop + 1.3, chimney.z]],
  ];
  for (const side of SIDES) {
    parts.push([[0.12, wallTop, 0.08], 'shutterWood', [side * (width / 2 - 0.07), wallTop / 2, facade + 0.045]]);
    parts.push([[0.12, 0.12, depth + 0.32], 'shutterWood', [side * (width / 2 + 0.08), wallTop, 0]]);
  }
  return parts;
}

/** Door, inset panel, knob, doorstep, plinth strip, chimney cap, then corner posts and eave beams. */
export function addHouseDoorAndTrim(house, dims, palette) {
  for (const [[w, h, d], key, [x, y, z]] of doorAndTrimParts(dims)) box(w, h, d, palette[key], x, y, z, house);
}
