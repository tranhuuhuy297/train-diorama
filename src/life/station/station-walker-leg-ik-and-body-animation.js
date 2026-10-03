// Walker posing: two-bone leg IK from hip to foot target (knee bends forward), and the upper-body
// motion driven by the walker's bounce/swing (bob, lean, arm swing, hat tilt) plus the cane, whose
// shaft is resized every frame so its tip just touches the platform.
import * as THREE from 'three';

export const WALKER_LEG_SEGMENT_LENGTH = 0.36;
const UP = new THREE.Vector3(0, 1, 0);
const HIP_SPREAD = 0.13;
const SHOE_FORWARD = 0.045;

// Stretches a unit-height bone mesh between two points (walker.axis is free scratch by now).
function fitBone(walker, mesh, from, to) {
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  const axis = walker.axis.subVectors(to, from);
  mesh.scale.y = axis.length();
  mesh.quaternion.setFromUnitVectors(UP, axis.normalize());
}

/** Places thigh, shin and shoe of both legs from their world targets, in the figure's local space. */
export function poseWalkerLegs(walker) {
  const { figure, hip, ankle, axis, bend, knee } = walker;
  const L = WALKER_LEG_SEGMENT_LENGTH;
  for (const leg of walker.legs) {
    hip.set(leg.side * HIP_SPREAD, walker.rig.body.position.y, 0);
    ankle.copy(leg.target).sub(figure.position).applyAxisAngle(UP, -figure.rotation.y).divideScalar(figure.scale.x);
    axis.subVectors(ankle, hip);
    const reach = axis.length();
    axis.normalize();
    // Forward knee pole, made perpendicular to the hip-to-ankle line.
    bend.set(0, 0, 1).addScaledVector(axis, -axis.z).normalize();
    const kneeOut = Math.sqrt(Math.max(0, L ** 2 - (reach / 2) ** 2));
    knee.copy(hip).addScaledVector(axis, reach / 2).addScaledVector(bend, kneeOut);
    fitBone(walker, leg.thigh, hip, knee);
    fitBone(walker, leg.shin, knee, ankle);
    leg.shoe.position.copy(ankle);
    leg.shoe.position.z += SHOE_FORWARD;
  }
}

/** Breathing, step bob and sway on the body, head and hat; arm swing; cane length to the floor. */
export function animateWalkerBody(walker) {
  const { body, head, hat, arms, cane, caneShaft } = walker.rig;
  const b = walker.bounce;
  const s = walker.swing;
  const e = walker.elapsed;
  const breathing = Math.sin(e * 1.8);
  body.position.y = 0.68 + b * 0.025 + breathing * 0.005;
  body.rotation.set(0.04 + b * 0.045, s * 0.055, s * 0.065);
  body.scale.set(1.07 + b * 0.025, 0.82 - b * 0.035, 1.08 + b * 0.02);
  head.rotation.x = -0.03 - b * 0.09 + Math.sin(e * 1.4) * 0.018;
  head.rotation.z = -s * 0.04;
  hat.rotation.x = -0.16 + b * 0.06;
  hat.rotation.z = s * 0.025;
  for (const { side, arm } of arms) {
    arm.rotation.x = -side * s * 0.38 - 0.06;
    arm.rotation.z = side * (0.025 + b * 0.035);
  }
  cane.rotation.x = s * 0.12;

  // Cane grip and shaft direction in figure space, from fresh world matrices.
  const figure = walker.figure;
  figure.updateWorldMatrix(true, true);
  const grip = figure.worldToLocal(cane.localToWorld(walker.caneGrip.set(0, 0, 0)));
  const down = figure.worldToLocal(cane.localToWorld(walker.caneDirection.set(0, -1, 0))).sub(grip);
  const length = (grip.y - 0.015 - b * 0.065) / -down.y;
  caneShaft.scale.y = length;
  caneShaft.position.y = -length / 2;
}
