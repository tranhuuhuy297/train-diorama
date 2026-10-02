// Windmill build step: picks the highest clear spot on the eastern hill, levels a pad, then builds
// the tapered tower, foundation ring, conical cap, doorway with steps, hay bales and the rotor. The
// windmill stays unmerged; its cap height also sets how high the cloud layers float.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { buildWindmillHayBales } from './windmill-hay-bales.js';
import { buildWindmillRotor } from './windmill-rotor.js';

const SEARCH_SAMPLES = 300;
const SEARCH_CENTRE_X = 24;
const SEARCH_CENTRE_Z = -10;
const SEARCH_SPAN = 16;
const DOORWAY_BOTTOM = 0.54;

/** Strictly highest sampled ground with track clearance ≥ 8; always consumes 600 draws. */
export function findWindmillSite(world) {
  let site = new THREE.Vector3(SEARCH_CENTRE_X, 0, SEARCH_CENTRE_Z);
  let highest = -Infinity;
  for (let sample = 0; sample < SEARCH_SAMPLES; sample++) {
    const x = SEARCH_CENTRE_X + (world.rand() - 0.5) * SEARCH_SPAN;
    const z = SEARCH_CENTRE_Z + (world.rand() - 0.5) * SEARCH_SPAN;
    if (world.nearest(x, z).d < 8) continue;
    const ground = world.heightAt(x, z);
    if (ground > highest) {
      highest = ground;
      site = new THREE.Vector3(x, ground, z);
    }
  }
  return site;
}

// The windmill's five materials, in creation order.
function createWindmillMaterials() {
  return {
    tower: npr({ color: '#f3ecdc', stipple: 0.15, stippleScale: 2 }),
    foundation: npr({ color: '#bda989', stipple: 0.12, stippleScale: 3 }),
    roof: npr({ color: '#c8453a', stipple: 0.15 }),
    sail: npr({ color: '#fbf4e2', stipple: 0.1, doubleSided: true }),
    wood: npr({ color: '#6e4a32', stipple: 0.1 }),
  };
}

// Mesh at local height y; returns it so the caller can read its placed position.
function addStackedPart(group, geometry, material, y) {
  const part = new THREE.Mesh(geometry, material);
  part.position.y = y;
  group.add(part);
  return part;
}

// Door, jambs, lintel, plank line, knob, then the two front steps (doorway heights stay unfolded sums).
function addDoorway(group, { wood, foundation }) {
  const bottom = DOORWAY_BOTTOM;
  box(0.66, 1.25, 0.12, wood, 0, bottom + 0.625, 1.49, group);
  for (const side of [-1, 1]) box(0.09, 1.34, 0.16, foundation, side * 0.375, bottom + 0.625, 1.5, group);
  box(0.84, 0.1, 0.16, foundation, 0, bottom + 1.3, 1.5, group);
  box(0.045, 1.16, 0.025, foundation, 0, bottom + 0.625, 1.565, group);
  box(0.055, 0.07, 0.055, foundation, 0.22, bottom + 0.59, 1.59, group);
  box(0.92, 0.12, 0.52, foundation, 0, 0.48, 1.7, group);
  box(1.08, 0.12, 0.38, foundation, 0, 0.36, 2.02, group);
}

/** Build step: site, facing (0, y, 30), pad, body, roof height, doorway, bales, rotor, exclusion. */
export function buildWindmill(world) {
  const site = findWindmillSite(world);
  const group = new THREE.Group();
  group.position.copy(site).add(new THREE.Vector3(0, -0.3, 0));
  group.lookAt(0, group.position.y, 30);
  world.flattenBuildingGround({
    x: site.x, z: site.z, height: site.y, width: 3.64, depth: 3.64, rotation: Math.atan2(-site.x, 30 - site.z), falloff: 3.5,
  });
  const materials = createWindmillMaterials();
  addStackedPart(group, new THREE.CylinderGeometry(1.0, 1.55, 5.5, 8), materials.tower, 2.75);
  addStackedPart(group, new THREE.CylinderGeometry(1.65, 1.82, 0.42, 8), materials.foundation, 0.29);
  const cap = addStackedPart(group, new THREE.ConeGeometry(1.35, 1.6, 8), materials.roof, 6.3);
  world.windmillRoofHeight = group.position.y + cap.position.y + 0.8;
  addDoorway(group, materials);
  buildWindmillHayBales(world, group);
  buildWindmillRotor(world, { wood: materials.wood, sail: materials.sail, roof: materials.roof });
  group.add(world.windmillBlades);
  world.group.add(group);
  world.exclusions.push({ x: site.x, z: site.z, r: 4.5 });
}
