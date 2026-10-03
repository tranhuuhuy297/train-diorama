// Water: one board-sized quad (the shader keeps only wet fragments) plus a curved curtain where
// the river bed crosses the front edge of the board.
import * as THREE from 'three';
import { lerp } from '../../core/seeded-prng-and-gradient-noise.js';
import { SIZE, HALF, SEG, STEP } from '../world-constants.js';
import { waterMaterial } from '../../materials/water-surface-material.js';
import { waterfallMaterial } from '../../materials/waterfall-curtain-material.js';

const CURTAIN_ROWS = 24;
const CURTAIN_COLUMNS = 8;
const CURTAIN_DROP = 18;
// Lip just past the board edge; the curtain bows outward with the square root of the drop.
const CURTAIN_LIP_Z = HALF + 0.05;
const CURTAIN_BOW = 1.35;
const CURTAIN_LIP_Y = 0.02;
const CURTAIN_SIDE_PAD = 0.2;

/** x-range of below-zero ground on the last heightmap row (+inf/-inf when the river never reaches it). */
export function findWaterfallMouth(heights) {
  const rowWidth = SEG + 1;
  const rowStart = SEG * rowWidth;
  let xmin = Infinity;
  let xmax = -Infinity;
  for (let column = 0; column < rowWidth; column++) {
    if (!(heights[rowStart + column] < 0)) continue;
    const x = -HALF + column * STEP;
    xmin = Math.min(xmin, x);
    xmax = Math.max(xmax, x);
  }
  return { xmin, xmax };
}

/** Row-major (CURTAIN_ROWS + 1) x (CURTAIN_COLUMNS + 1) grid; uv v runs 1 at the lip to 0 at the foot. */
export function createWaterfallGeometry(xmin, xmax) {
  const across = CURTAIN_COLUMNS + 1;
  const vertexCount = (CURTAIN_ROWS + 1) * across;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  let vertex = 0;
  for (let row = 0; row <= CURTAIN_ROWS; row++) {
    const drop = (row / CURTAIN_ROWS) * CURTAIN_DROP;
    const y = -drop + CURTAIN_LIP_Y;
    const z = CURTAIN_LIP_Z + CURTAIN_BOW * Math.sqrt(drop);
    for (let column = 0; column <= CURTAIN_COLUMNS; column++) {
      const u = column / CURTAIN_COLUMNS;
      positions[vertex * 3] = lerp(xmin - CURTAIN_SIDE_PAD, xmax + CURTAIN_SIDE_PAD, u);
      positions[vertex * 3 + 1] = y;
      positions[vertex * 3 + 2] = z;
      uvs[vertex * 2] = u;
      uvs[vertex * 2 + 1] = 1 - row / CURTAIN_ROWS;
      vertex++;
    }
  }
  const triangles = [];
  for (let row = 0; row < CURTAIN_ROWS; row++) {
    for (let column = 0; column < CURTAIN_COLUMNS; column++) {
      const corner = row * across + column;
      const below = corner + across;
      triangles.push(corner, below, corner + 1, corner + 1, below, below + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(triangles);
  return geometry;
}

// Adds a mesh to the world group and keeps it out of the shadow depth pass.
function addUnshadowed(world, mesh) {
  world.group.add(mesh);
  world.noShadow.push(mesh);
}

export function buildWater(world) {
  const sheet = new THREE.PlaneGeometry(SIZE, SIZE, 1, 1);
  sheet.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(sheet, waterMaterial(world.heightTex, SIZE));
  water.position.y = 0;
  addUnshadowed(world, water);

  const { xmin, xmax } = findWaterfallMouth(world.heights);
  if (!(xmin < xmax)) return;
  const curtain = createWaterfallGeometry(xmin, xmax);
  addUnshadowed(world, new THREE.Mesh(curtain, waterfallMaterial()));
}
