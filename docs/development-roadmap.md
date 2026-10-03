# Development roadmap

14 phases, each gated by `npm test && npm run check:lines` and reviewed for parity before the
next phase starts. Dependencies are listed as the phases whose output a phase reads or extends.

| Phase | Name | Depends on | Status |
|---|---|---|---|
| P01 | Scaffold, shell, HUD, settings, loading screen | — | Complete |
| P02 | Core math/noise, shared materials, geometry helpers | P01 | Complete |
| P03 | Real `Diorama` engine: render pipeline, cameras, shadow/post passes | P01, P02 | Complete |
| P04 | Debug menu, parity test harness, browser capture tooling | P01–P03 | Complete |
| P05 | World: terrain, track, bridge | P02 | Complete |
| P06 | Station | P05 | Complete |
| P07 | Train model and motion | P02, P05 | Complete |
| P08 | Village and windmill | P06, P07 | Complete |
| P09 | Village residents, trees, rocks | P05, P08 | Complete |
| P10 | Free-fly camera completion, train fly-along, bridge camera | P03 | Complete (headed pointer-lock check pending) |
| P11 | Sheep (pasture + trackside flee/return) | P05, P09 | Complete |
| P12 | Water, clouds, balloon | P05 | Complete |
| P13 | Station travellers, birds | P06, P09 | Complete |
| P14 | Full-scene parity signature, deployment prep | P01–P13 | Pending |

P01 delivers a runnable shell: the loader resolves, the HUD is fully interactive, settings
persist, and `src/engine/diorama.js` is a facade stub that P03 replaces at the same path without
changing its public surface.

P02 delivers the pure runtime libraries every scene module depends on: seeded PRNG/noise, the
shared lighting uniform bag, the NPR cel-shader GLSL + cached factory, the night glow/cone
effects and the per-material static-geometry merge — plus the original-source oracle fetcher and
node-side parity harness. Nothing renders in the app yet; the P01 facade still boots unchanged.

P03 replaces the P01 facade with the real engine: `WebGLRenderer`, the 120fps deadline frame
loop, the three time-of-day palettes and their 3s blend, the procedural sky dome, a custom
2048² shadow depth pass, the ink/saturation/grain-or-Bayer/vignette post pass, pixel-art render
resolution, and the overview `OrbitControls` with its dolly-in intro and double reset. World,
train and birds are not built yet — their constructor/composition/frame-loop insertion slots are
reserved and documented; P05–P13 fill them by editing this phase's own files at those slots
(`diorama.js`, `diorama-scene-composition.js`, `frame-loop-scheduler.js`, `simulation-step.js`,
`render-pipeline.js`, the camera files) without changing the facade's public surface. The app now
renders the sky and HUD and responds to every shortcut; deterministic sky/post pixel parity
against the original is deferred to the P04 capture harness.

P04 ships the `···` debug menu and the opt-in `?parity` hook, and builds the parity toolchain
every later phase proves itself with: the node oracle (original World stepper, simulation oracle,
scene-graph signatures) and the browser harness (frozen seeded captures of the live original vs
the clone, pixel compare, runtime probe). Stage `shell-and-sky` is gating and fully green; the
`train` and `full-scene` shots are listed and become gating as those features land (see
`parity-testing-guide.md`).

P05 builds the static world core behind an ordered build-step registry (`world-build-steps.js`;
later phases insert station/village/windmill before `buildTerrain` and the rest after it): the
closed centripetal track spline (1201 frames, length 276.136), bridge span detection ([30, 178]),
the graded heightmap with a cached nearest-track grid, rotated building pads, the vertex-coloured
terrain with meadow flowers, the strata skirt, the wooden plinth, the R8 water height texture,
ballast/rails/383 sleepers and the red arch bridge. Node parity against the original is
byte-exact on every output array and query, scene signatures are equal, construction draws the
same 444 `Math.random` values (UUIDs) on a warm build, and the clone builds ~20 % faster. The
two `world-core-*` browser shots are report-only until the original's station, house and
windmill pads exist on the clone too (P06/P08).

P06 adds the Mossbrook station as build step 6: placement on track frame 1008 (stop distance
236.455), platform, shelter, bench, the merged station building with its prism roof, vents,
shuttered windows and animated wall clock, the name board with the canvas sign, lamps with night
halos, luggage, stairs with railings and the footpath ribbon, plus both building pads and the 27
keep-out circles. The platform extension is baked into each coordinate with the original's exact
floats. `World#update` and the fixed-slot `updateWorld` orchestrator land with the clock in slot 1,
driven from `stepSimulation`. Node parity is bit-identical (figures excluded until P13); the two
station closeup shots are pixel-identical to the original and the station probe matches on both
sites, including the sign canvas hash.

P07 adds the train: locomotive (boiler, glazed cab, driver and raven, smokebox front, cowcatcher,
three lamps with halos and the headlight cone), tender and four coaches, built from part tables
in the original's exact order, merged per car with the wheels left to spin, spaced 0.45 apart
and placed each step on the chord between two track points. The station-stop motion (cruise
7.5 × speed slider, √ braking ramp over 26 units, exact snap, 4 s dwell), the 70-puff chimney
smoke and the 269-streak brake sparks live in `src/train/` behind the Diorama parity surface;
`stepSimulation` now feeds the world the real locomotive position and motion record, and every
render writes the headlight uniforms. Node parity is bit-identical: train signature and merged
buffers, 1000 placements, and 18000 oracle frames (motion, strength, puffs, spark matrices) with
`Math.random` replayed per side. The seven `train` stage shots are pixel-identical to the
original and the train-only probe matches on calls and triangles; `ACTIVE_PARITY_STAGE` is now
`train`.

P08 adds the village and the windmill as build steps 7–8, the first consumers of the seeded world
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
`ACTIVE_PARITY_STAGE` is now `village-and-windmill`.

P09 adds build steps 10–12 after the terrain bake. The village residents stand on copies of the
first two cottage frames: the woman (shorter, in a lathe dress with apron) paces her yard on a 28 s
loop, the bare-chested man idles with his dog, and their two yards become r2.2 keep-out circles.
The forest scatters 14000 candidate spots (W4) into 3749 conifers, 1215 round trees, 932 clusters
and 769 bushes (108 autumn and 51 blossom accents), drawn as four instanced layers that sway in the
vertex shader, and stamps every instance into a 70×70 canopy height grid behind
`World#treeCanopyHeightAt` (for the fly-along camera and the birds). Eighty riverside rocks (W5a)
follow. `updateWorld` slots 5–6 are live. Node parity is bit-identical (tree and rock buffers,
canopy grid and 10 000 queries, stream continuation, resident signatures and 60 s of resident
poses, whole `world.group` signature); the eight `residents-and-forest` shots (the full scene with
the not-yet-built systems masked on both sites, plus the two free-camera station starts, now
strict) match the original (mean diff 0.000, max channel
diff ≤ 1), sway animates
and freezes while paused on both sites, and the probe's tree, rock and resident counts match.
`ACTIVE_PARITY_STAGE` is now `residents-and-forest`.

P10 completes the camera-mode director. Free mode (key 2) locks the pointer on a canvas click and
flies with WASD, Space/C and Shift, clamped to the diorama box and above the ground only while
moving; its pose is saved on leaving and restored on return, starting from the station platform.
The train camera (key 3) hangs a rig off the driver's cab that drifts on 31/23/41 s sines, pulls
out to a wide shot every 56 s and climbs over hills and tree tops with a 0.8 s look-ahead; the
bridge camera (key 4 / B) is a riverbank tripod that pans after the train. Side and bridge glide
in; overview and free mode snap. Node parity against the original is exact (0 difference over
11 708 frames covering every mode, the wide-shot peak, the station dwell, pause, dt 0, time scale
2 and every free-flight clamp), and the `--camera-ui` browser probe answers identically on both
sites. Still pending: the manual headed pointer-lock checklist (real lock, Esc release, WASD flight;
headless Chromium rejects `lock(true)`), see docs/parity-testing-guide.md.

P11 adds the sheep flock. Twenty-four sheep graze the meadows (W5b, right after the rocks): they
wander, turn away from ground they may not enter, and lie down with folded legs as night falls.
Three more graze on the rails at the clearing nearest the flock; when the train comes they startle,
crouch, hop 3.5 m clear, wait until the line has been clear for 5–6.3 s and walk back, logging
`[SHEEP] Startles / Jumps off track / Returns to track` lines. Node parity is bit-identical (the
build after step 12 including the whole `world.group`, 60 s against a synthetic train, and 410 s
of the real train against the original sim oracle with a night ramp, the fastest train and doubled
time scale); the five sheep shots are pixel-identical and the probe's sheep section, including the
hop frames K = [785, 824, 840], matches. `sheep` left the `cloneMissing` preset.

P12 adds the water, the clouds and the balloon. One board-sized quad carries the pond and river: its
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
`cloneMissing` preset, which then hid only the birds and the station figures (retired in P13).

P13 adds the remaining ambient life. An old traveler in a blue coat and hat walks the widened
platform with his cane between three stops (wait, turn on the spot, short IK-driven steps; the cane
is resized every frame to touch the floor), logging `[STATION] Traveler walks / arrives: stop N`.
A grandmother with spectacles, a bun and a handbag waits by her suitcase stack; both sway idly and
turn their heads toward an approaching locomotive. Seven bird flocks (18 birds) sit on the bridge
rails, the station roof and the grass beside the track; they take off when the train approaches,
circle, return when the track is clear and land, logging `[BIRDS]` lines. All perches come from one
last build step with bit-identical records. Node parity is bit-identical: first-build draw counts
2532 / 948 / 4, the whole `world.group` signature with the travelers, flock init, and 180 sim-seconds
(plus 60 s at sim dt 0.1) of every bird, flock, walker and grandmother transform, with identical
`[BIRDS]` / `[STATION]` / `[VILLAGE]` lines per frame. The three new shots are pixel-identical,
`cloneMissing` is retired, the active stage is `full-scene`, and the frozen default overview now
matches the original's renderer counts exactly (1373 / 1,762,696 / 419 / 6 / 25).
