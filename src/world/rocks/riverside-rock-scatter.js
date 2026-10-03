// Grey boulders on the low ground around the pond and river banks: up to 80 instanced, squashed,
// randomly tumbled dodecahedra. Continues the world.rand stream right after the trees.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { colorize, jitter } from '../../geometry/procedural-geometry-helpers.js';
import { SIZE } from '../world-constants.js';

export const ROCK_CAPACITY = 80;
export const ROCK_ATTEMPTS = 3000;
// Candidates stay inside 95 % of the base.
const SPREAD = 0.95;
// Ground band: from just under the water plane up to the low banks.
const LOWEST = -0.3;
const HIGHEST = 1.2;

/** Build step part: the rock layer (count = rocks placed), already added to world.group. */
export function buildRiversideRocks(world) {
  const geometry = colorize(jitter(new THREE.DodecahedronGeometry(0.6, 0), 0.4, 9), '#9d978c');
  const rocks = new THREE.InstancedMesh(geometry, npr({ vertexColors: true, stipple: 0.3, stippleScale: 3 }), ROCK_CAPACITY);
  const tumble = new THREE.Quaternion();
  let placed = 0;
  // The guard runs before each attempt, so nothing is drawn once the layer is full.
  for (let attempt = 0; attempt < ROCK_ATTEMPTS && placed < ROCK_CAPACITY; attempt++) {
    const x = (world.rand() - 0.5) * SIZE * SPREAD;
    const z = (world.rand() - 0.5) * SIZE * SPREAD;
    const ground = world.heightAt(x, z);
    if (ground < LOWEST || ground > HIGHEST || world.excluded(x, z)) continue;
    const size = 0.4 + world.rand() * 1.1;
    tumble.setFromEuler(new THREE.Euler(world.rand() * 3, world.rand() * 3, world.rand() * 3));
    const scale = new THREE.Vector3(size, size * 0.7, size);
    rocks.setMatrixAt(placed, new THREE.Matrix4().compose(new THREE.Vector3(x, ground, z), tumble, scale));
    placed += 1;
  }
  rocks.count = placed;
  world.group.add(rocks);
  return rocks;
}
