// The river's fall off the front edge of the board: scrolling blue/white streaks with foamy
// sides and a splash at the foot, no lighting or shadows, visible from both faces.
import * as THREE from 'three';
import { G, NIGHT_UNIFORMS } from './shared-lighting-uniforms.js';
import { COMMON_GLSL } from './glsl/npr-lighting-common-glsl.js';

export const WATERFALL_VERTEX_SHADER = /* glsl */ `
varying vec2 vCurtainUv;
varying vec3 vCurtainPoint;
void main() {
  vCurtainUv = uv;
  vec4 placed = modelMatrix * vec4(position, 1.0);
  vCurtainPoint = placed.xyz;
  gl_Position = projectionMatrix * viewMatrix * placed;
}
`;

export const WATERFALL_FRAGMENT_SHADER = /* glsl */ `
varying vec2 vCurtainUv;
varying vec3 vCurtainPoint;
${COMMON_GLSL}
const vec3 FALL_DARK = vec3(0.3, 0.62, 0.88);
const vec3 FALL_LIGHT = vec3(0.62, 0.86, 0.96);
const vec3 SPRAY = vec3(1.0);
const vec3 MOON_FALL_A = vec3(0.19, 0.29, 0.41);
const vec3 MOON_FALL_B = vec3(0.26, 0.37, 0.5);

void main() {
  float across = vCurtainUv.x;
  float down = vCurtainUv.y;
  // v is 1 at the lip, so adding time to it scrolls the pattern downward.
  float streak = vnoise(vec3(across * 14.0, down * 2.5 + uTime * 2.2, 0.0));
  float detail = vnoise(vec3(across * 30.0, down * 6.0 + uTime * 3.5, 3.0));
  vec3 color = mix(FALL_DARK, FALL_LIGHT, step(0.5, streak));
  color = mix(color, SPRAY, step(0.72, streak * 0.6 + detail * 0.4));
  float fromSide = min(across, 1.0 - across);
  color = mix(SPRAY, color, step(0.07 + detail * 0.05, fromSide));
  // Foot splash: falls from 1 at the bottom row to 0 a tenth of the way up, with a ragged edge.
  float splash = 1.0 - smoothstep(0.0, 0.1, down + (detail - 0.5) * 0.08);
  color = mix(color, SPRAY, splash);
  color = mix(color, mix(MOON_FALL_A, MOON_FALL_B, streak), uNight);
  gl_FragColor = vec4(applyFog(color, vCurtainPoint), 1.0);
}
`;

/** A fresh double-sided waterfall material on the shared lighting bag (no headlight term). */
export function waterfallMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: WATERFALL_VERTEX_SHADER,
    fragmentShader: WATERFALL_FRAGMENT_SHADER,
    uniforms: { ...G, uNight: NIGHT_UNIFORMS.uNight },
  });
}
