// Sweeps a closed 2D cross-section along a list of {p, r, u} frames: a = lateral along r,
// b = up along u. Each profile edge gets its own vertex strip so corners stay hard.
import * as THREE from 'three';

// Appends p + r·a + u·b, each component summed in that order.
function pushFramePoint(out, frame, a, b) {
  const { p, r, u } = frame;
  out.push(p.x + r.x * a + u.x * b, p.y + r.y * a + u.y * b, p.z + r.z * a + u.z * b);
}

function addSideWalls(frames, profile, positions, indices) {
  const frameCount = frames.length;
  let stripStart = 0;
  profile.forEach((from, edge) => {
    const to = profile[(edge + 1) % profile.length];
    for (const frame of frames) {
      pushFramePoint(positions, frame, from[0], from[1]);
      pushFramePoint(positions, frame, to[0], to[1]);
    }
    for (let step = 0; step + 1 < frameCount; step++) {
      const v = stripStart + step * 2;
      indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
    }
    stripStart += frameCount * 2;
  });
  return stripStart;
}

// Triangle fans over the first and last frame, same winding as the walls.
function addEndCaps(frames, profile, positions, indices, firstVertex) {
  let fanStart = firstVertex;
  for (const frame of [frames[0], frames[frames.length - 1]]) {
    for (const [a, b] of profile) pushFramePoint(positions, frame, a, b);
    for (let corner = 1; corner < profile.length - 1; corner++) {
      indices.push(fanStart, fanStart + corner, fanStart + corner + 1);
    }
    fanStart += profile.length;
  }
}

/** Indexed geometry (position + computed normals, no uv); caps need a double-sided material. */
export function extrude(frames, profile, caps = false) {
  const positions = [];
  const indices = [];
  const wallVertices = addSideWalls(frames, profile, positions, indices);
  if (caps) addEndCaps(frames, profile, positions, indices, wallVertices);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
