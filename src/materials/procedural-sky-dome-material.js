// Procedural sky dome: gradient + sun/moon glow+disc + stars + 3 ridge hill bands + mist.
// No fog, no shadow sampling; uNight is the only time-of-day input the shader reads.
import * as THREE from 'three';
import { G, SHADER_NIGHT_UNIFORMS } from './shared-lighting-uniforms.js';
import { COMMON_GLSL } from './glsl/npr-lighting-common-glsl.js';

const SKY_VERTEX_SHADER = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const SKY_FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uHill;
uniform vec3 uMist;
uniform vec3 uSunColor;
varying vec3 vDir;
${COMMON_GLSL}
// Four stacked sine harmonics shaping one hill band's silhouette around the horizon azimuth.
float ridgeProfile(float a, float k) {
  return 0.5 * sin(3.0 * a + k) + 0.28 * sin(7.0 * a + 2.3 * k) + 0.14 * sin(13.0 * a + 4.1 * k) + 0.06 * sin(29.0 * a + k);
}

void main() {
  vec3 viewDir = normalize(vDir);
  float height = viewDir.y;
  float azimuth = atan(viewDir.z, viewDir.x);

  vec3 sky = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, height));

  float sunAlignment = max(dot(viewDir, uLightDir), 0.0);
  sky += uSunColor * pow(sunAlignment, 18.0) * mix(0.35, 0.06, uNight);
  sky = mix(sky, uSunColor, smoothstep(0.9975, 0.998, sunAlignment));

  if (uNight > 0.0 && height > 0.05) {
    // Each unit cube of the scaled view direction hashes to one star; keep only the near
    // miss of the cube centre so stars read as small round points, not filled cubes.
    vec3 starGrid = viewDir * 260.0;
    vec3 starCentreOffset = fract(starGrid) - 0.5;
    float starMask = hash13(floor(starGrid)) >= 0.993 ? 1.0 : 0.0;
    float starPoint = starMask * (1.0 - smoothstep(0.08, 0.3, length(starCentreOffset)));
    sky += vec3(0.68, 0.78, 1.0) * starPoint * uNight * smoothstep(0.05, 0.3, height);
  }

  float ridgeJitter = 0.012 * (vnoise(viewDir * 160.0) - 0.5);
  // Paint the 3 hill bands back-to-front so a nearer (later) band overwrites a farther one.
  for (int band = 0; band < 3; band++) {
    float depth = float(band);
    float bandSilhouette = 0.07 - 0.035 * depth + ridgeProfile(azimuth, 1.7 * depth + 0.5) * (0.045 - 0.008 * depth);
    if (height < bandSilhouette + ridgeJitter) {
      float bandShade = mix(0.94 + 0.12 * vnoise(viewDir * vec3(220.0, 90.0, 220.0)), 1.0, uNight);
      sky = mix(uHorizon, uHill, 0.35 + 0.25 * depth) * bandShade;
    }
  }

  // Ascending-edge smoothstep: 1 - S(-0.25, -0.02, height) equals the reversed-edge form
  // mathematically, without relying on GLSL's undefined behaviour for edge0 > edge1.
  sky = mix(sky, uMist, 1.0 - smoothstep(-0.25, -0.02, height));

  gl_FragColor = vec4(sky, 1.0);
}
`;

// BackSide: the sphere is seen from inside. depthWrite off: sky pixels always read back as
// far-plane depth in the post pass's depth Laplacian (there is nothing behind them to edge).
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: SKY_VERTEX_SHADER,
    fragmentShader: SKY_FRAGMENT_SHADER,
    uniforms: { ...G, ...SHADER_NIGHT_UNIFORMS },
  });
}
