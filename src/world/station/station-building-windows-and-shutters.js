// Two lit windows on the track façade: emissive panes, half-open hinged shutters, sills and
// mullions, plus one track-facing night halo per window (kept out of the shadow pass).
import * as THREE from 'three';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { createLightGlows } from '../../effects/night-light-glow-sprites.js';
import { WINDOW_GLASS_OPTIONS, SHUTTER_WOOD_OPTIONS, SHUTTER_PANEL_OPTIONS } from './station-palette-materials.js';
import { stationBuildingX, stationFacadeX } from './station-site-placement.js';

const WINDOW_ZS = [-1.6, 2.4];
const WINDOW_Y = 1.1;
const SHUTTER_SIDES = [-1, 1];

// One shutter leaf on a hinge group; built empty-handed, then attached once its parts exist.
function addShutter(building, hinge, leafSide, o, shutterWood, shutterPanel) {
  const group = new THREE.Group();
  group.position.set(hinge.x, WINDOW_Y, hinge.z + leafSide * 0.47);
  group.rotation.y = leafSide * o * 0.55;
  const leafZ = leafSide * 0.125;
  box(0.045, 0.82, 0.25, shutterWood, 0, 0, leafZ, group);
  box(0.015, 0.66, 0.18, shutterPanel, -o * 0.03, 0, leafZ, group);
  building.add(group);
}

/** Glass first (material order), then glows, shutter materials, panes with shutters, sills/mullions. */
export function buildStationWindows(world, building, site, materials) {
  const o = site.localOutward;
  const centreX = stationBuildingX(site);
  const facadeX = stationFacadeX(site);
  const glass = npr(WINDOW_GLASS_OPTIONS);
  const halos = createLightGlows(WINDOW_ZS.map(z => ({
    position: [centreX - o * 1.79, WINDOW_Y, z], size: [2.0, 1.8], normal: [-o, 0, 0], strength: 0.2,
  })));
  building.add(halos);
  world.noShadow.push(halos);
  const shutterWood = npr(SHUTTER_WOOD_OPTIONS);
  const shutterPanel = npr(SHUTTER_PANEL_OPTIONS);
  const hingeX = centreX - o * 1.68;
  for (const z of WINDOW_ZS) {
    box(0.08, 0.7, 0.8, glass, centreX - o * 1.62, WINDOW_Y, z, building);
    for (const leafSide of SHUTTER_SIDES) addShutter(building, { x: hingeX, z }, leafSide, o, shutterWood, shutterPanel);
  }
  for (const z of WINDOW_ZS) {
    box(0.22, 0.09, 1.0, materials.cream, facadeX, 0.69, z, building);
    box(0.05, 0.7, 0.045, materials.green, facadeX, WINDOW_Y, z, building);
  }
}
