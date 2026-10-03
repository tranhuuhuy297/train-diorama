// Per-frame flock motion: pasture sheep doze at night and otherwise wander, turning away from ground
// they may not enter; track sheep sway around their spot on the rails (or follow their escape offset)
// and stand on the rail heads or the ballast slope. Every sheep then gets its pose written.
import { smoothstep, lerp } from '../../core/seeded-prng-and-gradient-noise.js';
import { exponentialResponse } from '../../core/scalar-math-helpers.js';
import { UP } from '../../world/world-constants.js';
import { sheepGroundAt } from './sheep-pasture-ground-query.js';
import { writeSheepInstancePose, markSheepInstancesDirty } from './sheep-instance-pose-writer.js';

const SLEEP_RATE = 1.8;
const HEIGHT_RATE = 10;
const ANGLE_RATE = 8;
const SWAY_RATE = 5;
// Turn rate while blocked, and the speed at which a route sheep reaches its full trot.
const BLOCKED_TURN = 2.4;
const FULL_TROT_SPEED = 0.65;
// Track cross-section: ballast top just above the rail bed, sloping off past its edge; rail heads higher.
const BALLAST_TOP = 0.03;
const BALLAST_EDGE = 0.95;
const BALLAST_SLOPE = 1.45;
const RAIL_GAUGE = 0.52;
const RAIL_TOP = 0.3;

// Places a route sheep around its track spot and returns the height it stands at.
function followRoute(world, sheep, elapsed, dt) {
  const route = sheep.route;
  const { preset, center, tangent, outward, offset } = route;
  sheep.x = center.x + outward.x * offset;
  sheep.z = center.z + outward.z * offset;
  const grazing = route.mode === 'track';
  const cycle = elapsed * preset.frequency + preset.phase;
  const along = grazing ? Math.sin(cycle) * preset.wanderLength : 0;
  const across = grazing ? preset.lateralBias + Math.cos(cycle * 1.3) * preset.wanderWidth : 0;
  const sway = exponentialResponse(dt, SWAY_RATE);
  route.along += (along - route.along) * sway;
  route.across += (across - route.across) * sway;
  sheep.x += tangent.x * route.along + outward.x * route.across;
  sheep.z += tangent.z * route.along + outward.z * route.across;
  if (grazing) {
    // Heading and pace from the analytic velocity of the sway figure.
    const alongRate = Math.cos(cycle) * preset.frequency * preset.wanderLength;
    const acrossRate = -Math.sin(cycle * 1.3) * preset.frequency * 1.3 * preset.wanderWidth;
    const vx = tangent.x * alongRate + outward.x * acrossRate;
    const vz = tangent.z * alongRate + outward.z * acrossRate;
    sheep.direction = Math.atan2(vx, vz);
    sheep.speed = Math.hypot(vx, vz);
  }
  const lateral = Math.abs(offset + route.across);
  const ballast = center.y + BALLAST_TOP - Math.max(0, lateral - BALLAST_EDGE) * BALLAST_SLOPE;
  const onRail = 1 - smoothstep(0.16, 0.4, Math.abs(lateral - RAIL_GAUGE));
  return Math.max(world.heightAt(sheep.x, sheep.z), lerp(ballast, center.y + RAIL_TOP, onRail));
}

/** Advances every sheep by dt (dt 0 only re-poses) and refreshes the instance matrices. */
export function updateSheepFlock(world, elapsed, dt) {
  const heightBlend = exponentialResponse(dt, HEIGHT_RATE);
  const angleBlend = exponentialResponse(dt, ANGLE_RATE);
  const sleepBlend = exponentialResponse(dt, SLEEP_RATE);
  // One slope normal shared by the whole flock: a sheep whose queries bail out early keeps the last one written.
  const normal = world.sheepTransforms.groundNormal;
  const states = world.sheepStates;
  for (let index = 0; index < states.length; index++) {
    const sheep = states[index];
    const onTrack = Boolean(sheep.route);
    // Rail sheep never sleep.
    sheep.sleep += ((onTrack ? 0 : world.nightAmount) - sheep.sleep) * sleepBlend;
    const awake = 1 - smoothstep(0, 0.65, sheep.sleep);
    sheep.direction += sheep.turnSpeed * dt * awake;
    const nextX = sheep.x + Math.sin(sheep.direction) * sheep.speed * dt * awake;
    const nextZ = sheep.z + Math.cos(sheep.direction) * sheep.speed * dt * awake;
    let height;
    if (onTrack) {
      height = followRoute(world, sheep, elapsed, dt);
      normal.copy(UP);
    } else {
      height = sheepGroundAt(world, nextX, nextZ, normal);
      if (height === null) {
        sheep.direction += BLOCKED_TURN * dt * awake;
        height = sheepGroundAt(world, sheep.x, sheep.z, normal);
      } else {
        sheep.x = nextX;
        sheep.z = nextZ;
      }
    }
    const gaitGoal = onTrack ? Math.min(1, sheep.speed / FULL_TROT_SPEED) : awake;
    sheep.gait += (gaitGoal - sheep.gait) * heightBlend;
    // Kept for parity: no valid ground counts as height 0, so a stranded sheep sinks toward y = 0.
    sheep.groundHeight += ((height === null ? 0 : height) - sheep.groundHeight) * heightBlend;
    writeSheepInstancePose(world, index, sheep, elapsed, angleBlend, awake);
  }
  markSheepInstancesDirty(world);
}
