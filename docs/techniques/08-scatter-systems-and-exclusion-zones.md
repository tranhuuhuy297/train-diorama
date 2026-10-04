# 8. Scatter systems and exclusion zones

[Index](../diorama-techniques.md)

## 8.1 Trees by species

### What it achieves

A dense, clumpy forest that thickens toward the rim and on high ground. It mixes conifers, round broadleaves, three-crown clusters and bushes, with rare autumn and blossom trees, all swaying gently. That is 6665 trees in 4 draw calls per pass.

### Species geometry (`src/world/trees/tree-species-geometries.js`)

Each species is a few primitives merged into one non-indexed, vertex-coloured geometry. `colorize` bakes flat colours and faceted normals; crowns are icospheres with `jitter` 0.28.

| Species | Parts | Triangles |
|---|---|---|
| Conifer | trunk cylinder (5 segments) + 3 stacked cones (r 1.05/0.82/0.56, 7 segments), #2f6e3c | 62 |
| Round | trunk + icosphere r 1.1, detail 1, squashed to 0.92, #4f9b3c | 100 |
| Cluster | trunk + 3 icospheres, r 1.0/0.95/0.8 | 260 |
| Bush | icosphere r 0.7, squashed to 0.75, #5aa843 | 80 |

### Scatter rules (`src/world/trees/tree-scatter-rules.js`)

The scatter tries 14 000 uniform candidates over a 122.5-unit square. The draw-free filters run first:

| Filter | Rule |
|---|---|
| Dry ground | height ≥ 0.7 |
| Track gap | ≥ 4 (≥ 3 on the bridge span) |
| Exclusions | outside every circle |
| Slope | abs(Δx) + abs(Δz) over ±0.8 ≤ 2.4 |
| Acceptance | rand ≤ smoothstep(−0.1, 0.35, density) × 0.92 + 0.02, where density = fbm(0.045x + 10, 0.045z − 3, 3) + 0.45 × smoothstep(0.55, 1, r / HALF) + (0.2 when ground > 11) |
| Species | ground > 12 → conifer; otherwise roll < 0.22 conifer, < 0.55 round, < 0.8 cluster, else bush |
| Size | 0.75–1.5, vertical stretch 0.9–1.2, random yaw, sunk 0.15 |
| Tint | one of 5 multipliers (including warm 1.2/1.12/0.8 and cool 0.85/0.95/0.9); broadleaves can turn autumn (2.0, 1.05, 0.5) at 4 % or blossom (2.3, 1.2, 1.6) at 2 % |

Tints above 1 work because instance colours are floats multiplied in the shader. Result: [3749, 1215, 932, 769] trees per species.

### Instancing (`src/world/trees/tree-instanced-layers.js`)

Each species is one `InstancedMesh`, filled with `setMatrixAt` / `setColorAt`. The three tree species use the swaying material and the bushes a still one: two materials whose options differ only by `treeSway`.

### Canopy height grid (`src/world/trees/tree-canopy-height-grid.js`)

A 70 × 70 Float32 grid of 2-unit cells covers ±70 (the board plus 8). Every instance stamps its world bounding box, expanded 0.6 for sway, and each covered cell keeps the highest top. `treeCanopyHeightAt(x, z, r)` returns the maximum over a square query.

The train camera uses it to stay out of crowns, and the birds use it for flight height. The grid has 3478 non-zero cells, maximum 26.08. It is a cheap alternative to raycasting against 6665 instances.

## 8.2 Rocks

`src/world/rocks/riverside-rock-scatter.js` places up to 80 jittered dodecahedra (r 0.6, jitter 0.4, #9d978c) in at most 3000 attempts:

- only where the ground is between −0.3 and 1.2 (river banks, shallow water) and outside every exclusion circle;
- size 0.4–1.5, squashed to 0.7 in y, randomly tumbled.

All rocks are one InstancedMesh, with `count` set to the number placed.

## 8.3 Shrubs

Six shrubs per house in a fixed pattern (chapter 7), in one InstancedMesh.

## 8.4 Exclusion zones

`world.exclusions` is a list of circles `{x, z, r}`, and `world.excluded(x, z, pad)` tests all of them. Every builder pushes its own:

| Source | Circles | Radius |
|---|---|---|
| Station footpath (every 4th section) | 26 | 1.8 |
| Station disc | 1 | 8 |
| Cottages | 8 | 2.6 |
| Windmill | 1 | 4.5 |
| Resident yards | 2 | 2.2 |
| Trackside sheep clearings | 3 | 1.2 |

Order matters: a scatter only sees circles pushed before it runs. The sheep clearings come after the trees and rocks, so they can overlap trees.

## Files

`src/world/trees/*`, `src/world/rocks/riverside-rock-scatter.js`, `src/world/village/village-shrubs-instanced.js`, and `src/world/world.js` (`excluded`).

## Cost

Trees build in 34–36 ms. They are 657 778 triangles per pass, about 1.32 M per frame with the shadow pass, which is about 75 % of all triangles. Draw calls: 4 + 4. An instanced mesh is frustum-culled as a whole (one bounding sphere over all its instances), so in practice the trees are always drawn.

## Pitfalls

- `excluded()` is a linear scan using a closure (`.some`). That is fine for 41 circles, but with hundreds of circles and 14 000 candidates, use a spatial hash.
- Rocks and trees ignore each other: rocks are placed after trees and never tested against them.
- Instance tints also tint the trunks, since the multiplier applies to all vertex colours.
- Candidates are uniformly random. At higher densities, use Poisson-disc or jittered-grid sampling to avoid clumps where trees intersect.
