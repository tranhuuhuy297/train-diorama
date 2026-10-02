// Instanced view-facing halo billboards for night windows/lamps; a non-zero normal makes
// the halo fade when viewed from behind (e.g. coach windows), an all-zero normal is omni.
import * as THREE from 'three';
import { NIGHT_UNIFORMS, NIGHT_LIGHT_GLOW_MATERIAL_NAME, ADDITIVE_GLOW_RENDER_STATE } from '../materials/shared-lighting-uniforms.js';

// field on each light object -> [instanced attribute name, vector size].
const INSTANCED_LIGHT_FIELDS = [['position', 'glowCenter', 3], ['size', 'glowSize', 2], ['normal', 'glowNormal', 3]];

function flattenField(lights, field, itemSize) {
  const out = new Float32Array(lights.length * itemSize);
  lights.forEach((light, index) => out.set(light[field], index * itemSize));
  return out;
}

const GLOW_VERTEX_SHADER = /* glsl */ `
  attribute vec3 glowCenter; attribute vec2 glowSize;
  attribute vec3 glowNormal; attribute float glowStrength;
  varying vec2 vGlowUv;
  varying float vGlowIntensity;
  void main() {
    vGlowUv = uv;
    vec4 viewCenter = modelViewMatrix * vec4(glowCenter, 1.0);
    float directional = dot(glowNormal, glowNormal) > 0.0
      ? smoothstep(0.0, 0.4, dot(normalize(mat3(modelViewMatrix) * glowNormal), normalize(-viewCenter.xyz)))
      : 1.0;
    vGlowIntensity = glowStrength * directional;
    vec2 axisScale = vec2(length(modelViewMatrix[0].xyz), length(modelViewMatrix[1].xyz));
    viewCenter.xy += position.xy * glowSize * axisScale;
    gl_Position = projectionMatrix * viewCenter;
  }
`;

const GLOW_FRAGMENT_SHADER = /* glsl */ `
  uniform float uNight;
  varying vec2 vGlowUv;
  varying float vGlowIntensity;
  const vec3 GLOW_TINT = vec3(1.0, 0.78, 0.45);
  void main() {
    float offset = length(vGlowUv - 0.5) * 2.0;
    float core = exp(-4.5 * offset * offset);
    float rimCut = 1.0 - smoothstep(0.65, 1.0, offset);
    gl_FragColor = vec4(GLOW_TINT, core * rimCut * vGlowIntensity * uNight);
  }
`;

// Vertices move in the shader, so three cannot auto-compute a culling sphere; derive one
// from each halo's world-space reach box instead.
function haloBoundingSphere(lights) {
  const box = new THREE.Box3();
  for (const lamp of lights) {
    const [cx, cy, cz] = lamp.position;
    const reach = Math.hypot(lamp.size[0], lamp.size[1]) * 0.5;
    box.expandByPoint(new THREE.Vector3(cx + reach, cy + reach, cz + reach));
    box.expandByPoint(new THREE.Vector3(cx - reach, cy - reach, cz - reach));
  }
  return box.getBoundingSphere(new THREE.Sphere());
}

export function createLightGlows(lights) {
  // Instanced geometry before the quad: geometry ids and UUID draws then follow the reference allocation order.
  const haloGeometry = new THREE.InstancedBufferGeometry();
  // Reuse the quad's shared index/position/uv attribute objects; the quad itself never
  // gets a draw call of its own, so this does not add to renderer.info.memory.geometries.
  const haloQuad = new THREE.PlaneGeometry(1, 1);
  haloGeometry.setIndex(haloQuad.index);
  for (const name of ['position', 'uv']) haloGeometry.setAttribute(name, haloQuad.attributes[name]);
  for (const [field, attributeName, itemSize] of INSTANCED_LIGHT_FIELDS) {
    haloGeometry.setAttribute(attributeName, new THREE.InstancedBufferAttribute(flattenField(lights, field, itemSize), itemSize));
  }
  haloGeometry.setAttribute('glowStrength', new THREE.InstancedBufferAttribute(new Float32Array(lights.map(l => l.strength)), 1));
  haloGeometry.instanceCount = lights.length;
  haloGeometry.boundingSphere = haloBoundingSphere(lights);

  const material = new THREE.ShaderMaterial({
    name: NIGHT_LIGHT_GLOW_MATERIAL_NAME,
    uniforms: { uNight: NIGHT_UNIFORMS.uNight },
    vertexShader: GLOW_VERTEX_SHADER,
    fragmentShader: GLOW_FRAGMENT_SHADER,
    ...ADDITIVE_GLOW_RENDER_STATE,
  });

  const glowMesh = new THREE.Mesh(haloGeometry, material);
  return glowMesh;
}
