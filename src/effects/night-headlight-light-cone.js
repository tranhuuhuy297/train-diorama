// Additive headlight cone: an open cylinder, narrow end at the origin, widening along +Z.
import * as THREE from 'three';
import { NIGHT_UNIFORMS, NIGHT_LIGHT_GLOW_MATERIAL_NAME, ADDITIVE_GLOW_RENDER_STATE } from '../materials/shared-lighting-uniforms.js';

const RADIAL_SEGMENTS = 48;
const NARROW_RADIUS = 0.12;

const CONE_VERTEX_SHADER = /* glsl */ `
  varying float vAxialDistance;
  varying vec3 vViewSpacePosition;
  varying vec3 vViewSpaceNormal;
  void main() {
    vec4 viewSpace = modelViewMatrix * vec4(position, 1.0);
    vAxialDistance = position.z;
    vViewSpacePosition = viewSpace.xyz;
    vViewSpaceNormal = normalMatrix * normal;
    gl_Position = projectionMatrix * viewSpace;
  }
`;

const CONE_FRAGMENT_SHADER = /* glsl */ `
  uniform float uNight; uniform float uLength; uniform float uStrength;
  varying float vAxialDistance;
  varying vec3 vViewSpacePosition;
  varying vec3 vViewSpaceNormal;
  const vec3 CONE_TINT = vec3(1.0, 0.8, 0.48);
  void main() {
    float travel = vAxialDistance / uLength;
    float rim = abs(dot(normalize(vViewSpaceNormal), normalize(-vViewSpacePosition)));
    float rimFade = smoothstep(0.0, 0.45, rim);
    float axialFade = smoothstep(0.0, 0.035, travel) * pow(1.0 - travel, 1.5);
    gl_FragColor = vec4(CONE_TINT, rimFade * axialFade * uStrength * uNight);
  }
`;

export function createLightCone({ length, radius, strength }) {
  const geometry = new THREE.CylinderGeometry(radius, NARROW_RADIUS, length, RADIAL_SEGMENTS, 1, true)
    .rotateX(Math.PI / 2)
    .translate(0, 0, length / 2);

  const material = new THREE.ShaderMaterial({
    name: NIGHT_LIGHT_GLOW_MATERIAL_NAME,
    uniforms: {
      uNight: NIGHT_UNIFORMS.uNight,
      uLength: { value: length },
      uStrength: { value: strength },
    },
    side: THREE.BackSide,
    vertexShader: CONE_VERTEX_SHADER,
    fragmentShader: CONE_FRAGMENT_SHADER,
    ...ADDITIVE_GLOW_RENDER_STATE,
  });

  const cone = new THREE.Mesh(geometry, material);
  return cone;
}
