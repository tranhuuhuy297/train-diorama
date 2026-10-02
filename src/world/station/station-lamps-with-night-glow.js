// Two hexagonal platform lamps sharing three geometries, plus one omnidirectional night halo each.
// The halo mesh is moved by the platform extension while its instance centres keep the original x.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { createLightGlows } from '../../effects/night-light-glow-sprites.js';
import { LAMP_LANTERN_OPTIONS } from './station-palette-materials.js';
import { shiftedX } from './station-site-placement.js';

const LANTERN_Y = 2.7;

/** Lantern material, shared geometries, halos (→ noShadow), then pole/lantern/cap per lamp. */
export function buildStationLamps(world, site, materials) {
  const o = site.localOutward;
  const lantern = npr(LAMP_LANTERN_OPTIONS);
  const shapes = {
    pole: new THREE.CylinderGeometry(0.055, 0.075, 2.4, 6),
    lantern: new THREE.CylinderGeometry(0.16, 0.22, 0.34, 6),
    cap: new THREE.CylinderGeometry(0.13, 0.13, 0.11, 6),
  };
  // Unshifted x per lamp: one on the outer side near the bench, one track-side by the gate.
  const lamps = [{ x: o * 0.9, z: -5.5 }, { x: -o * 0.95, z: 6.0 }];
  const halos = createLightGlows(lamps.map(lamp => ({
    position: [lamp.x, LANTERN_Y, lamp.z], size: [2.4, 2.4], normal: [0, 0, 0], strength: 0.3,
  })));
  site.group.add(halos);
  world.noShadow.push(halos);
  halos.position.x = shiftedX(site, 0);
  const parts = [['pole', materials.green, 1.4], ['lantern', lantern, LANTERN_Y], ['cap', materials.green, 2.925]];
  for (const lamp of lamps) {
    const x = shiftedX(site, lamp.x);
    for (const [shape, material, y] of parts) {
      const mesh = new THREE.Mesh(shapes[shape], material);
      mesh.position.set(x, y, lamp.z);
      site.group.add(mesh);
    }
  }
}
