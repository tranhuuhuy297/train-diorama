// Station-stop motion as pure functions over a {s, speed, stopTimer, justLeft, speedMul} state:
// cruise, a square-root braking ramp into the station, an exact snap onto the stop, a 4 s dwell.
import { positiveModulo } from '../core/scalar-math-helpers.js';

const CRUISE_SPEED = 7.5;
const RESPONSE_RATE = 0.9;
const BRAKE_ZONE = 26;
const CREEP_SPEED = 0.35;
const DEPARTURE_WINDOW = 30;
const DWELL_SECONDS = 4;
const SPARK_SPEED_FLOOR = 0.1;
const FULL_BRAKE_DECELERATION = 3;

/** Start one unit past the station, already departing at speed 2. */
export function initTrainMotion(state, stationS) {
  state.s = stationS + 1;
  state.justLeft = true;
  state.speed = 2;
}

// Dwell: hold still; the step that runs the timer out re-arms the departure window.
function dwell(state, dt) {
  state.stopTimer -= dt;
  state.speed = 0;
  if (state.stopTimer <= 0) state.justLeft = true;
}

/** One motion step; mutates the state and returns what the brake-strength rule needs. */
export function stepTrainStationMotion(state, dt, trackLength, stationS) {
  const previousSpeed = state.speed;
  const topSpeed = CRUISE_SPEED * state.speedMul;
  const ahead = positiveModulo(stationS - state.s, trackLength);
  if (state.stopTimer > 0) {
    dwell(state, dt);
    return { stationBraking: false, previousSpeed };
  }

  if (state.justLeft && ahead > DEPARTURE_WINDOW && ahead < trackLength - DEPARTURE_WINDOW) state.justLeft = false;
  const braking = !state.justLeft && ahead < BRAKE_ZONE && topSpeed > 0;
  let target = topSpeed;
  if (braking) {
    target = Math.max(CREEP_SPEED, topSpeed * Math.sqrt(ahead / BRAKE_ZONE));
    if (target < state.speed) state.speed = target;
  }
  state.speed += (target - state.speed) * Math.min(1, dt * RESPONSE_RATE);

  const travel = state.speed * dt;
  if (braking && travel >= ahead) {
    state.s += ahead;
    state.stopTimer = DWELL_SECONDS;
    state.speed = 0;
  } else {
    state.s += travel;
  }
  return { stationBraking: braking, previousSpeed };
}

/** Deceleration-based spark strength in 0..1 (dt 0 while slowing saturates at 1). */
export function computeBrakeStrength(stationBraking, speed, previousSpeed, dt) {
  if (!stationBraking || speed <= SPARK_SPEED_FLOOR || speed >= previousSpeed) return 0;
  return Math.min(1, ((previousSpeed - speed) / dt) / FULL_BRAKE_DECELERATION);
}
