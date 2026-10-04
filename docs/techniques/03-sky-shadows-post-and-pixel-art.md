# 3. Sky dome, shadow pass, post pass and pixel art

[Index](../diorama-techniques.md)

## 3.1 Procedural sky dome

### What it achieves

A painted sky with:

- a gradient from horizon to zenith;
- a sun (or moon) disc with a soft glow;
- stars at night;
- three layered ridge silhouettes on the horizon that suggest distant hills;
- mist below the horizon, so the slab floats in haze.

### How it works

In `src/materials/procedural-sky-dome-material.js`, the dome is a `SphereGeometry(700, 32, 16)` (960 triangles; the probes' sky-only count of 962 adds the 2-triangle post quad). It is rendered BackSide with `depthWrite: false`, `frustumCulled = false` and `renderOrder = −1`. It moves to the camera position every frame, so it behaves as if it were at infinity. The fragment shader uses only the view direction:

| Term | Formula / value |
|---|---|
| Gradient | mix(uHorizon, uZenith, smoothstep(0, 0.55, dir.y)) |
| Sun glow | + uSunColor × max(dot(dir, uLightDir), 0)^18 × mix(0.35, 0.06, uNight) |
| Sun disc | smoothstep(0.9975, 0.998) on the same dot product, a disc radius of about 4° |
| Stars | night only, dir.y > 0.05: grid of dir × 260; a cell keeps a star when its hash ≥ 0.993 (0.7 %); round point radius smoothstep(0.08, 0.3); colour (0.68, 0.78, 1.0) × uNight × smoothstep(0.05, 0.3, y) |
| Ridges | 3 bands painted back to front. Silhouette height 0.07 − 0.035·i + profile × (0.045 − 0.008·i), with profile = 0.5 sin(3a + k) + 0.28 sin(7a + 2.3k) + 0.14 sin(13a + 4.1k) + 0.06 sin(29a + k) and k = 1.7 i + 0.5. Edge jitter 0.012 × (vnoise(dir × 160) − 0.5). Colour mix(uHorizon, uHill, 0.35 + 0.25 i) × a subtle noise shade |
| Mist | mix toward uMist by 1 − smoothstep(−0.25, −0.02, y) |

The `uLightDir` that lights the scene also places the sun or moon, so the disc always matches the shadows. The sky ignores fog and shadows.

### Cost

One draw call and 960 triangles, but it covers every sky pixel; the per-pixel work is a few sines and two value-noise lookups (plus a hash for stars at night).

### Pitfalls

- `depthWrite: false` matters. The post pass sees sky pixels as the far plane, so the ink outline never draws along the horizon.
- The ridges live in the sky shader, not in geometry, so they never show parallax. That is fine for an orbiting camera, but a free-fly camera near the ground can notice it.
- GLSL smoothstep is undefined when edge0 ≥ edge1. The mist therefore uses 1 − smoothstep with ascending edges.

## 3.2 Custom shadow depth pass

### What it achieves

Crisp, slightly soft sun shadows for the whole board. Shadow casting is controlled per object, every NPR shader can read the result, and neither three.js lights nor its shadow system are involved.

### How it works

`src/engine/custom-shadow-depth-pass.js` runs these steps every frame:

1. Place an `OrthographicCamera(−82, 82, 82, −82, 1, 360)` at `uLightDir × 170`, looking at the origin.
2. Set `uShadowMatrix = B · P · V`, where B maps clip space [−1, 1] to texture space [0, 1].
3. Hide everything on the shadow-hidden list: the sky, the sparks, every `noShadow` mesh (glows, smoke puffs, water, waterfall, cab glass, flames) and the 70 locomotive smoke puffs.
4. Set `scene.overrideMaterial = MeshBasicMaterial({ colorWrite: false, side: DoubleSide })` and render into a 2048² `WebGLRenderTarget` that has a `DepthTexture`. Then restore visibility.

Shaders then call `shadowAt(p, N)`. It offsets the point 0.12 along the normal, projects it, and takes a 3×3 PCF sample with a depth bias of 0.0006. Points outside the frustum count as lit.

| Parameter | Value | Note |
|---|---|---|
| Map size | 2048² | `SHADOW_MAP_SIZE` |
| Frustum | ±82 units, near 1, far 360 | covers the 124 board projected along the sun |
| Texel | 164 / 2048 = 0.08 unit | a sleeper (0.32 deep) spans 4 texels |
| Light distance | 170 | |
| PCF | 3×3, texel offset 1/2048 | soft edge about 0.24 unit wide |
| Bias | depth 0.0006, normal offset 0.12 | no acne on the terrain grid |

### Cost

The pass draws the whole scene a second time, so it accounts for roughly half of all draw calls and triangles each frame (it skips the 192 shadow-hidden objects). The double-sided override makes open and single-sided meshes (extruded strips, the bridge deck) cast shadows from either side, at some fill-rate cost.

### Pitfalls

- The override material is a plain MeshBasicMaterial, so vertex animation (tree sway) never reaches it and shadows stay static. A sway-aware depth material would fix this.
- Anything transparent or additive must be on a `noShadow` list, or it casts a solid shadow.
- The frustum is fixed to the board, not fitted to the view, so zooming in does not sharpen shadows.

## 3.3 Post pass

### What it achieves

The "printed illustration" finish: thin dark ink lines on silhouettes, a hint of film grain, a vignette and a night saturation boost. In pixel-art mode, an ordered-dither posterisation replaces the grain.

### How it works

The scene renders into `mainRT` (colour + `DepthTexture`). A full-screen quad using `src/engine/post-ink-outline-dither-pass.js` then writes to the screen in four steps:

1. **Ink outline.**
   - Convert depth to linear eye depth and invert it (w = 1/z, so nearer is bigger).
   - Take a 5-tap Laplacian normalised by the centre: lap = (4w₀ − wL − wR − wU − wD) / w₀.
   - Ink weight = uOutline × smoothstep(0.006, 0.02, lap).
   - Ink colour = colour × (0.22, 0.20, 0.28), a dark violet rather than black. It is applied at 90 % by day and 28 % at night.
   - The normalisation makes the threshold independent of distance. Only the near side of a depth step gets a line, so lines are one pixel wide and sit on the foreground object.
   - Sample offsets are `uThick / uRes`: thickness max(1, 0.9 × DPR) in native mode, 1 in pixel mode.
2. **Saturation.** mix(luma, colour, uSaturation): 1 by day, 2.5 at night.
3. **Pixel mode or grain.**
   - Pixel mode posterises to 15 levels per channel with a 4×4 Bayer bias: floor(14·c + 0.5 + bayer − 0.5) / 14. The Bayer index comes from the render-target pixel coordinate.
   - Native mode applies grain, colour × (0.975 + 0.05 × hash(pixel)), by day only.
4. **Vignette.** d = 1.35 × length(uv − 0.5); multiply by mix(1, mix(0.84, 0.94, uNight), smoothstep(0.45, 1.05, d)).

| Parameter | Day | Night |
|---|---|---|
| Ink strength | 0.9 | 0.28 |
| Saturation | 1 | 2.5 |
| Grain | ±2.5 % | off |
| Vignette corner | 0.84 | 0.94 |

The renderer uses `antialias: false`. MSAA would fight the ink lines and the low-resolution pixel mode, and the stipple hides most aliasing anyway.

### Cost

One full-screen draw with 6 texture reads per pixel (colour + 5 depth taps). At native resolution with DPR 2 this is the largest fixed fill-rate cost after the forest; pixel modes make it almost free.

### Pitfalls

- Edges come from depth only. Two surfaces at the same depth with different colours get no line between them (the cel bands draw creases inside one mesh instead).
- Very thin geometry far away, such as the 0.1-wide railing posts, can turn into a dotted line. At this scale that is acceptable.

## 3.4 Pixel-art resolutions

`src/engine/render-resolution-resizer.js` provides `computeRenderResolution(width, height, dpr, shortSide)`:

| Mode | Short side | Render target |
|---|---|---|
| Native | null | canvas × DPR (DPR capped at 2), linear filter |
| 720p / 540p / 360p | 720 / 540 / 360 | scale = min(1, shortSide / min(nativeW, nativeH)), nearest filter |

The post shader samples the small target with nearest filtering, so pixels stay square. The HUD is DOM, so it stays crisp. The P toggle defaults to 360p (`lastPixelResolution`).

A quirk kept from the reference: in WebGL, the filter swap only takes effect at the next size change.

## Files

`src/materials/procedural-sky-dome-material.js`, `src/engine/custom-shadow-depth-pass.js`, `src/engine/post-ink-outline-dither-pass.js`, `src/engine/render-resolution-resizer.js`, `src/engine/render-pipeline.js`, and `src/engine/diorama-scene-composition.js` (the shadow-hidden list).
