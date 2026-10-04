# 14. Performance budget and scaling up

[Index](../diorama-techniques.md)

## 14.1 Measured budget (default overview, 1600 × 900, all passes)

| Measure | Value |
|---|---|
| Draw calls | 1371 frozen (about 1411 live, with smoke puffs visible); 1391 at night |
| Triangles | 1 759 388 frozen (about 1.77 M live) |
| Geometries | 419 (436 at night) |
| Textures | 6 (shadow RT colour + depth, main RT colour + depth, water height, sign canvas) |
| Programs | 25 (27 at night) |
| CPU submit | about 4.4–4.9 ms per frame (SwiftShader host) |
| Build | world 250–280 ms + train 33–46 ms + birds about 3 ms in node; browser BUILD phase median 916 ms under SwiftShader |
| Allocation | about 74 KB per simulation step; about half from `sheepGroundAt` (23.7 KB) and the `excluded` closure (14.8 KB) |

Other views:

| View | Calls | Triangles |
|---|---|---|
| Train camera | 1323 | 1.74 M |
| Bridge | 1170 | 1.73 M |
| Free (platform) | 867 | 1.70 M |
| Mobile 390 × 844 | 1010 | 1.70 M |

## 14.2 Where the cost goes

Per pass; the shadow pass roughly doubles each figure.

| System | Meshes (draws) | Triangles per pass |
|---|---|---|
| Trees (4 instanced layers, 6665 trees) | 4 | 657 778 |
| Terrain + skirt | 2 | 81 600 |
| Track (ballast, rails, sleepers) | 4 | about 33 400 |
| Clouds (33 instanced) | 33 | 37 120 |
| Train | 149 | about 20 800 |
| Sheep (3 instanced layers) | 3 | 12 096 |
| House smoke | 96 | 7 680 |
| Birds | 108 | 6 624 |
| Residents | 33 | 4 432 |
| Balloon | 15 | 3 910 |
| Station | 116 | about 3 900 |
| Windmill (unmerged) | 65 | 892 |
| Loco smoke pool | up to 70 | up to 5 600 |

Takeaways:

- Triangles are dominated by one instanced forest (about 75 %).
- Draw calls are dominated by many small separate meshes (birds, train, station, windmill, smoke). Each costs a call for very few triangles.

## 14.3 Techniques used

| Technique | Where | Effect |
|---|---|---|
| Merge static geometry by material | `src/geometry/merge-static-geometry-by-material.js`; houses, station building, figures, balloon, every train car | a whole rig becomes one draw per material; about 70 house meshes → 9 |
| Instancing | trees, rocks, shrubs, sleepers, railing posts, clouds, sheep, sparks, glow halos | thousands of objects in one call |
| Material cache keyed by option literal | `npr()` | identical surfaces share a material, and so share a merge batch |
| Shared uniform bag | all shaders | one write per value per frame |
| No three.js lights or shadows | custom shadow pass + shader light pools | no per-light program variants |
| Glow visibility registry | 17 glow meshes | zero calls by day |
| Pre-sized typed arrays | grids, pose writers | no growing arrays during the build (but see the V8 pitfall about freezing) |
| Scratch reuse | sheep transforms, bird scratch, spark streaks, camera tmpA/tmpB | no per-frame garbage |
| One `updateMatrixWorld` per frame | render pipeline | matrices computed once, used by both passes |
| DPR cap 2, antialias off | renderer | bounded fill rate |
| 120 fps cap | frame loop | no wasted frames on high-refresh screens |
| Distance fields and grids instead of raycasts | heightAt, canopy grid, riverDist | O(1) ground and canopy queries for cameras and animals |

How `mergeStaticGeometry(root, excluded)` works:

1. Walk the tree depth-first (pre-order).
2. Take each eligible mesh (it has a uv attribute and is not transparent). Clone its geometry and transform it into the root's frame. Normals use the same mat3 the shaders use, and the winding is flipped for mirrored parts.
3. Group the results by material and merge each group with `BufferGeometryUtils.mergeGeometries`.
4. Add one mesh per material back to the root and remove the originals.

The root transform is never baked, so the root can still move (train cars, the balloon).

## 14.4 Cheap wins left on the table

- Merge the windmill (65 meshes over 8 materials → about 11 with the rotor merged in its own frame), the bridge boxes (45 → about 4) and the station props (116 meshes over 29 materials → about 30–35, keeping animated figures separate). That is roughly 175 fewer draws per pass, about 350 per frame.
- Hide clouds and smoke at scale 0 (`visible = false`).
- Instance the house smoke (96 → 1) and the birds per part (108 → 6).
- Keep tiny objects out of the shadow pass (birds and figures; smoke is already excluded). The shadow pass is half of everything.

## 14.5 Scaling up

### What grows with area

| Quantity | Scales with | At 124 | At 150 (1.46× area) | At 248 (4× area) |
|---|---|---|---|---|
| Terrain triangles (same 0.62 cell) | area | 80 000 | 117 000 | 320 000 |
| Heightmap grading (grid × track samples) | area × track length | 39–51 ms | about 65–80 ms | 300 ms or more |
| Trees at the same density | area | 6 665 / 0.66 M triangles | about 9 700 / 0.96 M | about 26 600 / 2.6 M (over budget on its own) |
| Shadow texel at 2048² | frustum width | 0.08 | about 0.10 | about 0.16 (blurry, acne) |
| Exclusion test cost | circles × candidates | 41 × 14 000 | grows quadratically with content | needs a spatial hash |
| Fog / camera distance | linear | 110–420, camera at 153 | about 130–500, about 185 | everything needs re-tuning |
| Draw calls | number of separate objects, not area | | | |

Constants sized for SIZE = 124 that must be audited when it changes:

- shadow frustum (±82) and fog (110/420);
- cloud bands (travel width, z ranges);
- free-fly clamp and canopy grid half-size (derived from HALF);
- overview home distance and zoom limits;
- water quad, height texture and waterfall mouth row;
- scatter attempt counts;
- sky dome radius vs camera far.

### Recommendations

1. **One slab = 124–150 units.** Above about 150, the 2048² shadow, the fog and the overview framing all degrade, and the forest alone uses up the triangle budget.
2. **Several slabs instead of one huge map.** Build each slab as its own `World` (own seed, heightmap and scatter), offset in space. Show one slab in detail and its neighbours as low-detail islands: terrain at SEG 50, trees as detail-0 crowns or impostors, no life systems. Every system's numbers then stay valid per slab.
3. **LOD.** Beyond about 80 units, use an icosahedron of detail 0 for crowns (20 triangles instead of 80). For far forests, use billboard impostors (camera-facing quads with a cel-shaded tree drawn into a small atlas at build time) or a single canopy-blanket mesh.
4. **Chunk culling.** Split each species' instanced layer into a 4 × 4 grid of chunks, each with its own bounding sphere, so the frustum culls them when zoomed in.
5. **Shadows.** Fit the ortho frustum to the visible part of the slab each frame, or use 2 cascades (near 0–60 units at 2048², the rest at 1024²). Keep tiny meshes out of the depth pass.
6. **Worker generation.** Everything up to placement is pure maths: natural height, grading, pads, scatter matrices, colours. Run it in a Web Worker that returns transferable typed arrays, then build the three.js objects on the main thread. With seeded PRNGs the result is identical.
7. **BatchedMesh** (three r159 and later): many different static props sharing one material (for example cottage parts across the whole village) in one call, with per-object visibility.

## Files

`src/geometry/merge-static-geometry-by-material.js`, `src/engine/render-pipeline.js`, `src/ui/debug-menu-panel.js`, `tools/parity/performance-budget-probe.mjs`, and `tools/parity/runtime-counts-probe.mjs`.

## Pitfalls

- `Object.freeze` on constants read in hot loops, and nested one-shot grid loops, triggered V8 deopt loops and slowed the build. A `%` in a hot scan added about 9 ms.
- Under SwiftShader (headless) FPS means nothing (about 2 FPS). Measure CPU submit time and counts there, and judge FPS on a real GPU.
- A performance gate once passed with zero samples, because `null <= 1.1 * null` is true in JS. Guard every metric with `Number.isFinite`.
- `renderer.info` resets on every render call by default. Set `autoReset = false` and reset once per frame to see the whole frame.
