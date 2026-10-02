// Fixed dimensions and layout data for the diorama base, river and track loop.
// Only plain numbers and math objects live here: nothing that draws a three.js UUID.
import * as THREE from 'three';

export const SIZE = 124;
export const HALF = SIZE / 2;
// Grid segments per side; the heightmap has SEG + 1 vertices per row.
export const SEG = 200;
export const STEP = SIZE / SEG;
// Skirt bottom and plinth reference height.
export const BOTTOM = -7;

// Shared axes; callers read them, never mutate them.
export const UP = new THREE.Vector3(0, 1, 0);
export const RIGHT = new THREE.Vector3(1, 0, 0);

// POND and RIVER stay unfrozen: frozen objects sent V8 into a deopt loop in the hot riverDist path.
export const POND = { x: -4, z: -6, r: 8 };

// River centre line from the pond to beyond the +z edge (4 segments).
export const RIVER = [
  { x: -4, z: -6 },
  { x: 2, z: 10 },
  { x: -3, z: 24 },
  { x: 1, z: 36 },
  { x: 0, z: 75 },
];

// Closed loop, counter-clockwise from above: front straight z = 36, station near (-45.5, -2).
export const TRACK_CONTROL_POINTS = Object.freeze([
  [-27, 9, 36], [-9, 9, 36], [9, 9, 36], [27, 9, 36],
  [40, 9.4, 27], [46, 10, 9], [43, 10.6, -10], [33, 10.4, -26],
  [14, 9.8, -36], [-6, 9.2, -41], [-26, 9, -36], [-40, 9, -21],
  [-45.5, 9, -2], [-41, 9, 20],
].map(point => Object.freeze(point)));

export const TRACK_SAMPLE_COUNT = 1200;
