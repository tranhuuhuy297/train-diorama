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
import { updateWorld } from './world-per-frame-update.js';

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

  /** One simulation step of every animated world system; only valid on a fully built world. */
  update(elapsed, dt, trainPosition, trainMotion) {
    updateWorld(this, elapsed, dt, trainPosition, trainMotion);
  }
}
