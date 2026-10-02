// Collects every 'night-light-glow' mesh once, then toggles their batch visibility each frame.
import { NIGHT_LIGHT_GLOW_MATERIAL_NAME } from '../materials/shared-lighting-uniforms.js';

export function collectNightLightGlows(scene) {
  const glows = [];
  scene.traverse(object => {
    if (object.isMesh && object.material?.isShaderMaterial && object.material.name === NIGHT_LIGHT_GLOW_MATERIAL_NAME) {
      glows.push(object);
    }
  });
  return glows;
}

export function applyNightGlowVisibility(glows, night) {
  const visible = night > 0;
  for (let i = 0; i < glows.length; i++) glows[i].visible = visible;
}
