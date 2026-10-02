// Coal tender: frame and water tank, a coal floor with a low heap, red coping rails and four small wheels.
import * as THREE from 'three';
import { SIDES, addParts } from './train-mesh-helpers.js';
import { addSmallWheel } from './rolling-stock-wheel-builders.js';

const TENDER_LENGTH = 2.7;

const TANK_AND_COAL = [
  ['box', [1.4, 0.3, 2.6], 'black', 0, 0.7, 0],
  ['box', [1.5, 1.0, 2.5], 'red', 0, 1.35, 0],
  ['plane', [1.46, 2.46], 'black', 0, 1.857, 0, { bake: ['rotateX', -Math.PI / 2] }],
  ['ico', [0.5, 1], 'black', 0, 1.9, 0, { bake: ['scale', 1.4, 0.35, 2.2] }],
];

// Per side: top rail along the tank, then three upright ribs.
const COPING_SIDE = [
  ['box', [0.12, 0.12, 2.62], 'supportRed', 0.79, 1.88, 0],
  ['box', [0.12, 0.9, 0.12], 'supportRed', 0.79, 1.36, [-1.08, 0, 1.08]],
];

const END_RAILS = [['box', [1.64, 0.12, 0.12], 'supportRed', 0, 1.88, [-1.27, 1.27]]];

export function buildTender(m) {
  const tender = new THREE.Group();
  addParts(tender, m, TANK_AND_COAL);
  for (const side of SIDES) addParts(tender, m, COPING_SIDE, { side });
  addParts(tender, m, END_RAILS);
  const wheels = [];
  for (const x of [-0.66, 0.66]) {
    for (const z of [0.7, -0.7]) wheels.push(addSmallWheel(tender, m, x, z));
  }
  return { obj: tender, len: TENDER_LENGTH, offset: 0, wheels };
}
