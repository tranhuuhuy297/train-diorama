// Ordered world construction. Full order once every builder exists: buildTrackFrames, findBridge,
// buildHeightmap, buildTrack, buildBridge, buildStation, buildVillage, buildWindmill, buildTerrain,
// createVillageResidents, buildTrees, buildRocksAndSheep, buildWater, buildClouds, buildBalloon,
// buildBirdPerches. Placement draws from world.rand in this order, so never reorder.
import { buildTrackFrames } from './track/track-spline-frames-and-queries.js';
import { findBridge } from './track/bridge-span-detection.js';
import { buildHeightmap } from './terrain/terrain-heightmap-grading.js';
import { buildTrack } from './track/track-ballast-rails-sleepers.js';
import { buildBridge } from './bridge/bridge-deck-girders-and-railings.js';
import { buildStation } from './station/build-station.js';
import { buildVillage } from './village/village-house-placement.js';
import { buildWindmill } from './windmill/windmill-site-and-body.js';
import { buildTerrain } from './terrain/terrain-skirt-plinth-and-water-height-texture.js';

export const WORLD_BUILD_STEPS = Object.freeze([
  { name: 'buildTrackFrames', run: buildTrackFrames },
  { name: 'findBridge', run: findBridge },
  { name: 'buildHeightmap', run: buildHeightmap },
  { name: 'buildTrack', run: buildTrack },
  { name: 'buildBridge', run: buildBridge },
  { name: 'buildStation', run: buildStation },
  { name: 'buildVillage', run: buildVillage },
  { name: 'buildWindmill', run: buildWindmill },
  // Terrain bakes the mesh and height texture last, after every building pad.
  { name: 'buildTerrain', run: buildTerrain },
].map(step => Object.freeze(step)));

/** Runs the steps in order; `skip` and `stopAfter` exist for partial builds in tests. */
export function runWorldBuildSteps(world, { stopAfter = null, skip = [] } = {}) {
  if (stopAfter !== null && !WORLD_BUILD_STEPS.some(step => step.name === stopAfter)) {
    throw new Error(`Unknown world build step: ${stopAfter}`);
  }
  const skipped = new Set(skip);
  for (const step of WORLD_BUILD_STEPS) {
    if (!skipped.has(step.name)) step.run(world);
    if (step.name === stopAfter) return;
  }
}
