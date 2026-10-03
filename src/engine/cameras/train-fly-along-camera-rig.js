// Cinematic chase rig for the train camera: a point beside the driver's cab that drifts on three slow
// sines, pulls out to a wide shot once a minute and climbs over hills and tree tops before reaching them.
// Float grouping in this file is deliberate (see docs/code-standards.md, parity-critical rules).
import * as THREE from 'three';
import { exponentialResponse } from '../../core/scalar-math-helpers.js';

export const FLY_ALONG = Object.freeze({
  // Loco-local point beside the driver; the rig is built around it (read-only).
  driverPosition: new THREE.Vector3(0, 2.45, -1.4),
  // Offsets from the anchor: base value, sine amplitude, sine period in seconds.
  distance: 20,
  distanceVariation: 4,
  distancePeriod: 31,
  height: 5,
  heightVariation: 2,
  heightPeriod: 23,
  longitudinalVariation: 7,
  longitudinalPeriod: 41,
  // Wide shot: cycle length, offset scale and canopy look radius at its peak.
  wideShotPeriod: 56,
  wideShotDistanceMultiplier: 2,
  wideShotAnticipationRadius: 14,
  // Floors, glide rates and the canopy look-ahead.
  terrainClearance: 3,
  positionResponse: 2,
  targetResponse: 5,
  canopyClearance: 1.5,
  canopyRadius: 1,
  canopyAnticipationRadius: 5,
  lookAheadSeconds: 0.8,
  ascentResponse: 3,
  descentResponse: 0.7,
});

const RIG_RESPONSES = Object.freeze({ positionResponse: FLY_ALONG.positionResponse, targetResponse: FLY_ALONG.targetResponse });

/** 0 at the start of each wide-shot cycle, 1 at its middle; eased by a cube. */
export function wideShotBlendAtPhase(phase) {
  const raisedCosine = (1 - Math.cos(phase / FLY_ALONG.wideShotPeriod)) * 0.5;
  return raisedCosine ** 3;
}

// Driver anchor in world space, written into `out` (the shared constant is only read).
function driverAnchor(loco, out) {
  return loco.localToWorld(out.copy(FLY_ALONG.driverPosition));
}

/** Side entry: restart the cycle, pick the loop's outer side once, prime the anchor history. */
export function enterFlyAlong(d) {
  const loco = d.train.loco.obj;
  d.flyAlongElapsed = 0;
  const localRight = d.tmpA.set(1, 0, 0).applyQuaternion(loco.quaternion);
  d.flyAlongSide = localRight.dot(loco.position) >= 0 ? 1 : -1;
  driverAnchor(loco, d.previousFlyAlongAnchor);
}

// Moves camPos/camTarget by the anchor's motion since last frame so the glide never lags the train.
function carryRigWithTrain(d, dt, scratch) {
  const step = scratch.subVectors(d.flyAlongAnchor, d.previousFlyAlongAnchor);
  if (dt > 0) d.flyAlongVelocity.copy(step).divideScalar(dt);
  d.camPos.add(step);
  d.camTarget.add(step);
  d.previousFlyAlongAnchor.copy(d.flyAlongAnchor);
}

/** Desired rig pose for this frame into the two output vectors; returns the side glide rates. */
export function computeFlyAlongDesired(d, dt, desiredPosition, desiredTarget) {
  const rig = FLY_ALONG;
  const world = d.world;
  const loco = d.train.loco.obj;
  if (!d.paused && d.timeScale > 0) d.flyAlongElapsed += dt;
  const phase = d.flyAlongElapsed * Math.PI * 2;

  driverAnchor(loco, d.flyAlongAnchor);
  carryRigWithTrain(d, dt, desiredPosition);

  const blend = wideShotBlendAtPhase(phase);
  const reach = THREE.MathUtils.lerp(1, rig.wideShotDistanceMultiplier, blend);
  const lookRadius = THREE.MathUtils.lerp(rig.canopyAnticipationRadius, rig.wideShotAnticipationRadius, blend);

  const lateral = d.flyAlongSide * (rig.distance + rig.distanceVariation * Math.sin(phase / rig.distancePeriod));
  const vertical = rig.height + rig.heightVariation * Math.sin(phase / rig.heightPeriod);
  const along = rig.longitudinalVariation * Math.sin(phase / rig.longitudinalPeriod);
  desiredPosition.set(lateral, vertical, along)
    .multiplyScalar(reach)
    .applyQuaternion(loco.quaternion)
    .add(d.flyAlongAnchor);

  const terrainFloor = world.heightAt(desiredPosition.x, desiredPosition.z) + rig.terrainClearance;
  desiredPosition.y = Math.max(desiredPosition.y, terrainFloor);

  // Canopy under the current camera, under the goal, and under where the goal is heading.
  const velocity = d.flyAlongVelocity;
  const canopyHere = world.treeCanopyHeightAt(d.camPos.x, d.camPos.z, lookRadius);
  const canopyGoal = world.treeCanopyHeightAt(desiredPosition.x, desiredPosition.z, lookRadius);
  const canopyAhead = world.treeCanopyHeightAt(
    desiredPosition.x + velocity.x * rig.lookAheadSeconds,
    desiredPosition.z + velocity.z * rig.lookAheadSeconds,
    lookRadius,
  );
  const canopyTop = Math.max(canopyHere, canopyGoal, canopyAhead);
  desiredPosition.y = Math.max(desiredPosition.y, canopyTop + rig.canopyClearance);

  desiredTarget.copy(d.flyAlongAnchor);
  return RIG_RESPONSES;
}

/** Replaces the glided camPos.y: climbs fast, sinks slowly, never below terrain or the local canopy. */
export function applyFlyAlongHeight(d, dt, previousHeight, desiredPosition) {
  const rig = FLY_ALONG;
  const world = d.world;
  const rate = desiredPosition.y > previousHeight ? rig.ascentResponse : rig.descentResponse;
  const pos = d.camPos;
  pos.y = THREE.MathUtils.lerp(previousHeight, desiredPosition.y, exponentialResponse(dt, rate));
  pos.y = Math.max(
    pos.y,
    world.heightAt(pos.x, pos.z) + rig.terrainClearance,
    world.treeCanopyHeightAt(pos.x, pos.z, rig.canopyRadius) + rig.canopyClearance,
  );
}
