// Two village residents in front of the first two cottages: the woman paces her yard on a 28 s
// loop while the man and his dog idle by their door. Everything runs on simulation time, so the
// figures freeze while the diorama is paused.
import * as THREE from 'three';
import { mergeStaticGeometry } from '../../geometry/merge-static-geometry-by-material.js';
import { wrapAngle, exponentialResponse } from '../../core/scalar-math-helpers.js';
import { SIDES, createVillageResidentMaterials, makeHead, addPartRows } from './village-resident-materials-and-primitives.js';
import { dressVillageWoman, dressVillageMan } from './village-woman-and-man-outfits.js';
import { buildVillageDog } from './village-dog-builder.js';

export const VILLAGE_WALK_CYCLE_SECONDS = 28;
// Walk legs inside one cycle: out [4, 12), back [18, 26); each crossing takes 8 s.
const WALK_OUT_START = 4;
const WALK_OUT_END = 12;
const WALK_BACK_START = 18;
const WALK_BACK_END = 26;
const CROSSING_SECONDS = 8;
const YARD_START_X = -0.75;
const YARD_WIDTH = 1.5;
const MAN_X = 0.45;
const IDLE_HEADING = 0.2;
const TURN_RATE = 4;
const STRIDE_RATE = 7;
const FIGURE_SCALE = 0.8;
const DEFAULT_FRONT_OFFSET = 1.25;
const DOG_SPOT = { x: 1.2, frontGap: 1.35, heading: -0.2 };
// Idle and stride motion: step bob/roll, breathing, head and arm drift, leg and arm swing, dog head and tail.
const STEP_BOB = 0.025;
const STEP_ROLL = 0.045;
const LEG_SWING = 0.28;
const ARM_SWING = 0.23;
const BREATH = { rate: 1.8, reach: 0.008 };
const HEAD_DRIFT = { rate: 0.7, reach: 0.18 };
const ARM_DRIFT = { rate: 1.5, reach: 0.025 };
const DOG_LOOK = { rest: -0.25, yawRate: 0.8, yawReach: 0.22, tiltRate: 0.6, tiltReach: 0.08 };
const TAIL_WAG = { rate: 5, reach: 0.35 };
const STARTS_WALKING = '[VILLAGE] Woman starts walking';
const STOPS_IN_YARD = '[VILLAGE] Woman stops in yard';
const { clamp } = THREE.MathUtils;
const swing = (angle, reach) => Math.sin(angle) * reach;

/** Fills `target` with the cycle time, whether the woman is walking and her 0..1 progress across the yard. */
export function resolveVillageWalkCycle(elapsed, target = { cycle: 0, walking: false, progress: 0 }) {
  const cycle = elapsed % VILLAGE_WALK_CYCLE_SECONDS;
  const walkingOut = cycle >= WALK_OUT_START && cycle < WALK_OUT_END;
  target.cycle = cycle;
  target.walking = walkingOut || (cycle >= WALK_BACK_START && cycle < WALK_BACK_END);
  target.progress = clamp((cycle - WALK_OUT_START) / CROSSING_SECONDS, 0, 1)
    - clamp((cycle - WALK_BACK_START) / CROSSING_SECONDS, 0, 1);
  return target;
}

const SHIN_AND_SHOE = [
  ['block', 'skin', [0, -0.23, 0], [0.17, 0.46, 0.18]],
  ['block', 'dark', [0, -0.515, 0.045], [0.22, 0.13, 0.3]],
];
// Upper arm then hand, mirrored by the arm's side.
const ARM_PARTS = [
  ['shape', 'skin', [0.025, -0.22, 0], [0.12, 0.31, 0.12]],
  ['shape', 'skin', [0.05, -0.49, 0.025], [0.09, 0.11, 0.085]],
];

function childGroup(parent, x = 0, y = 0, z = 0) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  parent.add(group);
  return group;
}

// Undressed figure on its own home frame (a copy of the cottage transform under `parent`).
function buildBaseResident({ house, depth }, index, parent, materials) {
  const home = childGroup(parent);
  home.position.copy(house.position);
  home.quaternion.copy(house.quaternion);
  const figure = childGroup(home);
  figure.scale.setScalar(FIGURE_SCALE);
  const body = childGroup(figure);
  const head = makeHead(body, materials.skin, materials.hair, materials.dark, 1.36);
  const legs = [];
  const arms = [];
  for (const side of SIDES) {
    const leg = childGroup(figure, side * 0.16, 0.58, 0);
    addPartRows(leg, materials, SHIN_AND_SHOE);
    legs.push(leg);
    const arm = childGroup(body, side * 0.35, 1.27, 0);
    arm.rotation.z = side * 0.12;
    addPartRows(arm, materials, ARM_PARTS, side);
    arms.push(arm);
  }
  return { home, figure, body, head, legs, arms, depth, frontOffset: DEFAULT_FRONT_OFFSET, position: new THREE.Vector3(), index };
}

// Animated pivots merge on their own and stay out of their parent's merge.
function mergeResident({ head, arms, legs, body }) {
  mergeStaticGeometry(head);
  for (const limb of arms) mergeStaticGeometry(limb);
  for (const limb of legs) mergeStaticGeometry(limb);
  mergeStaticGeometry(body, new Set([head, ...arms]));
}

export class VillageResidents {
  constructor(homes, groundHeight, parent) {
    this.groundHeight = groundHeight;
    this.walking = false;
    const materials = createVillageResidentMaterials();
    this.residents = homes.map((home, index) => buildBaseResident(home, index, parent, materials));
    dressVillageWoman(this.residents[0], materials);
    dressVillageMan(this.residents[1], materials);
    const { dog, dogHead, dogTail } = buildVillageDog(this.residents[1].home, materials);
    this.dogHead = dogHead;
    this.dogTail = dogTail;
    this.dog = dog;
    this.dogPosition = new THREE.Vector3();
    this.walkCycle = { cycle: 0, walking: false, progress: 0 };
    for (const resident of this.residents) mergeResident(resident);
    mergeStaticGeometry(dogHead);
    mergeStaticGeometry(dogTail);
    mergeStaticGeometry(dog, new Set([dogHead, dogTail]));
    this.update(0, 0);
  }

  /** One simulation step; returns the walk start/stop log line on a change, else null. */
  update(elapsed, dt) {
    const { cycle, walking, progress } = resolveVillageWalkCycle(elapsed, this.walkCycle);
    let event = null;
    if (walking !== this.walking) event = walking ? STARTS_WALKING : STOPS_IN_YARD;
    this.walking = walking;
    for (let i = 0; i < this.residents.length; i++) this.poseResident(this.residents[i], elapsed, dt, cycle, progress);
    this.poseDog(elapsed);
    return event;
  }

  poseResident(resident, elapsed, dt, cycle, progress) {
    const { home, figure, body, head, legs, arms, depth, frontOffset, position, index } = resident;
    const moving = index === 0 && this.walking;
    const stride = moving ? Math.sin(elapsed * STRIDE_RATE) : 0;
    const localX = index === 0 ? YARD_START_X + progress * YARD_WIDTH : MAN_X;
    const localZ = depth / 2 + frontOffset;
    home.localToWorld(position.set(localX, 0, localZ));
    figure.position.set(localX, this.groundHeight(position.x, position.z) - home.position.y, localZ);
    let heading = IDLE_HEADING;
    if (moving) heading = cycle < WALK_OUT_END ? Math.PI / 2 : -Math.PI / 2;
    figure.rotation.y += wrapAngle(heading - figure.rotation.y) * exponentialResponse(dt, TURN_RATE);
    body.position.y = Math.abs(stride) * STEP_BOB;
    body.rotation.z = stride * STEP_ROLL;
    body.scale.y = 1 + swing(elapsed * BREATH.rate + index, BREATH.reach);
    head.rotation.y = swing(elapsed * HEAD_DRIFT.rate + index, HEAD_DRIFT.reach);
    const armDrift = swing(elapsed * ARM_DRIFT.rate, ARM_DRIFT.reach);
    // Left limb (-1) then right (+1); each arm swings against its leg.
    for (let limb = 0; limb < legs.length; limb++) {
      const direction = limb * 2 - 1;
      legs[limb].rotation.x = stride * direction * LEG_SWING;
      arms[limb].rotation.x = -stride * direction * ARM_SWING + armDrift;
    }
  }

  poseDog(elapsed) {
    const { home, depth } = this.residents[1];
    const localZ = depth / 2 + DOG_SPOT.frontGap;
    const ground = home.localToWorld(this.dogPosition.set(DOG_SPOT.x, 0, localZ));
    this.dog.position.set(DOG_SPOT.x, this.groundHeight(ground.x, ground.z) - home.position.y, localZ);
    this.dog.rotation.y = DOG_SPOT.heading;
    this.dogHead.rotation.y = DOG_LOOK.rest + swing(elapsed * DOG_LOOK.yawRate, DOG_LOOK.yawReach);
    this.dogHead.rotation.z = swing(elapsed * DOG_LOOK.tiltRate, DOG_LOOK.tiltReach);
    this.dogTail.rotation.y = swing(elapsed * TAIL_WAG.rate, TAIL_WAG.reach);
  }
}
