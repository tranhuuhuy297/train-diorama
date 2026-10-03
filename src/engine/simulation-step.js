// One simulation step: sim time and the shared uTime uniform, the train (motion, sparks, smoke), the
// world with the locomotive position and a fresh {distance, speed, length} motion record, then the birds.
import { G } from '../materials/shared-lighting-uniforms.js';

export function stepSimulation(d, simDt) {
  d.time += simDt;
  G.uTime.value = d.time;
  d.updateTrain(simDt);
  d.world.update(d.time, simDt, d.train.loco.obj.position, { distance: d.s, speed: d.speed, length: d.train.totalLength });
  d.birds.update(d.time, d.s, d.speed, d.train.cars);
}
