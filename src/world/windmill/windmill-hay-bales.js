// Two small stacks of straw bales beside the windmill, each settled onto the levelled ground. Every
// bale is a body, two end caps, two twine bands and four straw lines on its front face (no merge).
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { box } from '../../geometry/procedural-geometry-helpers.js';

// Stack placement in the windmill frame: local x/z, yaw, and the bale centres bottom row first.
export const HAY_BALE_STACKS = Object.freeze([
  Object.freeze({ x: -2.35, z: 0.65, rotation: -0.18, bales: Object.freeze([[-0.48, 0.3, 0], [0.48, 0.3, 0], [0, 0.9, 0.02]].map(Object.freeze)) }),
  Object.freeze({ x: 2.4, z: 0.2, rotation: 0.32, bales: Object.freeze([[0, 0.3, 0], [0.18, 0.3, 0.76]].map(Object.freeze)) }),
]);
const SIDES = [-1, 1];
const STRAW_LINE_COUNT = 4;

// Parts of one bale, added to the stack group in draw order.
function addBale(stack, [x, y, z], { straw, strawEnds, twine }) {
  box(0.92, 0.6, 0.66, straw, x, y, z, stack);
  for (const side of SIDES) {
    box(0.018, 0.51, 0.57, strawEnds, x + side * 0.462, y, z, stack);
    box(0.045, 0.612, 0.674, twine, x + side * 0.27, y, z, stack);
  }
  const lowestLine = y - 0.2;
  for (let line = 0; line < STRAW_LINE_COUNT; line++) box(0.85, 0.017, 0.014, strawEnds, x, lowestLine + line * 0.13, z + 0.334, stack);
}

/** Bale materials, then both stacks; each stack sits 0.05 below the ground under its own origin. */
export function buildWindmillHayBales(world, windmillGroup) {
  const materials = {
    straw: npr({ color: '#dcae48', stipple: 0.24, stippleScale: 5 }),
    strawEnds: npr({ color: '#eed17b', stipple: 0.22, stippleScale: 6 }),
    twine: npr({ color: '#886539', stipple: 0.1 }),
  };
  for (const spec of HAY_BALE_STACKS) {
    const stack = new THREE.Group();
    const foot = windmillGroup.localToWorld(new THREE.Vector3(spec.x, 0, spec.z));
    stack.position.set(spec.x, world.heightAt(foot.x, foot.z) - windmillGroup.position.y - 0.05, spec.z);
    stack.rotation.y = spec.rotation;
    for (const centre of spec.bales) addBale(stack, centre, materials);
    windmillGroup.add(stack);
  }
}
