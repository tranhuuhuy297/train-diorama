// Pure render-resolution math, plus the renderer/RT/post-uniform/aspect resize wiring.
import * as THREE from 'three';

export function computeRenderResolution(width, height, dpr, shortSide) {
  const nativeWidth = width * dpr;
  const nativeHeight = height * dpr;
  const pixelated = shortSide !== null;
  const scale = pixelated ? Math.min(1, shortSide / Math.min(nativeWidth, nativeHeight)) : 1;
  return {
    renderWidth: Math.max(1, Math.floor(nativeWidth * scale)),
    renderHeight: Math.max(1, Math.floor(nativeHeight * scale)),
    pixelated,
    thickness: pixelated ? 1 : Math.max(1, 0.9 * dpr),
  };
}

export function resizeDiorama(d) {
  const width = Math.max(1, d.container.clientWidth);
  const height = Math.max(1, d.container.clientHeight);
  d.renderer.setSize(width, height, true);

  const dpr = d.renderer.getPixelRatio();
  const resolution = computeRenderResolution(width, height, dpr, d.pixelShortSide);
  d.mainRT.setSize(resolution.renderWidth, resolution.renderHeight);

  // Only the colour texture's filter changes (depth stays Nearest); the swap takes effect
  // through WebGL only on the next size change (quirk kept).
  const filter = resolution.pixelated ? THREE.NearestFilter : THREE.LinearFilter;
  d.mainRT.texture.minFilter = filter;
  d.mainRT.texture.magFilter = filter;
  d.mainRT.texture.needsUpdate = true;

  d.postMat.uniforms.uRes.value.set(resolution.renderWidth, resolution.renderHeight);
  d.postMat.uniforms.uThick.value = resolution.thickness;
  d.postMat.uniforms.uPixel.value = resolution.pixelated ? 1 : 0;

  d.camera.aspect = width / height;
  d.camera.updateProjectionMatrix();
}
