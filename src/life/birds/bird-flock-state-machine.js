// Flock behaviour as plain numbers: how close the train is to a perch (snapshot) and the
// perched → flying → returning → perched cycle with its [BIRDS] log lines. No three.js here.
import { positiveModulo } from '../../core/scalar-math-helpers.js';

// Minimum time aloft before a flock may head home, and the length of the landing approach.
const MIN_FLIGHT = 7;
const LANDING_TIME = 3.6;
// A moving train (above this speed) counts; "near" is a fixed reach or a few seconds of travel.
const MOVING_SPEED = 0.2;
const ALARM_AHEAD = 19;
const ALARM_LEAD_SECONDS = 2.5;
const ALARM_CAR_RADIUS = 12;
const CLEAR_AHEAD = 26;
const CLEAR_LEAD_SECONDS = 3;
const CLEAR_CAR_RADIUS = 24;

// Switches the flock to `mode` now and returns the intent record for the caller.
function transition(flock, mode, now, log, flags) {
  flock.mode = mode;
  flock.changedAt = now;
  return { owner: flock.id, log, ...flags };
}

/** One decision per call (first matching rule wins); null leaves the state untouched. */
export function decideBirdFlock(proximity, now, flock) {
  const id = flock.id;
  const since = now - flock.changedAt;
  switch (flock.mode) {
    case 'perched':
      if (proximity.approaching) return transition(flock, 'flying', now, `[BIRDS] Take off: ${id}, train approaches`, {});
      return null;
    case 'flying':
      if (since > MIN_FLIGHT && proximity.clear) {
        return transition(flock, 'returning', now, `[BIRDS] Return: ${id}, track clear`, { captureReturn: true });
      }
      return null;
    case 'returning':
      if (!proximity.clear) {
        return transition(flock, 'flying', now, `[BIRDS] Take off: ${id}, train interrupts landing`, { captureDeparture: true });
      }
      if (since >= LANDING_TIME) return transition(flock, 'perched', now, `[BIRDS] Perch: ${id}`, {});
      return null;
    default:
      return null;
  }
}

/** Writes {approaching, clear} for one flock into `target` (reuse one per frame) and returns it. */
export function computeFlockSnapshot(flock, trainDistance, trainSpeed, cars, trackLength, target = { approaching: false, clear: false }) {
  const ahead = positiveModulo(flock.trackDistance - trainDistance, trackLength);
  const center = flock.center;
  let nearestCar = Infinity;
  for (const car of cars) {
    const position = car.obj.position;
    nearestCar = Math.min(nearestCar, Math.hypot(position.x - center.x, position.z - center.z));
  }
  const moving = trainSpeed > MOVING_SPEED;
  target.approaching = moving && (ahead < Math.max(ALARM_AHEAD, trainSpeed * ALARM_LEAD_SECONDS) || nearestCar < ALARM_CAR_RADIUS);
  target.clear = nearestCar > CLEAR_CAR_RADIUS && !(moving && ahead < Math.max(CLEAR_AHEAD, trainSpeed * CLEAR_LEAD_SECONDS));
  return target;
}
