// Locomotive body: chassis, boiler, stack, dome and the glazed cab, then (after the crew) the cab
// fittings, valances, running boards and whistle. Child order feeds merge batches, so it is fixed.
import { SIDES, addParts } from './train-mesh-helpers.js';
import { buildDriverAndRaven } from './locomotive-driver-and-raven-builder.js';

const HALF_TURN = Math.PI;

// Row: [shape, geometry args, material, x, y, z, extras]; a list coordinate emits one part per value.
const CHASSIS_AND_BOILER = [
  ['box', [1.4, 0.35, 4.5], 'black', 0, 0.72, 0],
  ['cylZ', [0.62, 0.62, 2.7, 12], 'red', 0, 1.5, 0.55],
  ['cylZ', [0.66, 0.66, 0.5, 12], 'black', 0, 1.5, 2.05],
  ['cylZ', [0.645, 0.645, 0.08, 12], 'gold', 0, 1.5, [0.0, 1.0]],
  ['cyl', [0.3, 0.18, 0.75, 10], 'black', 0, 2.35, 1.95],
  ['cyl', [0.34, 0.34, 0.12, 10], 'black', 0, 2.72, 1.95],
  ['sphere', [0.3, 10, 8, 0, HALF_TURN * 2, 0, HALF_TURN / 2], 'gold', 0, 2.08, 0.75],
  ['box', [1.45, 0.12, 1.5], 'black', 0, 1.16, -1.35],
];

// Per side: wall, window rails, corner posts, side glass (x mirrored).
const CAB_SIDE = [
  ['box', [0.12, 0.8, 1.5], 'red', 0.72, 1.56, -1.35],
  ['box', [0.1, 0.08, 1.5], 'supportRed', 0.78, [1.98, 2.69], -1.35],
  ['box', [0.1, 0.75, 0.1], 'supportRed', 0.78, 2.34, [-2.05, -0.65]],
  ['plane', [1.3, 0.63], 'cabGlass', 0.79, 2.34, -1.35, { bake: ['rotateY', HALF_TURN / 2], noShadow: true }],
];

const CAB_FRONT_AND_ROOF = [
  ['box', [1.44, 0.8, 0.12], 'red', 0, 1.56, -0.66],
  ['box', [1.46, 0.08, 0.1], 'supportRed', 0, [1.98, 2.69], -0.62],
  ['plane', [1.3, 0.63], 'cabGlass', 0, 2.34, -0.58, { noShadow: true }],
  ['box', [1.75, 0.14, 1.9], 'roofMaterial', 0, 2.82, -1.4],
];

const BACKHEAD = [
  ['box', [1.02, 0.13, 0.3], 'black', 0, 1.89, -0.86],
  ['torus', [0.17, 0.025, 6, 12], 'gold', 0, 2.03, -1.03],
];

const VALANCE_SIDE = [
  ['box', [0.1, 0.15, 3.1], 'supportRed', 0.77, 0.98, 0.4],
  ['box', [0.11, 0.38, 0.13], 'supportRed', 0.77, 1.18, [-0.55, 0.4, 1.35]],
];

// Handrail with stanchions, cab step, brass number plate.
const RUNNING_BOARD_SIDE = [
  ['box', [0.045, 0.045, 2.25], 'gold', 0.65, 1.78, 0.65],
  ['box', [0.13, 0.045, 0.045], 'gold', 0.61, 1.78, [-0.35, 1.6]],
  ['box', [0.3, 0.09, 0.62], 'black', 0.84, 0.98, -1.62],
  ['box', [0.025, 0.12, 0.36], 'gold', 0.79, 1.65, -1.35],
];

const WHISTLE = [
  ['cyl', [0.07, 0.07, 0.32, 8], 'gold', 0.28, 2.23, -0.28],
  ['sphere', [0.09, 8, 6], 'gold', 0.28, 2.4, -0.28],
];

/** Shell → crew → fittings; the three cab glass planes are pushed onto `noShadow`. */
export function buildLocomotiveBody(loco, m, noShadow) {
  addParts(loco, m, CHASSIS_AND_BOILER);
  for (const side of SIDES) addParts(loco, m, CAB_SIDE, { side, noShadow });
  addParts(loco, m, CAB_FRONT_AND_ROOF, { noShadow });
  buildDriverAndRaven(loco, m);
  addParts(loco, m, BACKHEAD);
  for (const side of SIDES) addParts(loco, m, VALANCE_SIDE, { side });
  for (const side of SIDES) addParts(loco, m, RUNNING_BOARD_SIDE, { side });
  addParts(loco, m, WHISTLE);
}
