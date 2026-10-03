// Airborne bird motion: capped turn toward a target attitude (heading, pitch along the climb, bank
// into turns) and the wing beat with glides, take-off crouch, landing flare and touchdown squash.
import * as THREE from 'three';
import { wrapAngle } from '../../core/scalar-math-helpers.js';

const { smoothstep, clamp } = THREE.MathUtils;
const MAX_TURN_RATE = 4;
const MIN_MOVE_SQUARED = 0.00000001;
const PITCH_FACTOR = 0.55;
const BANK_FACTOR = 0.22;
const MAX_BANK = 0.48;
const WING_BEAT = 21;

/** Slerps the figure toward `targetQuaternion`: an eased share of the gap, at most 4 rad/s. */
export function rotateBirdTowards(bird, targetQuaternion, response, dt) {
  const quaternion = bird.figure.quaternion;
  quaternion.rotateTowards(targetQuaternion, Math.min(quaternion.angleTo(targetQuaternion) * response, dt * MAX_TURN_RATE));
}

/** Faces the frame's travel `direction`, banking by the heading change since last frame's velocity. */
export function orientBirdAlongFlight(bird, direction, dt, response, { targetRotation: aim, targetQuaternion: aimQuaternion }) {
  if (direction.lengthSq() <= MIN_MOVE_SQUARED) return;
  const { x, y, z } = direction;
  const yaw = Math.atan2(x, z);
  const turn = wrapAngle(yaw - Math.atan2(bird.velocity.x, bird.velocity.z));
  const bank = dt > 0 ? clamp(-turn / dt * BANK_FACTOR, -MAX_BANK, MAX_BANK) : 0;
  const pitch = -Math.atan2(y, Math.hypot(x, z)) * PITCH_FACTOR;
  aimQuaternion.setFromEuler(aim.set(pitch, yaw, bank));
  rotateBirdTowards(bird, aimQuaternion, response, dt);
}

/** Wing, tail and body pose for a flying or returning bird at sim time `elapsed`. */
export function animateBirdWingsAndBody(bird, flock, elapsed, response) {
  const { delay, phase, airborneDeparture: airborne, body, tail } = bird;
  const returning = flock.mode === 'returning';
  const sinceChange = elapsed - flock.changedAt;
  const age = sinceChange - delay;
  // Crouch-and-spring right before a take-off from the perch.
  const anticipation = airborne ? 0 : Math.sin(clamp(age / 0.28, 0, 1) * Math.PI) ** 2;
  const landing = returning ? smoothstep(sinceChange, 2.3, 3.2 + delay) : 0;
  const contactAge = sinceChange - 2.8 - delay;
  const settle = smoothstep(contactAge, 0, 0.4);
  let spread;
  if (returning) spread = 1 - smoothstep(sinceChange, 2.95 + delay, 3.2 + delay);
  else spread = airborne ? 1 : smoothstep(age, 0.12, 0.5);
  const glide = smoothstep(Math.sin(elapsed * 1.4 + phase), 0.45, 0.8);
  const stroke = elapsed * WING_BEAT + phase;
  // Beat strength (smaller while gliding) and the take-off crouch / touchdown squash.
  const amplitude = spread * (0.75 - glide * 0.57);
  const squash = returning ? Math.sin(Math.PI * settle) * 0.14 : anticipation * 0.18;
  const flare = landing * (1 - settle);

  body.scale.set(1 + squash * 0.3, 1 - squash, 1 + squash * 0.2);
  body.position.y = Math.sin(stroke - 0.7) * 0.018 * spread;
  body.rotation.x = anticipation * 0.18 - flare * 0.2 + Math.sin(stroke - 0.9) * 0.045 * spread;
  const tailGoal = -0.2 + flare * 0.55 + Math.sin(stroke - 1.3) * 0.16 * spread;
  tail.rotation.x += (tailGoal - tail.rotation.x) * response;
  const folded = 1 - spread;
  for (const { pivot, tip, side } of bird.wings) {
    pivot.rotation.y = side * 1.35 * folded;
    pivot.rotation.z = side * (-0.12 * folded + Math.sin(stroke) * amplitude);
    pivot.scale.set(0.6 + 0.4 * spread, 1, 0.8 + 0.2 * spread);
    tip.rotation.z = side * (Math.sin(stroke - 0.75) * amplitude * 0.6);
    tip.rotation.y = side * (0.18 * folded + (0.12 + Math.sin(stroke - 0.5) * 0.12) * spread);
  }
}
