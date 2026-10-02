// The grassy top surface: one indexed grid mesh over the final heightmap with per-vertex
// colours (height bands, rock on slopes, a dirt band beside the track, sand in the river bed).
// Colour inputs are read back from the Float32 position array, never from the doubles.
import * as THREE from 'three';
import { fbm, smoothstep } from '../../core/seeded-prng-and-gradient-noise.js';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { SEG } from '../world-constants.js';
import { GRID_WIDTH, gridCoordinate, gridRowColumn, ensureTrackNearestGrid } from './terrain-heightmap-grading.js';
import { inBridge } from '../track/bridge-span-detection.js';

const VERTEX_COUNT = GRID_WIDTH * GRID_WIDTH;

// Two triangles per cell, wound so the surface faces +Y.
function gridTriangles() {
  const indices = [];
  for (let row = 0; row < SEG; row++) {
    for (let column = 0; column < SEG; column++) {
      const corner = row * GRID_WIDTH + column;
      const below = corner + GRID_WIDTH;
      indices.push(corner, below, corner + 1, corner + 1, below, below + 1);
    }
  }
  return indices;
}

// Height bands, picked by the fbm-wobbled height: each blends `from` toward `to` across `edges`.
const BAND_SPLIT = 8;
const LOWER_BAND = { from: 'low', to: 'mid', edges: [2, 8] };
const UPPER_BAND = { from: 'mid', to: 'high', edges: [8, 16] };

// Overrides in application order, each blending the running colour toward `target`; a `restart`
// colour replaces it first (the river bed, whose reversed edges ramp toward rock as it deepens).
const COLOUR_OVERRIDES = [
  { when: v => v.slope > 0.3, target: 'rock', weight: v => smoothstep(0.3, 0.5, v.slope) },
  { when: v => v.onBridge === 0 && v.trackDistance < 3.4, target: 'dirt', weight: v => 1 - smoothstep(2.6, 3.4, v.trackDistance) },
  { when: v => v.h < 0.45, restart: 'sand', target: 'rock', weight: v => smoothstep(0.2, -1.2, v.h) * 0.5 },
];

function terrainPalette() {
  return {
    low: new THREE.Color(0.5, 0.76, 0.32),
    mid: new THREE.Color(0.37, 0.65, 0.26),
    high: new THREE.Color(0.27, 0.54, 0.24),
    sand: new THREE.Color(0.87, 0.8, 0.58),
    rock: new THREE.Color(0.64, 0.56, 0.46),
    dirt: new THREE.Color(0.7, 0.6, 0.42),
  };
}

function paintVertexColors(positions, normals, trackDistance, trackOnBridge) {
  const palette = terrainPalette();
  const paint = new THREE.Color();
  const vertex = { h: 0, slope: 0, trackDistance: 0, onBridge: 0 };
  const rgb = new Float32Array(VERTEX_COUNT * 3);
  for (let k = 0; k < VERTEX_COUNT; k++) {
    const offset = k * 3;
    vertex.h = positions[offset + 1];
    vertex.slope = 1 - normals.getY(k);
    vertex.trackDistance = trackDistance[k];
    vertex.onBridge = trackOnBridge[k];
    const wobble = fbm(positions[offset] * 0.09, positions[offset + 2] * 0.09, 2);
    const banded = vertex.h + wobble * 3;
    const band = banded < BAND_SPLIT ? LOWER_BAND : UPPER_BAND;
    paint.copy(palette[band.from]).lerp(palette[band.to], smoothstep(band.edges[0], band.edges[1], banded));
    paint.offsetHSL(wobble * 0.03, 0, wobble * 0.03);
    for (let rule = 0; rule < COLOUR_OVERRIDES.length; rule++) {
      const { when, restart, target, weight } = COLOUR_OVERRIDES[rule];
      if (!when(vertex)) continue;
      if (restart) paint.copy(palette[restart]);
      paint.lerp(palette[target], weight(vertex));
    }
    paint.toArray(rgb, offset);
  }
  return rgb;
}

/** Adds the terrain mesh to world.group and returns its live Float32 position array. */
export function buildTerrainSurface(world) {
  const positions = new Float32Array(VERTEX_COUNT * 3);
  const trackDistance = new Float32Array(VERTEX_COUNT);
  const trackOnBridge = new Uint8Array(VERTEX_COUNT);
  const trackGrid = ensureTrackNearestGrid(world);
  for (let k = 0; k < VERTEX_COUNT; k++) {
    const [row, column] = gridRowColumn(k);
    trackDistance[k] = trackGrid.distance[k];
    trackOnBridge[k] = inBridge(world, trackGrid.index[k]) ? 1 : 0;
    positions[k * 3] = gridCoordinate(column);
    positions[k * 3 + 1] = world.heights[k];
    positions[k * 3 + 2] = gridCoordinate(row);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(gridTriangles());
  geometry.computeVertexNormals();
  const rgb = paintVertexColors(positions, geometry.attributes.normal, trackDistance, trackOnBridge);
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  // Option keys, order and values form the npr cache identity; keep them exactly.
  const surfaceMaterial = npr({
    vertexColors: true,
    stipple: 0.42,
    stippleScale: 1.3,
    flowers: true,
  });
  world.group.add(new THREE.Mesh(geometry, surfaceMaterial));
  return positions;
}
