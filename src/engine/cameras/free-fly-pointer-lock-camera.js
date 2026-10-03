// Free camera: pointer-lock mouse look, WASD/Space/C flight with Shift sprint, a box clamp that only
// acts while moving, and the pose kept between visits to the mode.
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { HALF } from '../../world/world-constants.js';

export const FREE_CAMERA_VERTICAL_MARGIN = THREE.MathUtils.degToRad(5);

export const FREE_FLY = Object.freeze({ speed: 12, sprintSpeed: 24, edgeInset: 1, groundClearance: 1.2, ceiling: 200 });

export function createFirstPersonControls(d) {
  const controls = new PointerLockControls(d.camera, d.renderer.domElement);
  controls.enabled = false;
  controls.minPolarAngle = FREE_CAMERA_VERTICAL_MARGIN;
  controls.maxPolarAngle = Math.PI - FREE_CAMERA_VERTICAL_MARGIN;
  controls.addEventListener('unlock', () => d.movementKeys.clear());
  return controls;
}

/** Canvas click grabs the mouse, but only in free mode and only when not already grabbed. */
export function bindClickToLock(d) {
  d.onCanvasClick = () => {
    const look = d.firstPersonControls;
    if (d.mode !== 'orbit' || look.isLocked) return;
    look.lock(true);
  };
  d.renderer.domElement.addEventListener('click', d.onCanvasClick);
}

// camTarget-style look point: one unit ahead of the camera.
function lookPoint(d, out) {
  return out.copy(d.camera.position).add(d.camera.getWorldDirection(d.tmpA));
}

/** Remembers where the free camera was looking, then drops the mouse and any held keys. */
export function saveFreeCameraPose(d) {
  const pose = d.freeCameraPose;
  pose.position.copy(d.camera.position);
  lookPoint(d, pose.target);
  if (d.firstPersonControls.isLocked) d.firstPersonControls.unlock();
  d.movementKeys.clear();
}

export function restoreFreeCameraPose(d) {
  const pose = d.freeCameraPose;
  d.camera.position.copy(pose.position);
  d.camera.lookAt(pose.target);
  d.camPos.copy(d.camera.position);
  d.camTarget.copy(pose.target);
}

const held = (keys, code) => (keys.has(code) ? 1 : 0);

// Flies the camera for one frame and clamps it inside the diorama box, above the ground.
function flyStep(d, dt) {
  const keys = d.movementKeys;
  const ahead = held(keys, 'KeyW') - held(keys, 'KeyS');
  const sideways = held(keys, 'KeyD') - held(keys, 'KeyA');
  const lift = held(keys, 'Space') - held(keys, 'KeyC');
  if (ahead === 0 && sideways === 0 && lift === 0) return;

  const camera = d.camera;
  const facing = camera.getWorldDirection(d.tmpA);
  const heading = d.tmpB.set(1, 0, 0).applyQuaternion(camera.quaternion).multiplyScalar(sideways);
  heading.addScaledVector(facing, ahead);
  heading.y += lift;
  heading.normalize();
  const sprinting = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const pace = sprinting ? FREE_FLY.sprintSpeed : FREE_FLY.speed;
  const pos = camera.position;
  pos.addScaledVector(heading, pace * dt);

  const edge = HALF - FREE_FLY.edgeInset;
  const clamp = THREE.MathUtils.clamp;
  pos.x = clamp(pos.x, -HALF + FREE_FLY.edgeInset, edge);
  pos.z = clamp(pos.z, -HALF + FREE_FLY.edgeInset, edge);
  pos.y = clamp(pos.y, d.world.heightAt(pos.x, pos.z) + FREE_FLY.groundClearance, FREE_FLY.ceiling);
}

/** Free mode never glides: camPos/camTarget simply mirror the camera after any flight. */
export function updateFreeFlyCamera(d, dt) {
  if (d.firstPersonControls.isLocked) flyStep(d, dt);
  d.camPos.copy(d.camera.position);
  lookPoint(d, d.camTarget);
}

export function disposeFirstPersonControls(d) {
  const look = d.firstPersonControls;
  if (look.isLocked) look.unlock();
  d.renderer.domElement.removeEventListener('click', d.onCanvasClick);
  look.dispose();
}
