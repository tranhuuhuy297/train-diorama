// Four-armed windmill rotor on the shared world.windmillBlades group: wooden spars with offset sails
// around a hub, turned clockwise (seen from the front) by sim time only.
import * as THREE from 'three';
import { box } from '../../geometry/procedural-geometry-helpers.js';

// Radians per sim second; one turn takes about 7 s.
export const WINDMILL_ROTOR_SPEED = 0.9;
const ARM_COUNT = 4;

/** Mounts the rotor at the cap front: four arms (spar, then sail), then the hub. */
export function buildWindmillRotor(world, { wood, sail, roof }) {
  const rotor = world.windmillBlades;
  rotor.position.set(0, 5.4, 1.3);
  for (let arm = 0; arm < ARM_COUNT; arm++) {
    const spoke = new THREE.Group();
    spoke.rotation.z = (arm * Math.PI) / 2;
    box(0.16, 3.6, 0.12, wood, 0, 1.9, 0, spoke);
    box(0.8, 2.8, 0.05, sail, 0.5, 2.2, 0.02, spoke);
    rotor.add(spoke);
  }
  rotor.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), roof));
}

/** Roll the rotor back by dt·speed (negative z = clockwise from the front). */
export function updateWindmillRotor(world, dt) {
  world.windmillBlades.rotation.z -= dt * WINDMILL_ROTOR_SPEED;
}
