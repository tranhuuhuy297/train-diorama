// The cloud field: three bands of puffy blob clusters (high, far, and a low bank below the front
// edge), each cloud a single instanced icosahedron mesh. Clouds are the last world.rand consumer.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { SIZE, HALF } from '../world-constants.js';

// Small accent puffs pushed out past the outermost blob along -x, +x, -z, +z.
const ACCENT_DIRECTIONS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const CLUSTER_SPACING = 3.2;

function spawner(count, minimumHeight, heightRange, minimumDepth, depthRange, travelWidth, fadeWidth, size, minimumSpeed, speedRange) {
  return { count, minimumHeight, heightRange, minimumDepth, depthRange, travelWidth, fadeWidth, size, minimumSpeed, speedRange };
}

/** Bands in spawn order: high over the board, far behind it, and the low bank past the front edge. */
export function createCloudSpawners(windmillRoofHeight) {
  return [
    spawner(8, windmillRoofHeight + 15, 10, -18, 75, 220, 28, 1, 1.2, 1.5),
    spawner(7, windmillRoofHeight + 7, 12, -73, 30, 220, 28, 1.6, 1.2, 1.5),
    spawner(18, -4, 4, HALF + 10, 18, SIZE, 12, 1.1, 0.8, 0.7),
  ];
}

// Blobs alternate between 2-3 clusters spread along x; each blob takes 8 draws.
function addBlobs(group, rand, blobShape, cloudMaterial) {
  const blobCount = 8 + Math.floor(rand() * 5);
  const clusterCount = 2 + Math.floor(rand() * 2);
  const blobs = [];
  for (let index = 0; index < blobCount; index++) {
    const puff = new THREE.Mesh(blobShape, cloudMaterial);
    const size = 1.3 + rand() * 2;
    puff.scale.set(size, size * (0.7 + rand() * 0.2), size);
    const clusterX = (index % clusterCount - (clusterCount - 1) / 2) * CLUSTER_SPACING;
    const x = clusterX + (rand() + rand() - 1) * 1.8;
    const y = (rand() + rand() - 1) * 0.9;
    const z = (rand() + rand() - 1) * 2;
    puff.position.set(x, y, z);
    group.add(puff);
    blobs.push({ position: puff.position, size });
  }
  return blobs;
}

// The blob reaching furthest along (dx, dz); ties keep the earlier blob.
function outermostBlob(blobs, dx, dz) {
  const reach = blob => blob.position.x * dx + blob.position.z * dz + blob.size;
  let best = blobs[0];
  for (const candidate of blobs) {
    if (reach(candidate) > reach(best)) best = candidate;
  }
  return best;
}

function addEdgeAccents(group, blobs, blobShape, cloudMaterial) {
  for (const [dx, dz] of ACCENT_DIRECTIONS) {
    const { position, size } = outermostBlob(blobs, dx, dz);
    const accent = new THREE.Mesh(blobShape, cloudMaterial);
    accent.scale.set(size * 0.38, size * 0.34, size * 0.38);
    accent.position.set(position.x + dx * size * 0.78, position.y - size * 0.18, position.z + dz * size * 0.78);
    group.add(accent);
  }
}

// Bakes the temporary child meshes into one InstancedMesh; returns sphere colliders and the cloud radius.
function instanceChildren(group, blobShape, cloudMaterial) {
  const parts = group.children.slice();
  const instanced = new THREE.InstancedMesh(blobShape, cloudMaterial, parts.length);
  const colliders = [];
  let radius = 0;
  parts.forEach((part, index) => {
    part.updateMatrix();
    instanced.setMatrixAt(index, part.matrix);
    const partRadius = Math.max(part.scale.x, part.scale.y, part.scale.z);
    colliders.push({ position: part.position.clone(), radius: partRadius });
    radius = Math.max(radius, part.position.length() + partRadius);
  });
  instanced.computeBoundingSphere();
  group.clear();
  group.add(instanced);
  return { colliders, radius };
}

export function buildClouds(world) {
  const rand = world.rand;
  const cloudMaterial = npr({ color: '#ffffff', stipple: 0.22, stippleScale: 0.7 });
  const blobShape = new THREE.IcosahedronGeometry(1, 1);
  for (const band of createCloudSpawners(world.windmillRoofHeight)) {
    for (let n = 0; n < band.count; n++) {
      const group = new THREE.Group();
      const blobs = addBlobs(group, rand, blobShape, cloudMaterial);
      addEdgeAccents(group, blobs, blobShape, cloudMaterial);
      const x = (rand() - 0.5) * band.travelWidth;
      const y = band.minimumHeight + rand() * band.heightRange;
      const z = band.minimumDepth + rand() * band.depthRange;
      group.position.set(x, y, z);
      const { colliders, radius } = instanceChildren(group, blobShape, cloudMaterial);
      // Grows in from nothing; the drift update sets the real scale.
      group.scale.setScalar(0);
      world.group.add(group);
      world.clouds.push({
        group, colliders, radius,
        position: group.position.clone(),
        offset: new THREE.Vector3(),
        speed: band.minimumSpeed + rand() * band.speedRange,
        travelWidth: band.travelWidth, fadeWidth: band.fadeWidth, size: band.size, age: 0,
      });
    }
  }
}
