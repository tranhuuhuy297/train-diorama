// The bridge spans the longest unbroken run of frames where the untouched valley floor
// drops well below the rails near the river, padded by a few frames at each end.
import { naturalHeight, riverDist } from '../terrain/river-distance-and-natural-height.js';

const CLEARANCE = 2.6;
const RIVER_REACH = 20;
const END_PADDING = 3;

function needsBridge(point) {
  return naturalHeight(point.x, point.z) < point.y - CLEARANCE && riverDist(point.x, point.z) < RIVER_REACH;
}

/** Sets world.bridge = [first, last] frame indices; the run never wraps and the top is unclamped. */
export function findBridge(world) {
  let longestStart = 0;
  let longestLength = 0;
  let runStart = -1;
  for (let index = 0; index < world.N; index++) {
    if (!needsBridge(world.frames[index].p)) {
      runStart = -1;
      continue;
    }
    if (runStart < 0) runStart = index;
    const runLength = index - runStart + 1;
    // Strictly longer only, so the earliest of equal runs wins.
    if (runLength > longestLength) {
      longestLength = runLength;
      longestStart = runStart;
    }
  }
  world.bridge = [Math.max(0, longestStart - END_PADDING), longestStart + longestLength + END_PADDING];
}

export function inBridge(world, index) {
  return index >= world.bridge[0] && index <= world.bridge[1];
}
