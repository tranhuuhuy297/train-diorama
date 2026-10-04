# Diorama techniques catalogue

This is the index of a technique catalogue taken from Train Diorama, a build-free three.js scene (vanilla ES modules, three 0.186.0 through an import map, no bundler, no image textures). Each chapter covers what a technique shows on screen, how it works, the exact numbers used here, the files that implement it, what it costs and what went wrong.

The project is private and runs locally (`npm run dev`, then open the printed localhost URL). It is not published. Any static host could serve it unchanged (see `docs/deployment-guide.md`).

## Conventions used in these docs

- Paths are relative to `<workspace>/train-diorama`. Planning artifacts (phase specs, research, workflow scripts) are in `<workspace>/plans/<plan-dir>`.
- One world unit is about one toy metre. People are roughly 1–1.5 units tall and a cottage is 2–2.8 units wide.
- "sim time" means simulation seconds: the time-scale slider scales it and pause freezes it. "real time" means wall-clock seconds.
- **Parity-only** marks rules that exist only because this repo had to match the reference scene bit for bit (operand order, `Math.random` alignment). The other determinism rules (seeded streams, fixed build order) hold regardless.
- Sources of the measured numbers: node build timings come from the development machine (they vary by about ±30 % between runs). Renderer counts come from the parity probes (Chromium + SwiftShader, 1600×900, default overview, day).

## Chapters

| # | File | What it covers |
|---|---|---|
| 1 | [01-scene-composition-and-scale](techniques/01-scene-composition-and-scale.md) | the 124-unit floating slab, layer stack, object scale, layout map, 3/4 overview framing |
| 2 | [02-npr-cel-material-and-lighting-uniforms](techniques/02-npr-cel-material-and-lighting-uniforms.md) | shared uniform bag, `npr()` factory, cel bands, tinted shadows, stipple, night pass, emissive/night glow/local glow, sway, flowers, strata, fog |
| 3 | [03-sky-shadows-post-and-pixel-art](techniques/03-sky-shadows-post-and-pixel-art.md) | procedural sky dome, custom 2048² shadow pass with PCF, ink/grain/vignette/saturation post pass, Bayer pixel-art mode |
| 4 | [04-time-of-day-palettes](techniques/04-time-of-day-palettes.md) | the three palettes with every value, the 3 s blend, everything that reads `uNight` |
| 5 | [05-determinism-prng-and-noise](techniques/05-determinism-prng-and-noise.md) | mulberry32 streams, gradient noise + fbm, GPU value noise, draw-order discipline, golden tests |
| 6 | [06-terrain-river-track-and-bridge](techniques/06-terrain-river-track-and-bridge.md) | heightmap, river distance field, track shelf, flattening pads, vertex colours, skirt/plinth, spline frames, ballast/rails/sleepers, arch bridge |
| 7 | [07-buildings-and-props](techniques/07-buildings-and-props.md) | cottage generator, part tables, vents/windows/shutters, chimney smoke, hero station, canvas sign, windmill, lathe shapes |
| 8 | [08-scatter-systems-and-exclusion-zones](techniques/08-scatter-systems-and-exclusion-zones.md) | trees by species with instancing and a canopy height grid, rocks, shrubs, exclusion circles |
| 9 | [09-water-waterfall-clouds-and-balloon](techniques/09-water-waterfall-clouds-and-balloon.md) | height-texture water, waterfall curtain, cloud bands with drift and camera avoidance, balloon |
| 10 | [10-train-motion-and-effects](techniques/10-train-motion-and-effects.md) | train model, cars placed on chords, station-stop state machine, smoke pool, brake sparks, headlight cone and light pool, night glow sprites |
| 11 | [11-life-systems](techniques/11-life-systems.md) | bird flocks, sheep (pasture flock + trackside escape), station walker with leg IK, village residents |
| 12 | [12-cameras-and-frame-loop](techniques/12-cameras-and-frame-loop.md) | overview orbit + intro dolly, free fly, train fly-along rig, bridge tripod, frame loop, test hook |
| 13 | [13-hud-and-ui-patterns](techniques/13-hud-and-ui-patterns.md) | settings schema + localStorage, shortcuts, toast, loading step runner, night theme, debug menu |
| 14 | [14-performance-budget-and-scaling-up](techniques/14-performance-budget-and-scaling-up.md) | measured budget, where triangles and draw calls go, merge/instancing/scratch reuse, scaling to bigger or multiple slabs |

## Cheat sheet: the numbers that define the look

| Item | Value | Chapter |
|---|---|---|
| Slab | 124 × 124 units, heightmap 200 × 200 cells (0.62 unit each), skirt down to y −7, plinth below | 1, 6 |
| Overview camera | FOV 42, home (−55.522, 62.771, 130.519) → target (0, 4, 0), 153.5 units away, 22.5° above the horizon | 1, 12 |
| Other FOVs | Free 65, Train 48, Bridge 42 | 12 |
| Cel bands | lit amount = N·L × 1.15 × shadow + stipple; thresholds 0.16 and 0.46; sparkle band at ≥ 0.88 | 2 |
| Shadow tone | base colour × cool tint (day 0.5, 0.57, 0.78), never black | 2, 4 |
| Stipple | default amount 0.1 at scale 2; terrain 0.42/1.3, trees 0.55/2.4, ballast 0.5/5 | 2 |
| Fog | smoothstep from 110 to 420 units, capped at 85 % | 2 |
| Shadow map | 2048², ortho ±82, near 1 / far 360, 0.08 unit per texel, 3×3 PCF, bias 0.0006, normal offset 0.12 | 3 |
| Ink lines | depth Laplacian, smoothstep 0.006 → 0.02, ink = colour × (0.22, 0.20, 0.28), 90 % by day / 28 % at night | 3 |
| Pixel art | short side 720 / 540 / 360, nearest upscale, 15 levels per channel + 4×4 Bayer dither | 3 |
| Time of day | day / evening / night, 3 s smoothstep blend on real time | 4 |
| Seeds | world 42, noise tables 1337, birds 7821 | 5 |
| Frame loop | 120 fps cap, sim dt clamped to 0.05 s, time scale 0–2 | 12 |
| Budget (default overview, all passes) | 1371 calls frozen (1411 live with smoke puffs), 1.76–1.77 M triangles, 419 geometries, 6 textures, 25 programs | 14 |
| Build time | world 250–280 ms + train 33–46 ms in node (two runs); browser BUILD phase median 916 ms under SwiftShader | 14 |

## Anatomy of one frame

```
requestAnimationFrame
 └ cadence gate (at most 120 fps)       src/engine/frame-loop-scheduler.js
   ├ time-of-day blend (real dt)        src/engine/time-of-day-palettes-and-transition.js
   ├ world.nightAmount ← uNight
   ├ if !paused && timeScale > 0: stepSimulation(dt × timeScale)
   │   ├ uTime ← sim time
   │   ├ train: motion → car placement → sparks → smoke
   │   ├ world.update: clock, sheep, walker, residents, travelers, chimney smoke, rotor, clouds, balloon
   │   └ birds.update
   ├ camera rig (clamped real dt)
   ├ cloud camera avoidance (clamped real dt, also runs while paused)
   └ render: info reset → glow visibility → headlight uniforms → sky follows camera → updateMatrixWorld
             → shadow depth pass → main pass into a render target → post pass to the screen
```

## Anatomy of the build

World build steps run in a fixed order (`src/world/world-build-steps.js`). Node timings from two runs of the final build (run A totals 281 ms, run B 251 ms); the draw counts are exact and identical on every run:

| Step | ms (run A / run B) | `world.rand` draws | Notes |
|---|---|---|---|
| buildTrackFrames | 5.8 / 4.7 | 0 | spline + 1201 frames |
| findBridge | 4.2 / 3.4 | 0 | longest low run near the river |
| buildHeightmap | 39.4 / 51.2 | 0 | 201² vertices × nearest-track search |
| buildTrack | 16.0 / 16.0 | 0 | ballast, rails, 383 sleepers |
| buildBridge | 5.5 / 3.6 | 0 | deck, girders, arch |
| buildStation | 25.2 / 28.0 | 0 | hero building, figures, sign |
| buildVillage | 46.6 / 30.0 | 1024 | 8 cottages, pads, smoke traits, merges |
| buildWindmill | 4.1 / 3.0 | 600 | site search |
| buildTerrain | 57.1 / 36.4 | 0 | surface mesh, colours, skirt, height texture |
| createVillageResidents | 17.4 / 11.4 | 0 | 2 figures + dog |
| buildTrees | 35.6 / 33.8 | 76 963 | 14 000 attempts → 6665 trees |
| buildRocksAndSheep | 6.7 / 6.5 | 7 106 | 80 rocks, 24 + 3 sheep |
| buildWater | 0.3 / 0.4 | 0 | quad + waterfall |
| buildClouds | 3.0 / 8.3 | 2 854 | 33 clouds (the last `world.rand` consumer) |
| buildBalloon | 11.8 / 12.5 | 0 | merge |
| buildBirdPerches | 0.9 / 0.6 | 0 | 7 perches |

In total the world stream is drawn 88 547 times. After the world, `src/engine/diorama-scene-composition.js` adds, in this order, the birds (about 3 ms), the train (33–46 ms), the brake sparks, the sky, the smoke pool, the shadow-hidden list and the glow registry.

## Related docs

- `docs/system-architecture.md`: module contracts, construction order, per-frame order.
- `docs/code-standards.md`: file size, naming, comments, parity-critical rules.
- `docs/design-guidelines.md`: the 15-point style bible and the contact-sheet review.
- `docs/parity-testing-guide.md`: screenshot/probe harness, SwiftShader determinism rules, sign-off numbers.
- `docs/development-roadmap.md`: quirks kept on purpose (post-parity backlog).
