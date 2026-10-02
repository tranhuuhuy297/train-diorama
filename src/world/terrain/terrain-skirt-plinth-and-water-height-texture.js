// Final terrain bake, run once every building pad is in: surface mesh, strata skirt walls,
// the wooden plinth and the 8-bit height texture the water shader samples.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { SIZE, SEG, BOTTOM } from '../world-constants.js';
import { GRID_WIDTH } from './terrain-heightmap-grading.js';
import { buildTerrainSurface } from './terrain-surface-mesh-and-vertex-colors.js';

// Grid (column, row) of point i along each base edge, walked once around the square;
// corners appear on two edges.
const SKIRT_EDGES = [
  i => [i, 0],
  i => [SEG, i],
  i => [SEG - i, SEG],
  i => [0, SEG - i],
];

// Vertical walls from the surface rim down to BOTTOM; topY lets the strata shader place the lip.
function buildTerrainSkirt(world, surfacePositions) {
  const positions = [];
  const topY = [];
  const indices = [];
  let stripStart = 0;
  for (const edgePoint of SKIRT_EDGES) {
    for (let i = 0; i <= SEG; i++) {
      const [column, row] = edgePoint(i);
      const k = (row * GRID_WIDTH + column) * 3;
      const [x, y, z] = [surfacePositions[k], surfacePositions[k + 1], surfacePositions[k + 2]];
      positions.push(x, y, z, x, BOTTOM, z);
      topY.push(y, y);
    }
    for (let i = 0; i < SEG; i++) {
      const top = stripStart + i * 2;
      indices.push(top, top + 1, top + 2, top + 2, top + 1, top + 3);
    }
    stripStart += GRID_WIDTH * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('topY', new THREE.Float32BufferAttribute(topY, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  world.group.add(new THREE.Mesh(geometry, npr({ color: '#9a6a44', strata: true, stipple: 0.2, stippleScale: 1.2, doubleSided: true })));
}

function buildPlinth(world) {
  const wood = npr({ color: '#6b4630', stipple: 0.12, stippleScale: 0.6 });
  box(SIZE, 1.8, SIZE, wood, 0, BOTTOM - 0.9, 0, world.group);
  const trim = npr({ color: '#3f2a1f', stipple: 0.1, stippleScale: 0.6 });
  box(SIZE, 0.5, SIZE, trim, 0, BOTTOM - 2.05, 0, world.group);
}

// One red byte per vertex: (h + 3) / 12 clamped to [0, 1]; the water shader decodes it back.
function createWaterHeightTexture(heights) {
  const bytes = new Uint8Array(GRID_WIDTH * GRID_WIDTH);
  for (let k = 0; k < bytes.length; k++) {
    bytes[k] = Math.round(Math.min(1, Math.max(0, (heights[k] + 3) / 12)) * 255);
  }
  const texture = new THREE.DataTexture(bytes, GRID_WIDTH, GRID_WIDTH, THREE.RedFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function buildTerrain(world) {
  const surfacePositions = buildTerrainSurface(world);
  buildTerrainSkirt(world, surfacePositions);
  buildPlinth(world);
  world.heightTex = createWaterHeightTexture(world.heights);
}
