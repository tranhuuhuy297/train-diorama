// Unlit stylised water for the pond and river: one flat quad over the whole board whose
// fragments survive only where the baked terrain height texture says the ground is wet.
import * as THREE from 'three';
import { G, NIGHT_UNIFORMS } from './shared-lighting-uniforms.js';
import { COMMON_GLSL } from './glsl/npr-lighting-common-glsl.js';

export const WATER_VERTEX_SHADER = /* glsl */ `
varying vec3 vSurfacePoint;
void main() {
  vec4 placed = modelMatrix * vec4(position, 1.0);
  vSurfacePoint = placed.xyz;
  gl_Position = projectionMatrix * viewMatrix * placed;
}
`;

export const WATER_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D uHeight;
uniform float uSize;
varying vec3 vSurfacePoint;
${COMMON_GLSL}
const vec3 FACING_UP = vec3(0.0, 1.0, 0.0);
const vec3 DAY_SHALLOW = vec3(0.48, 0.82, 0.86);
const vec3 DAY_DEEP = vec3(0.2, 0.5, 0.8);
const vec3 RIPPLE_TONE = vec3(0.82, 0.95, 1.0);
const vec3 FOAM_TONE = vec3(0.97, 0.99, 1.0);
const vec3 MOON_SHALLOW = vec3(0.15, 0.24, 0.35);
const vec3 MOON_DEEP = vec3(0.1, 0.18, 0.29);
const vec3 MOON_RIPPLE = vec3(0.035, 0.045, 0.055);
const vec3 LAMP_ON_WATER = vec3(0.48, 0.65, 0.75);

void main() {
  vec3 p = vSurfacePoint;
  float t = uTime;
  // Heights were packed as (h + 3) / 12 into an 8-bit red channel spanning the board.
  vec2 boardUv = (p.xz + uSize * 0.5) / uSize;
  float ground = texture2D(uHeight, boardUv).r * 12.0 - 3.0;
  if (ground > 0.08) discard;
  float depth = -ground;
  float deepness = smoothstep(0.15, 1.5, depth);
  vec3 color = mix(DAY_SHALLOW, DAY_DEEP, deepness);

  float waveA = vnoise(vec3(p.x * 0.45 + t * 0.15, t * 0.35, p.z * 0.9 - t * 0.5));
  float waveB = vnoise(vec3(p.x * 1.3, t * 0.6, p.z * 1.1 + t * 0.3));
  float crest = step(0.76, waveA * 0.7 + waveB * 0.3);
  color = mix(color, RIPPLE_TONE, crest * 0.75);

  // Shore foam: a noisy band along the shallowest water.
  float shore = depth + (vnoise(vec3(p.xz * 1.6, t * 0.8)) - 0.5) * 0.35;
  color = mix(color, FOAM_TONE, step(shore, 0.18));

  float lit = shadowAt(p, FACING_UP);
  color *= mix(uShadowTint * 1.1, vec3(1.0), lit);

  vec3 moonlit = mix(MOON_SHALLOW, MOON_DEEP, deepness);
  moonlit *= mix(0.82, 1.0, lit);
  moonlit += MOON_RIPPLE * crest;
  color = mix(color, moonlit, uNight);

  color += headlightAt(p, FACING_UP) * LAMP_ON_WATER;
  gl_FragColor = vec4(applyFog(color, p), 1.0);
}
`;

/** A fresh water material bound to the shared lighting bag plus this world's height texture. */
export function waterMaterial(heightTex, size = 124) {
  return new THREE.ShaderMaterial({
    vertexShader: WATER_VERTEX_SHADER,
    fragmentShader: WATER_FRAGMENT_SHADER,
    uniforms: {
      ...G,
      uNight: NIGHT_UNIFORMS.uNight,
      uHeadlightPosition: NIGHT_UNIFORMS.uHeadlightPosition,
      uHeadlightDirection: NIGHT_UNIFORMS.uHeadlightDirection,
      uHeight: { value: heightTex },
      uSize: { value: size },
    },
  });
}
