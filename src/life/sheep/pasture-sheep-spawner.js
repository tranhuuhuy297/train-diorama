// Scatters the grazing flock over the meadows. Continues the world.rand stream right after the rocks:
// two draws per candidate spot, five more for each sheep that is kept.
import * as THREE from 'three';
import { SIZE, UP } from '../../world/world-constants.js';
import { sheepGroundAt } from './sheep-pasture-ground-query.js';

const MAX_ATTEMPTS = 4000;
const FLOCK_SIZE = 24;
// Candidates stay inside 90 % of the base.
const SPREAD = 0.9;

/** Pushes pasture sheep into world.sheepStates and returns how many were placed. */
export function spawnPastureSheep(world) {
  // Own scratch normal: the per-frame shared one must stay untouched here.
  const slope = new THREE.Vector3();
  let placed = 0;
  for (let attempt = 0; attempt < MAX_ATTEMPTS && placed < FLOCK_SIZE; attempt++) {
    const x = (world.rand() - 0.5) * SIZE * SPREAD;
    const z = (world.rand() - 0.5) * SIZE * SPREAD;
    const ground = sheepGroundAt(world, x, z, slope);
    if (ground === null) continue;
    const direction = world.rand() * Math.PI * 2;
    const size = 0.9 + world.rand() * 0.4;
    const phase = world.rand() * Math.PI * 2;
    const speed = 0.16 + world.rand() * 0.18;
    const turnSpeed = (world.rand() - 0.5) * 0.5;
    world.sheepStates.push({
      x, z, direction, size, phase, speed, turnSpeed, groundHeight: ground, gait: 1, sleep: 0,
      orientation: new THREE.Quaternion().setFromAxisAngle(UP, direction),
    });
    placed += 1;
  }
  return placed;
}
