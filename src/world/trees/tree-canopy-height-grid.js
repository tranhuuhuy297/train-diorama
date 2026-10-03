// Coarse top-of-canopy height field over the base (plus a margin), stamped from every tree and bush
// instance so cameras and birds can stay above the foliage with a cheap square query.
import * as THREE from 'three';
import { HALF } from '../world-constants.js';

export const CANOPY_CELL_SIZE = 2;
export const CANOPY_HALF = HALF + 8;
export const CANOPY_GRID_SIZE = Math.ceil((CANOPY_HALF * 2) / CANOPY_CELL_SIZE);
// Wind sway moves foliage this far past its static bounds.
const SWAY_MARGIN = 0.6;
const LAST_CELL = CANOPY_GRID_SIZE - 1;
const stampBounds = new THREE.Box3();

/** Zero-filled grid, row = z cell, column = x cell. */
export function createCanopyHeightGrid() {
  return new Float32Array(CANOPY_GRID_SIZE * CANOPY_GRID_SIZE);
}

// Unclamped cell index of a world coordinate along x or z.
const cellOf = coordinate => Math.floor((coordinate + CANOPY_HALF) / CANOPY_CELL_SIZE);

// Max of every cell in the inclusive rectangle, starting from `floor`; rows outer, columns inner.
function maxOverCells(grid, columnFrom, columnTo, rowFrom, rowTo, floor) {
  let highest = floor;
  for (let row = rowFrom; row <= rowTo; row++) {
    for (let column = columnFrom; column <= columnTo; column++) highest = Math.max(highest, grid[row * CANOPY_GRID_SIZE + column]);
  }
  return highest;
}

/** Raises every cell under the instance's padded world bounds to at least the bounds' top. */
export function stampCanopyHeights(world, geometry, matrix) {
  stampBounds.copy(geometry.boundingBox).applyMatrix4(matrix).expandByScalar(SWAY_MARGIN);
  const { min, max } = stampBounds;
  const grid = world.treeCanopyHeights;
  const columnTo = Math.min(LAST_CELL, cellOf(max.x));
  const rowTo = Math.min(LAST_CELL, cellOf(max.z));
  for (let row = Math.max(0, cellOf(min.z)); row <= rowTo; row++) {
    for (let column = Math.max(0, cellOf(min.x)); column <= columnTo; column++) {
      const cell = row * CANOPY_GRID_SIZE + column;
      grid[cell] = Math.max(grid[cell], max.y);
    }
  }
}

/** Highest canopy over [x ± radius] × [z ± radius]; 0 with no trees there or entirely off the grid. */
export function treeCanopyHeightAt(world, x, z, radius) {
  // Low ends clamp only from below and high ends only from above, so a square off the grid is empty.
  return maxOverCells(
    world.treeCanopyHeights,
    Math.max(0, cellOf(x - radius)), Math.min(LAST_CELL, cellOf(x + radius)),
    Math.max(0, cellOf(z - radius)), Math.min(LAST_CELL, cellOf(z + radius)),
    0,
  );
}
