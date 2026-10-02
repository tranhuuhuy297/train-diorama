// The two front windows of a cottage: frame, lit pane, mullion, sill, flower box with blooms and a
// pair of hinged shutters, plus one facade-facing night halo per window.
import * as THREE from 'three';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { createLightGlows } from '../../effects/night-light-glow-sprites.js';

// Open angles (rad); each shutter picks one from the house number, window and side.
export const SHUTTER_ANGLES = Object.freeze([0.18, 0.55, 1.05, 1.42]);
const SIDES = [-1, 1];
const FLOWER_OFFSETS = [-0.16, 0, 0.16];

// Box parts per window: [w, h, d, palette key, y offset from the window centre, z offset from the facade].
const WINDOW_BOXES = [
  [0.52, 0.86, 0.08, 'dark', 0, 0.04],
  [0.38, 0.72, 0.04, 'windowMaterial', 0, 0.09],
  [0.04, 0.72, 0.025, 'dark', 0, 0.12],
  [0.6, 0.075, 0.22, 'cream', -0.45, 0.12],
  [0.55, 0.17, 0.23, 'shutterWood', -0.55, 0.16],
  [0.46, 0.09, 0.16, 'flowerLeaves', -0.43, 0.17],
];

/** Index into SHUTTER_ANGLES; cycles through all four every four houses. */
export function shutterAngleIndex(houseNumber, windowIndex, side) {
  return (3 * houseNumber + 2 * windowIndex + (side + 1) / 2) % SHUTTER_ANGLES.length;
}

// Window centres along the facade: left (index 0) then right (index 1).
const windowCentres = ({ width, wallHeight }) => [-width * 0.3, width * 0.3].map(x => ({ x, y: wallHeight * 0.6 }));

/** One instanced halo mesh for both windows; it joins the house and stays out of the shadow pass. */
export function addHouseWindowGlows(world, house, dims) {
  const lights = windowCentres(dims).map(({ x, y }) => ({
    position: [x, y, dims.depth / 2 + 0.24], size: [1.65, 2.0], normal: [0, 0, 1], strength: 0.18,
  }));
  const halos = createLightGlows(lights);
  house.add(halos);
  world.noShadow.push(halos);
  return halos;
}

// Hinge group with the leaf and its raised panel, swung open by the picked angle.
function addShutter(house, palette, hinge, side, openAngle) {
  const pivot = new THREE.Group();
  pivot.position.set(hinge.x, hinge.y, hinge.z);
  pivot.rotation.y = side * openAngle;
  const leafX = -side * 0.125;
  const leaf = new THREE.Mesh(palette.shutterGeometry, palette.shutterWood);
  leaf.position.x = leafX;
  pivot.add(leaf);
  const panel = new THREE.Mesh(palette.shutterPanelGeometry, palette.shutterPanel);
  panel.position.set(leafX, 0, 0.032);
  pivot.add(panel);
  house.add(pivot);
}

/** Both windows in order, each fully built (boxes, flowers, shutters) before the next starts. */
export function addHouseWindows(house, dims, palette, houseNumber) {
  const facade = dims.depth / 2;
  windowCentres(dims).forEach(({ x, y }, windowIndex) => {
    for (const [w, h, d, key, dy, dz] of WINDOW_BOXES) box(w, h, d, palette[key], x, y + dy, facade + dz, house);
    for (const offset of FLOWER_OFFSETS) {
      const bloom = new THREE.Mesh(palette.flowerGeometry, palette.flowerPetals);
      bloom.position.set(x + offset, y - 0.36, facade + 0.2);
      house.add(bloom);
    }
    for (const side of SIDES) {
      const hinge = { x: x + side * 0.27, y, z: facade + 0.145 };
      addShutter(house, palette, hinge, side, SHUTTER_ANGLES[shutterAngleIndex(houseNumber, windowIndex, side)]);
    }
  });
}
