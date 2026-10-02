// Mossbrook station build step. Call order is fixed: it decides material ids, merge batches,
// child (draw) order, pad order in the heightmap and the order of world.exclusions.
import { mergeStaticGeometry } from '../../geometry/merge-static-geometry-by-material.js';
import { createStationMaterials } from './station-palette-materials.js';
import { placeStationSite, addStationExclusion } from './station-site-placement.js';
import { buildPlatformAndEdge, buildShelter, buildBench } from './station-platform-shelter-bench.js';
import { buildStationBuildingShell, buildStationFacadeTrims } from './station-building-shell-and-roof.js';
import { buildStationWindows } from './station-building-windows-and-shutters.js';
import { buildStationClock } from './station-wall-clock.js';
import { buildStationNameBoard, buildStationSign } from './station-name-board-sign.js';
import { buildTravelerSuitcases, buildGrandmotherSuitcaseStack } from './station-luggage-props.js';
import { buildStationLamps } from './station-lamps-with-night-glow.js';
import { buildStationStairs, buildStationFootpath } from './station-stairs-railings-footpath.js';

export function buildStation(world) {
  const site = placeStationSite(world);
  const materials = createStationMaterials();
  buildPlatformAndEdge(site, materials);
  buildShelter(site, materials);
  buildBench(site, materials);

  const building = buildStationBuildingShell(world, site, materials);
  buildStationWindows(world, building, site, materials);
  buildStationFacadeTrims(building, site, materials);
  buildStationClock(world, building, site, materials);
  // One draw call per material for the static building; the hand pivots must stay animatable.
  mergeStaticGeometry(building, new Set([world.stationClockMinuteHand, world.stationClockHourHand]));

  buildStationNameBoard(site, materials);
  buildStationSign(site);
  // Walking traveler slot: his figure joins the station group here, before his cases.
  buildTravelerSuitcases(site);
  // Grandmother slot: her figure joins here (reusing the traveler parts), before her stacked cases.
  buildGrandmotherSuitcaseStack(site);
  buildStationLamps(world, site, materials);

  // Pads first: the footpath drapes over the already levelled heights.
  buildStationStairs(world, site, materials);
  buildStationFootpath(world, site);
  addStationExclusion(world, site);
}
