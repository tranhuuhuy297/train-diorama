// The traveler's stroll along the platform: wait at a stop, turn on the spot, then short steps
// (one foot at a time) to the next stop, looping over three stops. update(dt) returns a
// [STATION] log line on departure/arrival and undefined otherwise.
import * as THREE from 'three';
import { wrapAngle, exponentialResponse } from '../../core/scalar-math-helpers.js';
import { poseWalkerLegs, animateWalkerBody } from './station-walker-leg-ik-and-body-animation.js';

export const WALKER_STEP_DURATION = 0.7;
const FIRST_WAIT = 5;
const MAX_STRIDE = 0.2;
const TURN_RATE = 1.8;
const TURN_TOLERANCE = 0.025;
const ARRIVAL_RADIUS = 0.001;
// Shuffling steps in place after every turn.
const STEPS_AFTER_TURN = 2;
const FOOT_LIFT = 0.085;
const BLEND_RATE = 14;
const FOOT_SPREAD = 0.13;
const ANKLE_HEIGHT = 0.075;
const FOOT_LEAD = 0.1;

const walks = stop => `[STATION] Traveler walks: stop ${stop}`;
const arrives = stop => `[STATION] Traveler arrives: stop ${stop}`;

// Ankle rest point of one foot, in the parent space of the figure standing at `origin`.
function footPlacement(out, figure, side, lead, origin) {
  return out.set(side * FOOT_SPREAD, ANKLE_HEIGHT, lead).multiplyScalar(figure.scale.x).applyEuler(figure.rotation).add(origin);
}

const vectorFields = (target, names) => names.forEach(name => { target[name] = new THREE.Vector3(); });

export class StationWalker {
  constructor(figure, legs, stops, rig) {
    // Field order is part of the parity surface (snapshots read these names).
    Object.assign(this, { figure, legs, stops, rig, elapsed: 0, bounce: 0, swing: 0 });
    vectorFields(this, ['caneGrip', 'caneDirection']);
    Object.assign(this, { stopIndex: 0, wait: FIRST_WAIT, progress: 1, legIndex: 0, turnSteps: 0 });
    Object.assign(this, { start: figure.position.clone(), end: figure.position.clone() });
    vectorFields(this, ['direction', 'footStart', 'footEnd', 'hip', 'ankle', 'knee', 'axis', 'bend']);
    for (const leg of legs) leg.target = footPlacement(new THREE.Vector3(), figure, leg.side, 0, figure.position);
    poseWalkerLegs(this);
  }

  update(dt) {
    this.elapsed = this.elapsed + dt;
    this.easeBodyMotion(dt);
    animateWalkerBody(this);
    if (this.wait > 0) return this.waitAtStop(dt);

    const { figure, direction } = this;
    direction.subVectors(this.stops[this.stopIndex], figure.position).setY(0);
    const distance = direction.length();
    const yawError = wrapAngle(Math.atan2(direction.x, direction.z) - figure.rotation.y);
    const standing = this.progress >= 1;
    if (standing && distance > ARRIVAL_RADIUS && Math.abs(yawError) > TURN_TOLERANCE) {
      figure.rotation.y += THREE.MathUtils.clamp(yawError, -dt * TURN_RATE, dt * TURN_RATE);
      this.turnSteps = STEPS_AFTER_TURN;
      poseWalkerLegs(this);
      return undefined;
    }
    if (standing) {
      if (distance < ARRIVAL_RADIUS) return this.arrive();
      this.beginStep(distance);
    }
    this.advanceStep(dt);
    return undefined;
  }

  // Bounce and swing chase the step's arc (zero while standing) with a 14/s exponential ease.
  easeBodyMotion(dt) {
    const midStep = this.wait <= 0 && this.progress < 1;
    const stride = Math.sin(Math.PI * this.progress);
    const bounceGoal = midStep ? stride : 0;
    const swingGoal = midStep ? stride * this.legs[this.legIndex].side : 0;
    const blend = exponentialResponse(dt, BLEND_RATE);
    this.bounce += (bounceGoal - this.bounce) * blend;
    this.swing += (swingGoal - this.swing) * blend;
  }

  // Standing still: legs stay posed; the departure line is logged when the wait runs out.
  waitAtStop(dt) {
    poseWalkerLegs(this);
    this.wait -= dt;
    return this.wait <= 0 ? walks(this.stopIndex + 1) : undefined;
  }

  // Logs the reached stop, then waits 8 / 10 / 6 s depending on the next stop.
  arrive() {
    const message = arrives(this.stopIndex + 1);
    const next = (this.stopIndex + 1) % this.stops.length;
    this.stopIndex = next;
    this.wait = 6 + next * 2;
    return message;
  }

  // Swaps the active foot and plans its arc; steps right after a turn stay on the spot.
  beginStep(distance) {
    const inPlace = this.turnSteps > 0;
    if (inPlace) this.turnSteps--;
    const { start, end, figure } = this;
    const heading = this.direction.normalize();
    start.copy(figure.position);
    end.copy(start).addScaledVector(heading, inPlace ? 0 : Math.min(MAX_STRIDE, distance));
    const nextLeg = 1 - this.legIndex;
    const { target, side } = this.legs[nextLeg];
    this.legIndex = nextLeg;
    this.footStart.copy(target);
    footPlacement(this.footEnd, figure, side, inPlace ? 0 : FOOT_LEAD, end);
    this.progress = 0;
  }

  // Body glides along the step; the swinging foot follows an eased arc with a small lift.
  advanceStep(dt) {
    const p = Math.min(1, this.progress + dt / WALKER_STEP_DURATION);
    this.progress = p;
    this.figure.position.lerpVectors(this.start, this.end, p);
    const foot = this.legs[this.legIndex].target;
    foot.lerpVectors(this.footStart, this.footEnd, (p * p) * (3 - 2 * p));
    foot.y += Math.sin(Math.PI * p) * FOOT_LIFT;
    poseWalkerLegs(this);
  }

  pose() {
    poseWalkerLegs(this);
  }

  animateBody() {
    animateWalkerBody(this);
  }
}

/** Walker for the traveler built at his pre-widening lane; applies the platform widening afterwards
 * with the same float operations as the rest of the station (+o·E, then a half-shift back). */
export function createPlatformWalker(site, { figure, legs, rig }) {
  const o = site.localOutward;
  const stops = [
    new THREE.Vector3(-0.6 * o, 0.4, 4.3),
    new THREE.Vector3(-0.6 * o, 0.4, -2.7),
    figure.position.clone(),
  ];
  const walker = new StationWalker(figure, legs, stops, rig);
  figure.position.x += o * site.platformExtension;
  const halfShift = (o * site.platformExtension) / 2;
  figure.position.x -= halfShift;
  for (const point of [walker.start, walker.end, ...stops, ...legs.map(leg => leg.target)]) point.x += halfShift;
  return walker;
}
