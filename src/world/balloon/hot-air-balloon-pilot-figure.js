// The balloon pilot standing in the basket: blue jacket with yellow trim, goggles pushed up on
// the cap, arms resting on the rim. Built in a scaled sub-group that the balloon merge flattens.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { box } from '../../geometry/procedural-geometry-helpers.js';

const PILOT_SCALE = 0.64;

// Mesh over a fresh icosahedron, placed in the pilot group.
function addBall(group, radius, detail, material, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, detail), material);
  mesh.position.set(x, y, z);
  group.add(mesh);
  return mesh;
}

function addHeadAndBody(pilot, { jacket, jacketTrim, skin, hair }) {
  addBall(pilot, 0.32, 1, jacket, 0, 0.38, 0).scale.set(0.78, 1.05, 0.68);
  box(0.3, 0.09, 0.08, jacketTrim, 0, 0.6, 0.19, pilot);
  box(0.055, 0.34, 0.035, jacketTrim, 0, 0.38, 0.22, pilot);
  addBall(pilot, 0.16, 1, skin, 0, 0.79, 0);
  addBall(pilot, 0.17, 1, hair, 0, 0.91, 0).scale.y = 0.45;
  box(0.06, 0.06, 0.07, skin, 0, 0.75, 0.17, pilot);
}

// Eyes, side hair, tilted arms and hands, left side first.
function addMirroredFeatures(pilot, { jacket, skin, hair }) {
  for (const sign of [-1, 1]) {
    addBall(pilot, 0.025, 0, hair, sign * 0.07, 0.82, 0.145);
    box(0.045, 0.11, 0.05, hair, sign * 0.15, 0.77, 0, pilot);
    box(0.14, 0.34, 0.15, jacket, sign * 0.29, 0.48, 0.08, pilot).rotation.z = sign * 0.35;
    addBall(pilot, 0.08, 1, skin, sign * 0.35, 0.36, 0.22);
  }
}

// Goggle rings and straps, the chest tabs, then the centre bridge, pocket flap and buttons.
function addGogglesAndTrim(pilot, { jacketTrim, hair }) {
  for (const sign of [-1, 1]) {
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 5, 10), jacketTrim);
    lens.position.set(sign * 0.068, 0.927, 0.122);
    pilot.add(lens);
    box(0.025, 0.035, 0.15, jacketTrim, sign * 0.14, 0.91, 0.025, pilot);
    box(0.1, 0.035, 0.025, jacketTrim, sign * 0.12, 0.48, 0.22, pilot);
  }
  box(0.035, 0.02, 0.02, jacketTrim, 0, 0.927, 0.13, pilot);
  box(0.09, 0.27, 0.04, jacketTrim, -0.12, 0.52, 0.24, pilot);
  for (const y of [0.37, 0.46, 0.55]) box(0.026, 0.026, 0.025, hair, 0, y, 0.245, pilot);
}

export function buildBalloonPilot(balloon, localGlow) {
  const pilot = new THREE.Group();
  pilot.position.set(-0.12, -2.9, 0.13);
  pilot.scale.setScalar(PILOT_SCALE);
  const outfit = {
    jacket: npr({ localGlow, color: '#2c8fc7', stipple: 0.12, stippleScale: 4 }),
    jacketTrim: npr({ localGlow, color: '#f0b74c', stipple: 0.08 }),
    skin: npr({ localGlow, color: '#d6a37c', stipple: 0.08 }),
    hair: npr({ localGlow, color: '#47342e', stipple: 0.08 }),
  };
  addHeadAndBody(pilot, outfit);
  addMirroredFeatures(pilot, outfit);
  addGogglesAndTrim(pilot, outfit);
  balloon.add(pilot);
  return pilot;
}
