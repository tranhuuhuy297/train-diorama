// Chimney smoke: a fixed pool of 70 shaded puffs in world space. Emission speeds up with the train
// and slows while standing; each puff rises, drifts downwind, swells and then shrinks away.
// A launch draws Math.random seven times (lifetime, size, velocity xyz, spin xy).
import * as THREE from 'three';
import { npr } from '../materials/npr-cel-material-factory.js';

export const SMOKE_PUFF_COUNT = 70;

const WIND_DRIFT = 0.8;
const RISE_DAMPING = 0.6;
const MIN_SCALE = 0.001;

/** Seconds until the next puff: steady while standing, shorter the faster the train runs. */
export function puffEmissionInterval(speed, stopTimer) {
  const base = stopTimer > 0 ? 0.55 : Math.max(0.07, 0.3 - speed * 0.03);
  return base / 1.2;
}

function launch(puff, chimney) {
  chimney.getWorldPosition(puff.mesh.position);
  const lifetime = 2.4 + Math.random() * 1.2;
  puff.life = lifetime;
  puff.max = lifetime;
  puff.size = 0.7 + Math.random() * 0.6;
  const driftX = (Math.random() - 0.5) * 0.6;
  const rise = 2.2 + Math.random() * 0.8;
  const driftZ = (Math.random() - 0.5) * 0.6;
  puff.vel.set(driftX, rise, driftZ);
  const spinX = Math.random() * 3;
  const spinY = Math.random() * 3;
  puff.mesh.rotation.set(spinX, spinY, 0);
  puff.mesh.visible = true;
}

// Ages one live puff; grows from half size, then collapses over the last ~30% of its life.
function age(puff, dt) {
  puff.life -= dt;
  if (puff.life <= 0) {
    puff.mesh.visible = false;
    return;
  }
  const aged = 1 - puff.life / puff.max;
  const position = puff.mesh.position;
  position.addScaledVector(puff.vel, dt);
  position.x += dt * WIND_DRIFT;
  puff.vel.y *= 1 - dt * RISE_DAMPING;
  const scale = puff.size * (0.5 + aged * 2.4) * Math.min(1, (1 - aged) * 3.5);
  puff.mesh.scale.setScalar(Math.max(MIN_SCALE, scale));
}

export class LocomotiveSmokePuffPool {
  constructor(scene) {
    const puffShape = new THREE.IcosahedronGeometry(0.5, 1);
    const puffMaterial = npr({ color: '#fbfbff', stipple: 0.3, stippleScale: 2.2 });
    this.timer = 0;
    this.puffs = [];
    for (let i = 0; i < SMOKE_PUFF_COUNT; i++) {
      const puffMesh = new THREE.Mesh(puffShape, puffMaterial);
      puffMesh.visible = false;
      scene.add(puffMesh);
      this.puffs.push({ mesh: puffMesh, vel: new THREE.Vector3(), life: 0, max: 1, size: 1 });
    }
  }

  /** The timer resets even when every puff is still alive (that emission is simply skipped). */
  update(dt, chimney, speed, stopTimer) {
    this.timer -= dt;
    const interval = puffEmissionInterval(speed, stopTimer);
    if (this.timer <= 0 && (speed > 0.1 || stopTimer > 0)) {
      this.timer = interval;
      const free = this.puffs.find(puff => puff.life <= 0);
      if (free) launch(free, chimney);
    }
    for (let i = 0; i < this.puffs.length; i++) {
      if (this.puffs[i].life > 0) age(this.puffs[i], dt);
    }
  }
}
