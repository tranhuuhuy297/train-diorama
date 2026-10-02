// Levels a rotated rectangular pad (footprint + 0.8 margin) into the heightmap with a quintic
// falloff that spares earlier pads and the graded track bed.
import * as THREE from 'three';
import { lerp } from '../../core/seeded-prng-and-gradient-noise.js';
import { HALF, SEG, STEP } from '../world-constants.js';
import { GRID_WIDTH, gridCoordinate, ensureTrackNearestGrid } from './terrain-heightmap-grading.js';

const PAD_MARGIN = 0.8;
// Earlier pads keep their level within this distance of their own rectangle.
const EARLIER_PAD_BLEND = 0.8;
const { smootherstep } = THREE.MathUtils;

// Distance from (px, pz) to the pad rectangle in its own rotated frame; 0 inside.
function distanceOutsidePad(px, pz, pad) {
  const cos = Math.cos(pad.rotation);
  const sin = Math.sin(pad.rotation);
  const dx = px - pad.x;
  const dz = pz - pad.z;
  // Overhang past each half-extent along the pad's own axes; 0 while within it.
  const overWidth = Math.max(0, Math.abs(cos * dx - sin * dz) - pad.halfWidth);
  const overDepth = Math.max(0, Math.abs(sin * dx + cos * dz) - pad.halfDepth);
  return Math.hypot(overWidth, overDepth);
}

// Inclusive grid index range covering centre ± reach, clamped to the grid.
function gridSpan(centre, reach) {
  return [Math.max(0, Math.floor((centre - reach + HALF) / STEP)), Math.min(SEG, Math.ceil((centre + reach + HALF) / STEP))];
}

/** Blends heights toward `pad.height` around the pad, then records it in world.buildingFoundations. */
export function flattenBuildingGround(world, spec) {
  const { falloff } = spec;
  // Recorded field order is part of world.buildingFoundations' observable shape.
  const pad = {
    x: spec.x, z: spec.z, height: spec.height,
    halfWidth: spec.width / 2 + PAD_MARGIN, halfDepth: spec.depth / 2 + PAD_MARGIN,
    rotation: spec.rotation, falloff,
  };
  const reach = Math.hypot(pad.halfWidth, pad.halfDepth) + falloff;
  const [firstColumn, lastColumn] = gridSpan(pad.x, reach);
  const [firstRow, lastRow] = gridSpan(pad.z, reach);
  const trackGrid = ensureTrackNearestGrid(world);
  const earlierPads = world.buildingFoundations;
  for (let row = firstRow; row <= lastRow; row++) {
    for (let column = firstColumn; column <= lastColumn; column++) {
      const px = gridCoordinate(column);
      const pz = gridCoordinate(row);
      const outside = distanceOutsidePad(px, pz, pad);
      if (outside >= falloff) continue;
      let weight = 1 - smootherstep(outside, 0, falloff);
      for (const earlier of earlierPads) weight *= smootherstep(distanceOutsidePad(px, pz, earlier), 0, EARLIER_PAD_BLEND);
      const k = row * GRID_WIDTH + column;
      weight *= smootherstep(trackGrid.distance[k], 2.3, 3.5);
      world.heights[k] = lerp(world.heights[k], pad.height, weight);
    }
  }
  earlierPads.push(pad);
}
