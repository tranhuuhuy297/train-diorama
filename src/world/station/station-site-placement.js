// Station placement: the track sample nearest the target point, the stop distance, the oriented
// station group, the free-camera start and the platform-extension coordinate helpers.
import * as THREE from 'three';
import { UP } from '../world-constants.js';
import { box } from '../../geometry/procedural-geometry-helpers.js';

export const STATION_TARGET_X = -45.5;
export const STATION_TARGET_Z = -2;
// The locomotive halts this far past the platform's centre sample.
export const STATION_STOP_AHEAD = 4.5;
export const PLATFORM_DEPTH = 2.6 * 1.3;
// Kept as the computed float (0.7800000000000002): every shifted coordinate depends on its bits.
export const PLATFORM_EXTENSION = PLATFORM_DEPTH - 2.6;
const TRACK_TO_PLATFORM = 2.7;

// First sample index at the strictly smallest planar distance to the target point.
function nearestSampleIndex(world) {
  let winner = 0;
  let winnerDistance = Infinity;
  for (let sample = 0; sample < world.N; sample++) {
    const gap = Math.hypot(world.sx[sample] - STATION_TARGET_X, world.sz[sample] - STATION_TARGET_Z);
    if (gap < winnerDistance) {
      winner = sample;
      winnerDistance = gap;
    }
  }
  return winner;
}

/** Positions and orients the station group, records stationS/freeCameraStart/stationSite. */
export function placeStationSite(world) {
  const frameIndex = nearestSampleIndex(world);
  const frame = world.frames[frameIndex];
  const distance = (frameIndex / world.N) * world.length;
  world.stationS = distance + STATION_STOP_AHEAD;
  // +1 when the frame's right vector points away from the origin (the platform goes on that side).
  const side = frame.p.dot(frame.r) > 0 ? 1 : -1;
  const group = new THREE.Group();
  group.position.copy(frame.p).addScaledVector(frame.r, side * TRACK_TO_PLATFORM);
  const forward = UP.clone().cross(frame.r).normalize();
  // Aim local +Z along the track while still parentless, so no parent rotation is folded in.
  group.lookAt(new THREE.Vector3(forward.x, 0, forward.z).add(group.position));
  world.group.add(group);
  const localOutward = -side;
  const cameraX = -0.3 * localOutward;
  world.freeCameraStart = {
    position: group.localToWorld(new THREE.Vector3(cameraX, 2.1, -2.8)),
    target: group.localToWorld(new THREE.Vector3(cameraX, 2.1, 3.5)),
  };
  const site = {
    group, frame, frameIndex, distance, side, localOutward,
    outward: frame.r.clone().multiplyScalar(side), forward, platformExtension: PLATFORM_EXTENSION,
  };
  world.stationSite = site;
  return site;
}

/** Final x of a part that sits on the widened platform: x + o·E. */
export function shiftedX(site, x) {
  return x + site.localOutward * site.platformExtension;
}

/** Box on the widened platform at outward coefficient a (x = a·o + o·E), parented to the station group. */
export function addShiftedBox(site, [width, height, depth], material, coefficient, y, z) {
  return box(width, height, depth, material, shiftedX(site, coefficient * site.localOutward), y, z, site.group);
}

/** Centre line of the station building, behind the widened platform. */
export function stationBuildingX(site) {
  return site.localOutward * (2.8 + site.platformExtension);
}

/** Track-facing façade plane of the station building. */
export function stationFacadeX(site) {
  return stationBuildingX(site) - site.localOutward * 1.69;
}

/** World position of a station-group local point (fresh vector). */
export function stationLocalToWorld(site, x, y, z) {
  return site.group.localToWorld(new THREE.Vector3(x, y, z));
}

/** Large keep-out disc around the whole station, pushed after the footpath circles. */
export function addStationExclusion(world, site) {
  const reach = 3 + site.platformExtension;
  const centre = site.group.position;
  world.exclusions.push({ x: centre.x + site.outward.x * reach, z: centre.z + site.outward.z * reach, r: 8 });
}
