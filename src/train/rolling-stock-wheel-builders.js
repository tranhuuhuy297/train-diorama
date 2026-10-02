// Wheels for every car. The six wheel geometries are created once and shared by all 44 wheel groups;
// each group spins as a unit, so it stays out of the static merge.
import * as THREE from 'three';
import { SIDES, add, boxGeometry, cylinderAlongX } from './train-mesh-helpers.js';

const DRIVING_WHEEL_Z = [0.95, -0.05, -1.05];
const LOCOMOTIVE_WHEEL_X = 0.68;

function ringAroundX(radius, tube, tubularSegments) {
  return new THREE.TorusGeometry(radius, tube, 6, tubularSegments).rotateY(Math.PI / 2);
}

export function createWheelParts() {
  return {
    wheelGeometry: cylinderAlongX(0.44, 0.44, 0.14, 12),
    smallWheelGeometry: cylinderAlongX(0.28, 0.28, 0.12, 10),
    drivingWheelRing: ringAroundX(0.335, 0.035, 16),
    smallWheelRing: ringAroundX(0.205, 0.027, 14),
    wheelHub: cylinderAlongX(0.1, 0.1, 0.025, 10),
    pin: boxGeometry(0.06, 0.12, 0.12),
  };
}

/** Black disc with a silver ring on its outer face; reads the shared parts from m.wheelParts. */
export function addSmallWheel(parent, m, x, z) {
  const parts = m.wheelParts;
  const wheel = new THREE.Group();
  wheel.position.set(x, 0.58, z);
  add(parts.smallWheelGeometry, m.black, wheel, 0, 0, 0);
  add(parts.smallWheelRing, m.silver, wheel, Math.sign(x) * 0.08, 0, 0);
  parent.add(wheel);
  return { mesh: wheel, r: 0.28 };
}

// Red driver with gold tyre ring, silver hub and a gold crank pin above the axle.
function addDrivingWheel(loco, m, x, z) {
  const parts = m.wheelParts;
  const outer = Math.sign(x) * 0.09;
  const wheel = new THREE.Group();
  wheel.position.set(x, 0.74, z);
  add(parts.wheelGeometry, m.red, wheel, 0, 0, 0);
  add(parts.drivingWheelRing, m.gold, wheel, outer, 0, 0);
  add(parts.wheelHub, m.silver, wheel, outer, 0, 0);
  add(parts.pin, m.gold, wheel, outer, 0.26, 0);
  loco.add(wheel);
  return { mesh: wheel, r: 0.44 };
}

/** Per side: three drivers front to back, the pony wheel, then that side's (static) coupling rod. */
export function buildLocomotiveWheels(loco, m) {
  const wheels = [];
  for (const side of SIDES) {
    const x = side * LOCOMOTIVE_WHEEL_X;
    for (const z of DRIVING_WHEEL_Z) wheels.push(addDrivingWheel(loco, m, x, z));
    wheels.push(addSmallWheel(loco, m, x, 1.85));
    const rodX = x < 0 ? x - 0.12 : x + 0.12;
    add(boxGeometry(0.05, 0.1, 2.2), m.gold, loco, rodX, 0.8, -0.05);
  }
  return wheels;
}
