# 1. Scene composition and scale

[Index](../diorama-techniques.md)

## What it achieves

The scene is a cosy "cake slice" of landscape floating in the sky. A square board has a grassy top, a layered soil cut-away on all four sides and a wooden plinth underneath. A river notches the front edge and falls off it as a waterfall, and clouds drift around and below the slab. From the 3/4 overview it reads as a toy diorama on a turntable.

## The slab, top to bottom

| Layer | y range | How it is built | File |
|---|---|---|---|
| Clouds, high band | windmill roof + 15 … + 25, about 37–47 | instanced blob clusters | `src/world/sky/cloud-field-spawner.js` |
| Balloon | 27 ± 1.2 | merged model on an elliptical orbit | `src/world/balloon/*` |
| Terrain top | −1.4 (river bed) … about 20 (rim) | 201 × 201 vertex grid with vertex colours | `src/world/terrain/terrain-surface-mesh-and-vertex-colors.js` |
| Water plane | y = 0 | one 124 × 124 quad; the shader keeps only wet fragments | `src/world/water/river-water-and-waterfall-builder.js` |
| Skirt | surface rim → −7 | four vertical walls with the strata shader | `src/world/terrain/terrain-skirt-plinth-and-water-height-texture.js` |
| Plinth | wood −7.0 … −8.8, trim −8.8 … −9.3 | two boxes | same file |
| Waterfall | 0.02 → −18 | curved curtain off the +z edge | `src/world/water/river-water-and-waterfall-builder.js` |
| Low cloud bank | −4 … 0, z from HALF + 10 to HALF + 28 | 18 clouds below and in front of the slab | `src/world/sky/cloud-field-spawner.js` |
| Sky dome | radius 700, follows the camera | procedural shader | `src/materials/procedural-sky-dome-material.js` |

Constants in `src/world/world-constants.js`: `SIZE = 124`, `HALF = 62`, `SEG = 200`, `STEP = 0.62`, `BOTTOM = −7`.

## Layout map (top view: +x to the right, +z toward the default camera)

| Feature | Position | Notes |
|---|---|---|
| Pond | centre (−4, −6), radius 8 | the village rings it |
| River | polyline (−4, −6) → (2, 10) → (−3, 24) → (1, 36) → (0, 75) | runs out of the front edge (+z), so the waterfall faces the camera |
| Track loop | 14 control points, front straight at z = 36, y 9–10.6 | counter-clockwise from above, 276.14 units long |
| Bridge | track frames 30–178, where the loop crosses the river | red arch over the valley |
| Station | track sample nearest to (−45.5, −2) | west side; the train stops 4.5 units past the platform centre |
| Village | 8 cottages on a ring 11–25 units from the pond centre | houses face the pond |
| Hills | Gaussians at (−24, −16), height 11, and (24, −10), height 9 | the windmill takes the highest spot near (24, −10) |
| Rim | +11 units, ramping from 60 % to 130 % of HALF radius | turns the board into a shallow bowl that frames the centre |

The design rule: every hero object sits on or next to the moving element (the train loop), so the camera always has something alive in frame. The river and waterfall give the front edge a focal point.

## Object scale (toy compression)

| Object | Size (units) |
|---|---|
| Locomotive | 4.6 long |
| Whole train | 27.95 long from buffer to buffer (loco 4.6, tender 2.7, 4 coaches of 4.6, 5 gaps of 0.45); `Train.totalLength` = 25.65 is measured from the loco centre to the tail |
| Track | rails at ±0.52; ballast 2.7 wide at the base |
| Station building | 3.2 × 5 × 6 box + prism roof |
| Cottage | width 2–2.8, depth 2.2–3.2, walls 1.6–2.4 high |
| Windmill | tower 5.5, about 7.1 with the cap; rotor spars 3.6 |
| Trees | base models about 3–3.6 tall (bush about 0.9), scaled 0.75–1.5 (vertical × 0.9–1.2 more) |
| People | roughly 1–1.5 tall (station figures scaled 0.7–0.8, village figures 0.8; the woman also × 0.7 in y) |
| Sheep | about 1.5 long at scale 1, scaled 0.9–1.3 |
| Birds | rig scale 0.41–0.52 |

Buildings are deliberately small next to the people and the train. This compression is what makes the scene read as a model railway rather than a landscape.

## Camera framing (overview)

| Parameter | Value | Why |
|---|---|---|
| FOV | 42° vertical | a longer lens flattens perspective and gives the toy look |
| Home position | (−55.522, 62.771, 130.519) | 153.5 units from the target, azimuth −23°, elevation 22.5° |
| Target | (0, 4, 0) | slightly above the board centre |
| Zoom range | min 25, max 240 | |
| Max polar angle | 1.5 rad (86°) | never look from under the slab |
| Turntable | autoRotateSpeed −0.245, about one turn per 245 s | slow enough to read as ambient motion |
| Intro | 3.2 s dolly from 1.22× the distance, quintic ease | first impression |
| Near / far | 0.3 / 1500 | the 700-radius sky dome must stay inside far |

At 153.5 units and FOV 42, the visible height at the target is about 118 units. The 124-unit board (175 on the diagonal) therefore fills a 16:9 frame and leaves a margin of sky and clouds.

## Files

- `src/world/world-constants.js`: sizes, pond, river, track control points.
- `src/engine/cameras/overview-orbit-camera.js`: framing, intro, reset.
- `src/engine/diorama.js`: camera near/far and renderer setup.

## Cost

Composition itself costs nothing at runtime. It does set the triangle budget (the terrain grid is 80 000 triangles per pass) and the shadow frustum (±82 covers the 124 board, see chapter 3).

## Pitfalls

- Many numbers are sized for SIZE = 124 but written as literals, not derived from SIZE: the shadow frustum (±82), the fog distances (110/420), the cloud travel widths and z ranges, the overview home pose and zoom limits. The free-fly clamp (±61) and the canopy grid (±70) are derived from HALF. If SIZE changes, audit every one of them (chapter 14 lists them).
- A waterfall appears only where the river bed is below 0 on the last heightmap row. Moving the river moves the waterfall, or removes it.
- The intro writes `camera.position` directly and bypasses the OrbitControls limits. With a home pose farther than about 197 units, the intro start (1.22× the home distance) lies beyond maxDistance 240; the controls only apply their limits once the intro ends.
