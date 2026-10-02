// Small geometry utilities shared by world, village and bird builders. Every helper allocates
// exactly the three.js objects it documents, since each one draws Math.random for its UUID.
import * as THREE from 'three';

/** Adds a mesh over a freshly allocated BoxGeometry to `parent` at (x, y, z) and returns it. */
export function box(w, h, d, material, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// One RGB triple repeated for every vertex of the geometry.
function constantColorAttribute(vertexCount, color) {
  const { r, g, b } = new THREE.Color(color);
  const rgb = new Float32Array(vertexCount * 3);
  for (let offset = 0; offset < rgb.length; offset += 3) {
    rgb[offset] = r;
    rgb[offset + 1] = g;
    rgb[offset + 2] = b;
  }
  return new THREE.BufferAttribute(rgb, 3);
}

/** Bakes a flat colour; indexed input is expanded (source kept alive), otherwise mutated in place. */
export function colorize(geometry, color, flat = true) {
  const target = geometry.index === null ? geometry : geometry.toNonIndexed();
  if (target.hasAttribute('uv')) target.deleteAttribute('uv');
  // Non-indexed, so recomputed normals come out faceted.
  if (flat) target.computeVertexNormals();
  target.setAttribute('color', constantColorAttribute(target.attributes.position.count, color));
  return target;
}

/** Bird variant: expands and disposes an indexed source, keeps uv and normals as they are. */
export function tintGeometry(geometry, color) {
  let target = geometry;
  if (target.index !== null) {
    target = geometry.toNonIndexed();
    geometry.dispose();
  }
  target.setAttribute('color', constantColorAttribute(target.attributes.position.count, color));
  return target;
}

/** Deterministic radial wobble from a sin-hash of each vertex; apply before any translation. */
export function jitter(geometry, amount, seed) {
  const position = geometry.attributes.position;
  for (let vertex = 0; vertex < position.count; vertex++) {
    const x = position.getX(vertex);
    const y = position.getY(vertex);
    const z = position.getZ(vertex);
    const hashed = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + seed) * 43758.5453;
    const scale = 1 + (hashed - Math.floor(hashed) - 0.5) * amount;
    position.setXYZ(vertex, x * scale, y * scale, z * scale);
  }
  return geometry;
}
