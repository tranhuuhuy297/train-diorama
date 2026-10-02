// Shared train building blocks: mesh placement, axis-baked cylinders and a tiny part-table emitter.
import * as THREE from 'three';

const QUARTER_TURN = Math.PI / 2;

/** Mirror order for per-side blocks: the whole block runs for -1, then for +1. */
export const SIDES = Object.freeze([-1, 1]);

/** New mesh at (x, y, z), appended to `parent`. */
export function add(geometry, material, parent, x, y, z) {
  const part = new THREE.Mesh(geometry, material);
  part.position.set(x, y, z);
  parent.add(part);
  return part;
}

/** A fresh BoxGeometry per call; boxes are never shared between parts. */
export function boxGeometry(width, height, depth) {
  return new THREE.BoxGeometry(width, height, depth);
}

export function cylinderAlongZ(radiusTop, radiusBottom, height, radialSegments) {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments).rotateX(QUARTER_TURN);
}

export function cylinderAlongX(radiusTop, radiusBottom, height, radialSegments) {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments).rotateZ(QUARTER_TURN);
}

const SHAPES = {
  box: boxGeometry,
  cylZ: cylinderAlongZ,
  cylX: cylinderAlongX,
  cyl: (...args) => new THREE.CylinderGeometry(...args),
  ico: (...args) => new THREE.IcosahedronGeometry(...args),
  torus: (...args) => new THREE.TorusGeometry(...args),
  sphere: (...args) => new THREE.SphereGeometry(...args),
  plane: (...args) => new THREE.PlaneGeometry(...args),
  circle: (...args) => new THREE.CircleGeometry(...args),
  cone: (...args) => new THREE.ConeGeometry(...args),
};

function placePart(parent, materials, row, at, side, noShadow) {
  const [shape, args, materialKey, , , , extras = {}] = row;
  const geometry = SHAPES[shape](...args);
  if (extras.bake) geometry[extras.bake[0]](...extras.bake.slice(1));
  const x = side === null ? at[0] : side * at[0];
  const mesh = add(geometry, materials[materialKey], parent, x, at[1], at[2]);
  if (extras.scale) mesh.scale.set(...extras.scale);
  if (extras.rotX !== undefined) mesh.rotation.x = extras.rotX;
  if (extras.noShadow) noShadow.push(mesh);
  return mesh;
}

/**
 * Emits rows `[shape, args, materialKey, x, y, z, extras?]` in order, each with a fresh geometry.
 * A list-valued coordinate emits one mesh per listed value; `side` (±1) mirrors x.
 * extras: scale [x, y, z], rotX, bake [geometryMethod, ...args], noShadow (push onto `noShadow`).
 */
export function addParts(parent, materials, rows, { side = null, noShadow = null } = {}) {
  for (const row of rows) {
    const coordinates = row.slice(3, 6);
    const listAxis = coordinates.findIndex(Array.isArray);
    if (listAxis < 0) {
      placePart(parent, materials, row, coordinates, side, noShadow);
      continue;
    }
    for (const value of coordinates[listAxis]) {
      const at = coordinates.slice();
      at[listAxis] = value;
      placePart(parent, materials, row, at, side, noShadow);
    }
  }
}
