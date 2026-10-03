// Turns one sheep's state into instance matrices: a body leaning partly into the slope, trot bob and
// sleepy crouch, the hop arc with squash and stretch, then four swinging legs and two flapping ears.
import * as THREE from 'three';
import { UP, RIGHT } from '../../world/world-constants.js';
import { SHEEP_LEGS, SHEEP_EARS } from './sheep-geometry-and-instanced-meshes.js';
import { LANDING_TIME } from './track-sheep-escape-state-machine.js';

// Share of the slope tilt that is dropped (the body keeps 45 % of it).
const TILT_DAMPING = 0.55;
const STRIDE_RATE = 8;
const BOB_HEIGHT = 0.045;
const SINK = 0.05;
const SLEEP_DROP = 0.24;
const HIP_HEIGHT = 0.3;
const LEG_SWING = 0.4;
const HOP_TUCK = 0.85;
const SLEEP_FOLD = 1.35;
const EAR_HEIGHT = 0.82;
const EAR_FORWARD = 0.34;
// Ear flap reaches full amplitude at this walking speed.
const EAR_FULL_SPEED = 0.34;
const EAR_FLAP = 0.32;

/** Scratch objects reused by every pose write (groundNormal is also the per-frame shared slope normal). */
export function createSheepTransforms() {
  const vector = () => new THREE.Vector3();
  const rotation = () => new THREE.Quaternion();
  const matrix = () => new THREE.Matrix4();
  return {
    groundNormal: vector(), tilt: rotation(), heading: rotation(), identity: rotation(),
    position: vector(), scale: vector(), bodyMatrix: matrix(),
    legMatrix: matrix(), legWorldMatrix: matrix(), legPosition: vector(), legRotation: rotation(),
    // Unit scale shared by the leg and ear matrices.
    legScale: new THREE.Vector3(1, 1, 1),
    earPosition: vector(), earRotation: rotation(), earAngles: new THREE.Euler(0, 0, 0, 'XYZ'),
    earMatrix: matrix(), earWorldMatrix: matrix(),
  };
}

// Squash/stretch factor of the body for a route sheep's hop, landing and pre-jump crouch.
function hopStretch(route, progress) {
  const preset = route.preset;
  let stretch = 1 + 0.24 * Math.sin(Math.PI * progress) * Math.abs(1 - 2 * progress);
  const landing = Math.max(0, (route.hopAge - preset.hopDuration) / LANDING_TIME);
  stretch -= 0.22 * Math.sin(Math.PI * landing) * (1 - landing);
  if (route.mode === 'startled') {
    const crouch = 1 - Math.max(0, route.reactionTime) / preset.reactionDelay;
    stretch -= Math.sin(Math.PI * crouch) * 0.1;
  }
  return stretch;
}

/** Writes body, leg and ear matrices for sheep `index`; slerps its orientation toward slope + heading. */
export function writeSheepInstancePose(world, index, sheep, elapsed, angleBlend, wakefulness) {
  const t = world.sheepTransforms;
  t.tilt.setFromUnitVectors(UP, t.groundNormal).slerp(t.identity, TILT_DAMPING);
  t.heading.setFromAxisAngle(UP, sheep.direction);
  sheep.orientation.slerp(t.tilt.multiply(t.heading), angleBlend);

  const gait = sheep.gait;
  const stride = elapsed * STRIDE_RATE + sheep.phase;
  const swing = Math.sin(stride);
  let y = sheep.groundHeight - SINK + Math.max(0, swing) * BOB_HEIGHT * sheep.size * gait;
  y -= sheep.sleep * sheep.size * SLEEP_DROP;
  let hopArc = 0;
  let stretch = 1;
  const route = sheep.route;
  if (route) {
    const progress = Math.min(1, route.hopAge / route.preset.hopDuration);
    hopArc = 4 * progress * (1 - progress);
    y += hopArc * route.preset.hopHeight;
    stretch = hopStretch(route, progress);
  }
  const width = 1 / Math.sqrt(stretch);
  t.position.set(sheep.x, y, sheep.z);
  t.scale.set(sheep.size * width, sheep.size * stretch, sheep.size * width);
  t.bodyMatrix.compose(t.position, sheep.orientation, t.scale);
  world.sheep.setMatrixAt(index, t.bodyMatrix);

  for (let k = 0; k < SHEEP_LEGS.length; k++) {
    const leg = SHEEP_LEGS[k];
    const front = Math.sign(leg.z);
    const angle = swing * LEG_SWING * leg.swing * gait + hopArc * HOP_TUCK * front + sheep.sleep * front * SLEEP_FOLD;
    t.legPosition.set(leg.x, HIP_HEIGHT, leg.z);
    t.legRotation.setFromAxisAngle(RIGHT, angle);
    t.legMatrix.compose(t.legPosition, t.legRotation, t.legScale);
    t.legWorldMatrix.multiplyMatrices(t.bodyMatrix, t.legMatrix);
    world.sheepLegs.setMatrixAt(index * SHEEP_LEGS.length + k, t.legWorldMatrix);
  }

  const flap = THREE.MathUtils.clamp(sheep.speed / EAR_FULL_SPEED, 0, 1) * EAR_FLAP * wakefulness;
  for (let k = 0; k < SHEEP_EARS.length; k++) {
    const ear = SHEEP_EARS[k];
    const earStride = stride + ear.phase;
    const roll = Math.sin(earStride - 0.6) * flap + Math.sin(earStride * 2) * flap * 0.2;
    t.earPosition.set(ear.x, EAR_HEIGHT, EAR_FORWARD);
    t.earAngles.set(0, ear.heading, roll);
    t.earRotation.setFromEuler(t.earAngles);
    t.earMatrix.compose(t.earPosition, t.earRotation, t.legScale);
    t.earWorldMatrix.multiplyMatrices(t.bodyMatrix, t.earMatrix);
    world.sheepEars.setMatrixAt(index * SHEEP_EARS.length + k, t.earWorldMatrix);
  }
}

/** Flags all three instance buffers for upload. */
export function markSheepInstancesDirty(world) {
  world.sheep.instanceMatrix.needsUpdate = true;
  world.sheepLegs.instanceMatrix.needsUpdate = true;
  world.sheepEars.instanceMatrix.needsUpdate = true;
}
