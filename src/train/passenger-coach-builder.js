// One passenger coach in a given body colour: cream window band behind X-shaped muntins, framed
// windows and lower panels, gold trim, a clerestory roof with vents, eight wheels and 12 window halos.
import * as THREE from 'three';
import { createLightGlows } from '../effects/night-light-glow-sprites.js';
import { SIDES, addParts } from './train-mesh-helpers.js';
import { addSmallWheel } from './rolling-stock-wheel-builders.js';

const COACH_LENGTH = 4.6;
const BAY = 4.1 / 6;
const FIRST_PILLAR_Z = -2.05;
const WINDOW_COUNT = 6;
const PANEL_Z = [-1.71, -1.025, -0.34, 0.34, 1.025, 1.71];

const PILLAR_Z = Array.from({ length: WINDOW_COUNT + 1 }, (_, i) => FIRST_PILLAR_Z + i * BAY);
const windowCentreZ = index => FIRST_PILLAR_Z + (index + 0.5) * BAY;

const MUNTIN_BARS = [
  ['box', [0.025, 0.76, 0.055], 'windowBar', 0.825, 0, 0],
  ['box', [0.025, 0.05, 0.76], 'windowBar', 0.825, 0, 0],
];

// Underframe, body, glowing window band and the seven body-coloured pillars.
const SHELL = [
  ['box', [1.3, 0.3, 4.3], 'black', 0, 0.66, 0],
  ['box', [1.6, 1.3, 4.5], 'body', 0, 1.45, 0],
  ['box', [1.64, 0.42, 4.1], 'cream', 0, 1.65, 0],
  ['box', [1.68, 0.44, 0.12], 'body', 0, 1.65, PILLAR_Z],
];

const MOULDINGS = [['box', [0.04, 0.2, 4.25], 'body', 0.84, [1.36, 1.94], 0]];

const windowFrame = z => [
  ['box', [0.045, 0.055, 0.62], 'windowBar', 0.865, [1.45, 1.85], z],
  ['box', [0.045, 0.46, 0.06], 'windowBar', 0.865, 1.65, [-1, 1].map(edge => z + edge * 0.285)],
];

const lowerPanel = z => [
  ['box', [0.035, 0.29, 0.54], 'windowBar', 0.817, 1.08, z],
  ['box', [0.02, 0.23, 0.46], 'body', 0.843, 1.08, z],
];

const WAISTLINE = [['box', [0.045, 0.045, 4.28], 'gold', 0.84, 1.29, 0]];

const endFittings = z => [
  ['box', [0.045, 0.57, 0.045], 'gold', 0.87, 1.35, z],
  ['box', [0.25, 0.075, 0.38], 'black', 0.84, 0.67, z],
];

const roofVent = z => [
  ['cyl', [0.1, 0.1, 0.15, 8], 'black', 0, 2.43, z],
  ['cyl', [0.2, 0.17, 0.07, 8], 'gray', 0, 2.54, z],
];

// Eaves, clerestory, both gangways and the gold solebar.
const ROOF_AND_ENDS = [
  ['box', [1.8, 0.15, 4.7], 'gray', 0, 2.17, 0],
  ['box', [1.3, 0.14, 4.5], 'gray', 0, 2.3, 0],
  ['box', [1.0, 1.1, 0.25], 'black', 0, 1.4, 2.3],
  ['box', [1.0, 1.1, 0.25], 'black', 0, 1.4, -2.3],
  ['box', [1.7, 0.08, 4.5], 'gold', 0, 0.84, 0],
];

/** Two crossed bars tilted 45°; only ever cloned, never added to the scene itself. */
export function createWindowGridTemplate(windowBar) {
  const grid = new THREE.Group();
  addParts(grid, { windowBar }, MUNTIN_BARS);
  grid.rotation.x = Math.PI / 4;
  return grid;
}

// Per window: halo entry, a mirrored muntin clone (three's clone keeps the original allocations), frame bars.
function addWindowSide(coach, m, side, glows) {
  addParts(coach, m, MOULDINGS, { side });
  for (let i = 0; i < WINDOW_COUNT; i++) {
    const z = windowCentreZ(i);
    glows.push({ position: [side * 0.93, 1.65, z], size: [1.35, 1.05], normal: [side, 0, 0], strength: 0.13 });
    const grid = m.windowGrid.clone();
    grid.scale.x = side;
    grid.position.set(0, 1.65, z);
    coach.add(grid);
    addParts(coach, m, windowFrame(z), { side });
  }
}

function addLowerSide(coach, m, side) {
  for (const z of PANEL_Z) addParts(coach, m, lowerPanel(z), { side });
  addParts(coach, m, WAISTLINE, { side });
  for (const z of [-2.12, 2.12]) addParts(coach, m, endFittings(z), { side });
}

/** Builds one coach; its window halos are pushed onto `noShadow`. */
export function buildPassengerCoach(bodyMaterial, m, noShadow) {
  const coach = new THREE.Group();
  const parts = { ...m, body: bodyMaterial };
  const wheels = [];
  const glows = [];
  addParts(coach, parts, SHELL);
  for (const side of SIDES) addWindowSide(coach, parts, side, glows);
  for (const side of SIDES) addLowerSide(coach, parts, side);
  for (const z of [-1.4, 0, 1.4]) addParts(coach, parts, roofVent(z));
  addParts(coach, parts, ROOF_AND_ENDS);
  for (const x of [-0.66, 0.66]) {
    for (const z of [1.75, 1.15, -1.15, -1.75]) wheels.push(addSmallWheel(coach, m, x, z));
  }
  const windowHalos = createLightGlows(glows);
  coach.add(windowHalos);
  noShadow.push(windowHalos);
  return { obj: coach, len: COACH_LENGTH, offset: 0, wheels };
}
