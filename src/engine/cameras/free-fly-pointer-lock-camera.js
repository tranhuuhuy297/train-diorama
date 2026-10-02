// PointerLockControls creation only; click-to-lock, WASD/Space/C/Shift and pose save/restore
// land later (the fields and this instance are ready for them now).
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

export const FREE_CAMERA_VERTICAL_MARGIN = THREE.MathUtils.degToRad(5);

export function createFirstPersonControls(d) {
  const controls = new PointerLockControls(d.camera, d.renderer.domElement);
  controls.enabled = false;
  controls.minPolarAngle = FREE_CAMERA_VERTICAL_MARGIN;
  controls.maxPolarAngle = Math.PI - FREE_CAMERA_VERTICAL_MARGIN;
  controls.addEventListener('unlock', () => d.movementKeys.clear());
  return controls;
}
