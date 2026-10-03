// Clothing for the two residents. The woman: shorter, standing closer to her door, in a lathe-turned
// dress with collar, puff sleeves, side hair locks, a wrap-around apron and a belt. The man: bare torso,
// box shorts with a belt and a hair tuft.
import * as THREE from 'three';
import { SIDES, shape, addPartRows, addMirroredRows } from './village-resident-materials-and-primitives.js';

// Garments are squashed front to back so the round lathes read as flat figures.
const GARMENT_DEPTH = 0.78;
// (radius, height) profiles turned around the body axis.
const DRESS_PROFILE = [
  [0, 0.35], [0.39, 0.35], [0.45, 0.46], [0.46, 0.64], [0.42, 0.82], [0.34, 0.96],
  [0.38, 1.13], [0.36, 1.28], [0.27, 1.38], [0.15, 1.42], [0, 1.42],
];
const APRON_PROFILE = [[0.447, 0.43], [0.477, 0.64], [0.437, 0.82], [0.357, 0.96]];
// Front arc the apron covers.
const APRON_START = -0.7;
const APRON_SWEEP = 1.4;
const BELT = { radius: 0.357, height: 0.055, y: 0.96 };

const toProfile = rows => rows.map(([radius, height]) => new THREE.Vector2(radius, height));

function addGarment(body, geometry, material) {
  const garment = new THREE.Mesh(geometry, material);
  garment.scale.z = GARMENT_DEPTH;
  body.add(garment);
  return garment;
}

/** Resident 0: frontOffset 0.65, figure y-scale ×0.7 and the full outfit, in insertion order. */
export function dressVillageWoman(woman, materials) {
  woman.frontOffset = 0.65;
  woman.figure.scale.y *= 0.7;
  addGarment(woman.body, new THREE.LatheGeometry(toProfile(DRESS_PROFILE), 16), materials.dress);
  for (const side of SIDES) {
    shape(woman.body, materials.blouse, [side * 0.1, 1.365, 0.17], [0.11, 0.045, 0.075]);
    shape(woman.arms[(side + 1) / 2], materials.dress, [0, -0.08, 0], [0.155, 0.17, 0.15]);
    shape(woman.head, materials.hair, [side * 0.185, 0.18, -0.045], [0.09, 0.24, 0.19]);
  }
  addGarment(woman.body, new THREE.LatheGeometry(toProfile(APRON_PROFILE), 10, APRON_START, APRON_SWEEP), materials.apron);
  const belt = addGarment(woman.body, new THREE.CylinderGeometry(BELT.radius, BELT.radius, BELT.height, 16), materials.apron);
  belt.position.y = BELT.y;
}

const TORSO = [['shape', 'skin', [0, 1.08, 0], [0.34, 0.36, 0.23]]];
// Chest muscle then shorts leg, mirrored.
const CHEST_AND_SHORTS = [
  ['shape', 'skin', [0.15, 1.25, 0.08], [0.2, 0.18, 0.19]],
  ['block', 'shorts', [0.16, 0.65, 0], [0.29, 0.36, 0.3]],
];
const WAIST_BELT = [['block', 'dark', [0, 0.835, 0], [0.59, 0.055, 0.31]]];
const HAIR_TUFT = [['shape', 'hair', [0.045, 0.42, -0.01], [0.19, 0.12, 0.19]]];

/** Resident 1: torso, paired chest and shorts, belt, then the tuft on the head. */
export function dressVillageMan(man, materials) {
  addPartRows(man.body, materials, TORSO);
  addMirroredRows(man.body, materials, CHEST_AND_SHORTS);
  addPartRows(man.body, materials, WAIST_BELT);
  addPartRows(man.head, materials, HAIR_TUFT);
}
