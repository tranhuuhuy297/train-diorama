// Station building body behind the platform: levelled pad, cream walls, a three-sided prism roof,
// louvred vents, ridge, roof stack and door, plus the façade trims added after the windows.
import * as THREE from 'three';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { addWallVent, addRoofVent } from '../../geometry/building-wall-and-roof-vents.js';
import { stationBuildingX, stationFacadeX, stationLocalToWorld } from './station-site-placement.js';

// Building-local z of the body centre; the building group itself sits at station z -1.
const CENTRE_Z = 0.5;
const PRISM = { radius: 2.3, length: 6.6, sides: 3, y: 2.85, squash: 0.55 };

// Smooth-normal triangular prism lying along z; the cylinder's radial normals shade the slopes.
function addPrismRoof(building, x, material) {
  const geometry = new THREE.CylinderGeometry(PRISM.radius, PRISM.radius, PRISM.length, PRISM.sides);
  geometry.rotateX(-Math.PI / 2);
  const roof = new THREE.Mesh(geometry, material);
  roof.scale.set(1, PRISM.squash, 1);
  roof.position.set(x, PRISM.y, CENTRE_Z);
  building.add(roof);
}

/** Creates the building group, levels its pad, then adds the shell parts; returns the group. */
export function buildStationBuildingShell(world, site, materials) {
  const { green, darkWood } = materials;
  const o = site.localOutward;
  const centreX = stationBuildingX(site);
  const building = new THREE.Group();
  building.position.z = -1;
  site.group.add(building);
  const pad = stationLocalToWorld(site, centreX, -0.42, -0.5);
  world.flattenBuildingGround({
    x: pad.x, z: pad.z, height: pad.y, width: 3.2, depth: 6,
    rotation: Math.atan2(site.forward.x, site.forward.z), falloff: 3,
  });
  box(3.2, 5, 6, materials.cream, centreX, -0.3, CENTRE_Z, building);
  addPrismRoof(building, centreX, materials.roof);
  // Gable vents face away from the centre: yaw π at the -z end, 0 at the +z end.
  for (const end of [-1, 1]) {
    const at = new THREE.Vector3(centreX, 1.65, CENTRE_Z + end * 3.04);
    addWallVent(building, at, ((1 - end) * Math.PI) / 2, green, darkWood);
  }
  addWallVent(building, new THREE.Vector3(centreX + o * 1.64, 1.45, CENTRE_Z), (o * Math.PI) / 2, green, darkWood);
  box(0.16, 0.1, 6.65, green, centreX, 4.12, CENTRE_Z, building);
  addRoofVent(building, new THREE.Vector3(centreX, 4.12, -1.35), green);
  box(0.08, 1.7, 0.8, green, centreX - o * 1.62, 1.25, CENTRE_Z, building);
  return building;
}

// Façade trims on the track-facing wall: [size, material key, outward inset from the façade, y, z].
const FACADE_TRIMS = [
  [[0.09, 1.75, 0.13], 'cream', 0, 1.3, -2.44],
  [[0.09, 1.75, 0.13], 'cream', 0, 1.3, 3.44],
  [[0.07, 0.12, 5.9], 'green', 0, 2.04, CENTRE_Z],
  [[0.035, 0.12, 0.035], 'wood', 0.02, 1.22, 0.24],
  [[0.42, 0.08, 1.05], 'platform', 0, 0.46, CENTRE_Z],
];

/** Pilasters, band, door knob and threshold (added after the windows). */
export function buildStationFacadeTrims(building, site, materials) {
  const facadeX = stationFacadeX(site);
  for (const [[width, height, depth], key, inset, y, z] of FACADE_TRIMS) {
    const x = inset === 0 ? facadeX : facadeX - site.localOutward * inset;
    box(width, height, depth, materials[key], x, y, z, building);
  }
}
