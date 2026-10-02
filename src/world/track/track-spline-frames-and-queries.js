// Closed centripetal Catmull-Rom loop sampled into N + 1 arc-length frames, plus the
// nearest-sample and arc-length queries every later builder relies on.
import * as THREE from 'three';
import { positiveModulo } from '../../core/scalar-math-helpers.js';
import { TRACK_CONTROL_POINTS, UP } from '../world-constants.js';

const COARSE_STRIDE = 8;

/** Sets curve, length, frames[0..N] ({p, r outward, u}) and the Float32 sx/sz sample caches. */
export function buildTrackFrames(world) {
  const sampleCount = world.N;
  const controlPoints = TRACK_CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  world.curve = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal');
  world.length = world.curve.getLength();
  world.sx = new Float32Array(sampleCount);
  world.sz = new Float32Array(sampleCount);
  // The last frame wraps to u = 0, closing the loop for extrusions.
  for (let sample = 0; sample <= sampleCount; sample++) {
    const u = (sample / sampleCount) % 1;
    const p = world.curve.getPointAt(u);
    const tangent = world.curve.getTangentAt(u);
    const outward = new THREE.Vector3().crossVectors(tangent, UP).normalize();
    const up = new THREE.Vector3().crossVectors(outward, tangent).normalize();
    world.frames.push({ p, r: outward, u: up });
    if (sample < sampleCount) {
      world.sx[sample] = p.x;
      world.sz[sample] = p.z;
    }
  }
}

// Visits samples first..last (inclusive; one wrap into [0, N) covers the ±stride overshoot) by `stride`;
// strictly closer ones replace `best`, so ties keep the earlier winner.
function scanSamples(world, x, z, first, last, stride, best) {
  const { sx, sz, N: count } = world;
  for (let step = first; step <= last; step += stride) {
    const sample = step < 0 ? step + count : step >= count ? step - count : step;
    const squared = (sx[sample] - x) ** 2 + (sz[sample] - z) ** 2;
    if (squared < best.squared) {
      best.squared = squared;
      best.index = sample;
    }
  }
}

/** Nearest track sample in xz: a stride-8 scan, then a ±8 wrapped refinement around the winner. */
export function nearest(world, x, z) {
  const best = { index: 0, squared: Infinity };
  scanSamples(world, x, z, 0, world.N - 1, COARSE_STRIDE, best);
  const coarseWinner = best.index;
  scanSamples(world, x, z, coarseWinner - COARSE_STRIDE, coarseWinner + COARSE_STRIDE, 1, best);
  return { i: best.index, d: Math.sqrt(best.squared) };
}

// Arc-length s wrapped into the curve's [0, 1) parameter.
const wrappedU = (world, s) => positiveModulo(s / world.length, 1);

export function pointAtS(world, s, target = new THREE.Vector3()) {
  return world.curve.getPointAt(wrappedU(world, s), target);
}

export function tangentAtS(world, s, target = new THREE.Vector3()) {
  return world.curve.getTangentAt(wrappedU(world, s), target);
}
