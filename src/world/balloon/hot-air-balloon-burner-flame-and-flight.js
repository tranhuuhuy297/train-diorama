// Balloon assembly (envelope, basket, pilot and sandbags merged by material; burner and flames
// left live) and its flight: a slow elliptical orbit over the board with a bob, a spin and a
// flickering burner flame, all closed-form in sim time.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { mergeStaticGeometry } from '../../geometry/merge-static-geometry-by-material.js';
import { createLightGlows } from '../../effects/night-light-glow-sprites.js';
import {
  BALLOON_LOCAL_GLOW, createBalloonEnvelope, buildBalloonBasket, buildBalloonRopesAndSandbags,
} from './hot-air-balloon-envelope-and-basket.js';
import { buildBalloonPilot } from './hot-air-balloon-pilot-figure.js';

const BURNER_X = 0;
const BURNER_Z = -0.08;
// Outer orange tongue, then the pale core.
const FLAME_LAYERS = [
  { radius: 0.105, height: 0.52, color: '#ff942e' },
  { radius: 0.062, height: 0.34, color: '#fff3b0' },
];
const BURNER_GLOW = { position: [BURNER_X, -2.02, BURNER_Z], size: [1.7, 1.7], normal: [0, 0, 0], strength: 0.85 };

function buildBurner(balloon) {
  const metal = npr({ color: '#514b43' });
  box(0.46, 0.045, 0.045, metal, BURNER_X, -2.22, BURNER_Z, balloon);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.085, 0.14, 8), metal);
  can.position.set(BURNER_X, -2.18, BURNER_Z);
  balloon.add(can);
}

function buildFlame(world) {
  const flame = new THREE.Group();
  flame.position.set(BURNER_X, -2.11, BURNER_Z);
  for (const { radius, height, color } of FLAME_LAYERS) {
    const cone = new THREE.ConeGeometry(radius, height, 7);
    const tongue = new THREE.Mesh(cone, npr({ color, emissive: 1, nightGlow: true }));
    // Cone base sits on the burner mouth.
    tongue.position.y = height / 2;
    flame.add(tongue);
    world.noShadow.push(tongue);
  }
  return flame;
}

export function buildBalloon(world) {
  const balloon = world.balloon;
  const localGlow = BALLOON_LOCAL_GLOW;
  // Call order fixes material creation, merge batch order and vertex order within each batch.
  const envelope = createBalloonEnvelope(balloon, localGlow);
  buildBalloonBasket(balloon, localGlow);
  buildBalloonPilot(balloon, localGlow);
  buildBalloonRopesAndSandbags(balloon, localGlow);
  mergeStaticGeometry(balloon, new Set([envelope]));

  buildBurner(balloon);
  world.balloonFlame = buildFlame(world);
  balloon.add(world.balloonFlame);
  const glow = createLightGlows([BURNER_GLOW]);
  balloon.add(glow);
  world.noShadow.push(glow);
  world.group.add(balloon);
}

const ORBIT_RATE = 0.035;
const ORBIT_X = 34;
const ORBIT_Z = 26;
const ORBIT_CENTRE_Z = -4;
const CRUISE_HEIGHT = 27;
const BOB_RATE = 0.5;
const BOB_HEIGHT = 1.2;
const SPIN_RATE = 0.1;

/** Pose for sim time `elapsed`; needs the flame group, so only valid on a fully built world. */
export function updateBalloonFlight(world, elapsed) {
  const heading = elapsed * ORBIT_RATE;
  world.balloon.position.set(
    Math.cos(heading) * ORBIT_X,
    CRUISE_HEIGHT + Math.sin(elapsed * BOB_RATE) * BOB_HEIGHT,
    Math.sin(heading) * ORBIT_Z + ORBIT_CENTRE_Z,
  );
  world.balloon.rotation.y = elapsed * SPIN_RATE;
  world.balloonFlame.scale.y = 0.9 + Math.sin(elapsed * 9) * 0.06 + Math.sin(elapsed * 17) * 0.04;
}
