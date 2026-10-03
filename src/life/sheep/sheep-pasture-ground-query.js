// Where a pasture sheep may stand: inside the base, on mid-height ground, away from the track and
// every keep-out circle, in the meadow patches of a low-frequency noise mask, and not too steep.
import { HALF } from '../../world/world-constants.js';
import { fbm } from '../../core/seeded-prng-and-gradient-noise.js';

const EDGE_LIMIT = HALF - 2;
const LOWEST = 1;
const HIGHEST = 8;
const TRACK_CLEARANCE = 5;
const KEEP_OUT_PAD = 1;
const MEADOW_FREQUENCY = 0.045;
const MEADOW_LIMIT = -0.05;
// Half-width of the central-difference slope probe.
const PROBE = 0.6;
const MIN_NORMAL_Y = 0.88;

/** Ground height for a sheep at (x, z) or null. The slope normal lands in `normalOut` once every
 * placement test has passed, so a too-steep spot still leaves its normal written. */
export function sheepGroundAt(world, x, z, normalOut) {
  if (Math.abs(x) > EDGE_LIMIT || Math.abs(z) > EDGE_LIMIT) return null;
  const height = world.heightAt(x, z);
  if (height < LOWEST || height > HIGHEST) return null;
  if (world.nearest(x, z).d < TRACK_CLEARANCE) return null;
  if (world.excluded(x, z, KEEP_OUT_PAD)) return null;
  if (fbm(x * MEADOW_FREQUENCY + 10, z * MEADOW_FREQUENCY - 3, 3) > MEADOW_LIMIT) return null;
  const slopeX = world.heightAt(x - PROBE, z) - world.heightAt(x + PROBE, z);
  const slopeZ = world.heightAt(x, z - PROBE) - world.heightAt(x, z + PROBE);
  normalOut.set(slopeX, PROBE * 2, slopeZ).normalize();
  return normalOut.y >= MIN_NORMAL_Y ? height : null;
}
