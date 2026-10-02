// Permanent way around the whole loop: ballast bed and two rails swept along every frame
// (the closing frame seals the seam), plus one instanced sleeper every 0.72 units of arc length.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { extrude } from '../../geometry/extrude-profile-along-frames.js';
import { UP } from '../world-constants.js';
import { pointAtS, tangentAtS } from './track-spline-frames-and-queries.js';

const BALLAST_PROFILE = [[-1.35, -0.55], [1.35, -0.55], [0.95, 0.03], [-0.95, 0.03]];
const RAIL_OFFSETS = [-0.52, 0.52];
const RAIL_HALF_WIDTH = 0.07;
const SLEEPER_SPACING = 0.72;
const SLEEPER_LIFT = 0.08;

// Rail cross-section centred on lateral offset `x`, from 0.12 to 0.3 above the frame.
function railProfile(x) {
  const inner = x - RAIL_HALF_WIDTH;
  const outer = x + RAIL_HALF_WIDTH;
  return [[inner, 0.12], [outer, 0.12], [outer, 0.3], [inner, 0.3]];
}

// Sleeper basis: x across the track (pointing inward), y up, z along the tangent.
function writeSleeperMatrices(world, sleepers) {
  const position = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const across = new THREE.Vector3();
  const lift = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  const sleeperRotation = new THREE.Quaternion();
  const unitScale = new THREE.Vector3(1, 1, 1);
  const instance = new THREE.Matrix4();
  for (let index = 0; index < sleepers.count; index++) {
    const s = index * SLEEPER_SPACING;
    pointAtS(world, s, position);
    tangentAtS(world, s, tangent);
    across.crossVectors(UP, tangent).normalize();
    lift.crossVectors(tangent, across).normalize();
    sleeperRotation.setFromRotationMatrix(basis.makeBasis(across, lift, tangent));
    position.y += SLEEPER_LIFT;
    sleepers.setMatrixAt(index, instance.compose(position, sleeperRotation, unitScale));
  }
}

export function buildTrack(world) {
  const ballastGeometry = extrude(world.frames, BALLAST_PROFILE);
  const ballast = npr({ color: '#a39a8c', stipple: 0.5, stippleScale: 5, doubleSided: true });
  world.group.add(new THREE.Mesh(ballastGeometry, ballast));

  const rail = npr({ color: '#8f8f9e', stipple: 0.05, doubleSided: true });
  for (const offset of RAIL_OFFSETS) world.group.add(new THREE.Mesh(extrude(world.frames, railProfile(offset)), rail));

  const sleeperGeometry = new THREE.BoxGeometry(1.9, 0.12, 0.32);
  const sleeperMaterial = npr({ color: '#6e4a32', stipple: 0.25, stippleScale: 4 });
  const sleepers = new THREE.InstancedMesh(sleeperGeometry, sleeperMaterial, Math.floor(world.length / SLEEPER_SPACING));
  writeSleeperMatrices(world, sleepers);
  world.group.add(sleepers);
}
