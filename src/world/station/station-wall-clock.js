// Wall clock above the station door: rim, face, a centre pin and two hand pivots that turn about
// the building's outward axis from simulation time.
import * as THREE from 'three';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { stationFacadeX } from './station-site-placement.js';

// Seconds of sim time per minute-hand turn; the hour hand turns twelve times slower.
export const STATION_CLOCK_MINUTE_PERIOD = 60;
export const STATION_CLOCK_HOUR_PERIOD = STATION_CLOCK_MINUTE_PERIOD * 12;

const CLOCK_Y = 1.77;
const CLOCK_Z = 0.5;
const DISC_SEGMENTS = 16;

// Flat cylinder turned to face the track, standing `inset` in front of the façade.
function addDisc(building, facadeX, o, { radius, thickness, inset }, material) {
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, thickness, DISC_SEGMENTS), material);
  disc.rotation.z = Math.PI / 2;
  disc.position.set(facadeX - o * inset, CLOCK_Y, CLOCK_Z);
  building.add(disc);
}

// Pivot group at the dial centre with one hand box reaching up from it (12 o'clock at rotation 0).
function addHandPivot(building, x, [width, length, depth], material) {
  const pivot = new THREE.Group();
  pivot.position.set(x, CLOCK_Y, CLOCK_Z);
  box(width, length, depth, material, 0, length / 2, 0, pivot);
  building.add(pivot);
  return pivot;
}

/** Builds the clock in draw order and exposes the hand pivots and turn direction on the world. */
export function buildStationClock(world, building, site, materials) {
  const o = site.localOutward;
  const facadeX = stationFacadeX(site);
  addDisc(building, facadeX, o, { radius: 0.25, thickness: 0.09, inset: 0.04 }, materials.darkWood);
  addDisc(building, facadeX, o, { radius: 0.21, thickness: 0.015, inset: 0.095 }, materials.cream);
  world.stationClockDirection = o;
  world.stationClockMinuteHand = addHandPivot(building, facadeX - o * 0.13, [0.018, 0.14, 0.025], materials.darkWood);
  world.stationClockHourHand = addHandPivot(building, facadeX - o * 0.15, [0.022, 0.1, 0.03], materials.darkWood);
  box(0.016, 0.035, 0.035, materials.darkWood, facadeX - o * 0.112, CLOCK_Y, CLOCK_Z, building);
}

/** Sets both hand angles from sim time; the hour hand starts a quarter turn ahead (3:00 at t = 0). */
export function updateStationClock(world, elapsed) {
  const turn = world.stationClockDirection;
  world.stationClockMinuteHand.rotation.x = (turn * elapsed * Math.PI * 2) / STATION_CLOCK_MINUTE_PERIOD;
  world.stationClockHourHand.rotation.x = turn * (Math.PI / 2 + (elapsed * Math.PI * 2) / STATION_CLOCK_HOUR_PERIOD);
}
