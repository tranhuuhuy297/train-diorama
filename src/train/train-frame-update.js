// Per-step train work behind Diorama#updateTrain, and the per-render headlight uniform writes.
import { stepTrainStationMotion, computeBrakeStrength } from './train-station-motion-controller.js';

/** Motion → car placement → brake strength → sparks → smoke (both effects draw Math.random, in that order). */
export function updateTrainAndEffects(d, dt) {
  const { stationBraking, previousSpeed } = stepTrainStationMotion(d, dt, d.world.length, d.world.stationS);
  const train = d.train;
  train.update(d.world, d.s);
  const strength = computeBrakeStrength(stationBraking, d.speed, previousSpeed, dt);
  d.brakeSparks.update(dt, strength, train.loco);
  d.puffPool.update(dt, train.chimney, d.speed, d.stopTimer);
  return strength;
}

/**
 * Headlight pool inputs: the anchor's world position, and the beam axis turned by the locomotive's
 * own quaternion (valid because the train group itself never moves or rotates).
 */
export function writeHeadlightUniforms(train, uniforms) {
  train.headlight.getWorldPosition(uniforms.uHeadlightPosition.value);
  const direction = uniforms.uHeadlightDirection.value;
  direction.set(0, -0.08, 1);
  direction.normalize();
  direction.applyQuaternion(train.loco.obj.quaternion);
}
