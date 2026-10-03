// Per-frame life for the people on the platform: a gentle idle sway for anyone standing still
// (the walker animates himself) and a head turn toward the locomotive that fades out with distance.
import * as THREE from 'three';
import { smoothstep } from '../../core/seeded-prng-and-gradient-noise.js';

// Idle motion: sway (roll and breathing stretch) and a slower nod, offset per traveler by `phase`.
const SWAY_RATE = 1.8;
const NOD_RATE = 1.35;
const ROLL = 0.018;
const NOD = 0.012;
const STRETCH = 0.008;
const MAX_HEAD_TURN = 0.85;
const LOOK_NEAR = 12;
const LOOK_FAR = 32;
const HEAD_TURN_RATE = 2.8;
const headWorld = new THREE.Vector3();
const trainLocal = new THREE.Vector3();

/** Sway (non-walkers) and clamped, distance-faded head-look for every station traveler. */
export function updateStationTravelers(world, elapsed, dt, trainPosition) {
  const walkerFigure = world.stationWalker.figure;
  for (const { figure, head, baseScale, phase } of world.stationTravelers) {
    const swayWave = Math.sin(elapsed * SWAY_RATE + phase);
    if (figure !== walkerFigure) {
      figure.rotation.z = swayWave * ROLL;
      figure.rotation.x = Math.cos(elapsed * NOD_RATE + phase) * NOD;
      figure.scale.y = baseScale * (1 + swayWave * STRETCH);
    }
    // Measured from the figure origin; both queries refresh the figure's world matrix.
    figure.getWorldPosition(headWorld);
    const distance = Math.hypot(trainPosition.x - headWorld.x, trainPosition.z - headWorld.z);
    figure.worldToLocal(trainLocal.copy(trainPosition));
    const facing = Math.atan2(trainLocal.x, trainLocal.z);
    const goal = THREE.MathUtils.clamp(facing, -MAX_HEAD_TURN, MAX_HEAD_TURN) * (1 - smoothstep(LOOK_NEAR, LOOK_FAR, distance));
    head.rotation.y += (goal - head.rotation.y) * Math.min(1, dt * HEAD_TURN_RATE);
  }
}
