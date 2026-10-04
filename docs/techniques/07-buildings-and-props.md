# 7. Buildings and props

[Index](../diorama-techniques.md)

## 7.1 The procedural cottage generator

### What it achieves

A village of 8 cottages ringed around the pond. Each differs in size and roof colour and sits on levelled ground. Each has windows that glow at night, shutters at varied angles, flower boxes and chimney smoke.

### Placement (`src/world/village/village-house-placement.js`)

Rejection sampling on a ring: up to 600 tries for up to 8 houses.

| Step | Rule |
|---|---|
| Candidate | bearing = rand × 2π, reach = 11 + rand × 14 from the pond centre |
| Height band | 0.9 ≤ ground ≤ 9 |
| Slope | abs(h(x + 1.5) − h(x − 1.5)) + abs(h(z + 1.5) − h(z − 1.5)) ≤ 2.2 |
| Track gap | ≥ 6.5 |
| House gap | ≥ 5 between centres |
| Exclusions | outside every circle, each grown by 3 |
| Facing | `house.lookAt(pond)`: every door faces the water |
| Dimensions | width 2 + rand × 0.8, depth 2.2 + rand × 1.0, wall 1.6 + rand × 0.8 |
| Result | pad flattened, house built and merged, exclusion circle r 2.6 pushed |

Measured: 8 houses in 256 tries.

### Construction (house-local frame: origin on the ground, +Z = facade)

- **Walls:** one box sunk 1 unit into the ground, which hides pad imperfections.
- **Roof:** a 3-sided `CylinderGeometry` rotated to lie along Z forms a gable prism. It is scaled ((width + 0.4) / 1.732, 0.75, 1) for the overhang. The roof colour cycles through 5 tints by house number.
- **Vents:** shared helpers in `src/geometry/building-wall-and-roof-vents.js`. The louvred wall vent has a frame, a dark recess, 5 slats tilted 0.3 and a drip hood. The roof vent has a plate, a tapered 8-sided pipe and a cone cap.
- **Roofline:** a ridge beam, and a chimney 0.3 × 0.9 × 0.3 at (width × 0.25, −depth × 0.2) with a cap.
- **Door and trim rows:** door, inset panel, knob, doorstep, plinth strip, corner posts, eave beams.
- **Windows:** two on the front at x = ±0.3 × width, y = 0.6 × wall height. Each has a frame, glass (emissive + night glow), a mullion, a sill, and a flower box with leaves and three petal blobs. Two hinged shutters (a pivot group with a leaf and a raised panel) open at 0.18, 0.55, 1.05 or 1.42 rad, picked by (3·house + 2·window + sideIndex) mod 4, where sideIndex is 0 for the left shutter and 1 for the right.
- **Night halos:** one instanced glow mesh per house for both windows (glow sprite 1.65 × 2.0, strength 0.18).

### Data-driven part tables

Most parts are rows of a size, a palette key and a position, iterated in order (see `doorAndTrimParts` and `WINDOW_BOXES`).

The train uses the richest version: `addParts(parent, materials, rows, { side, noShadow })` in `src/train/train-mesh-helpers.js`, with rows `[shape, args, materialKey, x, y, z, extras]`.

- A list-valued coordinate emits one mesh per value.
- `side` mirrors x.
- `extras` add a scale, an X rotation (`rotX`), a baked geometry transform (`bake`), or no-shadow.

A locomotive is a few dozen rows. Builders stay short and diffable, and models stay editable as tables.

### Chimney smoke (`src/world/village/village-chimney-smoke.js`)

Each house has 12 opaque puffs (a lumpy icosahedron, `npr` #e4dfd5 with emissive 0.25) on a 3.5 s loop, each offset by i/12 of the loop. Every puff:

- rises 3 units and drifts (0.35–0.75, ±0.33) in the house frame, with a wobble;
- fades in and out by scale only: envelope smoothstep(0, 0.12) × (1 − smoothstep(0.72, 1));
- has radius (0.45 + 0.8 × age) × size.

Position and size are closed-form in sim time (only the slow spin accumulates by dt), so there is no per-puff state machine and no allocation. Opaque puffs that fade by scale avoid sorting transparent particles.

### Merge per house

`mergeStaticGeometry(house, excluded)` (chapter 14) bakes every opaque mesh that has a uv attribute into one mesh per material, excluding the smoke puffs. A house goes from about 70 meshes to 9 merged meshes, plus 1 glow mesh and 12 puffs.

## 7.2 Shrubs around houses

`src/world/village/village-shrubs-instanced.js` places 6 shrubs per house (2 behind, 2 per side, none in front) in one `InstancedMesh` for the whole village. Size, colour and yaw cycle with the running index, so no random draws are needed.

## 7.3 The station: a hand-placed hero

`src/world/station/*`:

- **Site:** the track sample nearest (−45.5, −2). The station group sits 2.7 units off the track on the outward side, with local +Z along the track. Everything else is authored in that local frame with helpers (`shiftedX`, `addShiftedBox`, `stationLocalToWorld`).
- **Contents:** a 3.38 × 1.3 × 13 platform with a pale yellow safety edge, a shelter, a slatted bench, a building with a prism roof and vents, two lit windows with half-open shutters, a wall clock, an entrance gate with a canvas sign, two hexagonal lamps with halos, luggage, and stairs down to a levelled landing with railings.
- **Footpath:** an open Catmull-Rom curve in station-local coordinates, sampled at 101 cross-sections. Its edges are offset ±0.8 and draped at `heightAt + 0.04`. Every 4th centre pushes an exclusion circle of radius 1.8 (26 circles), so trees keep off it.
- **Clock:** two hand pivots rotate from sim time: the minute hand turns once per 60 s, the hour hand once per 720 s, starting at 3:00.
- **Merging:** only the building is merged (the hand pivots are excluded). The platform props stay separate, so the station group has 116 meshes using 29 materials, a merge candidate.

### Canvas sign

`src/world/station/station-name-board-sign.js` paints a 1024 × 256 canvas from a table of context writes (fills, strokes, Fredoka text). The canvas becomes a `CanvasTexture` (sRGB, anisotropy 4) on a 2.27 × 0.57 plane with a `MeshBasicMaterial`.

Pitfalls:

- MeshBasic ignores fog, shadows and night, so the sign stays bright at night (and the sRGB texture renders it slightly darker than its canvas colours).
- The canvas is drawn synchronously at build time. If Fredoka has not loaded yet, the text falls back to sans-serif. Await `document.fonts.load()` before building, or render signs with an NPR material that samples the canvas.

## 7.4 The windmill

`src/world/windmill/*`:

- **Site:** the highest of 300 random samples in a 16 × 16 window around (24, −10), with a track distance ≥ 8. The search always uses 600 draws.
- **Model:** a tapered 8-sided tower (r 1.0/1.55, h 5.5), a foundation ring, a conical cap, a doorway with steps and two hay-bale stacks.
- **Rotor:** 4 arms (spar + sail) turning at −0.9 rad/s (about 7 s per turn).
- **Clouds:** the cap height (22.27) sets the cloud band heights.
- **Merging:** none. 65 meshes over 8 materials means 65 draws per pass; it is a merge candidate (with the rotor excluded or merged in its own frame).

## 7.5 Lathe shapes

`LatheGeometry` turns a [radius, y] profile into a round object cheaply. Examples:

- the balloon envelope: 9 points × 14 segments, with checker vertex colours (red #d93f36 / cream #fff4e4) per panel;
- the village woman's dress: 11 points × 16 segments;
- her apron: a partial sweep of 1.4 rad.

Squash with scale.z = 0.78 for flat toy figures (the garment depth used here).

## Files

`src/world/village/*`, `src/world/station/*`, `src/world/windmill/*`, `src/geometry/building-wall-and-roof-vents.js`, `src/geometry/procedural-geometry-helpers.js`, `src/geometry/merge-static-geometry-by-material.js`, and `src/train/train-mesh-helpers.js`.

## Cost

The village builds in 30–47 ms. After merging, each house has 22 meshes (9 static, 1 glow, 12 puffs). The village totals 177 meshes (including the shrub layer), 96 of them smoke puffs, which are drawn even when their scale is 0.

## Pitfalls

- The merge only takes meshes with a uv attribute. `colorize()` deletes uv, so vertex-coloured parts are never merged by this helper. That is by design: it keeps attribute sets compatible.
- Animated parts (clock hands, rotor, heads, shutters if animated) must be in the excluded set or inside an excluded subtree.
- The merge works in the root's local frame and never bakes the root transform, so the root (a house, a train car, the balloon) can still be moved or animated afterwards.
- Pads change the ground that later candidates are tested on. The first house placed changes where the next one can go.
- Shrub heights are sampled before the windmill pad exists. Build anything that samples the ground after all pads are in place.
