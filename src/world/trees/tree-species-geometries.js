// The four vertex-coloured tree shapes, each merged into one non-indexed geometry: a tiered conifer,
// a round broadleaf, a three-crown cluster and a trunkless bush. Crowns are jittered icospheres.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { colorize, jitter } from '../../geometry/procedural-geometry-helpers.js';

export const TREE_TRUNK_COLOR = '#6b4a33';
const NEEDLES = '#2f6e3c';
const LEAVES = '#4f9b3c';
const SHRUB = '#5aa843';
const CROWN_WOBBLE = 0.28;

const trunk = (radiusTop, radiusBottom, height) => () => new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 5);
const cone = (radius, height) => () => new THREE.ConeGeometry(radius, height, 7);
// Lumpy crown: an icosphere wobbled by a seeded hash.
const crown = (radius, seed) => () => jitter(new THREE.IcosahedronGeometry(radius, 1), CROWN_WOBBLE, seed);

// Parts per species in merge order: primitive factory, optional stretch, lift, colour.
const SPECIES_PARTS = [
  [
    { make: trunk(0.14, 0.2, 1), lift: [0, 0.5, 0], color: TREE_TRUNK_COLOR },
    { make: cone(1.05, 1.6), lift: [0, 1.5, 0], color: NEEDLES },
    { make: cone(0.82, 1.4), lift: [0, 2.25, 0], color: NEEDLES },
    { make: cone(0.56, 1.2), lift: [0, 2.95, 0], color: NEEDLES },
  ],
  [
    { make: trunk(0.14, 0.2, 1.3), lift: [0, 0.65, 0], color: TREE_TRUNK_COLOR },
    { make: crown(1.1, 1), stretch: [1, 0.92, 1], lift: [0, 1.95, 0], color: LEAVES },
  ],
  [
    { make: trunk(0.16, 0.24, 1.4), lift: [0, 0.7, 0], color: TREE_TRUNK_COLOR },
    { make: crown(1.0, 2), lift: [-0.55, 1.9, 0.1], color: LEAVES },
    { make: crown(0.95, 3), lift: [0.55, 2.1, -0.2], color: LEAVES },
    { make: crown(0.8, 4), lift: [0, 2.75, 0.1], color: LEAVES },
  ],
  [
    { make: crown(0.7, 5), stretch: [1, 0.75, 1], lift: [0, 0.35, 0], color: SHRUB },
  ],
];

// Fixed per-part order: shape the raw primitive, stretch, lift into place, then bake the flat colour.
function buildPart({ make, stretch, lift, color }) {
  const geometry = make();
  if (stretch) geometry.scale(stretch[0], stretch[1], stretch[2]);
  geometry.translate(lift[0], lift[1], lift[2]);
  return colorize(geometry, color);
}

/** `[conifer, round, cluster, bush]`, each one merge over its parts (the bush too, as a single part). */
export function createTreeSpeciesGeometries() {
  return SPECIES_PARTS.map(parts => mergeGeometries(parts.map(buildPart)));
}
