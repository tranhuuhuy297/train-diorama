// Cloud motion: an eastward drift that wraps around its band with a soft shrink at the band
// edges (sim time), and a camera push that parts a cloud the view flies into (real time).
import { smoothstep } from '../../core/seeded-prng-and-gradient-noise.js';

// Extra clearance kept between the camera and every blob sphere.
export const CLOUD_CAMERA_BUFFER = 1.5;
// Exponential glide-back rate of a pushed cloud, per second.
export const CLOUD_RETURN_RESPONSE = 1.8;
const SETTLED_OFFSET_SQ = 1e-10;
const GROW_IN_SECONDS = 2;

function placeGroup(cloud) {
  cloud.group.position.addVectors(cloud.position, cloud.offset);
}

/** Drift, wrap and edge fade for one sim step; does nothing to the avoidance offset except reset it on wrap. */
export function updateCloudDrift(clouds, dt) {
  for (const cloud of clouds) {
    const half = cloud.travelWidth / 2;
    cloud.age += dt;
    cloud.position.x += cloud.speed * dt;
    if (cloud.position.x > half) {
      cloud.position.x -= cloud.travelWidth;
      cloud.offset.set(0, 0, 0);
    }
    placeGroup(cloud);
    const x = cloud.position.x;
    const fadeIn = smoothstep(-half, -half + cloud.fadeWidth, x);
    const fadeOut = 1 - smoothstep(half - cloud.fadeWidth, half, x);
    cloud.group.scale.setScalar(cloud.size * (fadeIn * fadeOut) * smoothstep(0, GROW_IN_SECONDS, cloud.age));
  }
}

// Forward distance along unit (ux, uy, uz) that clears the camera from every buffered blob sphere
// the push line meets; `hit` reports whether any sphere actually contains the camera.
const push = { distance: 0, hit: false };
function measurePush(cloud, scale, dx, dy, dz, ux, uy, uz) {
  push.distance = 0;
  push.hit = false;
  for (const { position, radius } of cloud.colliders) {
    const cx = dx + position.x * scale;
    const cy = dy + position.y * scale;
    const cz = dz + position.z * scale;
    const reach = radius * scale + CLOUD_CAMERA_BUFFER;
    const centreSq = cx * cx + cy * cy + cz * cz;
    if (centreSq < reach * reach) push.hit = true;
    const along = cx * ux + cy * uy + cz * uz;
    const discriminant = along * along + reach * reach - centreSq;
    if (discriminant > 0) push.distance = Math.max(push.distance, Math.sqrt(discriminant) - along);
  }
  return push;
}

/** Glides every offset back toward zero, then shoves visible clouds the camera is inside out of the way. */
export function updateCloudCamera(clouds, cameraPosition, dt) {
  const decay = Math.exp(-CLOUD_RETURN_RESPONSE * dt);
  for (const cloud of clouds) {
    const { offset, group } = cloud;
    offset.multiplyScalar(decay);
    if (offset.lengthSq() < SETTLED_OFFSET_SQ) offset.set(0, 0, 0);
    placeGroup(cloud);
    const scale = group.scale.x;
    if (scale === 0 || !group.visible) continue;
    const dx = group.position.x - cameraPosition.x;
    const dy = group.position.y - cameraPosition.y;
    const dz = group.position.z - cameraPosition.z;
    const distance = Math.hypot(dx, dy, dz);
    const reach = cloud.radius * scale + CLOUD_CAMERA_BUFFER;
    if (distance >= reach) continue;
    // Keep pushing the way it already moved; otherwise away from the camera; +x when dead centre.
    const length = offset.length();
    let ux = 1;
    let uy = 0;
    let uz = 0;
    if (length > 0) {
      ux = offset.x / length;
      uy = offset.y / length;
      uz = offset.z / length;
    } else if (distance > 0) {
      ux = dx / distance;
      uy = dy / distance;
      uz = dz / distance;
    }
    const { distance: shove, hit } = measurePush(cloud, scale, dx, dy, dz, ux, uy, uz);
    if (!hit) continue;
    offset.x += ux * shove;
    offset.y += uy * shove;
    offset.z += uz * shove;
    placeGroup(cloud);
  }
}
