// Post pass: depth-Laplacian ink outline, saturation, then grain or 4x4 Bayer posterize,
// then vignette.
import * as THREE from 'three';
import { LIGHTING_UNIFORMS } from '../materials/shared-lighting-uniforms.js';
import { HASH_AND_VALUE_NOISE_GLSL } from '../materials/glsl/hash-and-value-noise-glsl.js';

export const POST_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const POST_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tDepth;
uniform vec2 uRes;
uniform float uNear;
uniform float uFar;
uniform float uOutline;
uniform float uThick;
uniform float uPixel;
uniform float uNight;
uniform float uSaturation;
varying vec2 vUv;
${HASH_AND_VALUE_NOISE_GLSL}
// Reconstructs linear eye-space depth from window-space depth, then inverts it so a nearer
// surface reads as a larger weight for the Laplacian edge test below.
float inverseLinearDepth(vec2 uv) {
  float z = 2.0 * texture2D(tDepth, uv).r - 1.0;
  float linearDepth = 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
  return 1.0 / linearDepth;
}

// Standard 4x4 ordered-dither matrix built from one 2x2 cell nested inside itself.
float bayer2(vec2 cell) {
  return 0.5 * cell.x + 0.75 * cell.y - cell.x * cell.y;
}
float bayer4(vec2 cell) {
  vec2 inner = mod(cell, 2.0);
  vec2 outer = mod(floor(cell * 0.5), 2.0);
  return bayer2(inner) + 0.25 * bayer2(outer);
}

void main() {
  vec2 delta = uThick / uRes;
  vec3 col = texture2D(tColor, vUv).rgb;

  float w0 = inverseLinearDepth(vUv);
  float wLeft = inverseLinearDepth(vUv - vec2(delta.x, 0.0));
  float wRight = inverseLinearDepth(vUv + vec2(delta.x, 0.0));
  float wUp = inverseLinearDepth(vUv + vec2(0.0, delta.y));
  float wDown = inverseLinearDepth(vUv - vec2(0.0, delta.y));
  float lap = (4.0 * w0 - wLeft - wRight - wUp - wDown) / w0;

  float inkWeight = uOutline * smoothstep(0.006, 0.02, lap);
  vec3 inkTint = col * vec3(0.22, 0.20, 0.28);
  col = mix(col, inkTint, inkWeight * mix(0.9, 0.28, uNight));

  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = clamp(mix(vec3(luma), col, uSaturation), 0.0, 1.0);

  if (uPixel > 0.5) {
    vec2 q = vUv * uRes;
    float bias = bayer4(floor(q)) - 0.5;
    col = floor(14.0 * col + 0.5 + bias) / 14.0;
  } else {
    float grain = hash12(floor(gl_FragCoord.xy));
    col *= mix(0.975 + 0.05 * grain, 1.0, uNight);
  }

  float vignetteDistance = 1.35 * length(vUv - vec2(0.5));
  col *= mix(1.0, mix(0.84, 0.94, uNight), smoothstep(0.45, 1.05, vignetteDistance));

  gl_FragColor = vec4(col, 1.0);
}
`;

export function createPostPass(mainRenderTarget, near, far) {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const material = new THREE.ShaderMaterial({
    vertexShader: POST_VERTEX_SHADER,
    fragmentShader: POST_FRAGMENT_SHADER,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      tColor: { value: mainRenderTarget.texture },
      tDepth: { value: mainRenderTarget.depthTexture },
      uRes: { value: new THREE.Vector2(4, 4) },
      uNear: { value: near },
      uFar: { value: far },
      uOutline: { value: 1 },
      uThick: { value: 1 },
      uPixel: { value: 0 },
      uNight: LIGHTING_UNIFORMS.uNight,
      uSaturation: LIGHTING_UNIFORMS.uSaturation,
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  quad.frustumCulled = false;
  scene.add(quad);
  return { scene, camera, material };
}
