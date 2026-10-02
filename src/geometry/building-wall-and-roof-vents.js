// Louvred wall vent and capped roof vent shared by the station and village houses.
// Each vent is its own Group, attached to the parent only after its parts are built.
import * as THREE from 'three';
import { box } from './procedural-geometry-helpers.js';

const SLAT_COUNT = 5;
const SLAT_TILT = 0.3;

// Wall-vent box parts: [width, height, depth, y, z, which material]; slats are added between.
const VENT_FRAME = [0.64, 0.52, 0.08, 0, 0, 'frame'];
const VENT_RECESS = [0.51, 0.39, 0.035, 0, 0.052, 'dark'];
const VENT_HOOD = [0.73, 0.055, 0.18, 0.29, 0.045, 'frame'];

function ventBox(group, [width, height, depth, y, z, role], materials) {
  return box(width, height, depth, materials[role], 0, y, z, group);
}

/** Frame, dark recess, five tilted slats and a drip hood, facing local +Z after `rotationY`. */
export function addWallVent(parent, position, rotationY, frameMaterial, darkMaterial) {
  const louvre = new THREE.Group();
  louvre.position.copy(position);
  louvre.rotation.y = rotationY;
  const materials = { frame: frameMaterial, dark: darkMaterial };
  ventBox(louvre, VENT_FRAME, materials);
  ventBox(louvre, VENT_RECESS, materials);
  for (let slat = 0; slat < SLAT_COUNT; slat++) {
    ventBox(louvre, [0.5, 0.045, 0.085, -0.15 + slat * 0.075, 0.085, 'frame'], materials).rotation.x = SLAT_TILT;
  }
  ventBox(louvre, VENT_HOOD, materials);
  parent.add(louvre);
}

// Mesh over a fresh geometry, lifted to height y inside the vent group.
function stackedPart(group, geometry, material, y) {
  const part = new THREE.Mesh(geometry, material);
  part.position.y = y;
  group.add(part);
}

/** Square base plate, tapered 8-sided pipe and a conical rain cap. */
export function addRoofVent(parent, position, material) {
  const stack = new THREE.Group();
  stack.position.copy(position);
  ventBox(stack, [0.42, 0.06, 0.42, 0, 0, 'plate'], { plate: material });
  stackedPart(stack, new THREE.CylinderGeometry(0.085, 0.11, 0.42, 8), material, 0.2);
  stackedPart(stack, new THREE.ConeGeometry(0.23, 0.16, 8), material, 0.47);
  parent.add(stack);
}
