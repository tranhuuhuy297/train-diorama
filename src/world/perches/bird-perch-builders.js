// Where the bird flocks sit: railings along the bridge deck, the station shelter roof and a few
// grassy spots beside the track. Runs as the final build step and only creates Vector3 values, so it
// neither draws from world.rand nor allocates UUIDs. Records: {id, positions, outward, trackDistance}.
import * as THREE from 'three';

// Fractions of the bridge span, one list per flock; even flocks sit on the right rail (+1).
export const BRIDGE_PERCH_GROUPS = [
  [0.12, 0.19, 0.32],
  [0.43, 0.48],
  [0.69, 0.84, 0.89],
];
const RAIL_LATERAL = 1.67;
const RAIL_TOP = new THREE.Vector3(0, 0.96, 0);

// Shelter-roof spots as (x, z) on the sloping roof, before the outward mapping.
export const STATION_ROOF_PERCH_OFFSETS = [
  [-0.25, -1.85],
  [0.6, -0.95],
  [0.1, 1.65],
];

// Track-side clusters: a start fraction of the loop, a side and (frame offset, lateral metres) seeds.
const cluster = (fraction, side, ...offsets) => ({ fraction, side, offsets });
export const TRACKSIDE_PERCH_CLUSTERS = [
  cluster(0.08, 1, [0, 2.7], [4, 3.2], [11, 2.9]),
  cluster(0.36, -1, [0, 3.1], [7, 2.6]),
  cluster(0.56, 1, [0, 2.8], [5, 3.3], [14, 3]),
  cluster(0.73, -1, [0, 3.1], [9, 2.7]),
];
const SCAN_SPAN = 60;
const SCAN_STRIDE = 3;
const MAX_GROUND_STEP = 2.5;
const MIN_SPACING_SQUARED = 0.45;
const GROUND_LIFT = 0.025;

const loopDistance = (world, frameIndex) => (frameIndex / world.N) * world.length;

function addBridgePerches(world) {
  const [first, last] = world.bridge;
  const frameAt = fraction => first + Math.round((last - first) * fraction);
  BRIDGE_PERCH_GROUPS.forEach((fractions, group) => {
    const side = group % 2 === 0 ? 1 : -1;
    const anchor = frameAt(fractions[0]);
    const positions = fractions.map(fraction => {
      const frame = world.frames[frameAt(fraction)];
      return frame.p.clone().addScaledVector(frame.r, side * RAIL_LATERAL).add(RAIL_TOP);
    });
    world.birdPerches.push({
      id: `bridge-${group + 1}`,
      positions,
      outward: world.frames[anchor].r.clone().multiplyScalar(side),
      trackDistance: loopDistance(world, anchor),
    });
  });
}

function addStationRoofPerch(world) {
  const site = world.stationSite;
  const o = site.localOutward;
  const positions = STATION_ROOF_PERCH_OFFSETS.map(([x, z]) => {
    const local = new THREE.Vector3((0.35 + x) * o, 2.64 - x * Math.tan(0.12), z);
    // The platform widening is applied in world space, after the roof point is placed.
    return site.group.localToWorld(local).addScaledVector(site.outward, site.platformExtension);
  });
  world.birdPerches.push({ id: 'station-roof', positions, outward: site.outward.clone(), trackDistance: site.distance });
}

// First scan candidate that is off the bridge, on dry ground near rail height, outside keep-outs
// and not crowding an accepted spot; null when the whole window fails.
function scanTracksideSpot(world, start, side, lateral, accepted) {
  for (let i = 0; i < SCAN_SPAN; i += SCAN_STRIDE) {
    const frameIndex = (start + i) % world.N;
    if (world.inBridge(frameIndex)) continue;
    const frame = world.frames[frameIndex];
    const spot = frame.p.clone().addScaledVector(frame.r, side * lateral);
    const ground = world.heightAt(spot.x, spot.z);
    if (ground < 0 || Math.abs(ground - frame.p.y) > MAX_GROUND_STEP) continue;
    if (world.excluded(spot.x, spot.z)) continue;
    spot.y = ground + GROUND_LIFT;
    if (accepted.some(other => other.distanceToSquared(spot) < MIN_SPACING_SQUARED)) continue;
    return spot;
  }
  return null;
}

function addTracksidePerches(world) {
  TRACKSIDE_PERCH_CLUSTERS.forEach(({ fraction, side, offsets }, cluster) => {
    const base = Math.floor(fraction * world.N);
    const positions = [];
    for (const [frameOffset, lateral] of offsets) {
      const spot = scanTracksideSpot(world, base + frameOffset, side, lateral, positions);
      if (spot !== null) positions.push(spot);
    }
    // An empty cluster keeps its number: later ids follow the cluster index, not the record count.
    if (positions.length === 0) return;
    const firstSpot = positions[0];
    world.birdPerches.push({
      id: `trackside-${cluster + 1}`,
      positions,
      outward: world.frames[base].r.clone().multiplyScalar(side),
      trackDistance: loopDistance(world, world.nearest(firstSpot.x, firstSpot.z).i),
    });
  });
}

/** Appends every perch record to world.birdPerches: bridge, station roof, then trackside. */
export function buildBirdPerches(world) {
  addBridgePerches(world);
  addStationRoofPerch(world);
  addTracksidePerches(world);
}
