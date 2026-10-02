// Graded heightmap: natural ground eased onto a shelf under the track, carved open under
// the bridge. The nearest track sample per grid vertex is cached for pads and terrain colours.
import { smoothstep, lerp } from '../../core/seeded-prng-and-gradient-noise.js';
import { HALF, SEG, STEP } from '../world-constants.js';
import { naturalHeight } from './river-distance-and-natural-height.js';
import { nearest } from '../track/track-spline-frames-and-queries.js';
import { inBridge } from '../track/bridge-span-detection.js';

export const GRID_WIDTH = SEG + 1;

/** World x (column) or z (row) of a heightmap vertex; every grid consumer uses this exact form. */
export function gridCoordinate(index) {
  return -HALF + index * STEP;
}

// Row and column of flat grid index k (rows run along z).
export function gridRowColumn(k) {
  const row = Math.floor(k / GRID_WIDTH);
  return [row, k - row * GRID_WIDTH];
}

// Distance kept as float64: pad weights consume the unrounded value. Flat loops (not nested)
// keep V8 from repeatedly bailing out of on-stack-replaced inner loops on these one-shot passes.
function computeTrackNearestGrid(world) {
  const index = new Uint16Array(GRID_WIDTH * GRID_WIDTH);
  const distance = new Float64Array(GRID_WIDTH * GRID_WIDTH);
  for (let k = 0; k < index.length; k++) {
    const [row, column] = gridRowColumn(k);
    const hit = nearest(world, gridCoordinate(column), gridCoordinate(row));
    index[k] = hit.i;
    distance[k] = hit.d;
  }
  return { index, distance };
}

/** Returns the cached nearest-track grid, building it on first use (e.g. when grading was skipped). */
export function ensureTrackNearestGrid(world) {
  world.trackNearestGrid ??= computeTrackNearestGrid(world);
  return world.trackNearestGrid;
}

// Track shelf: carved to 1.8 below the rails under the bridge, eased onto rails − 0.42 elsewhere.
function gradedHeight(world, x, z, trackIndex, trackDistance) {
  const railHeight = world.frames[trackIndex].p.y;
  const natural = naturalHeight(x, z);
  if (inBridge(world, trackIndex)) return trackDistance < 3.5 ? Math.min(natural, railHeight - 1.8) : natural;
  return lerp(natural, railHeight - 0.42, 1 - smoothstep(2.3, 7.5, trackDistance));
}

export function buildHeightmap(world) {
  const grid = computeTrackNearestGrid(world);
  for (let k = 0; k < world.heights.length; k++) {
    const [row, column] = gridRowColumn(k);
    world.heights[k] = gradedHeight(world, gridCoordinate(column), gridCoordinate(row), grid.index[k], grid.distance[k]);
  }
  world.trackNearestGrid = grid;
}

// Continuous grid position of a world coordinate, clamped just inside the far edge.
const gridFraction = value => Math.min(SEG - 0.001, Math.max(0, (value + HALF) / STEP));

/** Bilinear height over the stored grid. */
export function heightAt(world, x, z) {
  const fx = gridFraction(x);
  const fz = gridFraction(z);
  const column = Math.floor(fx);
  const row = Math.floor(fz);
  const tx = fx - column;
  const tz = fz - row;
  const heights = world.heights;
  const near = row * GRID_WIDTH + column;
  const far = near + GRID_WIDTH;
  return lerp(lerp(heights[near], heights[near + 1], tx), lerp(heights[far], heights[far + 1], tx), tz);
}
