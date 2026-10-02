// 2048^2 custom depth render: an orthographic light camera plus a colour-free override
// material, writing the shared shadow-map/texel/matrix uniforms every render.
import * as THREE from 'three';
import { G } from '../materials/shared-lighting-uniforms.js';

export const SHADOW_MAP_SIZE = 2048;

// Row-major clip-space [-1,1] -> texture-space [0,1] remap, applied as uShadowMatrix = B*P*V.
const BIAS_MATRIX = new THREE.Matrix4().set(
  0.5, 0, 0, 0.5,
  0, 0.5, 0, 0.5,
  0, 0, 0.5, 0.5,
  0, 0, 0, 1,
);

export function createShadowDepthPass() {
  const depthTexture = new THREE.DepthTexture(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
  const renderTarget = new THREE.WebGLRenderTarget(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE, { depthTexture });
  const camera = new THREE.OrthographicCamera(-82, 82, 82, -82, 1, 360);
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, colorWrite: false });

  G.uShadowMap.value = depthTexture;
  G.uShadowTexel.value = 1 / SHADOW_MAP_SIZE;

  // Tree sway never reaches this override material (static shadows, quirk kept): no
  // vertex-animated depth material is ever swapped in here.
  function render(renderer, scene, hiddenObjects, visibility) {
    camera.position.copy(G.uLightDir.value).multiplyScalar(170);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    G.uShadowMatrix.value.copy(BIAS_MATRIX).multiply(camera.projectionMatrix).multiply(camera.matrixWorldInverse);

    for (let i = 0; i < hiddenObjects.length; i++) {
      visibility[i] = hiddenObjects[i].visible;
      hiddenObjects[i].visible = false;
    }

    scene.overrideMaterial = material;
    renderer.setRenderTarget(renderTarget);
    renderer.clear();
    renderer.render(scene, camera);
    scene.overrideMaterial = null;

    for (let i = 0; i < hiddenObjects.length; i++) hiddenObjects[i].visible = visibility[i];
  }

  return { renderTarget, camera, material, render };
}
