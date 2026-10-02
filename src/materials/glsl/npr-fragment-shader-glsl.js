// Fragment stage for the cel-shaded NPR material: optional cliff-strata banding and
// meadow flowers paint over the base colour before the shared nprShade() ramp runs.
import { COMMON_GLSL } from './npr-lighting-common-glsl.js';

export const NPR_FRAGMENT_SHADER = /* glsl */ `
#ifdef LOCAL_GLOW
varying vec3 vLocalSpace;
uniform vec3 uLocalGlowPosition;
uniform float uLocalGlowRadius;
uniform float uLocalGlowStrength;
#endif
uniform vec3 uColor;
uniform float uStipple;
uniform float uStippleScale;
uniform float uEmissive;
uniform float uOpacity;
varying vec3 vWorldPosition;
varying vec3 vSurfaceNormal;
varying vec3 vVertexColor;
#ifdef STRATA
varying float vStrataTop;
#endif
${COMMON_GLSL}
void main() {
  vec3 N = normalize(vSurfaceNormal);
  #ifdef DOUBLE_SIDED
    N = gl_FrontFacing ? N : -N;
  #endif

  vec3 base = uColor * vVertexColor;

  #ifdef STRATA
    float wobble = vnoise(vWorldPosition * 0.45) * 1.3;
    float band = floor((vWorldPosition.y + wobble) * 0.8);
    float bandTint = hash11(band * 3.17 + 5.0);
    base *= mix(vec3(0.78, 0.74, 0.78), vec3(1.14, 1.06, 0.98), bandTint);
    if (vnoise(vWorldPosition * 3.1) > 0.8) {
      base *= 1.22;
    }
    float lipHeight = vStrataTop - 0.45 - vnoise(vWorldPosition * 1.7) * 0.7;
    if (vWorldPosition.y > lipHeight) {
      base = vStrataTop < 0.2 ? vec3(0.86, 0.8, 0.6) : vec3(0.38, 0.66, 0.26);
    }
  #endif

  #ifdef FLOWERS
    float bloomNoise = vnoise(vWorldPosition * 0.08);
    bool lush = bloomNoise > 0.52 && N.y > 0.82 && base.g > base.r * 1.2 && base.g > base.b * 1.5;
    if (lush) {
      vec2 tile = floor(vWorldPosition.xz * 1.5);
      float tileChance = hash12(tile);
      if (tileChance > 0.72) {
        vec2 bloomCenter = vec2(hash12(tile + 7.1), hash12(tile + 3.3)) * 0.6 + 0.2;
        vec2 tileFrac = fract(vWorldPosition.xz * 1.5);
        if (length(tileFrac - bloomCenter) < 0.16) {
          float petalPick = hash12(tile + 1.7);
          base = petalPick < 0.33 ? vec3(1.0, 0.55, 0.72) : (petalPick < 0.66 ? vec3(1.0, 0.88, 0.3) : vec3(1.0, 0.98, 0.94));
        }
      }
    }
  #endif

  vec3 shaded = nprShade(base, N, vWorldPosition, uStipple, uStippleScale);
  shaded = mix(shaded, base * 1.1, uEmissive * (1.0 - uNight));

  #ifdef NIGHT_GLOW
    shaded = mix(shaded, base * vec3(1.3, 1.02, 0.75), uNight);
  #endif

  #ifdef LOCAL_GLOW
    float glowReach = 1.0 - smoothstep(0.0, uLocalGlowRadius, length(vLocalSpace - uLocalGlowPosition));
    float pulse = 0.9 + 0.06 * sin(uTime * 9.0) + 0.04 * sin(uTime * 17.0);
    shaded += base * vec3(1.0, 0.62, 0.22) * glowReach * uLocalGlowStrength * pulse * uNight;
  #endif

  shaded = applyFog(shaded, vWorldPosition);
  gl_FragColor = vec4(shaded, uOpacity);
}
`;
