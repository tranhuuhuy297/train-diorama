// Platform slab with its painted edge, the open shelter and the slatted bench. The slab and edge
// stay put; shelter and bench stand on the widened platform (shifted outward coordinates).
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { PLATFORM_DEPTH, addShiftedBox } from './station-site-placement.js';

const PLATFORM_LENGTH = 13;
const SHELTER_POST = [0.12, 2.1, 0.12];
const BENCH_Z = -4.25;

// Bench parts repeated at each end frame: [size, material key, outward coefficient, y].
const BENCH_END_PARTS = [
  [[0.11, 0.43, 0.11], 'darkWood', 0.43, 0.61],
  [[0.11, 0.43, 0.11], 'darkWood', 0.87, 0.61],
  [[0.1, 1.04, 0.11], 'darkWood', 1.0, 0.98],
  [[0.63, 0.09, 0.1], 'wood', 0.7, 1.12],
];
// Full-length slats: [size, outward coefficient, y], seat front to back, then the backrest.
const BENCH_SLATS = [
  [[0.16, 0.08, 1.8], 0.42, 0.84],
  [[0.16, 0.08, 1.8], 0.65, 0.84],
  [[0.16, 0.08, 1.8], 0.88, 0.84],
  [[0.09, 0.12, 1.8], 1.0, 1.16],
  [[0.09, 0.12, 1.8], 1.0, 1.4],
];

/** Slab (half the extension outward of the track offset) and the yellow safety line. */
export function buildPlatformAndEdge(site, materials) {
  const o = site.localOutward;
  box(PLATFORM_DEPTH, 1.3, PLATFORM_LENGTH, materials.platform, (o * site.platformExtension) / 2, -0.25, 0, site.group);
  box(0.25, 0.04, PLATFORM_LENGTH, materials.edge, -o * 1.15, 0.42, 0, site.group);
}

/** Four green posts and a roof sloping down away from the track. */
export function buildShelter(site, materials) {
  for (const z of [-2.2, 2.2]) {
    addShiftedBox(site, SHELTER_POST, materials.green, -0.2, 1.45, z);
    addShiftedBox(site, SHELTER_POST, materials.green, 0.9, 1.45, z);
  }
  const roof = addShiftedBox(site, [2.0, 0.14, 5.6], materials.roof, 0.35, 2.55, 0);
  roof.rotation.z = -0.12 * site.localOutward;
}

/** Bench facing the track: two end frames, three seat slats and two back slats. */
export function buildBench(site, materials) {
  for (const endZ of [BENCH_Z - 0.72, BENCH_Z + 0.72]) {
    for (const [size, key, coefficient, y] of BENCH_END_PARTS) addShiftedBox(site, size, materials[key], coefficient, y, endZ);
  }
  for (const [size, coefficient, y] of BENCH_SLATS) addShiftedBox(site, size, materials.wood, coefficient, y, BENCH_Z);
}
