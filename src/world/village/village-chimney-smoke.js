// Chimney smoke: a ring of opaque puffs per cottage that rise, drift and wobble in the house's own
// frame on a looping cycle, fading in and out by scale only. Driven by sim time, so pausing freezes it.
import * as THREE from 'three';
import { smoothstep } from '../../core/seeded-prng-and-gradient-noise.js';
import { chimneyCentre } from './village-house-body-and-roof.js';

export const HOUSE_SMOKE_COUNT = 12;
// Seconds for one puff to rise from the chimney to where it vanishes.
export const HOUSE_SMOKE_LIFETIME = 3.5;

// Per-puff character, drawn from the world stream in exactly this field order.
function drawPuffTraits(rand) {
  return {
    driftX: 0.35 + rand() * 0.4,
    driftZ: (rand() - 0.5) * 0.65,
    wobble: rand() * Math.PI * 2,
    size: 0.75 + rand() * 0.5,
    spin: (rand() - 0.5) * 0.8,
  };
}

/** One phase draw, then 12 hidden (scale 0) puffs: each joins the house, noShadow and houseSmoke. */
export function registerChimneySmoke(world, house, dims, materials, geometry) {
  const { x, z } = chimneyCentre(dims);
  const top = dims.wallHeight + 1.35;
  const basePhase = world.rand();
  for (let index = 0; index < HOUSE_SMOKE_COUNT; index++) {
    const mesh = new THREE.Mesh(geometry, materials.smokeMaterial);
    mesh.scale.setScalar(0);
    house.add(mesh);
    world.noShadow.push(mesh);
    world.houseSmoke.push({ mesh, x, z, top, phase: basePhase + index / HOUSE_SMOKE_COUNT, ...drawPuffTraits(world.rand) });
  }
}

/** Places, sizes and spins every puff for sim time `elapsed`; writes in place, allocates nothing. */
export function updateChimneySmoke(houseSmoke, elapsed, dt) {
  for (let index = 0; index < houseSmoke.length; index++) {
    const puff = houseSmoke[index];
    const cycle = elapsed / HOUSE_SMOKE_LIFETIME + puff.phase;
    const age = cycle - Math.floor(cycle);
    const wobble = puff.wobble;
    const swayX = puff.driftX + Math.sin(elapsed * 1.3 + wobble) * 0.12;
    const bob = Math.sin(elapsed * 1.6 + wobble) * 0.06;
    const swayZ = puff.driftZ + Math.cos(elapsed * 1.1 + wobble) * 0.12;
    puff.mesh.position.set(puff.x + age * swayX, (puff.top + age * 3) + bob * age, puff.z + age * swayZ);
    const envelope = smoothstep(0, 0.12, age) * (1 - smoothstep(0.72, 1, age));
    const radius = ((0.45 + age * 0.8) * puff.size) * envelope;
    puff.mesh.scale.set(
      radius * (0.85 + Math.sin(wobble) * 0.15),
      radius * (1 + Math.cos(wobble) * 0.18),
      radius * (0.85 + Math.sin(wobble * 1.7) * 0.15),
    );
    puff.mesh.rotation.y += puff.spin * dt;
  }
}
