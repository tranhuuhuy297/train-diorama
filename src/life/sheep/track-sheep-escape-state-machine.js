// The three sheep that graze on the rails: each watches the train and runs
// track → startled → escaping (a hop off the line) → waiting → returning → track.
// Pure numbers only (no three.js), so the state machine runs in plain node.
import { positiveModulo } from '../../core/scalar-math-helpers.js';

// Per-sheep tuning; shared by reference with each route (never frozen).
export const TRACK_SHEEP_PRESETS = [
  {
    spacing: -2.7, side: 1, phase: 0.4, frequency: 0.53, wanderLength: 0.65, wanderWidth: 0.2, lateralBias: -0.1,
    reactionDelay: 0.06, escapeSpeed: 3.8, hopHeight: 0.58, hopDuration: 0.64, returnDelay: 5,
  },
  {
    spacing: -0.15, side: -1, phase: 2.7, frequency: 0.72, wanderLength: 0.48, wanderWidth: 0.16, lateralBias: 0.18,
    reactionDelay: 0.38, escapeSpeed: 3.4, hopHeight: 0.46, hopDuration: 0.72, returnDelay: 6.3,
  },
  {
    spacing: 3.05, side: 1, phase: 4.5, frequency: 0.44, wanderLength: 0.8, wanderWidth: 0.23, lateralBias: -0.17,
    reactionDelay: 0.2, escapeSpeed: 4.1, hopHeight: 0.66, hopDuration: 0.6, returnDelay: 5.7,
  },
];

// Sideways distance of the safe spot beside the track, and the amble speed back onto it.
const SAFE_OFFSET = 3.5;
const RETURN_SPEED = 0.65;
// The hop pose settles for this long after landing.
export const LANDING_TIME = 0.3;
// Danger windows: a fixed reach ahead or 3.2 s of travel, and the train's length plus a margin behind.
const WARN_AHEAD = 18;
const WARN_LEAD_SECONDS = 3.2;
const TAIL_MARGIN = 5;
// Too close to wait out the reaction delay.
const PANIC_AHEAD = 5;
const PANIC_LEAD_SECONDS = 1.5;

const startles = id => `[SHEEP] Startles: approaching train, sheep ${id}`;
const jumps = id => `[SHEEP] Jumps off track: sheep ${id}`;
const returns = id => `[SHEEP] Returns to track: train clear, sheep ${id}`;

// Offset the current mode walks toward (a startled sheep freezes where it is).
function goalOffset(route) {
  switch (route.mode) {
    case 'escaping':
    case 'waiting': return SAFE_OFFSET;
    case 'startled': return route.offset;
    default: return 0;
  }
}

function goalSpeed(route) {
  if (route.mode === 'escaping') return route.preset.escapeSpeed;
  return route.mode === 'returning' ? RETURN_SPEED : 0;
}

/** One step of a track sheep against the train {distance, speed, length}; returns the step's last
 * log line or null. A startle and a jump in the same step keep only the jump line. */
export function advanceTrackSheep(route, train, trackLength, dt) {
  const preset = route.preset;
  route.hopAge = Math.min(preset.hopDuration + LANDING_TIME, route.hopAge + dt);
  const ahead = positiveModulo(route.distance - train.distance, trackLength);
  const sinceTail = (trackLength - ahead) % trackLength;
  const tailNear = sinceTail < train.length + TAIL_MARGIN;
  let event = null;
  if (ahead < Math.max(WARN_AHEAD, train.speed * WARN_LEAD_SECONDS) || tailNear) {
    route.clearTime = 0;
    if (route.mode === 'track' || route.mode === 'returning') {
      route.mode = 'startled';
      route.reactionTime = preset.reactionDelay;
      event = startles(route.id);
    }
  } else {
    route.clearTime += dt;
    if (route.mode === 'waiting' && route.clearTime > preset.returnDelay) {
      route.mode = 'returning';
      event = returns(route.id);
    }
  }
  // Once startled there is no way back: the hop follows even if the danger has passed.
  if (route.mode === 'startled') {
    route.reactionTime -= dt;
    if (route.reactionTime <= 0 || ahead < Math.max(PANIC_AHEAD, train.speed * PANIC_LEAD_SECONDS) || tailNear) {
      route.mode = 'escaping';
      route.hopAge = 0;
      event = jumps(route.id);
    }
  }
  const remaining = goalOffset(route) - route.offset;
  const step = Math.sign(remaining) * Math.min(Math.abs(remaining), goalSpeed(route) * dt);
  route.offset += step;
  route.speed = dt > 0 ? Math.abs(step) / dt : 0;
  // The final step lands exactly on the goal, so plain equality is the arrival test.
  if (route.mode === 'escaping' && route.offset === SAFE_OFFSET) route.mode = 'waiting';
  if (route.mode === 'returning' && route.offset === 0) route.mode = 'track';
  return event;
}

/** Steps every track sheep, logs its event, and hands the route's pace and heading to the sheep. */
export function advanceTrackSheepFlock(world, trainMotion, dt) {
  const members = world.trackSheep;
  for (let index = 0; index < members.length; index++) {
    const sheep = members[index];
    const route = sheep.route;
    const event = advanceTrackSheep(route, trainMotion, world.length, dt);
    if (event !== null) console.log(event);
    sheep.speed = route.speed;
    // Faces away from the track, or back toward it while returning; the + 0 also turns −0 into +0.
    sheep.direction = Math.atan2(route.outward.x, route.outward.z) + (route.mode === 'returning' ? Math.PI : 0);
  }
}
