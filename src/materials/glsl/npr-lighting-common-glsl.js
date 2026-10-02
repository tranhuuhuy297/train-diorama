// Shared GLSL chunk pulled into every NPR-family fragment shader (cel materials, sky,
// water, waterfall): shadow sampling, the headlight cone and the cel shading ramp.
import { HASH_AND_VALUE_NOISE_GLSL } from './hash-and-value-noise-glsl.js';

export const COMMON_GLSL = /* glsl */ `
uniform vec3 uLightDir;
uniform vec3 uLightColor;
uniform vec3 uShadowTint;
uniform vec3 uAmbient;
uniform sampler2D uShadowMap;
uniform mat4 uShadowMatrix;
uniform float uShadowTexel;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform float uTime;
uniform float uNight;
uniform vec3 uHeadlightPosition;
uniform vec3 uHeadlightDirection;
${HASH_AND_VALUE_NOISE_GLSL}
// 3x3 PCF lookup against the ortho shadow map; outside the frustum counts as lit.
float shadowAt(vec3 worldPosition, vec3 normal) {
  vec4 shadowClip = uShadowMatrix * vec4(worldPosition + normal * 0.12, 1.0);
  vec3 shadowCoord = shadowClip.xyz / shadowClip.w;
  if (shadowCoord.x < 0.0 || shadowCoord.x > 1.0 || shadowCoord.y < 0.0 || shadowCoord.y > 1.0 || shadowCoord.z > 1.0) {
    return 1.0;
  }
  float lit = 0.0;
  for (int dx = -1; dx <= 1; dx++) {
    for (int dy = -1; dy <= 1; dy++) {
      float depth = texture2D(uShadowMap, shadowCoord.xy + vec2(float(dx), float(dy)) * uShadowTexel).r;
      lit += (shadowCoord.z - 0.0006 > depth) ? 0.0 : 1.0;
    }
  }
  return lit / 9.0;
}

// Cone falloff from the locomotive headlight, faded by angle, distance and facing.
const vec3 HEADLIGHT_TINT = vec3(1.0, 0.78, 0.42);
vec3 headlightAt(vec3 worldPosition, vec3 normal) {
  if (uNight <= 0.0) return vec3(0.0);
  vec3 toLamp = worldPosition - uHeadlightPosition;
  float lampReach = length(toLamp);
  vec3 beamAxis = toLamp / max(lampReach, 0.001);
  float coneTerm = smoothstep(0.86, 0.97, dot(beamAxis, uHeadlightDirection));
  float reachTerm = (1.0 - smoothstep(8.0, 25.0, lampReach)) / (1.0 + lampReach * lampReach * 0.025);
  float faceTerm = max(dot(normal, -beamAxis), 0.0);
  return HEADLIGHT_TINT * (coneTerm * reachTerm * faceTerm * uNight * 2.8);
}

// Cel shading ramp: a banded day pass, a desaturated moonlit pass, blended by uNight.
vec3 nprShade(vec3 base, vec3 normal, vec3 worldPosition, float stipple, float stippleScale) {
  float facingLight = dot(normal, uLightDir);
  float shadow = shadowAt(worldPosition, normal);
  vec3 color = vec3(0.0);
  if (uNight < 1.0) {
    float litAmount = clamp(facingLight * 1.15, 0.0, 1.0) * shadow;
    float grain = vnoise(worldPosition * stippleScale) * 0.62 + vnoise(worldPosition * stippleScale * 2.7 + 11.0) * 0.38;
    float shade = litAmount + (grain - 0.5) * stipple;
    float upperBand = step(0.46, shade);
    float lowerBand = step(0.16, shade);
    vec3 shadowTone = base * uShadowTint;
    vec3 midTone = base * mix(uShadowTint, vec3(1.0), 0.66);
    vec3 litTone = base * uLightColor;
    vec3 banded = mix(shadowTone, mix(midTone, litTone, upperBand), lowerBand);
    float sparkleMask = step(0.88, shade) * step(0.25, stipple);
    color = mix(banded, litTone * 1.16, sparkleMask);
    color += uAmbient * base * (0.5 + 0.5 * normal.y) * 0.16;
  }
  if (uNight > 0.0) {
    float luma = dot(base, vec3(0.2126, 0.7152, 0.0722));
    vec3 duskBase = mix(base, vec3(luma), 0.78);
    float moon = smoothstep(-0.35, 0.85, facingLight) * mix(0.62, 1.0, shadow);
    vec3 duskTone = duskBase * mix(uShadowTint, uLightColor, moon);
    duskTone += uAmbient * (0.055 + 0.04 * normal.y);
    color = mix(color, duskTone, uNight);
  }
  return color + base * headlightAt(worldPosition, normal);
}

vec3 applyFog(vec3 color, vec3 worldPosition) {
  float viewDistance = length(worldPosition - cameraPosition);
  float fog = smoothstep(uFogNear, uFogFar, viewDistance) * 0.85;
  return mix(color, uFogColor, fog);
}
`;
