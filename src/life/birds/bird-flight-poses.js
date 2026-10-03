// Where each bird is in each flock mode: resting on its perch (with idle head bobs written to the
// shared target rotation), circling an orbit in front of the perch, or gliding home on an arc.
import * as THREE from 'three';

const { smoothstep, clamp } = THREE.MathUtils;
// Orbit in front of the perch: outward reach ± swing, tangential sweep, vertical bob.
const ORBIT_REACH = 7;
const ORBIT_SWING = 3;
const ORBIT_SWEEP = 5;
const ORBIT_SPEED = 0.72;
const TAKE_OFF_LEAD = 0.28;
const CLIMB_TIME = 2.2;
const HOMING_TIME = 2.8;
const HOP_HEIGHT = 0.7;
// Folded wings: shoulders swept back along the body, slightly drooped and shrunk; tips tucked in.
const FOLD_DROOP = 0.12;
const FOLD_SWEEP = 1.35;
const FOLDED_SCALE = [0.6, 1, 0.8];
const TIP_TUCK = 0.18;
const TAIL_REST = -0.2;

// Resting pose on the perch: neutral body, tail down, wings folded, no carried launch speed.
function settleOnPerch(bird) {
  const { figure, body, tail, home, wings } = bird;
  figure.position.copy(home);
  bird.departure.copy(home);
  body.scale.setScalar(1);
  body.position.y = 0;
  body.rotation.x = 0;
  tail.rotation.x = TAIL_REST;
  bird.airborneDeparture = false;
  bird.departureVelocity.set(0, 0, 0);
  for (const wing of wings) {
    const { pivot, tip, side } = wing;
    pivot.rotation.z = -FOLD_DROOP * side;
    pivot.rotation.y = FOLD_SWEEP * side;
    pivot.scale.fromArray(FOLDED_SCALE);
    tip.rotation.z = 0;
    tip.rotation.y = TIP_TUCK * side;
  }
}

/** Pose functions keyed by flock mode; they write into the shared scratch {targetRotation, nextPosition}. */
export function createBirdFlightPoses({ targetRotation, nextPosition }) {
  return {
    perched(bird, _flock, time) {
      const phase = bird.phase;
      // Occasional quick peck (a sharp sine power) and a slow look around, written as the aim.
      const peck = Math.max(0, Math.sin(time * 1.6 + phase)) ** 12 * 0.2;
      targetRotation.set(peck, bird.heading + Math.sin(time * 0.8 + phase) * 0.25, 0);
      settleOnPerch(bird);
    },

    flying(bird, flock, time) {
      const { phase, delay } = bird;
      const lead = bird.airborneDeparture ? 0 : delay + TAKE_OFF_LEAD;
      const age = Math.max(0, time - flock.changedAt - lead);
      const angle = age * ORBIT_SPEED + phase * 0.12;
      nextPosition.copy(flock.center)
        .addScaledVector(flock.outward, ORBIT_REACH + Math.sin(angle) * ORBIT_SWING)
        .addScaledVector(flock.tangent, Math.cos(angle) * ORBIT_SWEEP + Math.sin(phase));
      nextPosition.y = flock.flightHeight + Math.sin(angle * 2 + phase) * 0.5 + delay;
      // Ease from the take-off point onto the orbit; leftover launch speed fades as the climb completes.
      const lift = smoothstep(age, 0, CLIMB_TIME);
      const position = bird.figure.position.lerpVectors(bird.departure, nextPosition, lift);
      position.addScaledVector(bird.departureVelocity, age * (1 - lift));
    },

    returning(bird, flock, time) {
      const duration = HOMING_TIME + bird.delay;
      const t = clamp((time - flock.changedAt) / duration, 0, 1);
      const eased = (t * t) * (3 - 2 * t);
      const position = bird.figure.position.lerpVectors(bird.returnStart, bird.home, eased);
      // Carry the flight momentum early on, and hop up over the arc.
      position.addScaledVector(bird.returnVelocity, duration * t * (1 - t) ** 2);
      position.y += Math.sin(eased * Math.PI) ** 2 * HOP_HEIGHT;
    },
  };
}
