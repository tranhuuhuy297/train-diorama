// Bakes opaque, uv-bearing meshes under a root into one merged Mesh per material (a whole static rig becomes one draw call); root transform is never baked, excluded subtrees are skipped.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function isEligible(object) {
  return object.isMesh && object.geometry.hasAttribute('uv') && !object.material.transparent;
}

function flipTriangleWinding(indexArray) {
  for (let base = 0; base < indexArray.length; base += 3) {
    const a = indexArray[base];
    indexArray[base] = indexArray[base + 2];
    indexArray[base + 2] = a;
  }
}

// Clones+transforms via applyMatrix4, then overwrites normals with the plain-mat3 transform
// (applyMatrix4's built-in normal handling uses inverse-transpose, unlike this scene's shaders).
function bakeMeshGeometry(mesh, worldMatrix) {
  const source = mesh.geometry;
  const baked = source.clone().applyMatrix4(worldMatrix);
  const normalBasis = new THREE.Matrix3().setFromMatrix4(worldMatrix);
  baked.setAttribute('normal', source.attributes.normal.clone().applyNormalMatrix(normalBasis));
  if (baked.index === null) baked.setIndex([...Array(baked.attributes.position.count).keys()]);
  if (worldMatrix.determinant() < 0) flipTriangleWinding(baked.index.array);
  return baked;
}

// Pre-order depth-first walk: updateMatrix() + eligibility + bake happen per node before
// recursing (Map insertion order = first-seen material), so a bake error (missing normal)
// stops the walk before later nodes are updateMatrix()'d, not after the whole tree is read.
function walkAndBake(root, excluded) {
  const byMaterial = new Map();
  const stack = root.children.map(child => [child, new THREE.Matrix4()]).reverse();
  while (stack.length > 0) {
    const [object, parentMatrix] = stack.pop();
    if (excluded.has(object)) continue;
    object.updateMatrix();
    const worldMatrix = parentMatrix.clone().multiply(object.matrix);
    if (isEligible(object)) {
      const batch = byMaterial.get(object.material) ?? byMaterial.set(object.material, []).get(object.material);
      batch.push({ source: object, baked: bakeMeshGeometry(object, worldMatrix) });
    }
    for (let i = object.children.length - 1; i >= 0; i--) stack.push([object.children[i], worldMatrix]);
  }
  return byMaterial;
}

export function mergeStaticGeometry(root, excluded = new Set()) {
  const batches = walkAndBake(root, excluded);

  for (const [material, batch] of batches) {
    const merged = mergeGeometries(batch.map(entry => entry.baked));
    if (!merged) throw new Error('Static geometry attributes must match');
    merged.computeBoundingSphere();
    root.add(new THREE.Mesh(merged, material));
    for (const { source, baked } of batch) {
      source.removeFromParent();
      baked.dispose();
    }
  }
}
