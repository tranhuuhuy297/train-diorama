# 9. Water, waterfall, clouds and balloon

[Index](../diorama-techniques.md)

## 9.1 Water: one quad, discarded by height

### What it achieves

A pond and a winding river with shallow and deep colours, animated ripple crests, white shore foam, sun shadows, a moonlit night version, and the train headlight sweeping across. All of it is one board-sized quad and one draw call; there is no river-shaped mesh.

### How it works

`src/world/water/river-water-and-waterfall-builder.js` adds a single 124 × 124 plane at y = 0. The shader in `src/materials/water-surface-material.js` then:

1. Computes board uv = (p.xz + 62) / 124 and ground = texture(heightTex).r × 12 − 3.
2. Discards the fragment where ground > 0.08 (dry land); the terrain itself forms the bank.
3. Sets depth = −ground and deepness = smoothstep(0.15, 1.5, depth), and colour = mix((0.48, 0.82, 0.86), (0.2, 0.5, 0.8), deepness).
4. Adds waves from two value-noise layers scrolling in different directions (scales 0.45/0.9 at speeds 0.15–0.5; scales 1.3/1.1 at 0.3–0.6). crest = step(0.76, 0.7 a + 0.3 b) mixes the colour 75 % toward (0.82, 0.95, 1.0).
5. Adds foam where depth plus a noise jitter is below 0.18: (0.97, 0.99, 1.0).
6. Samples the shared shadow map with an up normal; shadows are tinted by uShadowTint × 1.1.
7. At night, switches to a moonlit palette from (0.15, 0.24, 0.35) to (0.1, 0.18, 0.29), dimmed to 82 % in shadow, with faint crests, plus the headlight pool × (0.48, 0.65, 0.75).
8. Applies fog.

### Pitfalls

- 8-bit heights (steps of 0.047 unit) plus a half-texel offset shift the shoreline by up to 0.3 units. If shorelines must be exact, use a Float or HalfFloat texture, or align the texel centres.
- The water is on the `noShadow` list: it receives shadows but never casts them.
- The plane covers the whole board, so every fragment of it does the texture lookup before the discard. That is cheap, but not free on big boards.

## 9.2 Waterfall curtain

`findWaterfallMouth(heights)` scans the last heightmap row (z = +62) for ground below 0 and returns its x-range. `createWaterfallGeometry` builds a grid of 24 rows × 8 columns that starts at the lip (y 0.02, z = HALF + 0.05) and drops 18 units. It bows outward by 1.35 × √drop, which looks ballistic. uv v is 1 at the lip.

`src/materials/waterfall-curtain-material.js` is unlit and double-sided:

- streak noise scrolls down at 2.2 per second and a detail layer at 3.5;
- two blues, plus white spray where the noise is high;
- foamy sides (7–12 % of the width) and a ragged splash in the bottom 10 %;
- moon colours at night, and fog (no headlight term).

Together with the low cloud bank, the foot of the fall dissolves into mist.

## 9.3 Clouds

### What it achieves

Puffy cel-shaded clouds in three layers: high over the board, far behind it, and a low bank below the front edge. They drift east (+x), wrap around, grow in and out, and part when a camera flies into them.

### Build (`src/world/sky/cloud-field-spawner.js`)

| Band | Count | Height | Depth (z) | Travel width | Fade width | Size | Speed |
|---|---|---|---|---|---|---|---|
| High | 8 | roof + 15 … + 25 | −18 … 57 | 220 | 28 | 1 | 1.2–2.7 |
| Far | 7 | roof + 7 … + 19 | −73 … −43 | 220 | 28 | 1.6 | 1.2–2.7 |
| Low bank | 18 | −4 … 0 | HALF + 10 … HALF + 28 | 124 | 12 | 1.1 | 0.8–1.5 |

Each cloud is built like this:

- 8–12 icosphere blobs (detail 1), sized 1.3–3.3 and squashed to 0.7–0.9 in y;
- spread in 2–3 clusters 3.2 apart, with triangular-distributed offsets (rand + rand − 1);
- 4 small accent puffs added beside the outermost blob in each of ±x and ±z;
- the temporary meshes baked into one `InstancedMesh` per cloud, with their spheres kept as colliders.

The material is `npr({ color: '#ffffff', stipple: 0.22, stippleScale: 0.7 })`. The low stipple scale (large noise features) gives soft, blotchy shading.

### Motion (`src/world/sky/cloud-drift-fade-and-camera-avoidance.js`)

- **Drift (sim time):** x += speed × dt, wrapping at ±travelWidth/2. scale = size × fade-in × fade-out (smoothstep over the fade width at both ends) × smoothstep(0, 2 s, age).
- **Camera avoidance (real time, runs while paused):** offsets decay by exp(−1.8 dt). If the camera is inside a cloud's bounding radius + 1.5, the cloud is pushed along its current offset direction (or away from the camera) by the largest ray–sphere exit distance over its blob colliders.

### Pitfalls

- Clouds and puffs at scale 0 still issue draw calls. Set `visible = false` at scale 0.
- Wrapping resets the avoidance offset, causing an invisible pop at the band edge.
- Avoidance assumes uniform scale.

## 9.4 Hot-air balloon

`src/world/balloon/*` builds:

- a lathe envelope with checker panels;
- a woven basket from many thin boxes, ropes, sandbags and a pilot figure;
- all of the basket, pilot, ropes and sandbags merged by material in balloon-local space. The envelope (vertex-coloured, no uv) stays its own mesh and is excluded from the merge explicitly. Every part uses the same LOCAL_GLOW, which measures in balloon-local space; the merge keeps that working because it never bakes the root transform;
- a live burner and a two-layer flame (cones, emissive + nightGlow, noShadow), plus a burner glow sprite. The burner and flame sit outside the local glow (a kept quirk).

The flight is closed-form in sim time:

| Parameter | Value |
|---|---|
| Orbit | ellipse 34 × 26 centred at z = −4, 0.035 rad/s (about 180 s per lap) |
| Height | 27 + 1.2 sin(0.5 t) |
| Spin | 0.1 rad/s yaw (independent of the heading) |
| Flame flicker | scale.y = 0.9 + 0.06 sin 9t + 0.04 sin 17t |

## Files

`src/world/water/*`, `src/materials/water-surface-material.js`, `src/materials/waterfall-curtain-material.js`, `src/world/sky/*`, and `src/world/balloon/*`.

## Cost

| Item | Draws | Triangles |
|---|---|---|
| Water | 1 | 2 |
| Waterfall | 1 | 384 |
| Clouds | 33 per pass | 37 120 per pass |
| Balloon | 15 meshes | 3 910 |
