// The diorama world: shared containers, the seeded placement PRNG and the ordered build steps,
// plus the ground and track queries other systems call. Field order and the three Object3D
// created here are part of the parity surface (each Object3D draws Math.random for its UUID).
import '../core/disable-three-color-management.js';
import * as THREE from 'three';
import { mulberry32 } from '../core/seeded-prng-and-gradient-noise.js';
import { SIZE, HALF, TRACK_SAMPLE_COUNT } from './world-constants.js';
import { runWorldBuildSteps } from './world-build-steps.js';
import { nearest, pointAtS, tangentAtS } from './track/track-spline-frames-and-queries.js';
import { inBridge } from './track/bridge-span-detection.js';
import { GRID_WIDTH, heightAt } from './terrain/terrain-heightmap-grading.js';
import { flattenBuildingGround } from './terrain/building-ground-flattening.js';
import { treeCanopyHeightAt as queryTreeCanopyHeight } from './trees/tree-canopy-height-grid.js';
import { updateWorld } from './world-per-frame-update.js';
import { createSheepTransforms } from '../life/sheep/sheep-instance-pose-writer.js';
import { sheepGroundAt } from '../life/sheep/sheep-pasture-ground-query.js';

export { SIZE, HALF };

export class World {
  /** `options` ({stopAfter, skip}) is for partial builds in tests only. */
  constructor(options = {}) {
    this.group = new THREE.Group();
    this.noShadow = [];
    this.N = TRACK_SAMPLE_COUNT;
    this.frames = [];
    this.heights = new Float32Array(GRID_WIDTH * GRID_WIDTH);
    this.bridge = [0, 0];
    this.stationS = 0;
    this.exclusions = [];
    this.buildingFoundations = [];
    this.windmillBlades = new THREE.Group();
    this.clouds = [];
    this.treeLayers = [];
    this.houseSmoke = [];
    this.stationTravelers = [];
    this.sheepStates = [];
    this.nightAmount = 0;
    this.sheepTransforms = createSheepTransforms();
    // Filled by the sheep build step; null layers mean a partial build without sheep.
    this.trackSheep = [];
    this.sheep = null;
    this.sheepLegs = null;
    this.sheepEars = null;
    this.balloon = new THREE.Group();
    this.birdPerches = [];
    // Created before the track so every later placement sees the same stream.
    this.rand = mulberry32(42);
    runWorldBuildSteps(this, options);
  }

  nearest(x, z) {
    return nearest(this, x, z);
  }

  inBridge(i) {
    return inBridge(this, i);
  }

  heightAt(x, z) {
    return heightAt(this, x, z);
  }

  /** True when (x, z) lies inside any keep-out circle grown by `pad`. */
  excluded(x, z, pad = 0) {
    return this.exclusions.some(circle => Math.hypot(circle.x - x, circle.z - z) < circle.r + pad);
  }

  /** Pasture ground height at (x, z) or null; may write the slope normal into `normalOut`. */
  sheepGroundAt(x, z, normalOut) {
    return sheepGroundAt(this, x, z, normalOut);
  }

  /** Track point at arc length s (wrapped); a fresh vector when no target is given. */
  pointAtS(s, target) {
    return pointAtS(this, s, target);
  }

  tangentAtS(s, target) {
    return tangentAtS(this, s, target);
  }

  flattenBuildingGround(pad) {
    flattenBuildingGround(this, pad);
  }

  /** Highest stamped canopy top over the square of half-size `radius` around (x, z); 0 where no tree stands. */
  treeCanopyHeightAt(x, z, radius) {
    return queryTreeCanopyHeight(this, x, z, radius);
  }

  /** One simulation step of every animated world system; only valid on a fully built world. */
  update(elapsed, dt, trainPosition, trainMotion) {
    updateWorld(this, elapsed, dt, trainPosition, trainMotion);
  }
}
