// Village build step: rings up to eight cottages around the pond, each levelled into the heightmap,
// built, merged into one draw per material and fenced off, then plants the shrubs. Every world.rand
// draw happens in a fixed order, and accepted pads reshape the ground later candidates are tested on.
import * as THREE from 'three';
import { POND } from '../world-constants.js';
import { mergeStaticGeometry } from '../../geometry/merge-static-geometry-by-material.js';
import { createVillagePalette } from './village-house-palette-materials.js';
import { addHouseShell, addHouseDoorAndTrim } from './village-house-body-and-roof.js';
import { addHouseWindowGlows, addHouseWindows } from './village-house-windows-and-shutters.js';
import { registerChimneySmoke } from './village-chimney-smoke.js';
import { buildVillageShrubs } from './village-shrubs-instanced.js';

const MAX_HOUSES = 8;
const MAX_TRIES = 600;
// Ring around the pond centre that candidates are drawn from.
const RING_INNER_RADIUS = 11;
const RING_WIDTH = 14;
// Keep-out circle each house leaves for trees, rocks and later placements.
const HOUSE_CLEARANCE = 2.6;

// Draw-free site tests, cheapest-first in a fixed order: height band, slope, track gap, house gap, exclusions.
function isBuildable(world, x, z, height, placed) {
  if (height < 0.9 || height > 9) return false;
  const slope = Math.abs(world.heightAt(x + 1.5, z) - world.heightAt(x - 1.5, z))
    + Math.abs(world.heightAt(x, z + 1.5) - world.heightAt(x, z - 1.5));
  if (slope > 2.2) return false;
  if (world.nearest(x, z).d < 6.5) return false;
  const centre = new THREE.Vector2(x, z);
  if (placed.some(other => other.distanceTo(centre) < 5)) return false;
  return !world.excluded(x, z, 3);
}

// Levels the pad, builds every part in insertion order and merges the static parts of this house.
function buildCottage(world, palette, site, houseNumber) {
  const { x, z, height } = site;
  const house = new THREE.Group();
  house.position.set(x, height, z);
  house.lookAt(POND.x, height, POND.z);
  const dims = { width: 2 + world.rand() * 0.8, depth: 2.2 + world.rand() * 1.0, wallHeight: 1.6 + world.rand() * 0.8 };
  addHouseWindowGlows(world, house, dims);
  world.flattenBuildingGround({
    x, z, height, width: dims.width, depth: dims.depth, rotation: Math.atan2(POND.x - x, POND.z - z), falloff: 2.8,
  });
  addHouseShell(house, dims, palette, houseNumber);
  registerChimneySmoke(world, house, dims, palette, palette.smokeGeometry);
  addHouseDoorAndTrim(house, dims, palette);
  addHouseWindows(house, dims, palette, houseNumber);
  // Every puff registered so far stays animatable (and out of the merge), not just this house's.
  mergeStaticGeometry(house, new Set(world.houseSmoke.map(puff => puff.mesh)));
  world.group.add(house);
  return { house, width: dims.width, depth: dims.depth };
}

/** Build step: houses, pads, smoke, exclusions, villageHomes (first two houses) and shrubs. */
export function buildVillage(world) {
  const palette = createVillagePalette();
  const placed = [];
  const footprints = [];
  for (let tries = 0; placed.length < MAX_HOUSES && tries < MAX_TRIES; tries++) {
    const bearing = world.rand() * Math.PI * 2;
    const reach = RING_INNER_RADIUS + world.rand() * RING_WIDTH;
    const x = POND.x + Math.cos(bearing) * reach;
    const z = POND.z + Math.sin(bearing) * reach;
    const height = world.heightAt(x, z);
    if (!isBuildable(world, x, z, height, placed)) continue;
    placed.push(new THREE.Vector2(x, z));
    footprints.push(buildCottage(world, palette, { x, z, height }, placed.length));
    world.exclusions.push({ x, z, r: HOUSE_CLEARANCE });
  }
  if (footprints.length < 2) throw new Error('Village residents require two houses');
  world.villageHomes = footprints.slice(0, 2);
  buildVillageShrubs(world, footprints);
}
