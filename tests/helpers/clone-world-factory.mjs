// Builds clone Worlds in node: colour management off first, the minimal DOM shim installed
// (later builders draw on canvases), then the World module loaded on demand.
import '../../src/core/disable-three-color-management.js';
import { installMinimalDomShim } from './minimal-dom-shim.mjs';

installMinimalDomShim();
const { World } = await import('../../src/world/world.js');

// Every build step after the terrain/track/bridge core. Names not registered yet are ignored
// by the clone runner; the original stepper maps them through toOriginalStep. Only pair this
// with stopAfter at or before 'buildTerrain' (the original builds village residents inline).
export const WORLD_CORE_SKIP = Object.freeze([
  'buildStation', 'buildVillage', 'buildWindmill', 'buildTrees', 'buildRocksAndSheep',
  'buildWater', 'buildClouds', 'buildBalloon', 'buildBirdPerches',
]);

export function createCloneWorld(options = {}) {
  return new World(options);
}

export { World };
