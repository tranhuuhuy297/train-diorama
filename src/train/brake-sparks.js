// Brake sparks: a ring buffer of instanced unit boxes stretched into short yellow streaks along their
// velocity. Spawned at the locomotive wheel rims while braking; they fall, bounce off the terrain and
// shrink away. Each spawn draws Math.random four times (velocity x, y, z, then lifetime).
import '../core/disable-three-color-management.js';
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
export const SPARK_EMISSION_MULTIPLIER = 1.4;
export const SPARK_CAPACITY = Math.ceil(192 * SPARK_EMISSION_MULTIPLIER);

const GRAVITY = 9.8;
const GROUND_CLEARANCE = 0.025;
const BOUNCE_UP = -0.48;
const BOUNCE_DRAG = 0.7;
const STREAK_WIDTH = 0.028;
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);

const newSpark = () => ({ position: new THREE.Vector3(), velocity: new THREE.Vector3(), duration: 1, life: 0 });

// Sparks per second before the multiplier: 40 at a feather touch, 180 at full strength.
const sparksPerSecond = strength => 40 + strength * 140;

function createStreakMesh(geometry, material) {
  const streaks = new THREE.InstancedMesh(geometry, material, SPARK_CAPACITY);
  streaks.frustumCulled = false;
  streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  for (let slot = 0; slot < SPARK_CAPACITY; slot++) streaks.setMatrixAt(slot, HIDDEN);
  return streaks;
}

export class BrakeSparks {
  constructor(heightAt) {
    this.heightAt = heightAt;
    const unitBox = new THREE.BoxGeometry(1, 1, 1);
    const streakColour = new THREE.MeshBasicMaterial({ color: '#ffe56b', toneMapped: false });
    this.geometry = unitBox;
    this.material = streakColour;
    this.mesh = createStreakMesh(unitBox, streakColour);
    this.particles = Array.from({ length: SPARK_CAPACITY }, newSpark);
    this.nextParticle = 0;
    this.nextWheel = 0;
    this.emission = 0;
    // Per-frame scratch, never reallocated.
    this.streak = { matrix: new THREE.Matrix4(), turn: new THREE.Quaternion(), axis: new THREE.Vector3(), size: new THREE.Vector3() };
    this.bodyTurn = new THREE.Quaternion();
  }

  // Rim contact on the wheel's outer face, in world space; the kick points outward and up, turned with the loco.
  launch(spark, wheel, body) {
    const hub = wheel.mesh.position;
    const outward = Math.sign(hub.x);
    spark.position.set(hub.x + outward * 0.08, hub.y - (wheel.r - 0.035), hub.z);
    body.localToWorld(spark.position);
    const kickX = outward * (1.5 + Math.random() * 3);
    const kickY = 0.9 + Math.random() * 2;
    const kickZ = (Math.random() - 0.5) * 6.4 - 0.5;
    spark.velocity.set(kickX, kickY, kickZ).applyQuaternion(this.bodyTurn);
    const lifetime = 0.7 + Math.random() * 0.45;
    spark.duration = lifetime;
    spark.life = lifetime;
  }

  // Ballistic step with a terrain bounce; returns the velocity-aligned, fading streak matrix.
  fly(spark, dt) {
    const { position, velocity } = spark;
    position.addScaledVector(velocity, dt);
    velocity.y -= GRAVITY * dt;
    const floor = this.heightAt(position.x, position.z) + GROUND_CLEARANCE;
    if (position.y < floor) {
      position.y = floor;
      if (velocity.y < 0) {
        velocity.y *= BOUNCE_UP;
        velocity.x *= BOUNCE_DRAG;
        velocity.z *= BOUNCE_DRAG;
      }
    }
    const { matrix, turn, axis, size } = this.streak;
    const remaining = spark.life / spark.duration;
    turn.setFromUnitVectors(UP, axis.copy(velocity).normalize());
    const width = STREAK_WIDTH * remaining;
    size.set(width, (0.1 + velocity.length() * 0.025) * remaining, width);
    return matrix.compose(position, turn, size);
  }

  /** `strength` 0..1 from the brake rule; `locomotive` is the Car {obj, wheels}. */
  update(dt, strength, locomotive) {
    if (strength > 0) this.emission += dt * sparksPerSecond(strength) * SPARK_EMISSION_MULTIPLIER;
    else this.emission = 0;
    const body = locomotive.obj;
    const wheels = locomotive.wheels;
    body.updateWorldMatrix(true, false);
    body.getWorldQuaternion(this.bodyTurn);
    for (; this.emission >= 1; this.emission -= 1) {
      const wheel = wheels[this.nextWheel];
      const spark = this.particles[this.nextParticle];
      this.nextWheel = (this.nextWheel + 1) % wheels.length;
      this.nextParticle = (this.nextParticle + 1) % SPARK_CAPACITY;
      this.launch(spark, wheel, body);
    }
    const streaks = this.mesh;
    this.particles.forEach((spark, slot) => {
      spark.life = Math.max(0, spark.life - dt);
      streaks.setMatrixAt(slot, spark.life > 0 ? this.fly(spark, dt) : HIDDEN);
    });
    streaks.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
