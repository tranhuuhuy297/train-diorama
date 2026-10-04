# Development roadmap

14 milestones, each gated by `npm test && npm run check:lines` and reviewed for parity before the
next one starts. Dependencies are listed as the milestones whose output a milestone reads or
extends. Releases 0.1.0–0.13.0 in `project-changelog.md` match milestones 1–13; 1.0.0 is milestone 14.

| # | Milestone | Depends on | Status |
|---|---|---|---|
| 1 | Scaffold, shell, HUD, settings, loading screen | — | Complete |
| 2 | Core math/noise, shared materials, geometry helpers | 1 | Complete |
| 3 | Real `Diorama` engine: render pipeline, cameras, shadow/post passes | 1, 2 | Complete |
| 4 | Debug menu, parity test harness, browser capture tooling | 1–3 | Complete |
| 5 | World: terrain, track, bridge | 2 | Complete |
| 6 | Station | 5 | Complete |
| 7 | Train model and motion | 2, 5 | Complete |
| 8 | Village and windmill | 6, 7 | Complete |
| 9 | Village residents, trees, rocks | 5, 8 | Complete |
| 10 | Free-fly camera completion, train fly-along, bridge camera | 3 | Complete (headed pointer-lock check pending) |
| 11 | Sheep (pasture + trackside flee/return) | 5, 9 | Complete |
| 12 | Water, clouds, balloon | 5 | Complete |
| 13 | Station travellers, birds | 6, 9 | Complete |
| 14 | Full-scene parity sign-off, performance budget, docs, deployment prep | 1–13 | Complete (not deployed; repository private) |

### 1. Scaffold, shell, HUD, settings, loading screen

A runnable shell: the loader resolves, the HUD is fully interactive, settings persist, and
`src/engine/diorama.js` starts as a facade stub that the real engine later replaces at the same
path without changing its public surface.

### 2. Core math/noise, shared materials, geometry helpers

The pure runtime libraries every scene module depends on: seeded PRNG/noise, the shared lighting
uniform bag, the NPR cel-shader GLSL + cached factory, the night glow/cone effects and the
per-material static-geometry merge, plus the original-source oracle fetcher and node-side parity
harness. Nothing renders in the app yet; the shell's facade still boots unchanged.

### 3. Real `Diorama` engine

Replaces the facade with the real engine: `WebGLRenderer`, the 120fps deadline frame loop, the
three time-of-day palettes and their 3s blend, the procedural sky dome, a custom 2048² shadow depth
pass, the ink/saturation/grain-or-Bayer/vignette post pass, pixel-art render resolution, and the
overview `OrbitControls` with its dolly-in intro and double reset. World, train and birds are not
built yet: their constructor/composition/frame-loop insertion slots are reserved and documented, and
the later scene milestones fill them by editing the engine's own files at those slots
(`diorama.js`, `diorama-scene-composition.js`, `frame-loop-scheduler.js`, `simulation-step.js`,
`render-pipeline.js`, the camera files) without changing the facade's public surface. The app
renders the sky and HUD and responds to every shortcut; deterministic sky/post pixel parity against
the original waits for the browser capture harness.

### 4. Debug menu and parity harness

Ships the `···` debug menu and the opt-in `?parity` hook, and builds the parity toolchain every
later milestone proves itself with: the node oracle (original World stepper, simulation oracle,
scene-graph signatures) and the browser harness (frozen seeded captures of the live original vs the
clone, pixel compare, runtime probe). Stage `shell-and-sky` is gating and fully green; the `train`
and `full-scene` shots are listed and become gating as those features land (see
`parity-testing-guide.md`).

### 5. World: terrain, track, bridge

Builds the static world core behind an ordered build-step registry (`world-build-steps.js`; the
station, village and windmill are later inserted before `buildTerrain` and the rest after it): the
closed centripetal track spline (1201 frames, length 276.136), bridge span detection ([30, 178]),
the graded heightmap with a cached nearest-track grid, rotated building pads, the vertex-coloured
terrain with meadow flowers, the strata skirt, the wooden plinth, the R8 water height texture,
ballast/rails/383 sleepers and the red arch bridge. Node parity against the original is byte-exact
on every output array and query, scene signatures are equal, construction draws the same 444
`Math.random` values (UUIDs) on a warm build, and the clone builds ~20 % faster. The two
`world-core-*` browser shots stay report-only until the original's station, house and windmill pads
exist on the clone too.

### 6. Station

Adds the Mossbrook station as build step 6: placement on track frame 1008 (stop distance 236.455),
platform, shelter, bench, the merged station building with its prism roof, vents, shuttered windows
and animated wall clock, the name board with the canvas sign, lamps with night halos, luggage,
stairs with railings and the footpath ribbon, plus both building pads and the 27 keep-out circles.
The platform extension is baked into each coordinate with the original's exact floats.
`World#update` and the fixed-slot `updateWorld` orchestrator land with the clock in slot 1, driven
from `stepSimulation`. Node parity is bit-identical (the station figures are excluded until the
travelers exist); the two station closeup shots are pixel-identical to the original and the station
probe matches on both sites, including the sign canvas hash.

### 7. Train model and motion

Adds the train: locomotive (boiler, glazed cab, driver and raven, smokebox front, cowcatcher, three
lamps with halos and the headlight cone), tender and four coaches, built from part tables in the
original's exact order, merged per car with the wheels left to spin, spaced 0.45 apart and placed
each step on the chord between two track points. The station-stop motion (cruise 7.5 × speed
slider, √ braking ramp over 26 units, exact snap, 4 s dwell), the 70-puff chimney smoke and the
269-streak brake sparks live in `src/train/` behind the Diorama parity surface; `stepSimulation`
feeds the world the real locomotive position and motion record, and every render writes the
headlight uniforms. Node parity is bit-identical: train signature and merged buffers, 1000
placements, and 18000 oracle frames (motion, strength, puffs, spark matrices) with `Math.random`
replayed per side. The seven `train` stage shots are pixel-identical to the original and the
train-only probe matches on calls and triangles; `ACTIVE_PARITY_STAGE` becomes `train`.

### 8. Village and windmill

Adds the village and the windmill as build steps 7–8, the first consumers of the seeded world
stream: up to eight cottages ringed around the pond (eight placed in 256 tries, 1024 draws), each
with a levelled pad, walls, prism roof in the 5-colour cycle, vents, chimney, door and trim, two
flower-box windows with angle-cycled shutters and night halos, 12 chimney puffs, and a per-house
merge into 9 draws; six instanced shrubs per house; then the windmill on the highest clear spot of
the eastern hill (600 draws), unmerged (65 meshes) with doorway, steps, two hay-bale stacks and the
4-armed rotor, plus `windmillRoofHeight` for the later cloud layers. `updateWorld` slots 8 (smoke)
and 9 (rotor) are live. Node parity is bit-identical (stream position, transforms, heights, pads,
exclusions, shrub buffers, signatures, 600 frames of smoke and rotor); the four regional
`village-and-windmill` shots and the now-strict `world-core-*` shots are pixel-identical to the
original, and draw calls/triangles match under the `unbuiltAfterWindmill` hide set.
`ACTIVE_PARITY_STAGE` becomes `village-and-windmill`.

### 9. Village residents, trees, rocks

Adds build steps 10–12 after the terrain bake. The village residents stand on copies of the first
two cottage frames: the woman (shorter, in a lathe dress with apron) paces her yard on a 28 s loop,
the bare-chested man idles with his dog, and their two yards become r2.2 keep-out circles. The
forest scatters 14000 candidate spots (seeded world stream) into 3749 conifers, 1215 round trees,
932 clusters and 769 bushes (108 autumn and 51 blossom accents), drawn as four instanced layers
that sway in the vertex shader, and stamps every instance into a 70×70 canopy height grid behind
`World#treeCanopyHeightAt` (for the fly-along camera and the birds). Eighty riverside rocks follow
on the same stream. `updateWorld` slots 5–6 are live. Node parity is bit-identical (tree and rock
buffers, canopy grid and 10 000 queries, stream continuation, resident signatures and 60 s of
resident poses, whole `world.group` signature); the eight `residents-and-forest` shots (the full
scene with the not-yet-built systems masked on both sites, plus the two free-camera station starts,
now strict) match the original (mean diff 0.000, max channel diff ≤ 1), sway animates and freezes
while paused on both sites, and the probe's tree, rock and resident counts match.
`ACTIVE_PARITY_STAGE` becomes `residents-and-forest`.

### 10. Cameras: free fly, train fly-along, bridge

Completes the camera-mode director. Free mode (key 2) locks the pointer on a canvas click and
flies with WASD, Space/C and Shift, clamped to the diorama box and above the ground only while
moving; its pose is saved on leaving and restored on return, starting from the station platform.
The train camera (key 3) hangs a rig off the driver's cab that drifts on 31/23/41 s sines, pulls
out to a wide shot every 56 s and climbs over hills and tree tops with a 0.8 s look-ahead; the
bridge camera (key 4 / B) is a riverbank tripod that pans after the train. Side and bridge glide
in; overview and free mode snap. Node parity against the original is exact (0 difference over
11 708 frames covering every mode, the wide-shot peak, the station dwell, pause, dt 0, time scale
2 and every free-flight clamp), and the `--camera-ui` browser probe answers identically on both
sites. Still pending: the manual headed pointer-lock checklist (real lock, Esc release, WASD
flight; headless Chromium rejects `lock(true)`), see `parity-testing-guide.md`.

### 11. Sheep

Adds the sheep flock. Twenty-four sheep graze the meadows (seeded world stream, right after the
rocks): they wander, turn away from ground they may not enter, and lie down with folded legs as
night falls. Three more graze on the rails at the clearing nearest the flock; when the train comes
they startle, crouch, hop 3.5 m clear, wait until the line has been clear for 5–6.3 s and walk back,
logging `[SHEEP] Startles / Jumps off track / Returns to track` lines. Node parity is bit-identical
(the build after step 12 including the whole `world.group`, 60 s against a synthetic train, and
410 s of the real train against the original sim oracle with a night ramp, the fastest train and
doubled time scale); the five sheep shots are pixel-identical and the probe's sheep section,
including the hop frames K = [785, 824, 840], matches. `sheep` left the `cloneMissing` preset.

### 12. Water, clouds, balloon

Adds the water, the clouds and the balloon. One board-sized quad carries the pond and river: its
shader keeps only fragments where the baked height texture is below 0.08 and colours them by depth,
with two-octave ripples, shore foam, cloud shadows, a night palette and the headlight. The river
falls off the front edge as an 8 × 24 curtain with scrolling streaks, foamy sides and a splash at
the foot. Thirty-three clouds in three bands (high, far and a low bank below the front edge) drift
east on sim time, shrink out at the band edges and wrap; on real time, even while paused, a cloud
the camera flies into is pushed clear and glides back (τ ≈ 0.56 s). The red/cream harlequin balloon
with its woven basket, goggled pilot and sandbags orbits the board, bobs, spins and flickers its
burner flame, lit at night by its local glow and a burner halo. Clouds are the last `world.rand`
consumer: the next draw after a full build is 0.23735972004942596 on both sides, the 33 clouds
match bit for bit, the whole `world.group` signature matches (only the original's station figures
excluded), the UUID draws per step are 24 / 2128 / 2940 on both sides, and 300 sim-seconds of
drift, camera pushes and flight match exactly. The water, waterfall and balloon left the
`cloneMissing` preset, which then hid only the birds and the station figures.

### 13. Station travellers and birds

Adds the remaining ambient life. An old traveler in a blue coat and hat walks the widened platform
with his cane between three stops (wait, turn on the spot, short IK-driven steps; the cane is
resized every frame to touch the floor), logging `[STATION] Traveler walks / arrives: stop N`. A
grandmother with spectacles, a bun and a handbag waits by her suitcase stack; both sway idly and
turn their heads toward an approaching locomotive. Seven bird flocks (18 birds) sit on the bridge
rails, the station roof and the grass beside the track; they take off when the train approaches,
circle, return when the track is clear and land, logging `[BIRDS]` lines. All perches come from one
last build step with bit-identical records. Node parity is bit-identical: first-build draw counts
2532 / 948 / 4, the whole `world.group` signature with the travelers, flock init, and 180
sim-seconds (plus 60 s at sim dt 0.1) of every bird, flock, walker and grandmother transform, with
identical `[BIRDS]` / `[STATION]` / `[VILLAGE]` lines per frame. The three new shots are
pixel-identical, `cloneMissing` is retired, the active stage is `full-scene`, and the frozen default
overview matches the original's renderer counts exactly (1373 / 1,762,696 / 419 / 6 / 25 at that
point).

### 14. Full-scene parity sign-off (release 1.0.0)

Signs the clone off as release 1.0.0. In node, the whole scene (1201 signature entries: world,
birds, train, sparks, sky, 70 puffs) is identical to the original oracle, as are the ordered lists
(scene children, glow registry, shadow-hidden list), the world summary and the next `world.rand()`
draw; 10 800 lockstep frames across overview, train, bridge, free, night and a 2.5× train keep every
scalar bitwise equal with identical `[SHEEP]` / `[BIRDS]` / `[STATION]` / `[VILLAGE]` lines. In the
browser, 21 full-page 3D shots and 7 DOM shots, the 8 frozen probe states, the performance budget,
the research recapture and the smoke check are run against the original; results are recorded in
`parity-testing-guide.md` ("Sign-off results"; the frozen default overview there is
1371 / 1,759,388 / 419 / 6 / 25 on both sites, and the live debug-menu readout with puffs is about
1411 calls / 1,773,736 triangles). A Vercel deploy is prepared (config, analytics gate, deployment
guide) but not made. The GitHub Pages site that followed `main` from 2026-10-02 was removed on
2026-10-04, when the repository went back to private; the project is local-only now.

## Post-parity backlog (out of scope; each changes a parity baseline and needs approval)

Quirks kept on purpose so the clone matches the reference. Fixing any of them is a deliberate
departure from parity.

| # | quirk | where | possible fix |
|---|---|---|---|
| 1 | Right-click on a toggle toasts the stale label | HUD bindings | use the post-render label |
| 2 | X returns to 1× instead of the previous scale | keyboard / HUD actions | remember the previous scale |
| 3 | `paused`, mode and HUD visibility persist; a reload may start paused or hidden while the "H · Hide HUD" toast still shows | settings / boot | do not persist `paused`; skip the toast when hidden |
| 4 | Time slider toasts on every input event; focused inputs swallow shortcuts | HUD bindings / keyboard | toast on change; blur on Esc |
| 5 | Free-camera toast is nowrap and overflows its box on desktop | toast CSS | allow wrapping |
| 6 | `PointerLockControls.lock(true)` rejection is uncaught, so Free never locks where unadjusted movement is unsupported | free-fly camera | fall back to `lock()` |
| 7 | Time of day uses unclamped real dt (instant after a background tab) | time of day | clamp realDt |
| 8 | Free camera clamps apply only while moving | free-fly camera | clamp every frame |
| 9 | Fly-along elapsed time uses real dt, so its periods ignore the time scale; the side is chosen once at entry | train camera | use sim dt; re-pick the side |
| 10 | The bridge camera overwrites `controls.target`; re-pressing 2 in Free re-logs, re-toasts and re-saves | camera director | keep the target; ignore same-mode presses |
| 11 | Tree sway is absent from shadows | shadow pass | sway-aware depth material |
| 12 | The 70-puff pool is exhausted at top speed (emission silently skipped) | smoke pool | larger pool |
| 13 | Brake-strength spike when the speed slider drops while braking (capped at 1); dt 0 gives strength 1 | motion controller | rate-limit; guard dt 0 |
| 14 | Coupling rods stay still while the wheels turn; `s` is never wrapped | wheels / motion | animate rods; wrap s |
| 15 | Sleeper seam gap just before s = 0 | track | even spacing |
| 16 | Height-texture half-texel offset shifts the shoreline by up to 0.3; 8-bit quantisation | terrain / water | align texel centres |
| 17 | Station sign renders darker (sRGB texture), stays bright at night, ignores fog and shadows | station sign | NPR sign material |
| 18 | Sign font race falls back to sans-serif when Fredoka is late | station sign | await the font before the build |
| 19 | Hard throws at boot (fewer than 2 houses; no flock site) | village / sheep | logged fallbacks |
| 20 | Pasture sheep with no ground height sink toward y = 0 | sheep locomotion | keep the last height |
| 21 | Track-sheep danger ignores train speed; the station-roof flock circles through the 4 s dwell; trackside-1 is a dead cluster | sheep FSM / birds | speed-aware checks |
| 22 | Scale-0 clouds and puffs still issue draw calls; cloud wrap zeroes the avoidance offset; avoidance assumes uniform scale | clouds / smoke | hide at scale 0 |
| 23 | Sheep clearings are excluded after the trees (overlaps possible); rocks and trees ignore each other | build order | exclude before scattering (changes layout) |
| 24 | OrbitControls damping is per frame (feel depends on frame rate) | overview camera | dt-based damping |
| 25 | Bird bank angle depends on dt; the walker's shoe has no ankle pitch; head-look distance is measured from the figure origin | birds / station life | dt-independent bank; ankle; head origin |
| 26 | Residents turn 0 → 0.2 rad at load; the woman's non-uniform scale shades with unnormalised normals | village residents | settle pose; normal matrix |
| 27 | The waterfall drops to y ≈ −18; balloon yaw ignores its heading; burner and flame sit outside the local glow | water / balloon | trim; face heading; include them |
| 28 | Shrub heights are sampled before the windmill pad; shutter angles repeat every 4 houses; the windmill is unmerged (65 draws per pass) | village / windmill | sample after pads; merge |

Other follow-ups needing approval: CI parity job against the cached original, subresource
integrity in the import map, `modulepreload` hints for the unbundled module graph (LOAD ENGINE was
faster than the original's in the sign-off run, but that compared localhost with a remote deploy), and
any public deploy (the repository is private).

## Next

Repo-internal follow-ups, in no particular order:

- **Post-parity optional fixes:** any item of the backlog above, only with the owner's approval,
  since each one changes a parity baseline (the plan folder's `post-parity-optional-fixes.md` holds
  the details).
- **Manual headed pointer-lock check:** run the checklist in `parity-testing-guide.md` (probe
  section) once in a real browser with `npm run dev` and record the date and browser.
- **Before any Vercel deploy:** add `CLAUDE.md` to `.vercelignore` so agent notes never ship.
- **README controls table:** list L (logs the current camera pose to the console).
- **Other follow-ups needing approval:** listed above (CI parity job, subresource integrity,
  `modulepreload` hints, any public deploy).

Follow-up projects are tracked outside this repository.
