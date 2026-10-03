// Forest build step: scatter the trees, then draw each species as one instanced layer (the three tree
// species sway in the wind, the bushes stay still) and stamp every instance into the canopy grid.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { createTreeSpeciesGeometries } from './tree-species-geometries.js';
import { scatterTrees } from './tree-scatter-rules.js';
import { createCanopyHeightGrid, stampCanopyHeights } from './tree-canopy-height-grid.js';

const BUSH = 3;

/** Build step: canopy grid, four layers added to world.group and pushed onto world.treeLayers. */
export function buildTrees(world) {
  world.treeCanopyHeights = createCanopyHeightGrid();
  const geometries = createTreeSpeciesGeometries();
  const { matrices, colors } = scatterTrees(world);
  // Option key order is part of the material identity.
  const swaying = npr({ vertexColors: true, stipple: 0.55, stippleScale: 2.4, treeSway: true });
  const still = npr({ vertexColors: true, stipple: 0.55, stippleScale: 2.4 });
  geometries.forEach((geometry, species) => {
    geometry.computeBoundingBox();
    const placements = matrices[species];
    const layer = new THREE.InstancedMesh(geometry, species === BUSH ? still : swaying, placements.length);
    for (let instance = 0; instance < placements.length; instance++) {
      layer.setMatrixAt(instance, placements[instance]);
      layer.setColorAt(instance, colors[species][instance]);
      // Stamped from the double-precision matrix, in push order (the grid stores Float32).
      stampCanopyHeights(world, geometry, placements[instance]);
    }
    world.group.add(layer);
    // The debug menu holds this array, so it is filled in place, never replaced.
    world.treeLayers.push(layer);
  });
}
