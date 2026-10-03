// Forest layout: a fixed number of candidate spots across the base, filtered by ground, track, keep-out
// circles and slope, then accepted with a clumpy noise density that thickens toward the rim. Every
// world.rand draw happens in one fixed order, so later placements see the same stream.
import * as THREE from 'three';
import { fbm, smoothstep } from '../../core/seeded-prng-and-gradient-noise.js';
import { SIZE, HALF, UP } from '../world-constants.js';

export const TREE_SCATTER_ATTEMPTS = 14000;
// Multipliers on the vertex colours (trunks included); values above 1 survive in the float instance colours.
export const TREE_TINTS = Object.freeze([[1, 1, 1], [1.2, 1.12, 0.8], [0.85, 0.95, 0.9], [1.1, 1.05, 0.95], [0.95, 1.05, 1.1]].map(Object.freeze));
export const AUTUMN_TREE_TINT = Object.freeze([2.0, 1.05, 0.5]);
export const BLOSSOM_TREE_TINT = Object.freeze([2.3, 1.2, 1.6]);

const CONIFER = 0;
const SPAN = SIZE - 1.5;
const SLOPE_PROBE = 0.8;
// Type roll cut-offs for conifer, round and cluster; anything above is a bush.
const TYPE_CUTOFFS = [0.22, 0.55, 0.8];
const yawRotation = new THREE.Quaternion();

// Draw-free site filters, in order: dry ground, track gap (closer on the bridge), keep-outs, slope.
function isOpenSite(world, x, z, ground) {
  if (ground < 0.7) return false;
  const track = world.nearest(x, z);
  if (track.d < (world.inBridge(track.i) ? 3 : 4)) return false;
  if (world.excluded(x, z)) return false;
  const slope = Math.abs(world.heightAt(x + SLOPE_PROBE, z) - world.heightAt(x - SLOPE_PROBE, z))
    + Math.abs(world.heightAt(x, z + SLOPE_PROBE) - world.heightAt(x, z - SLOPE_PROBE));
  return !(slope > 2.4);
}

// Chance of keeping a site: noise clumps, a ramp toward the rim and a bonus on the high ground.
function acceptChance(x, z, ground) {
  const rim = Math.hypot(x, z) / HALF;
  const density = fbm(x * 0.045 + 10, z * 0.045 - 3, 3) + 0.45 * smoothstep(0.55, 1.0, rim) + (ground > 11 ? 0.2 : 0);
  return smoothstep(-0.1, 0.35, density) * 0.92 + 0.02;
}

function pickSpecies(ground, roll) {
  if (ground > 12) return CONIFER;
  const species = TYPE_CUTOFFS.findIndex(cutoff => roll < cutoff);
  return species < 0 ? TYPE_CUTOFFS.length : species;
}

/** Runs the scatter; returns per-species lists `{matrices: Matrix4[][4], colors: Color[][4]}` in push order. */
export function scatterTrees(world, attempts = TREE_SCATTER_ATTEMPTS) {
  const matrices = [[], [], [], []];
  const colors = [[], [], [], []];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const x = (world.rand() - 0.5) * SPAN;
    const z = (world.rand() - 0.5) * SPAN;
    const ground = world.heightAt(x, z);
    if (!isOpenSite(world, x, z, ground)) continue;
    if (world.rand() > acceptChance(x, z, ground)) continue;
    // The type roll is drawn even when high ground forces a conifer.
    const species = pickSpecies(ground, world.rand());
    const size = 0.75 + world.rand() * 0.75;
    yawRotation.setFromAxisAngle(UP, world.rand() * Math.PI * 2);
    const stretch = 0.9 + world.rand() * 0.3;
    const placement = new THREE.Vector3(x, ground - 0.15, z);
    matrices[species].push(new THREE.Matrix4().compose(placement, yawRotation, new THREE.Vector3(size, size * stretch, size)));
    let tint = TREE_TINTS[Math.floor(world.rand() * TREE_TINTS.length)];
    if (species !== CONIFER) {
      // Both accent rolls are drawn; blossom wins over autumn.
      if (world.rand() < 0.04) tint = AUTUMN_TREE_TINT;
      if (world.rand() < 0.02) tint = BLOSSOM_TREE_TINT;
    }
    colors[species].push(new THREE.Color(tint[0], tint[1], tint[2]));
  }
  return { matrices, colors };
}
