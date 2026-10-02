// Entrance gate at the top of the stairs: cream board in a dark-wood frame on two posts, and the
// "Mossbrook" name plate painted on a canvas (unlit MeshBasic, so it stays bright at night).
import * as THREE from 'three';
import { addShiftedBox, shiftedX } from './station-site-placement.js';

const BOARD_Z = 4.6;
const BOARD_Y = 2.55;
const SIGN_SIZE = [1024, 256];

// Gate parts on the widened platform: [size, material key, outward coefficient, y, z].
const GATE_PARTS = [
  [[0.1, 0.7, 2.4], 'cream', 1.0, BOARD_Y, BOARD_Z],
  [[0.1, 2.45, 0.1], 'green', 1.14, 1.275, 3.6],
  [[0.1, 2.45, 0.1], 'green', 1.14, 1.275, 5.6],
  [[0.11, 0.07, 2.55], 'darkWood', 1.0, 2.16, BOARD_Z],
  [[0.11, 0.07, 2.55], 'darkWood', 1.0, 2.94, BOARD_Z],
  [[0.11, 0.82, 0.07], 'darkWood', 1.0, BOARD_Y, 3.34],
  [[0.11, 0.82, 0.07], 'darkWood', 1.0, BOARD_Y, 5.86],
];

// Plate artwork as context writes in paint order: a string member is a property assignment,
// an array value is a method call with those arguments.
const BRAND_GREEN = '#315d45';
const PLATE_CREAM = '#f4ead2';
const SIGN_PAINT_STEPS = [
  ['fillStyle', PLATE_CREAM],
  ['fillRect', [0, 0, 1024, 256]],
  ['strokeStyle', '#3f7d5a'],
  ['lineWidth', 5],
  ['strokeRect', [14, 14, 996, 228]],
  ['fillStyle', BRAND_GREEN],
  ['font', 'bold 106px Fredoka, sans-serif'],
  ['textAlign', 'center'],
  ['textBaseline', 'middle'],
  ['fillText', ['Mossbrook', 455, 94]],
  ['font', 'bold 31px Fredoka, sans-serif'],
  ['fillText', ['R A I L W A Y   S T A T I O N', 455, 171]],
  ['font', '24px Fredoka, sans-serif'],
  ['fillText', ['VALLEY LINE  ·  EST. 1892', 455, 215]],
  // Platform badge on the right, still in the brand green.
  ['fillRect', [855, 38, 125, 180]],
  ['fillStyle', PLATE_CREAM],
  ['font', 'bold 19px Fredoka, sans-serif'],
  ['fillText', ['PLATFORM', 918, 70]],
  ['font', 'bold 100px Fredoka, sans-serif'],
  ['fillText', ['1', 918, 142]],
];

/** Board, posts, rails and stiles of the gate. */
export function buildStationNameBoard(site, materials) {
  for (const [size, key, coefficient, y, z] of GATE_PARTS) addShiftedBox(site, size, materials[key], coefficient, y, z);
}

/** Paints the plate synchronously with whatever fonts are ready right now. */
export function drawStationSign(context) {
  for (const [member, value] of SIGN_PAINT_STEPS) {
    if (Array.isArray(value)) context[member](...value);
    else context[member] = value;
  }
}

/** Canvas-textured plate facing the track, in front of the board; returns the mesh. */
export function buildStationSign(site) {
  const canvas = document.createElement('canvas');
  [canvas.width, canvas.height] = SIGN_SIZE;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Station name canvas context unavailable');
  drawStationSign(context);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const geometry = new THREE.PlaneGeometry(2.27, 0.57);
  const plate = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  const o = site.localOutward;
  plate.rotation.y = (-o * Math.PI) / 2;
  plate.position.set(shiftedX(site, o * 0.91), BOARD_Y, BOARD_Z);
  site.group.add(plate);
  return plate;
}
