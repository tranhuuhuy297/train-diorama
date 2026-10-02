// The static cab crew: a driver in coat and cap, and a raven perched by his shoulder (its own group).
import * as THREE from 'three';
import { SIDES, add, addParts, boxGeometry } from './train-mesh-helpers.js';

const QUARTER_TURN = Math.PI / 2;

const HIPS = [['ico', [0.25, 1], 'black', 0, 1.71, -1.42, { scale: [1.02, 0.7, 0.82] }]];

// Per side: leg, raised arm, hand.
const LIMBS_SIDE = [
  ['box', [0.16, 0.42, 0.18], 'black', 0.14, 1.46, -1.42],
  ['box', [0.13, 0.38, 0.14], 'driverCoat', 0.27, 2.02, -1.3, { rotX: -0.35 }],
  ['ico', [0.08, 1], 'driverSkin', 0.28, 1.85, -1.06],
];

// Torso, head, squashed cap, visor and cap badge.
const TORSO_AND_CAP = [
  ['ico', [0.36, 1], 'driverCoat', 0, 2.04, -1.42, { scale: [0.78, 0.95, 0.65] }],
  ['ico', [0.18, 1], 'driverSkin', 0, 2.48, -1.4],
  ['ico', [0.2, 1], 'driverHat', 0, 2.62, -1.43, { scale: [1, 0.48, 1] }],
  ['box', [0.27, 0.035, 0.15], 'driverHat', 0, 2.6, -1.26],
  ['box', [0.07, 0.04, 0.025], 'gold', 0, 2.64, -1.265],
];

// Per side: eye, brace, ear, coat button.
const FACE_AND_COAT_SIDE = [
  ['ico', [0.019, 0], 'black', 0.062, 2.5, -1.24],
  ['box', [0.045, 0.25, 0.025], 'silver', 0.11, 2.13, -1.22],
  ['box', [0.05, 0.07, 0.06], 'driverSkin', 0.17, 2.48, -1.4],
  ['box', [0.022, 0.022, 0.025], 'gold', 0.11, 2.03, -1.2],
];

// Nose, neckerchief and its tail, breast pocket.
const FACE_CENTRE = [
  ['box', [0.045, 0.055, 0.055], 'driverSkin', 0, 2.455, -1.21],
  ['box', [0.23, 0.06, 0.04], 'red', 0, 2.31, -1.22],
  ['box', [0.07, 0.16, 0.035], 'red', 0.07, 2.22, -1.2],
  ['box', [0.12, 0.07, 0.025], 'driverHat', 0, 2.09, -1.195],
];

// Unit icosahedra scaled into ellipsoids; the beak cone is baked to point along +Z.
const RAVEN_BODY = [
  ['ico', [1, 1], 'ravenFeathers', 0, 0.15, -0.015, { scale: [0.09, 0.12, 0.145] }],
  ['ico', [1, 1], 'ravenFeathers', 0, 0.275, 0.075, { scale: [0.078, 0.086, 0.09] }],
  ['cone', [0.036, 0.13, 4], 'black', 0, 0.265, 0.205, { bake: ['rotateX', QUARTER_TURN] }],
  ['ico', [1, 0], 'ravenFeathers', 0, 0.08, -0.175, { scale: [0.075, 0.025, 0.16], rotX: -0.35 }],
];

const RAVEN_WING_AND_LEG = [
  ['ico', [1, 1], 'ravenWings', 0.075, 0.135, -0.035, { scale: [0.027, 0.095, 0.135], rotX: -0.2 }],
  ['box', [0.018, 0.05, 0.018], 'black', 0.04, 0.032, 0],
];

const RAVEN_EYE = [
  ['ico', [0.012, 1], 'black', 0.071, 0.292, 0.109],
  ['ico', [0.004, 0], 'silver', 0.077, 0.299, 0.114],
];

function buildRaven(loco, m) {
  const raven = new THREE.Group();
  raven.position.set(0.31, 2.22, -1.34);
  raven.rotation.y = 0.2;
  loco.add(raven);
  addParts(raven, m, RAVEN_BODY);
  for (const side of SIDES) {
    addParts(raven, m, RAVEN_WING_AND_LEG, { side });
    // Two splayed claws per foot, toes inward then outward.
    for (const toe of [-1, 1]) {
      const claw = add(boxGeometry(0.012, 0.014, 0.075), m.black, raven, side * 0.04 + toe * 0.01, 0.01, 0.022);
      claw.rotation.y = toe * 0.2;
    }
    addParts(raven, m, RAVEN_EYE, { side });
  }
}

export function buildDriverAndRaven(loco, m) {
  addParts(loco, m, HIPS);
  for (const side of SIDES) addParts(loco, m, LIMBS_SIDE, { side });
  addParts(loco, m, TORSO_AND_CAP);
  for (const side of SIDES) addParts(loco, m, FACE_AND_COAT_SIDE, { side });
  addParts(loco, m, FACE_CENTRE);
  buildRaven(loco, m);
}
