// Side stairs down from the platform's outer face to a levelled landing, two hand railings, and a
// gravel footpath ribbon draped over the terrain from the landing toward the hills.
import * as THREE from 'three';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { FOOTPATH_OPTIONS } from './station-palette-materials.js';
import { stationLocalToWorld } from './station-site-placement.js';

const ENTRANCE_Z = 4.6;
const STAIR_RUN = 1.8;
const STEP_COUNT = 5;
const STEP_DEPTH = 0.36;
const STEP_DROP = 0.164;
const PATH_SAMPLES = 100;
const PATH_HALF_WIDTH = 0.8;

// Outward coordinates where the flight starts (platform outer face) and ends (landing).
function stairSpan(site) {
  const start = 1.3 + site.platformExtension;
  return { start, end: start + STAIR_RUN };
}

/** Landing pad, five solid steps with nosings, then a post-post-rail railing on each side. */
export function buildStationStairs(world, site, materials) {
  const o = site.localOutward;
  const parent = site.group;
  const { start, end } = stairSpan(site);
  const landing = stationLocalToWorld(site, o * end, -0.42, ENTRANCE_Z);
  world.flattenBuildingGround({
    x: landing.x, z: landing.z, height: landing.y, width: 2.1, depth: 2.2, rotation: parent.rotation.y, falloff: 1.3,
  });
  for (let step = 0; step < STEP_COUNT; step++) {
    const top = 0.4 - (step + 1) * STEP_DROP;
    const x = o * (start + (step + 0.5) * STEP_DEPTH);
    box(STEP_DEPTH, top + 1.2, 1.5, materials.platform, x, (top - 1.2) / 2, ENTRANCE_Z, parent);
    box(0.08, 0.035, 1.5, materials.edge, x - o * 0.14, top + 0.0175, ENTRANCE_Z, parent);
  }
  // Posts at the top (platform level 0.4) and the bottom (landing level -0.42) of the flight.
  const posts = [[0, 0.4], [STAIR_RUN, -0.42]];
  for (const side of [-1, 1]) {
    const z = ENTRANCE_Z + side * 0.84;
    for (const [along, foot] of posts) box(0.08, 0.86, 0.08, materials.green, o * (start + along), foot + 0.43, z, parent);
    const rail = box(Math.hypot(1.8, 0.82), 0.08, 0.08, materials.wood, o * (start + 0.9), 0.85, z, parent);
    rail.rotation.z = -o * Math.atan2(0.82, 1.8);
  }
}

// Centre and unit tangent at PATH_SAMPLES + 1 evenly spaced curve parameters.
function sampleCrossSections(curve) {
  return Array.from({ length: PATH_SAMPLES + 1 }, (unused, sample) => {
    const u = sample / PATH_SAMPLES;
    return { centre: curve.getPoint(u), tangent: curve.getTangent(u) };
  });
}

// Edge point lifted 0.04 above the terrain, stored at float offset `at`.
function writeDrapedPoint(world, positions, at, x, z) {
  positions[at] = x;
  positions[at + 1] = world.heightAt(x, z) + 0.04;
  positions[at + 2] = z;
}

// Left then right edge per section (offset ±0.8 across the tangent), two triangles per gap.
function ribbonGeometry(world, sections) {
  const positions = new Float32Array(sections.length * 6);
  const indices = new Uint16Array((sections.length - 1) * 6);
  sections.forEach(({ centre, tangent }, section) => {
    const acrossX = tangent.z * PATH_HALF_WIDTH;
    const acrossZ = tangent.x * PATH_HALF_WIDTH;
    writeDrapedPoint(world, positions, section * 6, centre.x - acrossX, centre.z + acrossZ);
    writeDrapedPoint(world, positions, section * 6 + 3, centre.x + acrossX, centre.z - acrossZ);
  });
  for (let gap = 0; gap < sections.length - 1; gap++) {
    const near = gap * 2;
    indices.set([near, near + 2, near + 1, near + 1, near + 2, near + 3], gap * 6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.Uint16BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/** Ribbon of 101 cross sections along an open Catmull-Rom curve; every fourth centre is a keep-out circle. */
export function buildStationFootpath(world, site) {
  const material = npr(FOOTPATH_OPTIONS);
  const o = site.localOutward;
  const { end } = stairSpan(site);
  const controls = [[end, ENTRANCE_Z], [5.4, ENTRANCE_Z], [6.7, 3.8], [7.2, -1], [8.4, -7], [12, -12]];
  const curve = new THREE.CatmullRomCurve3(controls.map(([outwardCoordinate, z]) => stationLocalToWorld(site, o * outwardCoordinate, 0, z)));
  const sections = sampleCrossSections(curve);
  const geometry = ribbonGeometry(world, sections);
  for (let section = 0; section < sections.length; section += 4) {
    const { centre } = sections[section];
    world.exclusions.push({ x: centre.x, z: centre.z, r: 1.8 });
  }
  world.group.add(new THREE.Mesh(geometry, material));
}
