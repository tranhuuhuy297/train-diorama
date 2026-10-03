// The grandmother waiting beside her stacked cases: flared skirt, shawl with brooch, spectacles,
// a grey bun and a handbag. Only the head stays separate (it follows the train); everything else is
// merged per material. Shares the traveler's shoulder geometry and reuses his cached materials.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { mergeStaticGeometry } from '../../geometry/merge-static-geometry-by-material.js';
import { attachMesh } from './station-figure-parts.js';
import { SUITCASE_TRIM_OPTIONS } from '../../world/station/station-palette-materials.js';

const SIDES = [-1, 1];
const GRANDMOTHER_SCALE = 0.7;
// The handbag hangs on her right regardless of the platform side.
const HANDBAG_X = 0.4;

// Her own three materials first, then lookups that hit the cache (traveler outfit, suitcase trim).
function grandmotherPalette() {
  return {
    dress: npr({ color: '#77566f', stipple: 0.13, stippleScale: 3 }),
    shawl: npr({ color: '#b67a67', stipple: 0.1 }),
    handbagLeather: npr({ color: '#7b5038', stipple: 0.12 }),
    skin: npr({ color: '#d2a27d', stipple: 0.08 }),
    grayHair: npr({ color: '#ddd8ca', stipple: 0.08 }),
    clothingTrim: npr({ color: '#d2bc87', stipple: 0.08 }),
    suitcaseTrim: npr(SUITCASE_TRIM_OPTIONS),
  };
}

function addDressAndShawl(figure, m, darkWood, shoulderGeometry) {
  for (const side of SIDES) {
    box(0.22, 0.13, 0.3, darkWood, side * 0.14, 0.08, 0.05, figure);
    box(0.18, 0.5, 0.2, m.shawl, side * 0.32, 1.22, 0, figure).rotation.z = side * 0.2;
    attachMesh(shoulderGeometry, m.shawl, figure, [side * 0.3, 1.46, 0], [0.95, 0.7, 0.85]);
    attachMesh(new THREE.IcosahedronGeometry(0.1, 1), m.skin, figure, [side * 0.37, 0.91, 0.04]);
  }
  attachMesh(new THREE.CylinderGeometry(0.29, 0.61, 1.1, 7), m.dress, figure, [0, 0.62, 0]);
  attachMesh(new THREE.IcosahedronGeometry(0.39, 1), m.dress, figure, [0, 1.22, 0], [0.8, 0.94, 0.65]);
  box(0.44, 0.12, 0.1, m.shawl, 0, 1.48, 0.2, figure);
  for (const side of SIDES) {
    box(0.12, 0.34, 0.055, m.shawl, side * 0.13, 1.32, 0.24, figure).rotation.z = -side * 0.25;
    box(0.17, 0.045, 0.04, m.clothingTrim, side * 0.14, 1.15, 0.275, figure);
  }
  box(0.07, 0.07, 0.045, m.clothingTrim, 0, 1.43, 0.29, figure);
  // Open-ended band around the skirt hem.
  attachMesh(new THREE.CylinderGeometry(0.585, 0.612, 0.09, 7, 1, true), m.shawl, figure, [0, 0.14, 0]);
}

function addHead(figure, m, darkWood) {
  const head = new THREE.Group();
  head.position.y = 1.48;
  figure.add(head);
  attachMesh(new THREE.IcosahedronGeometry(0.276, 1), m.skin, head, [0, 0.24, 0.02]);
  attachMesh(new THREE.IcosahedronGeometry(0.288, 1), m.grayHair, head, [0, 0.36, 0], [1, 0.56, 1]);
  attachMesh(new THREE.IcosahedronGeometry(0.168, 1), m.grayHair, head, [0, 0.38, -0.23]);
  for (const side of SIDES) attachMesh(new THREE.IcosahedronGeometry(0.03, 0), darkWood, head, [side * 0.095, 0.27, 0.27]);
  box(0.06, 0.075, 0.08, m.skin, 0, 0.23, 0.295, head);
  const lensGeometry = new THREE.TorusGeometry(0.065, 0.009, 5, 12);
  for (const side of SIDES) {
    attachMesh(lensGeometry, m.clothingTrim, head, [side * 0.095, 0.27, 0.296]);
    box(0.012, 0.012, 0.12, m.clothingTrim, side * 0.158, 0.28, 0.24, head);
  }
  box(0.06, 0.012, 0.015, m.clothingTrim, 0, 0.275, 0.3, head);
  box(0.09, 0.04, 0.035, m.shawl, 0, 0.39, -0.365, head);
  return head;
}

function addHandbag(figure, m) {
  box(0.25, 0.31, 0.12, m.handbagLeather, HANDBAG_X, 0.67, 0.04, figure);
  box(0.16, 0.05, 0.07, m.suitcaseTrim, HANDBAG_X, 0.85, 0.04, figure);
  box(0.23, 0.1, 0.025, m.suitcaseTrim, HANDBAG_X, 0.77, 0.112, figure);
  box(0.045, 0.045, 0.025, m.clothingTrim, HANDBAG_X, 0.72, 0.13, figure);
}

/** Builds her into the station group, already on the widened platform (x + o·E). */
export function buildStationGrandmother(site, materials) {
  const o = site.localOutward;
  const figure = new THREE.Group();
  figure.position.set(-0.25 * o, 0.4, -5.15);
  figure.rotation.y = (-o * Math.PI) / 2;
  figure.scale.setScalar(GRANDMOTHER_SCALE);
  const m = grandmotherPalette();
  addDressAndShawl(figure, m, materials.darkWood, materials.shoulderGeometry);
  const head = addHead(figure, m, materials.darkWood);
  addHandbag(figure, m);
  mergeStaticGeometry(head);
  mergeStaticGeometry(figure, new Set([head]));
  site.group.add(figure);
  figure.position.x += o * site.platformExtension;
  return { figure, head };
}
