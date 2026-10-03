// Low-poly sheep: a woolly body (fleece, dark head, tail), stick legs and floppy ears, drawn as three
// instanced layers over one stippled vertex-colour material. Geometry and mesh allocation order is fixed.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { colorize, jitter } from '../../geometry/procedural-geometry-helpers.js';
import { npr } from '../../materials/npr-cel-material-factory.js';

export const SHEEP_CAPACITY = 27;

// Leg hips in body space; diagonal pairs share a swing sign, giving a trot. Array order = instance order.
export const SHEEP_LEGS = [
  { x: 0.18, z: 0.25, swing: 1 },
  { x: -0.18, z: 0.25, swing: -1 },
  { x: 0.18, z: -0.25, swing: -1 },
  { x: -0.18, z: -0.25, swing: 1 },
];

// The ear mesh points along +x; the left ear is turned half a turn and flaps slightly out of step.
export const SHEEP_EARS = [
  { x: -0.105, heading: Math.PI, phase: 0.3 },
  { x: 0.105, heading: 0, phase: 0 },
];

const WOOL = '#fbf8f0';
const FACE = '#2e2a2a';
const EAR = '#342e30';

// Squash (optional), move, then bake a flat colour.
function shaped(geometry, scale, offset, colour) {
  if (scale) geometry.scale(scale[0], scale[1], scale[2]);
  geometry.translate(offset[0], offset[1], offset[2]);
  return colorize(geometry, colour);
}

/** The three instanced layers at full capacity; the caller sets their live counts. */
export function createSheepInstancedMeshes() {
  // Ear shifted toward +x so its root sits at the head.
  const ear = shaped(new THREE.IcosahedronGeometry(0.105, 1), [1.45, 0.4, 0.58], [0.115, 0, 0], EAR);
  const fleece = shaped(jitter(new THREE.IcosahedronGeometry(0.42, 1), 0.2, 3), [1, 0.85, 1.3], [0, 0.55, 0], WOOL);
  const head = shaped(new THREE.IcosahedronGeometry(0.18, 1), [0.78, 0.85, 1.65], [0, 0.72, 0.52], FACE);
  const tail = shaped(new THREE.IcosahedronGeometry(0.14, 1), [0.85, 0.9, 1.1], [0, 0.58, -0.53], WOOL);
  const body = mergeGeometries([fleece, head, tail]);
  // Pivot at the hip: the box hangs below the origin.
  const leg = shaped(new THREE.BoxGeometry(0.1, 0.3, 0.1), null, [0, -0.15, 0], FACE);
  const material = npr({ vertexColors: true, stipple: 0.2, stippleScale: 4 });
  return {
    sheep: new THREE.InstancedMesh(body, material, SHEEP_CAPACITY),
    sheepLegs: new THREE.InstancedMesh(leg, material, SHEEP_CAPACITY * SHEEP_LEGS.length),
    sheepEars: new THREE.InstancedMesh(ear, material, SHEEP_CAPACITY * SHEEP_EARS.length),
  };
}
