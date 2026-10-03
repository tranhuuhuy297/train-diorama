// Bird meshes: one vertex-coloured body (torso, head, bib, beak, legs, feet, eyes merged together)
// and wing, wing-tip and tail geometries shared by every bird. Each rig is figure > body > (body
// mesh, tail, two wing pivots > wing mesh + tip group > tip mesh); left parts mirror via scale.x.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { tintGeometry } from '../../geometry/procedural-geometry-helpers.js';

const SIDES = [-1, 1];
const PLUMAGE = '#738da2';
const DARK_PLUMAGE = '#33465b';
const LEG_COLOR = '#aa744a';

// Optional scale, optional x-rotation, then translation, applied in that order before tinting.
function shaped(geometry, color, { scale = null, rotateX = null, at }) {
  if (scale !== null) geometry.scale(...scale);
  if (rotateX !== null) geometry.rotateX(rotateX);
  geometry.translate(...at);
  return tintGeometry(geometry, color);
}

function bodyParts() {
  const parts = [
    shaped(new THREE.IcosahedronGeometry(1, 1), PLUMAGE, { scale: [0.17, 0.2, 0.3], at: [0, 0.27, 0] }),
    shaped(new THREE.IcosahedronGeometry(1, 1), DARK_PLUMAGE, { scale: [0.125, 0.14, 0.14], at: [0, 0.46, 0.18] }),
    shaped(new THREE.IcosahedronGeometry(1, 0), '#e1d4b6', { scale: [0.12, 0.13, 0.14], at: [0, 0.3, 0.2] }),
    shaped(new THREE.ConeGeometry(0.055, 0.15, 4), '#e0b45d', { rotateX: Math.PI / 2, at: [0, 0.43, 0.34] }),
  ];
  for (const side of SIDES) {
    parts.push(
      shaped(new THREE.BoxGeometry(0.025, 0.12, 0.025), LEG_COLOR, { at: [side * 0.075, 0.08, 0.025] }),
      shaped(new THREE.BoxGeometry(0.06, 0.022, 0.1), LEG_COLOR, { at: [side * 0.075, 0.025, 0.055] }),
      shaped(new THREE.IcosahedronGeometry(0.023, 0), '#171e2b', { at: [side * 0.112, 0.49, 0.245] }),
    );
  }
  return parts;
}

/** Builds the merged body and the three shared limb geometries (20 geometry allocations). */
export function createBirdGeometries() {
  const parts = bodyParts();
  const bodyGeometry = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return {
    bodyGeometry,
    wingGeometry: shaped(new THREE.IcosahedronGeometry(1, 0), '#405971', { scale: [0.22, 0.04, 0.18], at: [0.18, 0, -0.035] }),
    wingTipGeometry: shaped(new THREE.IcosahedronGeometry(1, 0), DARK_PLUMAGE, { scale: [0.23, 0.028, 0.13], at: [0.17, 0, -0.06] }),
    tailGeometry: shaped(new THREE.BoxGeometry(0.19, 0.035, 0.28), DARK_PLUMAGE, { at: [0, 0, -0.12] }),
  };
}

// One wing: a shoulder pivot holding the inner wing and a tip group that folds separately.
function buildWing(body, side, geometries, material) {
  const pivot = new THREE.Group();
  const wing = new THREE.Mesh(geometries.wingGeometry, material);
  wing.scale.x = side;
  pivot.position.set(0.11 * side, 0.32, 0);
  pivot.add(wing);
  const tip = new THREE.Group();
  tip.position.set(0.35 * side, 0, -0.035);
  const tipMesh = new THREE.Mesh(geometries.wingTipGeometry, material);
  tipMesh.scale.x = side;
  tip.add(tipMesh);
  pivot.add(tip);
  body.add(pivot);
  return { pivot, tip, side };
}

/** One bird rig (12 Object3Ds); the caller places the figure and adds it to the flock group. */
export function createBirdRig(geometries, material) {
  const figure = new THREE.Group();
  const body = new THREE.Group();
  body.add(new THREE.Mesh(geometries.bodyGeometry, material));
  figure.add(body);
  const tail = new THREE.Mesh(geometries.tailGeometry, material);
  tail.position.set(0, 0.2, -0.22);
  body.add(tail);
  const wings = SIDES.map(side => buildWing(body, side, geometries, material));
  return { figure, body, tail, wings };
}

export function disposeBirdGeometries({ bodyGeometry, wingGeometry, wingTipGeometry, tailGeometry }) {
  bodyGeometry.dispose();
  wingGeometry.dispose();
  wingTipGeometry.dispose();
  tailGeometry.dispose();
}
