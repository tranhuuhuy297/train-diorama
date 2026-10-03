// Camera-mode switching and the per-frame rig dispatch. Overview and free mode drive the camera
// directly; the train and bridge rigs only produce a goal pose that a shared exponential glide follows.
import { exponentialResponse } from '../../core/scalar-math-helpers.js';
import { updateOverviewCamera, resetOverviewPose } from './overview-orbit-camera.js';
import { saveFreeCameraPose, restoreFreeCameraPose, updateFreeFlyCamera } from './free-fly-pointer-lock-camera.js';
import { enterFlyAlong, computeFlyAlongDesired, applyFlyAlongHeight } from './train-fly-along-camera-rig.js';
import { computeBridgeDesired } from './bridge-tripod-camera.js';

export const CAMERA_FOV = Object.freeze({ overview: 42, orbit: 65, side: 48, bridge: 42 });

const DEFAULT_GLIDE = Object.freeze({ positionResponse: 2, targetResponse: 2 });

const ENTER_MODE = {
  overview: resetOverviewPose,
  orbit: restoreFreeCameraPose,
  side: enterFlyAlong,
  bridge: () => {},
};

export function setCameraMode(d, mode) {
  // Own keys only, so inherited names such as 'toString' are rejected too.
  if (!Object.prototype.hasOwnProperty.call(CAMERA_FOV, mode)) {
    throw new Error(`Invalid camera mode: ${mode}`);
  }
  if (d.overviewIntro) {
    d.overviewIntro = null;
    console.log('[CAMERA] Overview intro interrupted by mode selection');
  }
  // Re-selecting overview still re-homes it; any other repeat is a no-op.
  if (mode === d.mode && mode !== 'overview') return;
  if (d.mode === 'orbit') saveFreeCameraPose(d);

  d.mode = mode;
  d.firstPersonControls.enabled = mode === 'orbit';
  d.camera.fov = CAMERA_FOV[mode];
  d.camera.updateProjectionMatrix();
  d.controls.enabled = mode === 'overview';
  d.controls.autoRotate = false;
  ENTER_MODE[mode](d);
}

export function updateCameraRig(d, dt) {
  const mode = d.mode;
  if (mode === 'overview') return updateOverviewCamera(d, dt);
  if (mode === 'orbit') return updateFreeFlyCamera(d, dt);

  const goalPosition = d.tmpA;
  const goalTarget = d.tmpB;
  const side = mode === 'side';
  let glide = DEFAULT_GLIDE;
  if (side) glide = computeFlyAlongDesired(d, dt, goalPosition, goalTarget);
  else computeBridgeDesired(d, goalPosition, goalTarget);

  // Height before the glide (and after the rig carried camPos along with the train).
  const startHeight = d.camPos.y;
  d.camPos.lerp(goalPosition, exponentialResponse(dt, glide.positionResponse));
  if (side) applyFlyAlongHeight(d, dt, startHeight, goalPosition);
  d.camTarget.lerp(goalTarget, exponentialResponse(dt, glide.targetResponse));

  d.camera.position.copy(d.camPos);
  d.camera.lookAt(d.camTarget);
  if (mode === 'bridge') d.controls.target.copy(d.camTarget);
}
