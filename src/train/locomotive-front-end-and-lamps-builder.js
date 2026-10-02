// Locomotive nose: smokebox door with its bolt ring, buffers, hook and beam, the uv-less cowcatcher
// wedge with pilot bars, three lamps with halos, and the headlight anchor carrying the beam cone.
import * as THREE from 'three';
import { createLightGlows } from '../effects/night-light-glow-sprites.js';
import { createLightCone } from '../effects/night-headlight-light-cone.js';
import { SIDES, add, addParts, cylinderAlongZ } from './train-mesh-helpers.js';

const lamp = (x, y, radius, haloSize, haloStrength) => Object.freeze({ x, y, radius, haloSize, haloStrength });

/** Headlamp first, then the left and right buffer lamps. */
export const LOCOMOTIVE_LAMPS = Object.freeze([lamp(0, 2.1, 0.17, 2.3, 0.55), lamp(-0.69, 1.08, 0.075, 0.8, 0.38), lamp(0.69, 1.08, 0.075, 0.8, 0.38)]);

const BOLT_COUNT = 10;
const BOLT_RING_RADIUS = 0.46;
const PILOT_BAR_X = [-0.6, -0.3, 0, 0.3, 0.6];
const BEAM_AIM = [0, -0.08, 1];

const DOOR = [
  ['cylZ', [0.54, 0.54, 0.065, 16], 'roofMaterial', 0, 1.5, 2.32],
  ['torus', [0.51, 0.022, 6, 20], 'silver', 0, 1.5, 2.365],
];

// Centre ring and the crossed dart handle.
const DOOR_HANDLE = [
  ['torus', [0.12, 0.02, 6, 12], 'black', 0, 1.5, 2.4],
  ['box', [0.28, 0.035, 0.04], 'silver', 0, 1.5, 2.42],
  ['box', [0.035, 0.28, 0.04], 'silver', 0, 1.5, 2.42],
];

// Per side: door hinge, buffer stem, buffer face.
const BUFFER_SIDE = [
  ['box', [0.09, 0.14, 0.075], 'black', 0.42, 1.5, 2.38],
  ['cylZ', [0.065, 0.065, 0.24, 8], 'silver', 0.58, 0.81, 2.48],
  ['cylZ', [0.16, 0.16, 0.08, 10], 'black', 0.58, 0.81, 2.62],
];

const HOOK_AND_BEAM = [
  ['torus', [0.09, 0.026, 6, 10], 'black', 0, 0.73, 2.48],
  ['box', [1.6, 0.3, 0.2], 'red', 0, 0.8, 2.3],
];

// Wedge: four corners of the back plate, then the tip. Position only, so the merge leaves it alone.
const CATCHER_VERTICES = [-0.75, 0.65, 2.35, 0.75, 0.65, 2.35, -0.75, 0.2, 2.35, 0.75, 0.2, 2.35, 0, 0.17, 3.05];
const CATCHER_TRIANGLES = [0, 4, 1, 0, 2, 4, 1, 4, 3, 2, 3, 4, 0, 1, 3, 0, 3, 2];

function addDoorBolts(loco, m) {
  const bolt = new THREE.IcosahedronGeometry(0.032, 0);
  for (let i = 0; i < BOLT_COUNT; i++) {
    const angle = ((i / BOLT_COUNT) * Math.PI) * 2;
    add(bolt, m.gold, loco, Math.cos(angle) * BOLT_RING_RADIUS, 1.5 + Math.sin(angle) * BOLT_RING_RADIUS, 2.385);
  }
}

function addCowcatcher(loco, m) {
  const wedge = new THREE.BufferGeometry();
  wedge.setAttribute('position', new THREE.Float32BufferAttribute(CATCHER_VERTICES, 3));
  wedge.setIndex(CATCHER_TRIANGLES);
  wedge.computeVertexNormals();
  add(wedge, m.red, loco, 0, 0, 0);
}

// Thin rods from the beam down to the wedge, centred between their ends and turned from +Y.
function addPilotBars(loco, m) {
  const yAxis = new THREE.Vector3(0, 1, 0);
  for (const x of PILOT_BAR_X) {
    const top = new THREE.Vector3(x, 0.67, 2.36);
    const foot = new THREE.Vector3(x * 0.32, 0.24, 2.9 - Math.abs(x) * 0.25);
    const along = new THREE.Vector3().subVectors(foot, top);
    const bar = add(new THREE.CylinderGeometry(0.022, 0.022, along.length(), 5), m.supportRed, loco, 0, 0, 0);
    bar.position.addVectors(top, foot).multiplyScalar(0.5);
    bar.quaternion.setFromUnitVectors(yAxis, along.normalize());
  }
}

function addLamps(loco, m, train) {
  for (const { x, y, radius } of LOCOMOTIVE_LAMPS) {
    const rim = radius * 1.35;
    add(cylinderAlongZ(rim, rim, 0.22, 12), m.black, loco, x, y, 2.32);
    add(new THREE.TorusGeometry(radius * 1.08, 0.025, 6, 12), m.gold, loco, x, y, 2.445);
    add(new THREE.CircleGeometry(radius, 12), m.glow, loco, x, y, 2.46);
  }
  const halos = createLightGlows(LOCOMOTIVE_LAMPS.map(lamp => ({
    position: [lamp.x, lamp.y, 2.51],
    size: [lamp.haloSize * 1.5, lamp.haloSize * 1.5],
    normal: [0, 0, 1],
    strength: lamp.haloStrength,
  })));
  loco.add(halos);
  train.noShadow.push(halos);
}

function addHeadlightBeam(loco, train) {
  train.headlight.position.set(0, 2.1, 2.5);
  loco.add(train.headlight);
  const beam = createLightCone({ length: 18, radius: 4.5, strength: 0.2 });
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...BEAM_AIM).normalize());
  train.headlight.add(beam);
  train.noShadow.push(beam);
}

/** Uses train.headlight and train.noShadow (halos, then the beam). */
export function buildLocomotiveFront(loco, m, train) {
  addParts(loco, m, DOOR);
  addDoorBolts(loco, m);
  addParts(loco, m, DOOR_HANDLE);
  for (const side of SIDES) addParts(loco, m, BUFFER_SIDE, { side });
  addParts(loco, m, HOOK_AND_BEAM);
  addCowcatcher(loco, m);
  addPilotBars(loco, m);
  addLamps(loco, m, train);
  addHeadlightBeam(loco, train);
}
