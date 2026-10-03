// Bird flocks on their perches: build one flock per perch (seeded sizes, phases and headings from
// their own PRNG), then each frame let the train decide take-off/return and animate every bird.
import * as THREE from 'three';
import { mulberry32 } from '../../core/seeded-prng-and-gradient-noise.js';
import { exponentialResponse } from '../../core/scalar-math-helpers.js';
import { createBirdGeometries, createBirdRig, disposeBirdGeometries } from './bird-geometry-builder.js';
import { decideBirdFlock, computeFlockSnapshot } from './bird-flock-state-machine.js';
import { createBirdFlightPoses } from './bird-flight-poses.js';
import { rotateBirdTowards, orientBirdAlongFlight, animateBirdWingsAndBody } from './bird-wing-body-animator.js';

const BIRD_SEED = 7821;
const HEIGHT_SAMPLES = 24;
const DELAY_STEP = 0.09;
const TURN_RESPONSE_RATE = 9;

// Cruise height: 5 m over the perch, raised to clear ground (+3) and canopy (+2) around the orbit.
function flightHeightFor(center, outward, tangent, heightAt, canopyHeightAt) {
  let height = center.y + 5;
  const sample = new THREE.Vector3();
  for (let i = 0; i < HEIGHT_SAMPLES; i++) {
    const angle = i / HEIGHT_SAMPLES * Math.PI * 2;
    sample.copy(center).addScaledVector(outward, 7 + Math.sin(angle) * 3).addScaledVector(tangent, Math.cos(angle) * 5);
    height = Math.max(height, heightAt(sample.x, sample.z) + 3, canopyHeightAt(sample.x, sample.z, 2) + 2);
  }
  return height;
}

function createBird(home, index, outward, random, geometries, material, group) {
  const rig = createBirdRig(geometries, material);
  rig.figure.scale.setScalar((0.68 + random() * 0.18) * 0.6);
  rig.figure.position.copy(home);
  group.add(rig.figure);
  const zero = () => new THREE.Vector3();
  return {
    ...rig,
    home,
    departure: home.clone(),
    returnStart: home.clone(),
    velocity: zero(),
    returnVelocity: zero(),
    departureVelocity: zero(),
    airborneDeparture: false,
    previous: home.clone(),
    delay: index * DELAY_STEP,
    phase: random() * Math.PI * 2,
    heading: Math.atan2(outward.x, outward.z) + (random() - 0.5) * 1.5,
  };
}

function createFlock(perch, random, geometries, options, group) {
  const { positions, outward } = perch;
  const center = new THREE.Vector3();
  for (const position of positions) center.add(position);
  center.divideScalar(positions.length);
  const tangent = new THREE.Vector3(-outward.z, 0, outward.x);
  const flightHeight = flightHeightFor(center, outward, tangent, options.heightAt, options.canopyHeightAt);
  const birds = positions.map((home, index) => createBird(home, index, outward, random, geometries, options.material, group));
  return { id: perch.id, mode: 'perched', changedAt: 0, trackDistance: perch.trackDistance, outward, tangent, center, flightHeight, birds };
}

/** options: {perches, trackLength, heightAt(x, z), canopyHeightAt(x, z, pad), material}. */
export function createBirdSystem(options) {
  const random = mulberry32(BIRD_SEED);
  const group = new THREE.Group();
  group.name = 'Bird flocks';
  const geometries = createBirdGeometries();
  const flocks = options.perches.map(perch => createFlock(perch, random, geometries, options, group));

  // Per-frame scratch, shared by every flock and bird.
  const aim = new THREE.Euler(0, 0, 0, 'YXZ');
  const aimQuaternion = new THREE.Quaternion();
  const orbitPoint = new THREE.Vector3();
  const travel = new THREE.Vector3();
  const proximity = { approaching: false, clear: false };
  const orientScratch = { targetRotation: aim, targetQuaternion: aimQuaternion };
  const poses = createBirdFlightPoses({ targetRotation: aim, nextPosition: orbitPoint });
  let lastTime = null;

  // Start perched, already facing the idle heading (no easing on the first frame).
  for (const flock of flocks) {
    for (const bird of flock.birds) {
      poses.perched(bird, flock, 0);
      bird.figure.quaternion.setFromEuler(aim);
    }
  }

  function animateBird(bird, flock, time, dt, response) {
    const position = bird.figure.position;
    bird.previous.copy(position);
    poses[flock.mode](bird, flock, time);
    if (flock.mode === 'perched') {
      rotateBirdTowards(bird, aimQuaternion.setFromEuler(aim), response, dt);
      bird.velocity.set(0, 0, 0);
      return;
    }
    travel.subVectors(position, bird.previous);
    orientBirdAlongFlight(bird, travel, dt, response, orientScratch);
    if (dt > 0) bird.velocity.copy(travel).divideScalar(dt);
    animateBirdWingsAndBody(bird, flock, time, response);
  }

  // Captures each bird's current motion when the flock turns home or is chased off its approach.
  function applyChange(flock, change) {
    for (const bird of flock.birds) {
      const { figure: { position }, velocity } = bird;
      if (change.captureReturn) {
        bird.returnStart.copy(position);
        bird.returnVelocity.copy(velocity);
      }
      if (change.captureDeparture) {
        bird.departure.copy(position);
        bird.departureVelocity.copy(velocity);
        bird.airborneDeparture = true;
      }
    }
    console.log(change.log);
  }

  // `time` is sim time; dt comes from consecutive calls (0 on the first one).
  function update(time, trainS, trainSpeed, trainCars) {
    const dt = lastTime === null ? 0 : Math.max(0, time - lastTime);
    lastTime = time;
    const response = exponentialResponse(dt, TURN_RESPONSE_RATE);
    for (const flock of flocks) {
      computeFlockSnapshot(flock, trainS, trainSpeed, trainCars, options.trackLength, proximity);
      const change = decideBirdFlock(proximity, time, flock);
      if (change !== null) applyChange(flock, change);
      for (const bird of flock.birds) animateBird(bird, flock, time, dt, response);
    }
  }

  function dispose() {
    group.removeFromParent();
    disposeBirdGeometries(geometries);
  }

  return { group, flocks, update, dispose };
}
