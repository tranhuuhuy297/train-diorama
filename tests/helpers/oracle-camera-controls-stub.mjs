// Camera + control stand-ins shared by the original oracle and the clone driver: no DOM, no damping.
import * as THREE from 'three';

// Constructor facts of the original, typed here so a clone constant regression cannot leak in.
const OVERVIEW_FOV = 42;
const HOME_POSITION = [-55.522, 62.771, 130.519];
const HOME_TARGET = [0, 4, 0];

export function cameraRig() {
  const camera = new THREE.PerspectiveCamera(OVERVIEW_FOV, 1600 / 900, 0.3, 1500);
  camera.position.fromArray(HOME_POSITION);
  camera.lookAt(...HOME_TARGET);
  // OrbitControls stand-in: no damping/auto-rotate simulation, only the reset semantics setMode relies on.
  const controls = {
    target: new THREE.Vector3(...HOME_TARGET), target0: new THREE.Vector3(...HOME_TARGET),
    position0: camera.position.clone(), enabled: true, enableDamping: true, dampingFactor: 0.06,
    autoRotate: true, autoRotateSpeed: -0.245,
    reset() {
      camera.position.copy(this.position0);
      this.target.copy(this.target0);
      camera.lookAt(this.target);
    },
    update: () => false, saveState() {}, addEventListener() {}, removeEventListener() {}, dispose() {},
  };
  const firstPersonControls = {
    enabled: false, isLocked: false, lock() {}, unlock() { this.isLocked = false; }, addEventListener() {}, dispose() {},
  };
  return { camera, controls, firstPersonControls };
}
