// Camera-mode FOVs and the per-mode update dispatch. Orbit/side/bridge only hold the camera
// for now; their real rigs (fly-along, bridge tripod, pose save/restore) arrive later.
import { updateOverviewCamera, resetOverviewPose } from './overview-orbit-camera.js';

export const CAMERA_FOV = Object.freeze({ overview: 42, orbit: 65, side: 48, bridge: 42 });

export function setCameraMode(d, mode) {
  if (!Object.prototype.hasOwnProperty.call(CAMERA_FOV, mode)) {
    throw new Error(`Invalid camera mode: ${mode}`);
  }
  if (d.overviewIntro) {
    d.overviewIntro = null;
    console.log('[CAMERA] Overview intro interrupted by mode selection');
  }
  if (mode === d.mode && mode !== 'overview') return;

  if (d.mode === 'orbit') {
    // free-camera pose is saved here, before unlocking, once free-fly exists
    if (d.firstPersonControls.isLocked) d.firstPersonControls.unlock();
    d.movementKeys.clear();
  }

  d.mode = mode;
  d.firstPersonControls.enabled = mode === 'orbit';
  d.camera.fov = CAMERA_FOV[mode];
  d.camera.updateProjectionMatrix();
  d.controls.enabled = mode === 'overview';
  d.controls.autoRotate = false;

  if (mode === 'overview') resetOverviewPose(d);
}

export function updateCameraRig(d, dt) {
  if (d.mode === 'overview') {
    updateOverviewCamera(d, dt);
  } else if (d.mode === 'orbit') {
    d.camPos.copy(d.camera.position);
    d.camera.getWorldDirection(d.tmpA);
    d.camTarget.copy(d.camera.position).add(d.tmpA);
  }
  // side and bridge hold the camera until their own rigs land.
}
