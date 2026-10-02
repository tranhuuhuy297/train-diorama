// Per-frame render order: info reset -> glow visibility -> headlight uniforms -> sky follow -> matrices
// -> shadow -> main -> post.
import { applyNightGlowVisibility } from './night-light-glow-registry.js';
import { writeHeadlightUniforms } from '../train/train-frame-update.js';

export function renderDioramaFrame(d) {
  d.renderer.info.reset();
  applyNightGlowVisibility(d.nightGlows, d.lightingUniforms.uNight.value);
  writeHeadlightUniforms(d.train, d.lightingUniforms);

  d.sky.position.copy(d.camera.position);
  d.scene.updateMatrixWorld();

  d.shadowPass.render(d.renderer, d.scene, d.shadowHiddenObjects, d.shadowVisibility);

  d.renderer.setRenderTarget(d.mainRT);
  d.renderer.clear();
  d.renderer.render(d.scene, d.camera);

  d.renderer.setRenderTarget(null);
  d.renderer.render(d.postScene, d.postCam);
}
