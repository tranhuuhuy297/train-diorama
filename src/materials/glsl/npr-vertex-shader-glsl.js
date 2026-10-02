// Vertex stage for the cel-shaded NPR material: optional tree sway, then mat3() normals (deliberately not inverse-transpose, for non-uniform scale).
export const NPR_VERTEX_SHADER = /* glsl */ `
#ifdef TREE_SWAY
uniform float uTime;
#endif
#ifdef STRATA
attribute float topY;
#endif
#ifdef LOCAL_GLOW
varying vec3 vLocalSpace;
#endif
varying vec3 vWorldPosition;
varying vec3 vSurfaceNormal;
varying vec3 vVertexColor;
#ifdef STRATA
varying float vStrataTop;
#endif

void main() {
  vec4 localPosition = vec4(position, 1.0);
  vec3 localNormal = normal;

  #ifdef USE_INSTANCING
    #ifdef TREE_SWAY
      vec2 trunkXZ = instanceMatrix[3].xz;
      float swayPhase = dot(trunkXZ, vec2(0.83, 1.37));
      float swayHeight = smoothstep(0.45, 3.0, position.y);
      localPosition.x += swayHeight * (sin(uTime * 0.63 + swayPhase) * 0.045 + sin(uTime * 1.07 + swayPhase * 1.71) * 0.012);
      localPosition.z += swayHeight * (cos(uTime * 0.51 + swayPhase * 1.29) * 0.035 + sin(uTime * 0.89 + swayPhase * 0.73) * 0.01);
    #endif
    localPosition = instanceMatrix * localPosition;
    localNormal = mat3(instanceMatrix) * localNormal;
  #endif

  vec4 worldPosition = modelMatrix * localPosition;
  #ifdef LOCAL_GLOW
    vLocalSpace = localPosition.xyz;
  #endif
  vWorldPosition = worldPosition.xyz;
  vSurfaceNormal = normalize(mat3(modelMatrix) * localNormal);

  vVertexColor = vec3(1.0);
  #ifdef USE_COLOR
    vVertexColor *= color;
  #endif
  #ifdef USE_INSTANCING_COLOR
    vVertexColor *= instanceColor;
  #endif

  #ifdef STRATA
    vStrataTop = topY;
  #endif

  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;
