# 2. NPR cel material and the shared lighting uniform bag

[Index](../diorama-techniques.md)

## What it achieves

Every lit surface uses one hand-written ShaderMaterial family. It gives:

- three hard cel bands;
- shadows tinted cool blue instead of black;
- a painterly stipple, fixed in world space, that breaks band edges into blotches;
- sun shadows from a custom shadow map;
- distance fog and a moonlit night mode.

Optional features add emissive windows, night glow, a local fire glow, wind sway for trees, procedural meadow flowers and soil strata. No image textures are used.

## The shared uniform bag

`src/materials/shared-lighting-uniforms.js` exports frozen containers of uniform objects. Each material spreads them into its own `uniforms`, so every material holds the same `{ value }` objects by reference. One write such as `G.uTime.value = t` updates every material, with no traversal and no rebinding.

| Key | Initial value | Written by |
|---|---|---|
| uLightDir | (0.55, 0.7, 0.45) normalised | palettes |
| uLightColor | (1.04, 1.0, 0.92) | palettes |
| uShadowTint | (0.42, 0.5, 0.72); the day palette sets (0.5, 0.57, 0.78) at boot | palettes |
| uAmbient | (0.55, 0.7, 0.95) | palettes |
| uShadowMap, uShadowTexel | depth texture, 1/2048 | shadow pass, once at creation |
| uShadowMatrix | B·P·V | shadow pass, every frame |
| uFogColor, uFogNear, uFogFar | #cfe4f2, 110, 420 | palettes (colour only) |
| uTime | sim seconds | `stepSimulation` |
| uZenith, uHorizon, uHill, uMist, uSunColor | sky colours | palettes |
| uNight (in NIGHT_UNIFORMS) | 0 by day … 1 at night | palettes |
| uSaturation | 1 (night 2.5) | palettes; read only by the post pass |
| uHeadlightPosition / uHeadlightDirection | the locomotive lamp | render pipeline, every frame |

```js
// src/materials/shared-lighting-uniforms.js (excerpt)
export const G = Object.freeze({
  uLightDir: { value: new THREE.Vector3(0.55, 0.7, 0.45).normalize() },
  uShadowTint: { value: new THREE.Color(0.42, 0.5, 0.72) },
  uFogNear: { value: 110 },
  uTime: { value: 0 },
  // ...
});
```

Two rules:

- Never `.clone()` a ShaderMaterial. three.js deep-copies the uniforms, and the copy stops following the bag.
- Never replace a container (`G.uTime = { value: 0 }`): materials hold the old container, and the frozen bag rejects the write anyway. Change `.value`, or call `.value.copy()` for colours and vectors.

## The `npr(options)` factory

`src/materials/npr-cel-material-factory.js` returns a cached material keyed by `JSON.stringify(options)`. Identical option literals (same keys, same order, same values) share one material. That means one merge batch and fewer draw calls. Truthy flags add `#define`s. Each distinct combination of defines (plus three.js's own flags such as instancing and vertex colours) compiles to one GPU program. The whole scene uses 25 programs for about 125 materials.

| Option | Default | Effect |
|---|---|---|
| color | #ffffff | base colour, multiplied by vertex and instance colour |
| vertexColors | false | use the geometry's `color` attribute |
| stipple | 0.1 | stipple amplitude (how far it shifts band thresholds) |
| stippleScale | 2.0 | world-space stipple frequency |
| emissive | 0 | self-lit share by day (loco lamp lens 0.12, coach band and chimney smoke 0.25, windows 0.55–0.6, lanterns 0.8, flames 1) |
| doubleSided | false | DoubleSide, with the normal flipped on back faces |
| treeSway | false | vertex wind sway (instanced meshes only) |
| nightGlow | false | warm full brightness at night |
| localGlow | none | `{position, radius, strength}`: a warm point glow in object space |
| flowers | false | procedural flower dots on flat green surfaces |
| strata | false | soil band shader (needs a `topY` attribute) |

Pitfall: `{ color, stipple }` and `{ stipple, color }` produce two different materials. Keep option tables frozen, in one file per subsystem (see `src/world/station/station-palette-materials.js`).

## Vertex stage (`src/materials/glsl/npr-vertex-shader-glsl.js`)

- **Instancing.** The shader applies `instanceMatrix`, then transforms normals by `mat3(instanceMatrix)` and `mat3(modelMatrix)`, deliberately not by the inverse-transpose. Non-uniformly scaled parts shade slightly off. The static merge bakes normals the same way, so merged and unmerged parts match.
- **Instance colour** multiplies the vertex colour (tree tints, cloud blobs).
- **Tree sway** (`TREE_SWAY`, instanced meshes only) takes its phase from the trunk position, so neighbouring trees do not move in lock-step:

| Term | Value |
|---|---|
| phase φ | dot(trunk xz, (0.83, 1.37)) |
| height weight | smoothstep(0.45, 3.0, local y): the trunk base stays still, the crown moves |
| x offset | 0.045·sin(0.63 t + φ) + 0.012·sin(1.07 t + 1.71 φ) |
| z offset | 0.035·cos(0.51 t + 1.29 φ) + 0.010·sin(0.89 t + 0.73 φ) |

## Fragment pipeline (`src/materials/glsl/npr-fragment-shader-glsl.js`)

Order of operations:

1. Normal, flipped on double-sided back faces.
2. base = uColor × vertex colour.
3. STRATA, then FLOWERS.
4. `nprShade()`.
5. Emissive, then NIGHT_GLOW, then LOCAL_GLOW.
6. Fog.

### The cel ramp (`nprShade` in `src/materials/glsl/npr-lighting-common-glsl.js`)

```glsl
float litAmount = clamp(facingLight * 1.15, 0.0, 1.0) * shadow;
float grain = vnoise(worldPosition * stippleScale) * 0.62
            + vnoise(worldPosition * stippleScale * 2.7 + 11.0) * 0.38;
float shade = litAmount + (grain - 0.5) * stipple;
float upperBand = step(0.46, shade);
float lowerBand = step(0.16, shade);
vec3 shadowTone = base * uShadowTint;
vec3 midTone = base * mix(uShadowTint, vec3(1.0), 0.66);
vec3 litTone = base * uLightColor;
vec3 banded = mix(shadowTone, mix(midTone, litTone, upperBand), lowerBand);
```

| Band | Condition | Colour |
|---|---|---|
| shadow | shade < 0.16 | base × shadow tint |
| mid | 0.16 ≤ shade < 0.46 | base × mix(tint, 1, 0.66) |
| lit | shade ≥ 0.46 | base × light colour |
| sparkle | shade ≥ 0.88 and stipple ≥ 0.25 | lit × 1.16 (only rough materials: grass, trees, ballast, rocks, smoke, ...) |
| ambient (added on top) | always | ambient × base × (0.5 + 0.5·N.y) × 0.16, a skylight on up-facing surfaces |

Why it works: the stipple shifts the thresholds by up to ±stipple/2, so band borders become irregular blobs. The noise is sampled in world space, so it never swims when the camera moves and stays stable in pixel-art mode. Low stipple (0.04–0.1) gives clean painted metal and skin; high stipple (0.42–0.55) gives foliage and grass.

### Night pass

When `uNight > 0`, the shader computes a second ramp and mixes it in by `uNight`:

- the base colour is desaturated 78 % toward its luma;
- moon = smoothstep(−0.35, 0.85, N·L) × mix(0.62, 1, shadow), which is soft and has no bands;
- colour = desaturated base × mix(shadow tint, light colour, moon) + ambient × (0.055 + 0.04·N.y).

The post pass then boosts saturation × 2.5 at night. The result is a blue monochrome scene where only the warm emissive accents stay saturated.

### Headlight pool

`headlightAt()` adds a warm cone of light from the locomotive lamp to every lit surface at night:

- cone: smoothstep(0.86, 0.97) on the cosine of the angle (about 14°–31° half-angle);
- reach: (1 − smoothstep(8, 25, d)) / (1 + 0.025 d²);
- a facing term, and tint (1, 0.78, 0.42) × 2.8 × uNight.

The shader evaluates it per fragment, but returns early while `uNight` is 0. The scene contains no three.js lights.

### Emissive, night glow, local glow

| Feature | Formula | Used for |
|---|---|---|
| emissive | mix(shaded, base × 1.1, emissive × (1 − uNight)) | windows look lit by day; it switches off at night, when NIGHT_GLOW takes over |
| NIGHT_GLOW | mix(shaded, base × (1.3, 1.02, 0.75), uNight) | windows, lamp lenses, the coach window band, the flame |
| LOCAL_GLOW | + base × (1, 0.62, 0.22) × (1 − smoothstep(0, r, dist)) × strength × flicker × uNight | balloon envelope, basket, pilot and ropes lit by the burner: position (0, −1.9, 0), radius 4.5, strength 0.65, flicker 0.9 + 0.06 sin 9t + 0.04 sin 17t |

LOCAL_GLOW measures distance in the mesh's local space, before the model matrix, so the glow follows a moving object for free. The meshes must then be merged in that object's local frame (the merge never bakes the root transform).

### Flowers (`FLOWERS`, terrain only)

Flowers appear only where all three tests pass:

- vnoise(p × 0.08) > 0.52 (meadow patches);
- the surface faces up (N.y > 0.82);
- the colour is green-dominant (g > 1.2 r and g > 1.5 b).

There the ground is tiled at 1.5 tiles per unit, and 28 % of tiles get one dot of radius 0.16 tile (about 0.1 unit) at a hashed position. Each dot is pink (1, 0.55, 0.72), yellow (1, 0.88, 0.3) or white (1, 0.98, 0.94). No geometry is involved.

### Strata (`STRATA`, skirt only)

- Bands are 1.25 units tall: floor((y + wobble) × 0.8), with wobble = vnoise(p × 0.45) × 1.3.
- Each band gets a hashed tint between (0.78, 0.74, 0.78) and (1.14, 1.06, 0.98).
- Speckles brighten × 1.22 where vnoise(p × 3.1) > 0.8.
- A lip within 0.45–1.15 of the top edge turns grass (0.38, 0.66, 0.26), or sand (0.86, 0.8, 0.6) where the top is below 0.2 (the river mouth).
- The per-vertex `topY` attribute carries the surface height above each skirt column.

### Fog

`applyFog` mixes toward uFogColor by smoothstep(110, 420, distance to camera) × 0.85. Fog never reaches 100 %, so the far rim stays readable.

### About rim light

The cel ramp has no Fresnel rim term. Silhouettes come from the ink outline (chapter 3) and the sparkle band. The only view-angle rim fade is in the headlight cone shader. If a rim is ever wanted, it would go in `nprShade` after the bands, for example `color += base * uLightColor * pow(1.0 - max(dot(N, V), 0.0), 3.0) * rimStrength * (1.0 - uNight)`. This is not in the code. Keep such a term subtle (≤ 0.15), or it fights the ink lines.

## Material recipes used here

| Surface | Options |
|---|---|
| Terrain | vertexColors, stipple 0.42, scale 1.3, flowers |
| Skirt | #9a6a44, strata, stipple 0.2, scale 1.2, doubleSided |
| Trees (swaying) and bushes | vertexColors, stipple 0.55, scale 2.4, treeSway (bushes without) |
| Ballast / rails / sleepers | #a39a8c 0.5/5 doubleSided; #8f8f9e 0.05 doubleSided; #6e4a32 0.25/4 |
| Bridge | #b8432f 0.12/3 doubleSided; #8a2f24 0.1/3 doubleSided; stone #b9ae98 0.35/2.2 |
| Cottage walls / roofs | #f3e7cc 0.15/2; roofs #d24f3a #4d79b8 #e38b3b #c44d6a #5b9a6a at 0.18/3 |
| Windows | #ffe6a0, emissive 0.55 (station 0.6), nightGlow |
| Lantern lens | #ffe28a, emissive 0.8, nightGlow |
| Clouds | #ffffff 0.22/0.7 |
| Smoke | loco #fbfbff 0.3/2.2; chimney #e4dfd5 0.1, emissive 0.25 |
| Sheep / birds | vertexColors 0.2/4; vertexColors 0.1/4 |

## Files

`src/materials/shared-lighting-uniforms.js`, `npr-cel-material-factory.js`, `glsl/npr-vertex-shader-glsl.js`, `glsl/npr-fragment-shader-glsl.js`, `glsl/npr-lighting-common-glsl.js`, `glsl/hash-and-value-noise-glsl.js`, and `src/core/disable-three-color-management.js`.

## Cost

- Each fragment does 9 shadow taps and 2 value-noise samples (8 hashes each), plus the optional flower or strata noise. This runs fine at 1600×900 on integrated GPUs; overdraw of the forest is the main cost.
- 25 programs in total. Each new combination of defines compiles a new program the first time it is drawn, which causes a short hitch.

## Pitfalls

- Colour management is switched off (`THREE.ColorManagement.enabled = false`, output LinearSRGB), so hex colours are used as-is in display space. Import `src/core/disable-three-color-management.js` before creating any colour, including in tests.
- All materials sample the one shared shadow map. A surface outside the shadow frustum reads as lit.
- Non-uniform scale with `mat3` normals makes lighting on squashed parts approximate (for example the woman figure, scaled × 0.7 in y).
- Tree sway is missing from the shadow pass, so swaying crowns cast static shadows.
- `emissive` fades out at night by design. Use `nightGlow` for anything that must glow after dark.
