// Sine-free hash family (in the spirit of Dave Hoskins' "Hash without Sine", MIT) plus trilinear value noise; the GPU-side companion to the CPU gradient noise.
export const HASH_AND_VALUE_NOISE_GLSL = /* glsl */ `
float hash13(vec3 seed) {
  vec3 q = fract(seed * 0.1031);
  q += dot(q, q.zyx + 31.32);
  return fract((q.x + q.y) * q.z);
}

float hash12(vec2 seed) {
  vec3 q = fract(vec3(seed.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

float hash11(float seed) {
  float q = fract(seed * 0.1031);
  q *= q + 33.33;
  q *= q + q;
  return fract(q);
}

float vnoise(vec3 p) {
  vec3 cell = floor(p);
  vec3 frac = fract(p);
  frac = frac * frac * (3.0 - 2.0 * frac);
  float edgeY0 = mix(hash13(cell), hash13(cell + vec3(1.0, 0.0, 0.0)), frac.x);
  float edgeY1 = mix(hash13(cell + vec3(0.0, 1.0, 0.0)), hash13(cell + vec3(1.0, 1.0, 0.0)), frac.x);
  float edgeZ0 = mix(hash13(cell + vec3(0.0, 0.0, 1.0)), hash13(cell + vec3(1.0, 0.0, 1.0)), frac.x);
  float edgeZ1 = mix(hash13(cell + vec3(0.0, 1.0, 1.0)), hash13(cell + vec3(1.0, 1.0, 1.0)), frac.x);
  return mix(mix(edgeY0, edgeY1, frac.y), mix(edgeZ0, edgeZ1, frac.y), frac.z);
}
`;
