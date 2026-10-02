// Untouched landscape before grading: rolling fbm ground, a raised rim, two hills and a
// river valley carved toward the pond. Placement code depends on these bits, so keep each
// expression's operand order and hypot / exponent choices exactly as written.
import { fbm, smoothstep, lerp } from '../../core/seeded-prng-and-gradient-noise.js';
import { HALF, POND, RIVER } from '../world-constants.js';

/** Planar distance from point p to the segment a→b. */
export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const along = ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz);
  const t = Math.max(0, Math.min(1, along));
  const closestX = ax + dx * t;
  const closestZ = az + dz * t;
  return Math.hypot(px - closestX, pz - closestZ);
}

/** Distance to the pond rim (0 inside) or to the river centre line, whichever is nearer. */
export function riverDist(x, z) {
  let nearestWater = Math.max(0, Math.hypot(x - POND.x, z - POND.z) - POND.r);
  for (let segment = 1; segment < RIVER.length; segment++) {
    const from = RIVER[segment - 1];
    const to = RIVER[segment];
    nearestWater = Math.min(nearestWater, segDist(x, z, from.x, from.z, to.x, to.z));
  }
  return nearestWater;
}

/** Terrain height before track grading and building pads. */
export function naturalHeight(x, z) {
  const rimFraction = Math.hypot(x, z) / HALF;
  let height = 6 + 6.5 * fbm(x * 0.028 + 3.1, z * 0.028 - 7.3, 4);
  height += 11 * smoothstep(0.6, 1.3, rimFraction);
  height += 11 * Math.exp(-((x + 24) ** 2 + (z + 16) ** 2) / 140);
  height += 9 * Math.exp(-((x - 24) ** 2 + (z + 10) ** 2) / 110);
  const valley = 1 - smoothstep(2.5, 17, riverDist(x, z));
  return lerp(height, -1.4, valley);
}
