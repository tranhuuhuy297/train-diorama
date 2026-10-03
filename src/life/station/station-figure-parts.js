// Part placement shared by the two station figures: wraps a geometry in a mesh, sets its position (and
// scale, when given) from arrays and attaches it to the parent straight away.
import * as THREE from 'three';

export function attachMesh(geometry, material, parent, position, scale = null) {
  const part = new THREE.Mesh(geometry, material);
  part.position.fromArray(position);
  if (scale !== null) part.scale.fromArray(scale);
  parent.add(part);
  return part;
}
