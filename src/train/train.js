// The train: locomotive, tender and four coaches built in a fixed order, merged per car (wheels
// excluded), spaced along the track and placed each frame on the chord between two track points.
import * as THREE from 'three';
import { mergeStaticGeometry } from '../geometry/merge-static-geometry-by-material.js';
import { COACH_COLORS, createTrainMaterials, createCoachMaterials, createCoachBodyMaterial } from './train-palette-materials.js';
import { buildLocomotiveBody } from './locomotive-boiler-and-cab-builder.js';
import { buildLocomotiveFront } from './locomotive-front-end-and-lamps-builder.js';
import { createWheelParts, buildLocomotiveWheels } from './rolling-stock-wheel-builders.js';
import { buildTender } from './tender-car-builder.js';
import { createWindowGridTemplate, buildPassengerCoach } from './passenger-coach-builder.js';

const LOCOMOTIVE_LENGTH = 4.6;
const COUPLING_GAP = 0.45;
// Each car rides on the chord between points this fraction of its length ahead of and behind its centre.
const AXLE_SPREAD = 0.34;

// Offsets accumulate half-lengths plus the coupling gap; cars join the group in car order.
function layOutCars(cars, group) {
  let previous = null;
  for (const car of cars) {
    car.offset = previous === null ? 0 : previous.offset + (previous.len / 2 + COUPLING_GAP + car.len / 2);
    group.add(car.obj);
    previous = car;
  }
}

export class Train {
  constructor() {
    this.group = new THREE.Group();
    this.cars = [];
    this.noShadow = [];
    this.chimney = new THREE.Object3D();
    this.headlight = new THREE.Object3D();
    // Track-point scratch reused by update().
    [this.frontPosition, this.rearPosition] = [new THREE.Vector3(), new THREE.Vector3()];

    const m = createTrainMaterials();
    const locomotive = new THREE.Group();
    buildLocomotiveBody(locomotive, m, this.noShadow);
    buildLocomotiveFront(locomotive, m, this);
    m.wheelParts = createWheelParts();
    const wheels = buildLocomotiveWheels(locomotive, m);
    this.chimney.position.set(0, 2.9, 1.95);
    locomotive.add(this.chimney);
    this.loco = { obj: locomotive, len: LOCOMOTIVE_LENGTH, offset: 0, wheels };
    this.cars.push(this.loco, buildTender(m));

    Object.assign(m, createCoachMaterials());
    m.windowGrid = createWindowGridTemplate(m.windowBar);
    for (const color of COACH_COLORS) {
      const bodyMaterial = createCoachBodyMaterial(color);
      this.cars.push(buildPassengerCoach(bodyMaterial, m, this.noShadow));
    }

    // Merging waits until every car exists, so material ids and geometry order match a one-pass build.
    for (const car of this.cars) mergeStaticGeometry(car.obj, new Set(car.wheels.map(wheel => wheel.mesh)));
    layOutCars(this.cars, this.group);
  }

  get totalLength() {
    const last = this.cars.at(-1);
    return last.offset + last.len / 2;
  }

  /** Places every car at track distance `distance` minus its offset and rolls its wheels without slip. */
  update(world, distance) {
    const front = this.frontPosition;
    const rear = this.rearPosition;
    for (const car of this.cars) {
      const along = distance - car.offset;
      const reach = car.len * AXLE_SPREAD;
      world.pointAtS(along + reach, front);
      world.pointAtS(along - reach, rear);
      car.obj.position.addVectors(front, rear).multiplyScalar(0.5);
      car.obj.lookAt(front);
      for (const wheel of car.wheels) wheel.mesh.rotation.x = along / wheel.r;
    }
  }
}
