// Six round shrubs hugging each cottage (two behind, two per side, none in front), all in one
// instanced mesh. Size, tint and yaw cycle on a running index, so no random draws are needed.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { jitter } from '../../geometry/procedural-geometry-helpers.js';

export const SHRUB_COLORS = Object.freeze(['#4c9a38', '#65ab41', '#3f873d', '#79ad43']);
const SHRUBS_PER_HOUSE = 6;

// House-local (x, z) ground spots for one footprint, in instance order.
function shrubSpots(width, depth) {
  const back = -depth / 2 - 0.12;
  const left = -width / 2 - 0.12;
  const right = width / 2 + 0.12;
  return [
    [-width * 0.27, back], [width * 0.27, back],
    [left, -depth * 0.28], [left, depth * 0.28],
    [right, -depth * 0.28], [right, depth * 0.28],
  ];
}

/** Builds the instanced shrubs for every placed house (heights sampled now) and adds them to world.group. */
export function buildVillageShrubs(world, houseFootprints) {
  const geometry = jitter(new THREE.IcosahedronGeometry(1, 1), 0.12, 19);
  geometry.computeVertexNormals();
  const material = npr({ color: '#ffffff', stipple: 0.2, stippleScale: 3 });
  const shrubs = new THREE.InstancedMesh(geometry, material, houseFootprints.length * SHRUBS_PER_HOUSE);
  const placement = new THREE.Object3D();
  const ground = new THREE.Vector3();
  let index = 0;
  for (const { house, width, depth } of houseFootprints) {
    house.updateMatrixWorld(true);
    for (const [localX, localZ] of shrubSpots(width, depth)) {
      house.localToWorld(ground.set(localX, 0, localZ));
      const size = 0.38 + (index % 4) * 0.055;
      placement.position.set(ground.x, world.heightAt(ground.x, ground.z) + size * 0.48, ground.z);
      placement.scale.set(size, size * 0.83, size * 0.9);
      placement.rotation.y = index * 2.4;
      placement.updateMatrix();
      shrubs.setMatrixAt(index, placement.matrix);
      shrubs.setColorAt(index, new THREE.Color(SHRUB_COLORS[index % SHRUB_COLORS.length]));
      index += 1;
    }
  }
  shrubs.instanceMatrix.needsUpdate = true;
  shrubs.instanceColor.needsUpdate = true;
  world.group.add(shrubs);
  return shrubs;
}
