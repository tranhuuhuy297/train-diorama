// Overview OrbitControls setup, the 3.2s dolly-in intro and the damping-off double reset.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const OVERVIEW_HOME = Object.freeze(new THREE.Vector3(-55.522, 62.771, 130.519));
export const OVERVIEW_TARGET = Object.freeze(new THREE.Vector3(0, 4, 0));
export const OVERVIEW_INTRO = Object.freeze({ duration: 3.2, distanceMultiplier: 1.22 });

// Order matters: new OrbitControls -> target -> config -> saveState(). The constructor's own
// update() runs before the target is set, so saveState()'s position0 carries a few ULPs of noise.
export function createOverviewControls(d) {
  const controls = new OrbitControls(d.camera, d.renderer.domElement);
  controls.target.copy(OVERVIEW_TARGET);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = true;
  controls.autoRotateSpeed = -0.245;
  controls.minDistance = 25;
  controls.maxDistance = 240;
  controls.maxPolarAngle = 1.5;
  controls.saveState();
  return controls;
}

// Separate from creation so the facade assigns `controls` before `onOverviewInteraction`.
export function bindOverviewIntroInterrupt(d) {
  d.onOverviewInteraction = () => {
    if (d.overviewIntro === null) return;
    d.overviewIntro = null;
    console.log('[CAMERA] Overview intro interrupted by input');
  };
  d.controls.addEventListener('start', d.onOverviewInteraction);
}

// Starts the camera 1.22x further from the saved home along the home->target axis; the
// '[CAMERA] Overview intro started' log is emitted by the boot sequence once `playing` flips.
export function prepareOverviewIntro(d) {
  if (d.mode !== 'overview') return;
  const controls = d.controls;
  const target = controls.position0.clone();
  const homeTarget = controls.target;
  const start = homeTarget.clone().add(target.clone().sub(homeTarget).multiplyScalar(OVERVIEW_INTRO.distanceMultiplier));
  d.overviewIntro = { start, target, elapsed: 0, playing: false };
  d.camera.position.copy(start);
  d.camera.lookAt(homeTarget);
  d.camPos.copy(start);
}

export function updateOverviewCamera(d, dt) {
  const controls = d.controls;
  const intro = d.overviewIntro;
  if (intro) {
    if (intro.playing) {
      const advanced = intro.elapsed + dt;
      intro.elapsed = advanced < OVERVIEW_INTRO.duration ? advanced : OVERVIEW_INTRO.duration;
    }
    const p = intro.elapsed / OVERVIEW_INTRO.duration;
    const eased = p * p * p * (p * (6 * p - 15) + 10);
    d.camera.position.lerpVectors(intro.start, intro.target, eased);
    d.camera.lookAt(controls.target);
    if (p === 1) {
      d.overviewIntro = null;
      console.log('[CAMERA] Overview intro completed');
    }
  } else {
    controls.update(dt);
  }
  d.camPos.copy(d.camera.position);
  d.camTarget.copy(controls.target);
}

// Damping-off double reset: the first reset() applies the still-pending damped delta, the
// second lands exactly on the saved home pose.
export function resetOverviewPose(d) {
  const controls = d.controls;
  const wasDamping = controls.enableDamping;
  controls.enableDamping = false;
  controls.reset();
  controls.reset();
  controls.enableDamping = wasDamping;
  controls.autoRotate = d.autoRotateEnabled;
  d.camPos.copy(d.camera.position);
  d.camTarget.copy(controls.target);
}
