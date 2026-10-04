# 6. Terrain, river, track and bridge

[Index](../diorama-techniques.md)

## 6.1 Natural height and the river distance field

### What it achieves

Rolling meadows with two hills, a raised rim that cups the board, and a river valley carved from the pond to the front edge.

### How it works

In `src/world/terrain/river-distance-and-natural-height.js`, `riverDist(x, z)` is the minimum of the distance outside the pond circle and the distance to each river polyline segment. `naturalHeight(x, z)` adds these terms:

| Term | Formula |
|---|---|
| Base | 6 + 6.5 × fbm(0.028x + 3.1, 0.028z − 7.3, 4) |
| Rim | + 11 × smoothstep(0.6, 1.3, √(x² + z²) / HALF) |
| West hill | + 11 × exp(−((x + 24)² + (z + 16)²) / 140) |
| East hill | + 9 × exp(−((x − 24)² + (z − (−10))²) / 110) |
| Valley | lerp(height, −1.4, 1 − smoothstep(2.5, 17, riverDist)) |

The valley term is a distance field: any water shape (polyline, circle, more ponds) carves the ground with one min() per shape. Measured height range of the final heightmap: −1.4 … 20.0.

## 6.2 Grading: the track shelf and the bridge cut

`src/world/terrain/terrain-heightmap-grading.js` first finds the nearest track sample for each of the 201² vertices. The result is cached in `world.trackNearestGrid` (index + distance) and reused by pads and colours. Then:

- **Off the bridge:** lerp(natural, rail y − 0.42, 1 − smoothstep(2.3, 7.5, d)). This makes a flat shelf under the ballast that blends into the hills over 5 units.
- **On the bridge span, within 3.5 units:** min(natural, rail y − 1.8). This leaves open air under the deck.

`heightAt(x, z)` interpolates the grid bilinearly. The mesh splits each quad along one diagonal, so on steep cells the two can differ slightly.

## 6.3 Flattening pads for buildings

`src/world/terrain/building-ground-flattening.js` provides `world.flattenBuildingGround({x, z, height, width, depth, rotation, falloff})`:

- The pad rectangle is the footprint plus a 0.8 margin, rotated with the building.
- weight = 1 − smootherstep(distance outside the rectangle, 0, falloff).
- The weight is multiplied by smootherstep(distance to each earlier pad, 0, 0.8), so later pads never undo earlier ones.
- It is also multiplied by smootherstep(track distance, 2.3, 3.5), so pads never dent the track shelf.
- height = lerp(height, pad height, weight).

| Pad | Size | Falloff |
|---|---|---|
| Cottage | house width × depth | 2.8 |
| Station building | 3.2 × 6 | 3 |
| Station stair landing | 2.1 × 2.2 | 1.3 |
| Windmill | 3.64 × 3.64 | 3.5 |

All 11 pads (8 cottages, 2 station pads, 1 windmill) are applied before `buildTerrain` bakes the mesh. The mesh, the water height texture and every later `heightAt` call therefore see levelled ground.

## 6.4 Surface mesh and vertex colours

`src/world/terrain/terrain-surface-mesh-and-vertex-colors.js` builds one indexed 200 × 200 grid (80 000 triangles) with computed normals. Per-vertex colours follow these rules, in order:

| Rule | Colour |
|---|---|
| Height bands on h + 3 × fbm(0.09) | low (0.5, 0.76, 0.32) → mid (0.37, 0.65, 0.26) over 2–8; mid → high (0.27, 0.54, 0.24) over 8–16 |
| Hue/lightness wobble | offsetHSL(wobble × 0.03, 0, wobble × 0.03) |
| Slope > 0.3 (slope = 1 − N.y) | → rock (0.64, 0.56, 0.46) by smoothstep(0.3, 0.5) |
| Track within 3.4 (not on the bridge) | → dirt (0.7, 0.6, 0.42) by 1 − smoothstep(2.6, 3.4) |
| h < 0.45 | restart from sand (0.87, 0.8, 0.58), → rock by smoothstep(0.2, −1.2, h) × 0.5 |

Material: `npr({ vertexColors: true, stipple: 0.42, stippleScale: 1.3, flowers: true })`.

## 6.5 Skirt, plinth and the water height texture

All in `src/world/terrain/terrain-skirt-plinth-and-water-height-texture.js`:

- **Skirt:** walk the four grid edges and emit pairs of vertices (the surface point and the same point at y = −7), plus a `topY` attribute. Uses the strata material (chapter 2). 1 600 triangles.
- **Plinth:** a wood box 124 × 1.8 × 124 at y −7.9 (#6b4630) and a trim box 124 × 0.5 × 124 at −9.05 (#3f2a1f).
- **Water height texture:** one byte per vertex, (h + 3) / 12 clamped to [0, 1], stored as a 201² red-channel `DataTexture` with linear filtering. The water shader decodes it as r × 12 − 3, a resolution of 0.047 unit.

## 6.6 Track spline and frames

`src/world/track/track-spline-frames-and-queries.js`:

- The track is a `CatmullRomCurve3(points, closed = true, 'centripetal')` through 14 control points. The centripetal variant avoids cusps and overshoot with uneven point spacing.
- 1200 samples spaced evenly by arc length (`getPointAt`, `getTangentAt`), plus one closing frame, give 1201 frames `{p, r, u}`. r = tangent × UP (outward on this loop) and u = r × tangent.
- `nearest(x, z)` scans the Float32 sample caches with stride 8, then refines ±8 around the winner. It returns the nearest of the 1200 samples (spacing 0.23), so the distance to the true curve can be off by up to about 0.115.
- `pointAtS(s)` and `tangentAtS(s)` wrap arc length into [0, 1).

The loop is 276.14 units long: about 37 s per lap at the cruise speed of 7.5, or about 45 s including braking and the 4 s dwell.

## 6.7 Ballast, rails, sleepers

`src/world/track/track-ballast-rails-sleepers.js` with `src/geometry/extrude-profile-along-frames.js`:

| Part | Profile / size | Material |
|---|---|---|
| Ballast | trapezoid: ±1.35 at −0.55, ±0.95 at +0.03 | #a39a8c, stipple 0.5, scale 5, double-sided |
| Rails (2) | 0.14 × 0.18 at lateral ±0.52, from 0.12 to 0.3 above the frame | #8f8f9e, stipple 0.05, double-sided |
| Sleepers | box 1.9 × 0.12 × 0.32 every 0.72 units, 383 instances, lifted 0.08 | #6e4a32, 0.25/4 |

`extrude(frames, profile, caps)` gives every profile edge its own vertex strip. Corners stay hard (flat-shaded edges) without manual normal fixes. A 4-point profile extruded along 1201 frames is 9 600 triangles.

## 6.8 The bridge

Span detection (`src/world/track/bridge-span-detection.js`): the bridge covers the longest run of frames where the natural ground is more than 2.6 below the rails and within 20 units of water, padded by 3 frames. Result: frames [30, 178].

Construction (`src/world/bridge/*`):

- **Deck and girders** are extruded along the curved track frames. Profiles: deck ±1.55 wide from −1.25 to −0.45; side girder 1.5–1.75 out, −1.45 to −0.15; handrail 1.62–1.72 out, 0.85–0.95.
- **Railing posts** are one `InstancedMesh` of 0.1 × 1.1 × 0.1 boxes on every 4th frame on both sides: 76 posts in 1 draw call.
- **Arch.** It follows the straight chord between the first and last deck frame. The springs sit at chord fractions 0.13 and 0.87, sunk 0.6 into the ground, and the crown is 1.35 below the deck. Height is a parabola over the sloped line between the springs: y = line + (crown − line)(1 − (2κ − 1)²). Two ribs at ±1.15 are each extruded through 49 frames whose up vector is perpendicular to the arch tangent.
- **Supports.** Every 1.7 units along the chord there is a pair of uprights: spandrel columns (0.26 thick) between arch and deck inside the arch, with cross braces on even spans, and approach piers (0.5 thick) outside it. Stone abutments (3.4 × 2.2 × 2.2) stand at the springs.

## Files

`src/world/terrain/*`, `src/world/track/*`, `src/world/bridge/*`, and `src/geometry/extrude-profile-along-frames.js`.

## Cost

Build (two runs): heightmap grading 39–51 ms, terrain bake 36–57 ms, track 16 ms, bridge 4–6 ms. Triangles per pass: terrain 80 000, skirt 1 600, ballast + rails 28 800, sleepers 4 596. The bridge is 45 unmerged meshes; merging it by material would save about 40 draw calls per pass.

## Pitfalls

- The nearest-track grid is the heaviest one-shot computation (201² vertices × about 167 samples each). Keep it cached and reuse it.
- Pads read the track grid and write into `world.heights`. A pad applied before `buildHeightmap` is simply lost, because grading rewrites every height.
- The arch follows the chord but the deck follows the curve, so on a curved bridge they diverge (by up to 0.77 here). Keep bridges on near-straight stretches.
- The sleeper count is floor(length / 0.72), which leaves a gap of about 1.09 at the seam at s = 0.
- The height texture's half-texel offset shifts the shoreline by up to 0.3 units.
