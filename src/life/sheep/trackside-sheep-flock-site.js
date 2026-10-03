// Picks the stretch of track where three sheep graze on the rails: a level shoulder with room for every
// sheep to hop clear, as close to the pasture flock as possible. No random draws.
import * as THREE from 'three';
import { UP } from '../../world/world-constants.js';
import { TRACK_SHEEP_PRESETS } from './track-sheep-escape-state-machine.js';

// Only every 12th track frame is a candidate.
const FRAME_STRIDE = 12;
const SIDES = [-1, 1];
// Shoulder / safe-spot distance from the centre line, and the keep-out left around each safe spot.
const CLEAR_DISTANCE = 3.5;
const CLEARING_RADIUS = 1.2;
const TRACK_PAD = 2;
const SHOULDER_PAD = 0.8;
const EXIT_PAD = 0.7;
const MAX_SHOULDER_STEP = 1.4;
const MAX_EXIT_STEP = 2;
// Pasture sheep within this distance of the shoulder pull the clearing toward them.
const PULL_RADIUS = 18;

// Arc length of a preset's spot when the group is centred on track frame `frameIndex`.
const routeDistance = (world, frameIndex, preset) => (frameIndex / world.N) * world.length + preset.spacing;

// Shoulder on dry ground, close to rail height and clear of buildings.
function shoulderFits(world, frame, shoulder) {
  const ground = world.heightAt(shoulder.x, shoulder.z);
  if (ground < 1 || Math.abs(ground - frame.p.y) > MAX_SHOULDER_STEP) return false;
  return !world.excluded(shoulder.x, shoulder.z, SHOULDER_PAD);
}

// Each sheep's landing spot, measured along this frame's outward vector, must be dry, level and free.
function exitsFit(world, frameIndex, frame, side) {
  return TRACK_SHEEP_PRESETS.every(preset => {
    const centre = world.pointAtS(routeDistance(world, frameIndex, preset));
    const reach = side * preset.side * CLEAR_DISTANCE;
    const x = centre.x + frame.r.x * reach;
    const z = centre.z + frame.r.z * reach;
    const ground = world.heightAt(x, z);
    return ground > 1 && Math.abs(ground - centre.y) < MAX_EXIT_STEP && !world.excluded(x, z, EXIT_PAD);
  });
}

function pasturePull(world, shoulder) {
  let pull = 0;
  for (const sheep of world.sheepStates) {
    pull += Math.max(0, PULL_RADIUS - Math.hypot(sheep.x - shoulder.x, sheep.z - shoulder.z));
  }
  return pull;
}

/** Best clearing {frameIndex, side, score}; ties keep the first candidate found. */
export function findTracksideFlockSite(world) {
  const best = { frameIndex: -1, side: 1, score: -Infinity };
  for (let frameIndex = 0; frameIndex < world.N; frameIndex += FRAME_STRIDE) {
    const frame = world.frames[frameIndex];
    if (world.inBridge(frameIndex) || world.excluded(frame.p.x, frame.p.z, TRACK_PAD)) continue;
    for (const side of SIDES) {
      const shoulder = frame.p.clone().addScaledVector(frame.r, side * CLEAR_DISTANCE);
      if (!shoulderFits(world, frame, shoulder) || !exitsFit(world, frameIndex, frame, side)) continue;
      const score = pasturePull(world, shoulder);
      if (score > best.score) Object.assign(best, { frameIndex, side, score });
    }
  }
  if (best.frameIndex < 0) throw new Error('No safe trackside sheep clearing');
  return best;
}

/** The three rail sheep with their routes, each followed by the keep-out circle around its safe spot. */
export function createTrackSheep(world, site) {
  world.trackSheep = [];
  TRACK_SHEEP_PRESETS.forEach((preset, index) => {
    const distance = routeDistance(world, site.frameIndex, preset);
    const center = world.pointAtS(distance);
    const tangent = world.tangentAtS(distance).setY(0).normalize();
    const outward = new THREE.Vector3().crossVectors(tangent, UP).normalize().multiplyScalar(site.side * preset.side);
    const route = {
      id: index + 1, preset, distance, center, tangent, outward, offset: 0, along: 0, across: preset.lateralBias,
      mode: 'track', speed: 0, clearTime: 0, reactionTime: 0, hopAge: preset.hopDuration + 0.3,
    };
    // Starts facing its safe spot, standing on the ballast, slightly bigger and out of step per index.
    const facing = Math.atan2(outward.x, outward.z);
    const sheep = {
      x: center.x, z: center.z, direction: facing,
      size: 1 + index * 0.08, phase: index * 1.7,
      speed: 0, turnSpeed: 0, route, groundHeight: center.y + 0.03,
      gait: 0, sleep: 0, orientation: new THREE.Quaternion().setFromAxisAngle(UP, facing),
    };
    world.sheepStates.push(sheep);
    world.trackSheep.push(sheep);
    const spot = center.clone().addScaledVector(outward, CLEAR_DISTANCE);
    world.exclusions.push({ x: spot.x, z: spot.z, r: CLEARING_RADIUS });
  });
}
