// Build step part: the sheep flock. Meshes first, then the pasture sheep (random stream), the trackside
// clearing and its three rail sheep, and finally a zero-length update so every matrix starts posed.
import { createSheepInstancedMeshes, SHEEP_LEGS, SHEEP_EARS } from './sheep-geometry-and-instanced-meshes.js';
import { spawnPastureSheep } from './pasture-sheep-spawner.js';
import { findTracksideFlockSite, createTrackSheep } from './trackside-sheep-flock-site.js';
import { updateSheepFlock } from './sheep-locomotion-and-route-motion.js';

/** Fills world.sheepStates / trackSheep / sheep layers and adds the layers to world.group. */
export function buildSheepFlock(world) {
  const { sheep, sheepLegs, sheepEars } = createSheepInstancedMeshes();
  spawnPastureSheep(world);
  // Scored against the pasture sheep only: the rail sheep are added afterwards.
  createTrackSheep(world, findTracksideFlockSite(world));
  const flockSize = world.sheepStates.length;
  sheep.count = flockSize;
  sheepLegs.count = flockSize * SHEEP_LEGS.length;
  sheepEars.count = flockSize * SHEEP_EARS.length;
  // Instances roam far from the geometry's bounds, so the layers are never culled.
  for (const layer of [sheep, sheepLegs, sheepEars]) layer.frustumCulled = false;
  world.sheep = sheep;
  world.sheepLegs = sheepLegs;
  world.sheepEars = sheepEars;
  world.group.add(sheep, sheepLegs, sheepEars);
  updateSheepFlock(world, 0, 0);
}
