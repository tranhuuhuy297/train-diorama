// Fixed riverbank tripod beside the bridge: the lens stays put and only pans sideways to follow
// the track point under the train, squeezed into a narrow band so the arch stays in frame.
import * as THREE from 'three';

export const BRIDGE_TRIPOD = Object.freeze({
  x: -3, y: 5.5, z: 60,
  targetXLimit: 14, targetXScale: 0.35,
  targetY: 8.5, targetZ: 36,
});

// pointAtS writes every component, so one shared vector is enough.
const trackPoint = new THREE.Vector3();

/** Writes the tripod pose into the two output vectors; the director glides toward them. */
export function computeBridgeDesired(d, desiredPosition, desiredTarget) {
  const tripod = BRIDGE_TRIPOD;
  desiredPosition.set(tripod.x, tripod.y, tripod.z);
  d.world.pointAtS(d.s, trackPoint);
  const panX = THREE.MathUtils.clamp(trackPoint.x, -tripod.targetXLimit, tripod.targetXLimit) * tripod.targetXScale;
  desiredTarget.set(panX, tripod.targetY, tripod.targetZ);
}
