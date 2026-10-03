// The old traveler on the platform: hat, blue coat, beard and a cane. Built as an animatable rig
// (loose leg meshes for the IK, a body group with two arm pivots, a head with a hat group), then the
// static parts are merged per material. Creation order matters: every object draws UUID randoms and
// materials get their ids (and opaque sort order) here, between the station sign and the suitcases.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { mergeStaticGeometry } from '../../geometry/merge-static-geometry-by-material.js';
import { attachMesh } from './station-figure-parts.js';

const SIDES = [-1, 1];
const TRAVELER_SCALE = 0.8;
const HIP_HEIGHT = 0.69;
const SHOULDER_HEIGHT = 1.37;
const SHOULDER_SPAN = 0.31;
const SHOULDER_RADIUS = 0.176;
// Cane: a unit-length shaft hanging below the grip, plus a short crook.
const CANE_THICKNESS = 0.045;
const SHAFT_LENGTH = 1;

// Outfit palette, requested in this order (npr keys on the literal, so key order is fixed too).
const OUTFIT = [
  ['coat', { color: '#526876', stipple: 0.12, stippleScale: 3 }],
  ['trousers', { color: '#514a49', stipple: 0.1 }],
  ['skin', { color: '#d2a27d', stipple: 0.08 }],
  ['grayHair', { color: '#ddd8ca', stipple: 0.08 }],
  ['hat', { color: '#675443', stipple: 0.12 }],
  ['clothingTrim', { color: '#d2bc87', stipple: 0.08 }],
  ['hatBand', { color: '#a66749', stipple: 0.1 }],
];

// Per side: leg meshes (posed later by the IK) and an arm made of sleeve, shoulder pad and hand.
function addLimbs(figure, m, darkWood, shoulderGeometry, legs, arms) {
  for (const side of SIDES) {
    const thigh = box(0.18, 1, 0.2, m.trousers, 0, 0, 0, figure);
    const shin = box(0.15, 1, 0.17, m.trousers, 0, 0, 0, figure);
    const shoe = box(0.22, 0.15, 0.3, darkWood, side * 0.13, 0.075, 0.05, figure);
    legs.push({ side, thigh, shin, shoe });
    const sleeve = box(0.17, 0.58, 0.19, m.coat, side * 0.35, 1.09, 0, figure);
    sleeve.rotation.z = side * 0.12;
    const shoulder = attachMesh(shoulderGeometry, m.coat, figure, [side * SHOULDER_SPAN, SHOULDER_HEIGHT, 0], [1, 0.75, 0.9]);
    const hand = attachMesh(new THREE.IcosahedronGeometry(0.1, 1), m.skin, figure, [side * 0.39, 0.76, 0.04]);
    const arm = new THREE.Group();
    arm.add(sleeve, shoulder, hand);
    figure.add(arm);
    arms.push({ side, arm });
  }
}

function addCoatDetails(figure, m, arms) {
  const coatBody = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 1), m.coat);
  coatBody.scale.set(0.78, 1, 0.62);
  coatBody.position.y = 1.11;
  figure.add(coatBody);
  for (const side of SIDES) {
    box(0.095, 0.22, 0.035, m.clothingTrim, side * 0.09, 1.35, 0.21, figure).rotation.z = side * 0.28;
    box(0.14, 0.035, 0.035, m.trousers, side * 0.18, 1.02, 0.235, figure);
    box(0.18, 0.055, 0.2, m.trousers, side * 0.38, 0.84, 0.015, arms[(side + 1) / 2].arm);
  }
  box(0.06, 0.42, 0.025, m.trousers, 0, 1.1, 0.277, figure);
  for (const y of [0.95, 1.1, 1.25]) box(0.035, 0.035, 0.025, m.clothingTrim, 0, y, 0.3, figure);
}

function addHeadAndHat(figure, m, darkWood) {
  const head = new THREE.Group();
  head.position.y = 1.48;
  figure.add(head);
  attachMesh(new THREE.IcosahedronGeometry(0.23, 1), m.skin, head, [0, 0.24, 0.02]);
  attachMesh(new THREE.IcosahedronGeometry(0.16, 1), m.grayHair, head, [0, 0.1, 0.18], [1, 0.85, 0.65]);
  for (const side of SIDES) attachMesh(new THREE.IcosahedronGeometry(0.025, 0), darkWood, head, [side * 0.08, 0.28, 0.21]);
  box(0.065, 0.08, 0.075, m.skin, 0, 0.23, 0.235, head);
  for (const side of SIDES) {
    box(0.07, 0.025, 0.035, m.grayHair, side * 0.08, 0.33, 0.21, head);
    box(0.06, 0.1, 0.07, m.skin, side * 0.215, 0.23, 0.02, head);
  }
  const hat = new THREE.Group();
  hat.position.set(0, 0.42, 0.05);
  hat.rotation.x = -0.16;
  box(0.5, 0.07, 0.44, m.hat, 0, 0, -0.02, hat);
  box(0.37, 0.16, 0.34, m.hat, 0, 0.11, -0.07, hat);
  box(0.382, 0.045, 0.352, m.hatBand, 0, 0.055, -0.07, hat);
  box(0.055, 0.04, 0.02, m.clothingTrim, 0.1, 0.055, 0.115, hat);
  head.add(hat);
  return { head, hat };
}

// Cane in the left hand; the shaft is rescaled every frame so it just reaches the floor.
function addCane(arms, wood) {
  const cane = new THREE.Group();
  cane.position.set(-0.4, 0.79, 0.055);
  const shaft = box(CANE_THICKNESS, SHAFT_LENGTH, CANE_THICKNESS, wood, 0, -SHAFT_LENGTH / 2, 0, cane);
  box(0.17, CANE_THICKNESS, CANE_THICKNESS, wood, 0.055, 0, 0, cane);
  arms[0].arm.add(cane);
  return { cane, caneShaft: shaft };
}

// Arms swing from the shoulder: move each pivot there, keep the parts in place, bake the static parts.
function pivotArmsAtShoulders(arms, cane) {
  const keep = new Set([cane]);
  for (const { side, arm } of arms) {
    const pivot = arm.position.set(side * SHOULDER_SPAN, SHOULDER_HEIGHT, 0);
    arm.children.forEach(child => child.position.sub(pivot));
    mergeStaticGeometry(arm, keep);
  }
}

// Everything but the legs moves into a hip-height body group, which bobs and leans while walking.
function regroupAboveHips(figure, legs, head) {
  const body = new THREE.Group();
  const legMeshes = new Set();
  for (const { thigh, shin, shoe } of legs) legMeshes.add(thigh).add(shin).add(shoe);
  for (const part of figure.children.slice()) {
    if (legMeshes.has(part)) continue;
    part.position.y -= HIP_HEIGHT;
    body.add(part);
  }
  body.position.y = HIP_HEIGHT;
  body.scale.set(1.07, 0.82, 1.08);
  head.scale.set(1.05, 1.2, 1.05);
  figure.add(body);
  return body;
}

/** Builds the traveler into the station group at his pre-widening lane (x = -0.6·o). */
export function buildStationTravelerOldMan(site, materials) {
  const o = site.localOutward;
  const figure = new THREE.Group();
  figure.position.set(-0.28 * o, 0.4, 1.1);
  figure.rotation.y = (-o * Math.PI) / 2;
  figure.scale.setScalar(TRAVELER_SCALE);
  const m = {};
  for (const [name, options] of OUTFIT) m[name] = npr(options);
  const darkWood = materials.darkWood;
  // Shared with the grandmother's shoulders.
  const shoulderGeometry = new THREE.IcosahedronGeometry(SHOULDER_RADIUS, 1);
  const legs = [];
  const arms = [];

  attachMesh(new THREE.IcosahedronGeometry(0.25, 1), m.trousers, figure, [0, 0.72, 0], [1, 0.68, 0.8]);
  addLimbs(figure, m, darkWood, shoulderGeometry, legs, arms);
  addCoatDetails(figure, m, arms);
  const { head, hat } = addHeadAndHat(figure, m, darkWood);
  const { cane, caneShaft } = addCane(arms, darkWood);
  pivotArmsAtShoulders(arms, cane);
  const body = regroupAboveHips(figure, legs, head);

  mergeStaticGeometry(hat);
  mergeStaticGeometry(head, new Set([hat]));
  mergeStaticGeometry(body, new Set([head, arms[0].arm, arms[1].arm]));
  site.group.add(figure);
  figure.position.x = -0.6 * o;
  return { figure, head, legs, rig: { body, head, hat, arms, cane, caneShaft }, shoulderGeometry };
}
