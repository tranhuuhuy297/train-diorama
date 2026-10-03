// The man's dog: a coat-and-cream body with a head pivot (muzzle, nose, eyes, floppy ears), a collar
// and a wagging tail pivot. Pure construction; the residents class merges and animates it.
import * as THREE from 'three';
import { addPartRows, addMirroredRows } from './village-resident-materials-and-primitives.js';

const DOG_SCALE = 0.8;

// Build program, run top to bottom. `rows` go on the dog, the head or the tail pivot (`on`);
// `mirrored` rows run left then right; `pivot` entries attach a new Group to the dog.
const DOG_PROGRAM = [
  { rows: [
    ['shape', 'dogCoat', [0, 0.32, -0.1], [0.3, 0.32, 0.34]],
    ['shape', 'dogCream', [0, 0.48, 0.09], [0.21, 0.32, 0.19]],
  ] },
  { mirrored: [
    ['shape', 'dogCoat', [0.24, 0.18, -0.17], [0.17, 0.19, 0.22]],
    ['block', 'dogCream', [0.14, 0.24, 0.2], [0.1, 0.4, 0.11]],
    ['shape', 'dogCream', [0.14, 0.065, 0.26], [0.1, 0.065, 0.15]],
  ] },
  { pivot: 'dogHead', at: [0, 0.72, 0.09] },
  { on: 'dogHead', rows: [
    ['shape', 'dogCoat', [0, 0.09, 0], [0.24, 0.24, 0.22]],
    ['shape', 'dogCream', [0, 0, 0.2], [0.15, 0.12, 0.17]],
    ['shape', 'dark', [0, 0.04, 0.34], [0.075, 0.06, 0.05]],
  ] },
  { on: 'dogHead', mirrored: [
    ['shape', 'dark', [0.1, 0.14, 0.18], [0.028, 0.035, 0.025]],
    ['shape', 'dark', [0.22, 0.05, -0.025], [0.09, 0.24, 0.12]],
  ] },
  { rows: [['shape', 'collar', [0, 0.64, 0.08], [0.225, 0.05, 0.19]]] },
  { pivot: 'dogTail', at: [0, 0.18, -0.34] },
  { on: 'dogTail', rows: [['shape', 'dogCoat', [0, 0.02, -0.22], [0.065, 0.075, 0.28]]] },
];

/** Adds the dog Group to `parent` first, then every part; returns `{dog, dogHead, dogTail}`. */
export function buildVillageDog(parent, materials) {
  const dog = new THREE.Group();
  dog.scale.setScalar(DOG_SCALE);
  parent.add(dog);
  const nodes = { dog };
  for (const step of DOG_PROGRAM) {
    if (step.pivot) {
      const pivot = new THREE.Group();
      pivot.position.fromArray(step.at);
      dog.add(pivot);
      nodes[step.pivot] = pivot;
      continue;
    }
    const target = nodes[step.on ?? 'dog'];
    if (step.rows) addPartRows(target, materials, step.rows);
    else addMirroredRows(target, materials, step.mirrored);
  }
  return { dog, dogHead: nodes.dogHead, dogTail: nodes.dogTail };
}
