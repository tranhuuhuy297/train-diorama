# Parity testing guide

How this repo proves that the independent re-implementation looks and behaves like the reference
site without ever using the reference as a text source. The same method (a black-box oracle in node,
frozen seeded captures in the browser, exact probes, a performance budget) is described below.

## 1. Purpose and the three layers

The clone was written from specs (tables, formulas, contracts). The reference is used only at
runtime, as a black-box oracle:

| Layer | Where | What it proves |
|---|---|---|
| Node parity | `tests/parity/*.test.mjs`, the cache-gated cases in `tests/unit/`, `tests/helpers/*` | reference modules from `.parity-cache/original` run in node: World build steps, scene-graph signatures, a seeded simulation oracle stepped in lockstep with the clone |
| Browser captures | `tools/parity/capture-…`, `compare-…` | the live reference and the local clone, frozen in identical seeded states, screenshotted and pixel-diffed |
| Runtime probe | `tools/parity/runtime-counts-probe.mjs` | `renderer.info`, world and sim fields, post-pass outputs, hook and debug-menu behaviour on both sites |

**Independence rule:** nothing from the reference's JS/CSS/GLSL/HTML/SVG is copied into the repo.
Helpers never modify the reference modules on disk; the browser hook is our own snippet inserted into
the reference's response inside the test browser only. Code comments never cite the reference's files
or lines.

## 2. Setup

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install   # or plain npm install
npx playwright install chromium                 # or point CHROMIUM_PATH at a full Chromium/Chrome
npm run parity:fetch                            # reference modules → .parity-cache/original (TARGET_URL overrides)
```

| Variable | Default | Purpose |
|---|---|---|
| `TARGET_URL` | `https://train-diorama.vercel.app/` | the reference site (fetch and browser runs) |
| `CLONE_URL` | a static server auto-started on port 4317 | the clone under test |
| `CHROMIUM_PATH` | Playwright's Chromium | a full Chromium/Chrome binary (never the headless shell) |
| `PARITY_RESEARCH_DIR` | `../plans/260930-train-diorama-clone/research` relative to the repo | reference PNGs and the research capture logs |
| `PARITY_SKIP_PERF` | unset | `1` skips the node build-time comparison on a loaded machine |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | unset | sent only to the site's own origin for protected Vercel previews |

The research directory lives outside the repo (reference PNGs, `captures/capture-log.json` and
`capture-log-extras.json` with L-key poses). It is resolved only by `resolveResearchDir()` in
`tools/parity/research-capture-paths.mjs`. When it is absent, reference checks skip with
`research captures not found at … — set PARITY_RESEARCH_DIR` and the compare report writes
`referencePath: null`.

## 3. Node parity

| Helper | API |
|---|---|
| `original-module-loader.mjs` | `originalSkipReason([...files])` → `false` or a skip message; `importOriginal(file)`; `extractGlslInterface` |
| `minimal-dom-shim.mjs` | `installMinimalDomShim()` → `{canvases}` (idempotent); canvases record every 2D-context set/call in `operations` |
| `original-world-stepper.mjs` | `ORIGINAL_BUILD_STEPS` (14), `CLONE_TO_ORIGINAL_STEP`, `INLINE_ORIGINAL_STEPS`, `toOriginalStep`, `buildOriginalWorld({stopAfter, skip})` → `{world, stoppedAfter, milliseconds}` |
| `original-simulation-oracle.mjs` | `createOriginalSimulation({world})`, `stepOriginalFrame(ctx, dt)`, `setOriginalMode`, `snapshotSimulation`, `runWithSeededMathRandom(seedOrGenerator, fn)` (a seed restarts mulberry32 per call; a generator keeps one stream across calls), `withCapturedConsole(fn)`, `ORACLE_MATH_RANDOM_SEED` |
| `oracle-camera-controls-stub.mjs` | `cameraRig()` → `{camera, controls, firstPersonControls}` stubs (home pose, reset semantics), shared by the oracle and the clone driver |
| `clone-simulation-driver.mjs` | `createCloneSimulation({world})` (ctx with the oracle's shape, composed by the runtime `composeDioramaScene`), `setCloneMode(ctx, mode)`, `stepCloneFrame(ctx, dt)`, `snapshotTrainState(ctx)`, `snapshotLifeState(ctx)` |
| `sheep-flock-parity-lockstep.mjs` | `firstSheepFlockMismatch(original, clone)` → null or `{sheepIndex, field, original, clone}`; `runSheepLockstep({frames, stepOriginal, stepClone, beforeFrame, compare, logPrefixes})` (per-side `mulberry32(20260930)` `Math.random` and log buffers, restored in `finally`) |
| `smoke-puff-behaviour-checks.mjs` | `trackPuffs(ctx, dt)` → a log with `record(frame)`; `assertPuffBehaviour(log, {expectedDwellGaps})` |
| `fresh-process-train-material-ids.mjs` | `freshProcessTrainMaterialRows('clone' or 'original')` → per mesh `[material id − smallest, type, name]` from a `new Train()` in a child process (cold `npr` cache) |
| `counted-full-world-builds.mjs` | full reference and clone builds with `Math.random` draws counted per named build step |
| `station-travelers-and-birds-first-build.mjs` | first builds with draws counted inside `buildStation`, the bird material and `createBirdSystem`; walker, rig and flock readers |
| `world-summary-digest.mjs` | self-contained `summarizeWorld`, `summarizeOrderedLists`, `summarizeInstancedCounts`, `hashStationSignCanvas` (also injected into pages) |
| `quantised-number-hashing.mjs` | `quantise`, `hashNumbers(values, scale)` (two-lane FNV over quantised words), `hashString` |
| `typed-array-fnv1a-hash.mjs` | `fnv1aHex(typedArray)` → 8-hex FNV-1a-32 of the raw bytes (golden hashes in `npm test`) |
| `scene-graph-signature.mjs` | `sceneGraphSignature(root, {exclude, geometry})` → DFS `{path, key}`; `compareSceneSignatures(a, b, {labels, ordered})`; `SHARED_UNIFORM_NAMES` |
| `clone-world-factory.mjs` | `createCloneWorld({stopAfter, skip})` (colour management off and the DOM shim installed before the World import); `WORLD_CORE_SKIP` = every non-core step |

Node stepping order is written once, in `stepCloneFrame`: `world.nightAmount ← uNight` →
`stepSimulation(ctx, dt·timeScale)` only when not paused and timeScale > 0 → `updateCameraRig`
(unscaled dt) → `world.updateCloudCamera(camera.position, dt)` → `scene.updateMatrixWorld()`,
mirroring `stepOriginalFrame` and the browser frame loop. The clone ctx has no time-of-day
transition: for a night run call `applyPalette(LIGHTING_UNIFORMS, 'night')` beside the oracle's
`setTimeOfDay('night', true)`. The clone driver also applies the render's GPU-free side effects (glow
visibility, headlight uniforms, sky follow) each step.

Per-feature pattern:

- **Build steps:** `buildOriginalWorld({stopAfter, skip})` vs `new World({stopAfter, skip})`, then
  byte-compare the output arrays and `compareSceneSignatures` (with `ordered: true` where insertion
  order matters).
- **Simulation:** the oracle vs the clone driver, both stepped inside
  `withCapturedConsole(() => runWithSeededMathRandom(seed, …))`, comparing snapshots every frame with
  `Object.is`, dynamic signatures (`geometry: false`) at checkpoints, and log lines with frame numbers.
- **Draw counts:** count `Math.random` draws inside a step on both sides on the **first** build in a
  fresh process (`npr` caches materials per module, so a second World draws fewer UUIDs; the
  reference's `buildStation` draws 2424 on a second build instead of 2532).

Rules:

- Import helpers, never the reference modules directly.
- Gate reference-dependent tests with `{ skip: originalSkipReason([...]) }`; without the cache they
  report a skip, not a failure. Pure harness tests always run.
- Pair `WORLD_CORE_SKIP` with `stopAfter` at or before `'buildTerrain'`: the reference builds village
  residents inline right after the terrain and crashes without a village.
- Compare `birdPerches` only after full builds (the clone produces every perch in its last step).
- The stepper restores every patched `World.prototype` method on every exit path (normal, sentinel
  stop, build error), so stepped and full builds can share one process.
- Signatures never hash shader source; shared lighting uniforms are excluded (their binding is per
  build). The oracle skips the reference's uniform rebinding traverse because its `npr()` cache is
  process-wide.

### Node suites

| Suite | Runs in | What it pins |
|---|---|---|
| `world-core-helpers-registry-and-golden-values` | `npm test` | geometry helpers, registry semantics, golden scalars (length, bridge, frames, 53 children, 383/76 instances, height/heightTex ranges, 3,737 sand vertices, abutments, chord), FNV-1a hashes of heights, heightTex, sx, sz, terrain colour/position/normal, skirt position/topY; a warm build draws `Math.random` exactly 444 times |
| `station-sign-clock-and-build-counts` | `npm test` | 20 sign context writes, clock angles (12:00 before any update, 3:00 at t = 0), frame 1008, o = −1, computed E, 27 exclusions, 2 pads, 70 station children, 9 merge colours in order, `stationS` 236.45464110639873, FNV hashes of heights, exclusions and footpath |
| `train-station-motion-controller` | `npm test` | L = 276.13647750761754, S = 236.45464110639873: cruise, justLeft window (strict 30 / L − 30), √ profile, 0.35 floor, exact snap, dwell 241/81/121 frames at 1/60, 0.05, 1/30, lap goldens (brake 2043, snap 2447, departure 2688, period 2713, max strength 0.3697119847898378 at × 1; 857/1019/1270 at × 2.5) and the 1 → 2.5 → 0 → 0.5 → 1 schedule over 18000 frames |
| `track-sheep-escape-state-machine` | `npm test` | state-machine windows, reaction delay, same-step jump, escape and return, plus 3 × 20 000-step fuzz against the reference state machine |
| `bird-flock-state-machine` | `npm test` | transition table and boundaries, capture flags, snapshot thresholds, wrap, scratch target |
| `terrain-track-bridge-parity` | `test:parity` | frames/sx/sz/bridge bytes, graded heights, the six-pad flatten sequence, terrain/skirt/heightTex bytes, 10,000 seeded query samples, `inBridge(−2..1202)`, `excluded` with 40 shared circles, multiset + ordered signatures, `npr` request order, equal UUID draws, build time (median clone ≤ median reference over 7 alternating rounds) |
| `station-parity` | `test:parity` | placement, heights, pads, exclusions, signatures and child order, sign recordings, clock against the reference `World#update`, pads baked into terrain and `heightTex` |
| `train-model-and-motion-parity` | `test:parity` | structure goldens (offsets, `totalLength` 25.650000000000002, children [28, 7, 27, 27, 27, 27], merged batches [12, 3, 6, 6, 6, 6], 149 meshes, 55 geometries, 20998 triangles); signature vs `new Train()`; ids in allocation order; byte-equal merged buffers; `update(world, s)` × 1000; material id rows from fresh child processes (coach glow ids step 25, 26, 25) |
| `train-simulation-oracle-and-composition-parity` | `test:parity` | composed layout; 18000 frames of motion, strength, puffs and spark matrices with `Math.random` replayed per side (variant A on a second reference World, variant B on the clone World); headlight uniforms; 120 s smoke behaviour against the spec formulas |
| `village-windmill-parity` | `test:parity` | stream position (1024 / 1624), transforms, 96 smoke records, glows, pads, exclusions, shrub buffers, signatures, `noShadow` order (106), 600 frames of smoke and rotor |
| `residents-trees-rocks-parity` | `test:parity` | yards, tree and rock buffers, canopy grid bytes + 10 000 queries, stream continuation, resident signatures, 60 s of resident poses at fixed and random dt, the 8 `[VILLAGE]` lines at frames 241, 720, 1080, 1561, 1921, 2401, 2761, 3241 |
| `camera-modes-parity` | `test:parity` | 11 708 frames plus every `setMode` vs the oracle: side sweep, wide-shot peak, station dwell, pause, dt 0, time scale 2, bridge, free flight to every clamp, pose save/restore; each camera field within 1e-9 (the measured maximum difference is exactly 0) |
| `sheep-flock-parity` | `test:parity` | next 5 `world.rand()` draws, a 10 000-point `sheepGroundAt` grid with sentinel normals, every sheep state, route and instance buffer, clearing, exclusions, whole `world.group`; 60 s against a synthetic train |
| `sheep-flock-oracle-train-parity` | `test:parity` | the real train in lockstep: 260 s with a night ramp, 90 s at speedMul 2.5, 60 s of 0.1 s steps |
| `water-clouds-balloon-parity` | `test:parity` | UUID draws per step 24 / 2128 / 2940, next `world.rand()` 0.23735972004942596, 33 clouds bitwise (Σ 464 instances), signatures, materials, 18 000 frames of drift, camera pushes and flight |
| `station-travelers-and-birds-parity` | `test:parity` | first-build draws 2532 / 4 / 948, perches, flock init, lane floats, walker events, 180 s + 60 s (dt 0.1) lockstep of every bird, flock, walker and grandmother transform |
| `full-scene-signature-parity` | `test:parity` | whole scene (1201 signature entries), ordered lists, world summary, next `world.rand()`, 6 × 1800 lockstep frames with logs (section 10) |
| `harness-self-check` | `test:parity` | the reference World, stepper and oracle themselves; prototype restore after normal, sentinel-stop, pre-patch and mid-build failures |

## 4. Browser capture

```bash
npm run parity:capture -- --target both          # clone | original | both; --shots a,b|signoff; --stage s; --profile p; --out dir; --repeat (sign-off only: shots/<target>-repeat)
npm run parity:compare                           # --shots a,b|signoff; --in dir; --region all|none|name,name; --a dir --b dir
npm run parity:probe                             # see section 6
```

Recipe (identical on both sites; every in-page step uses parity-surface names only):

1. Fresh context per session: saved settings cleared once, `Math.random` = mulberry32(20260930) via
   init script (`window.__parityReseed(seed)` resets it), Vercel analytics blocked. The reference's
   entry module is route-patched with our hook (exactly one anchor, or it fails).
2. Load `?parity=freeze`; wait for the hook, the hidden loader, `#debug-menu` and fonts.
3. Freeze: `paused`, `overviewIntro = null`, auto-rotate off, and **at freeze time** instance no-ops
   for `updateCamera` and `world.updateCloudCamera` (originals stashed), so real-dt code in the
   paused loop cannot move the camera or clouds.
4. Per shot: `setMode('overview')` first (its double reset lands on the deterministic home pose), then
   the shot's mode; palette applied immediately; pixel/outline. Reseed, then step `round(seconds·60)`
   frames at dt 1/60 in one synchronous evaluate (time of day, nightAmount, time/uTime, train, world,
   birds, the stashed camera and cloud-camera updaters; no render).
5. Optional camera pose, then hide sets (always after stepping: puff spawns re-show meshes), then the
   shot's page actions in order: `uniformTimeOffset` (adds n to `uTime` without a sim step),
   `debugLayerOff` (clicks the `#debug-layers` checkbox by label and captures its log line),
   `inPageCameraPose` (named in-page pose resolved to world-space points), `holdPausedFrames` (waits n
   frames paused, recording `uTime` before and after). Results go into the meta as `shotActions`.
6. 3D shots: UI hidden, rendering on, 2 rAFs, full-viewport screenshot. The capture CSS hides each UI
   root and all its descendants with `transition: none !important` (a running transition outranks
   `!important`, so `transition-all` HUD buttons otherwise stay visible for several SwiftShader
   frames). DOM shots: canvas hidden, rendering off (keeps SwiftShader from starving timers), actions,
   finite animations awaited, clip around the selectors, masks painted `#ff00ff`.

Shot schema: `{id, stage, kind '3d'|'dom', viewport, mode, timeOfDay, pixelShortSide, outline,
seconds, hide, camera, fresh, actions, selectors, pad, mask, keepToast, reportOnly, parkTrain,
regions, uniformTimeOffset, holdPausedFrames, debugLayerOff, inPageCameraPose, relation,
thresholdClass, reference}`.

- `camera` is `{position, target, fov?}` in world space, or with `relativeTo: 'loco' | 'station'` in
  that object's local frame, or `{relativeTo: 'freeCameraStart', fov}`; a missing `fov` keeps the
  mode's FOV.
- `parkTrain` runs `parkTrainAway` after stepping: `train.update(world, (s + L/2) % L)`, moving the
  hidden train (and its headlight) away from the station.
- `relation` = `{to, expect: 'differs', minOverFraction}` or `{to, expect: 'identical'}`, judged on
  each site between two shots.
- `regions` names screen regions (`village`, `windmill`, `waterfall`) the shot is judged on.
- `reportOnly` shots are never picked by stage selection and print `REPORT(PASS|FAIL)` without
  failing the run (useful while a subsystem is half-built; no current shot uses it).
- `reference` is a research capture file name or `null` (clone vs reference only). Consecutive
  non-fresh shots on one viewport share a page load; fresh shots (`seconds > 0`, DOM actions or any
  page action) get their own.

Hide sets (objects by field; a family a site lacks hides nothing): `world`, `train`, `birds`,
`puffs`, `sparks`, `clouds`, `trees`, `stationFigures` (`world.stationTravelers[].figure`), `sheep`
(the three instanced layers), `balloon`, `villageResidents` (`residents[].figure` + `dog`),
`houseSmoke`, `unbuiltAfterWindmill` (every `world.group` child after the windmill group and the 4
terrain meshes, plus the station figures and `d.birds.group`: 49 objects on the full scene), `water`
(direct `world.group` meshes whose shader has no `uColor`: water and waterfall) and `allButWorldCore`
(keeps only the sky, terrain, skirt and the flat world-core materials, identified by `uColor hex |
uStipple`: `a39a8c|0.5` ballast, `8f8f9e|0.05` rail, `6e4a32|0.25` sleeper, `6b4630|0.12` plinth wood,
`3f2a1f|0.1` plinth trim, `b8432f|0.12` red, `8a2f24|0.1` dark red, `b9ae98|0.35` stone). Presets:
`skyOnly`, `transient` (puffs + sparks), `allFamilies`. Restores run in reverse order so overlapping
sets give back the original visibility. Hide sets and presets live in
`parity-shot-stages-and-hide-sets.mjs`, validation in `parity-shot-validation.mjs`; the in-page
function in `page-hide-set-application.mjs`.

Stages: `shell-and-sky` → `train` → `village-and-windmill` → `residents-and-forest` → `full-scene`. A
shot runs when its stage index is ≤ the selected stage; `--shots` overrides gating.
`ACTIVE_PARITY_STAGE` is `full-scene`, so a plain `npm run parity:capture` runs every non-report-only
shot. To add a shot, append one line in `parity-shot-list.mjs` (or a per-subsystem shot module) at its
stage; the `shot()` factory and the camera poses live in `parity-shot-factory-and-camera-poses.mjs`.

### Shot catalogue

The capture list (`PARITY_SHOTS`) holds 84 shots: 21 `shell-and-sky`, 7 `train`, 4
`village-and-windmill`, 35 `residents-and-forest` and 17 `full-scene`. The release sign-off uses its
own 28-shot set (section 11).

**Shell and sky** (21 shots): `sky-day`, `sky-evening`, `sky-night`, `sky-day-pixel360`,
`sky-day-ink-off`, `sky-mobile`, `hud-day`, `hud-night`, `hud-mobile`, `help-panel`, `toast-bridge`,
`loader-card` (the logo is masked on both sites; its box is still compared), `debug-menu` (perf text
masked), `world-core-overview` (home pose) and `world-core-bridge` ((−3, 5.5, 60) → (0, 8.5, 36), FOV
42, fixed target), `station-trackside-closeup-day` / `-night`, and four sky-direction shots without a
reference that pin the sky shader's sun, moon, star and ridge terms. Sky-direction shots: camera at
(0, 4, 0) looking along a fixed direction with the sky-only hide set:

| id | Time of day | Direction |
|---|---|---|
| `sky-sun-day` | day | `PALETTES.day.uLightDir` |
| `sky-moon-night` | night | `PALETTES.night.uLightDir` |
| `sky-stars-night` | night | normalize(0, 0.8, −0.6) |
| `sky-hills-evening` | evening | (1, 0, 0) |

**Train** (stage `train`; hide `world` + `birds`; camera in the locomotive's frame):

| Shot | Time of day | Steps (sim time incl. the 0.05 s warm-up) | Pose (loco frame) | Effects | Reference |
|---|---|---|---|---|---|
| `train-only-braking-front-day` | day | 2160 (36.05 s: braking, ahead ≈ 13.08, sparks live) | (4.5, 2.6, 6.5) → (0, 1.2, 0.5) | visible | 05-train-camera |
| `train-only-braking-front-day-no-effects` | day | 2160 | same | hidden | 05-train-camera |
| `train-only-dwell-side-day` | day | 2520 (42.05 s: dwelling) | (−11, 3.2, −9.5) → (0, 1.4, −9.5) | hidden | – |
| `train-only-night-headlight` | night | 540 (9.05 s: on the bridge) | (−14, 5.5, −3) → (0, 1.6, 7) | hidden | 18-night-train-camera |

`train-only-day` / `-night` (loco chase pose, effects hidden) and `train-smoke-day` (4 s, smoke
visible, transient thresholds) are in the same stage. A shot with transients visible uses the
transient class unless both sites are reseeded and the clone's heights near the braking zone are
byte-equal to the reference's (sparks bounce on the terrain); `train-only-braking-front-day` meets
both, so it is deterministic.

**Village and windmill** (3 s stepped, `unbuiltAfterWindmill` + `transient` hidden, house smoke
visible, judged per region `village` + `windmill`):

| Shot | Time of day | Pose | Reference |
|---|---|---|---|
| `village-windmill-overview-day` | day | overview home | 14-overview-day-settled |
| `village-windmill-zoomed-day` | day | zoomed (12 wheel notches) | 12-overview-zoomed-in |
| `village-windmill-evening` | evening | overview home | 03-overview-evening |
| `village-windmill-zoomed-night` | night | zoomed | 17-night-overview-zoomed |

Regions (`shot-region-projection.mjs`) are computed in the page right after the scene is prepared:
`village` = Box3 over the houses ∪ the shrub mesh, `windmill` = Box3 over `windmillBlades.parent`,
`waterfall` = the DoubleSide shader mesh; the 8 corners are projected to CSS px, padded 12 px and
clamped. Compare crops both PNGs per region × `devicePixelRatio` and uses the reference's regions.

**Residents and forest** (full scene, `transient` hidden; the `-masked` suffix is historical, from
when systems not yet built were masked on both sites):

| Shot | Steps | Pose / actions | Reference |
|---|---|---|---|
| `overview-day-settled-masked` | 180 | overview home | 14-overview-day-settled |
| `overview-zoomed-orbited-masked` | 180 | logged 12b pose (−69.894, 19.728, 15.753) → (0, 4, 0) | 12b-overview-zoomed-orbited |
| `overview-night-masked` | 180 | overview home, night | 04-overview-night |
| `village-residents-yard` | 480 (woman mid-walk) | `inPageCameraPose: 'villageResidentYard'` (woman's home frame, camera (−1.5, 2.4, depth/2 + 5.5) → (0, 0.7, depth/2 + 0.65)) | – |
| `trees-sway-t0` | 0 | 12b pose, fresh page | 12b |
| `trees-sway-t1` | 0 | 12b pose, `uniformTimeOffset: 5`; differs from t0 (≥ 0.05 %) | 12b |
| `trees-sway-hold` | 0 | as t1 + `holdPausedFrames: 20`; identical to t1 | – |
| `trees-debug-hidden` | 180 | `debugLayerOff: 'Trees'` | 14-overview-day-settled |
| `station-free-start-day` / `-night` | – | free-camera start, FOV 65, train parked away | 07 / 17 |

**Camera modes** (`camera-mode-parity-shots.mjs`): `train-camera-day` (side, 6.5 s),
`bridge-camera-day` (6 s), `bridge-camera-evening` (10.5 s), `free-camera-day` (orbit, 6 s),
`train-camera-night` (side, 9 s), each strict (`transient` hidden) plus a `-relaxed` twin (nothing
hidden, transient thresholds).

**Sheep** (`sheep-flock-parity-shots.mjs`; in-page pose `sheepFlockCloseup` = rail sheep 2's centre −
outward·9 + (0, 5, 0) + tangent·3, looking at centre + (0, 0.5, 0)):

| Shot | Time of day | Frames | Shows |
|---|---|---|---|
| `sheep-flock-day-closeup` | day | 120 | the three rail sheep grazing on the track |
| `sheep-flock-night-closeup` | night | 600 | night colours (rail sheep stay awake) |
| `sheep-track-hop-1` | day | K2 − 12 = 812 | sheep 2 crouching before its hop |
| `sheep-track-hop-2` | day | K2 + 20 = 844 | sheep 2 mid-hop |
| `sheep-track-hop-3` | day | K2 + 90 = 914 | sheep 2 waiting on its safe spot |

`SHEEP_HOP_K2` = 824 is the probe's hop frame for sheep 2; the probe fails if the measured K2 differs,
so re-measure and update the constant if train or sheep timing changes.

**Water, clouds and balloon** (`water-clouds-balloon-parity-shots.mjs`; 600 frames, sim time
10.05 s):

| Shot | Time of day | Pose / extra | Reference |
|---|---|---|---|
| `overview-zoomed-day-masked` | day | home dollied by 0.95^14.4 toward (0, 4, 0) | 12-overview-zoomed-in |
| `overview-zoomed-night-masked` | night | same | 17-night-overview-zoomed |
| `overview-day-waterfall-roi` | day | overview home, region `waterfall` | 11b-hud-hidden-no-toast |
| `balloon-closeup-day` / `-night` | day / night | (26.92, 26.36, 10.96) → (31.92, 25.06, 4.96) | 12 / 17 |
| `water-closeup-day` / `-night` | day / night | (−4, 24, 18) → (−2, 0, 2) | 12 / 17 |
| `waterfall-closeup-day` / `-night` | day / night | (0.3, −4, 96) → (0.3, −9, 64), `clouds` hidden | 11b / 17 |
| `clouds-debug-hidden` | day | `debugLayerOff: 'Clouds'` | 14-overview-day-settled |

Water and waterfall GLSL is never compared as text: these renders are the proof of output parity.

**Full scene** (17 shots): `overview-day`, `overview-evening`, `overview-night`,
`overview-pixel360`, `overview-pixel720`, `overview-ink-off`, `overview-zoomed-day`,
`overview-zoomed-night`, `free-cam-day`, `train-cam-day`, `train-cam-night`, `bridge-cam-day`,
`bridge-cam-evening`, `mobile-overview`, plus the three traveler and bird shots below.

**Travelers and birds** (`station-travelers-and-birds-parity-shots.mjs`; mode `orbit` with a fixed
pose applied after stepping):

| Shot | Seconds | Pose | Shows | Reference |
|---|---|---|---|---|
| `station-travelers-closeup` | 6 | (−45.479, 10.8, −10.431) → (−47.944, 9.9, −3.52) | walker and grandmother (her only view) | – |
| `station-roof-birds-takeoff` | 0.6 | (−44.5, 12.5, −8.5) → (−49.465, 11.9, −2.46) | the roof flock lifting off at load | – |
| `bridge-birds-in-flight` | 9 | (−11.686, 11.96, 53.896) → (−4.75, 15.5, 36.5) | bridge flocks circling above the deck | 06b-bridge-camera-later |

Research capture → shot mapping: 14 → sky/HUD/overview day, 03 → evening, 04 → night, 08/08b →
pixel shots, 09 → ink off, 10 → help panel, 15 → debug menu, 16 → toast, 01 → loader card (layout
only), 13 → mobile, 05/18/06b/19/07/12/17 → train and full-scene shots. Not captured: 02a/02
(time-dependent intro, covered by unit tests), 05-motion-2..3 and 06 (mid-blend), 11/11b (overview
with the UI hidden, covered by `hud-hidden`).

## 5. Compare

| Class | meanAbsDiff (0–255) | Pixels with a channel diff > 16 |
|---|---|---|
| deterministic | ≤ 1.0 | ≤ 0.5 % |
| transient (puffs/sparks visible) | ≤ 3.0 | ≤ 3 % |
| dom | ≤ 0.5 | ≤ 0.2 % |

A shot passes when the sizes match, neither meta has page errors, both metrics are within its class,
and its same-site checks hold (`intra-site-shot-checks.mjs`): a `relation` (`differs`: share of pixels
over 16 ≥ `minOverFraction`; `identical`: max channel diff 0) and the recorded page actions
(`holdPausedFrames`: still paused with `uTimeBefore === uTimeAfter`; `debugLayerOff`: unchecked and
logged `[DEBUG] <label>: hidden`). Regional shots are judged per region crop; whole-frame metrics are
still printed. Warnings (never failures): differing `runId`, `profile`, `executablePath` or
`webglRenderer` (shot folders are never cleared, so a partial capture can leave stale PNGs);
capability differences; differing `timeAtFreeze` or `fredokaReadyAtBuild` once both sites build a
world; `cloudOffsetMax > 0` on either site.

Outputs: `.parity-output/shots/<target>/<id>.png|json`, `.parity-output/capture-log.json`,
`.parity-output/compare/<id>.png` (reference | clone | heat: grey = equal, amber = diff ≤ 16, red =
diff > 16; region outlines in cyan), `.parity-output/compare-report.json` and a markdown table in
`.parity-output/compare/summary.md`. A full `--shots signoff` compare also writes
`.parity-output/compare/signoff-report.json` (the only report the research recapture trusts).

## 6. Probe

`npm run parity:probe -- [--target t] [--scenario default|sky-only|both] [--profile p] [--strict] [--skip-checks] [--skip-post-probe] [--shot id] [--fields a,b] [--states signoff] [--camera-ui]`

- Default: per target, the frozen default state (overview, day, native, outline on). Scenario
  `default` renders everything; `sky-only` hides world/train/birds/puffs/sparks and compares
  calls/triangles only. `--strict` exits 1 on any diff or failed check.
- `--shot <id>` probes that shot's scene prepared exactly as the capture does, rendered for 2 frames,
  into `probe-<id>.json`; `--fields` limits the renderer diff (e.g. `--fields calls,triangles`).
- Fields: `renderer` (calls, triangles, points, lines, geometries, textures, programs), canvas, pixel
  ratio, scene counts, sim, world (length, stationS, bridge, houses, homes, tree instances, rocks,
  sheep, clouds, windmill, clock, free-camera start, exclusions, foundations, perches, heights sum),
  train, birds; floats at 1e-4.

Scenario sections (collected and judged by `scenario-probe-sections.mjs`, exact, full precision):

| Section | Fields | Verdict |
|---|---|---|
| `station` | `stationS`, `freeCameraStart`, group position and `rotation.y`, `time` (0.05), clock hand angles and whether each equals the in-page formula, `signCanvasHash`, `fredokaBold106`, `frozenAfter30Frames` | all equal; a sign-hash/font-only difference reloads both sites (≤ 3 attempts) |
| `village` | `houseCount`, `villageHomePositions`, `windmillPosition`, `windmillQuaternion`, `windmillRoofHeight`, `bladeChildCount`, `bladeRotationZ`, `smokeTransforms` | equal in every scenario |
| `forest` | `treeCounts`, `rockCount`, `residentMeshCount`, `exclusionCount`, `hasSheepFlock` | counts equal; exclusion delta 0 |
| `sheep` | layer counts, routes, first pasture spots, stranding candidates, hop frames K1..K3 over 4000 stepped frames | equal; K2 = `SHEEP_HOP_K2` |
| `waterCloudsBalloon` | time, 33 clouds (position, speed, travel width, instance counts), roof height, balloon position, water and waterfall structure | 33 clouds Σ 464, roof 22.266444503377606, balloon within 1e-6 of the closed-form flight, water bound to its own `heightTex`, a 225-vertex / 1152-index DoubleSide waterfall, both in `noShadow` |
| `stationTravelersAndBirds` | flocks, birds, perch ids, flock modes, travelers, walker pose | 7 flocks, 18 birds, perch ids `bridge-1..3, station-roof, trackside-2..4`, 2 travelers |

Post synthetic-input probe: a 64 × 64 colour ramp (R = 4x, G = 4y, B = 128) and a two-level float
depth texture go through each site's post material for 18 combinations of `uOutline` ∈ {1, 0} ×
(`uNight`, `uSaturation`) ∈ {(0, 1), (1, 2.5), (0.5, 1.75)} × (`uPixel`, `uThick`) ∈ {(0, 1), (0, 1.8),
(1, 1)}; outputs must match within 1 per channel (`spreadFromFirst` proves the probe is sensitive).

Checks (both sites): debug-menu DOM tree and attribute order, toggle logs and visibility with no page
error, 0 perf-text mutations in 1600 ms closed and ≥ 2 open, hidden under `body.hud-hidden`, no
`__diorama` / `[PARITY]` without the param, `?parity` live and unpaused, `?parity=freeze` paused with
`[PARITY] Hook installed: freeze`, and "station clock hands follow live sim time" (on the live page,
once `time` > 0.05, `time` and both hands read in one evaluate must `Object.is`-equal the formula).

### Camera UI probe (`--camera-ui`)

Drives one live page per site (no freeze, saved settings cleared), from
`tools/parity/camera-ui-runtime-probe.mjs`:

1. Picks a canvas point where `document.elementFromPoint` is the canvas (clear of the HUD).
2. Presses `2, 3, 4, 1, b` and records `{mode, fov, pressed, toast}` after each (orbit/65 with the
   Free toast, side/48, bridge/42, overview/42, bridge/42 with `B · Bridge camera`), then right-clicks
   a mode button (overview + `Camera · Default`).
3. Overview → bridge plus 5 × `updateCamera(1/60)` (distance to the tripod strictly falling),
   overview → side plus one step (no snap), then orbit (exactly on `freeCameraPose.position`).
4. Spies `firstPersonControls.lock`: a canvas click in orbit gives `[[true]]`, none while `isLocked`
   is forced, none in overview.
5. `movementKeys` gets KeyW, then a PLC `'unlock'` event empties it.
6. In orbit with `isLocked` forced: keydown w adds KeyW, keyup removes it, Space neither logs
   `[PAUSE]` nor pauses; unlocked, Space pauses and resumes.

Writes `.parity-output/camera-ui-probe.json` plus one file per site; any miss or cross-site difference
sets exit code 1.

### Manual headed pointer-lock checklist

Headless Chromium rejects `lock(true)` (unadjusted movement) with "not supported on this platform" on
both sites (the uncaught rejection is a kept quirk), so real pointer lock is checked by hand in a
headed browser (`npm run dev`). Status: **not yet run**; record the date and browser here once done.

- Press 2, click the scene: the cursor locks.
- WASD / Space / C / Shift fly; the edge (±61), ground (+1.2) and ceiling (200) clamps hold.
- Esc: the cursor returns and movement stops (held keys are cleared).
- 3 glides into the train camera; 4 or B glides to the bridge (B shows its toast); 1 snaps home.

## 7. Baseline (SwiftShader via ANGLE, 1600 × 900)

| Measure | Reference | Clone |
|---|---|---|
| Frozen default `calls / triangles` | 1373 / 1,762,696 | 1373 / 1,762,696 |
| `geometries / textures / programs` | 419 / 6 / 25 | 419 / 6 / 25 |
| Sky-only `calls / triangles` | 2 / 962 | 2 / 962 |
| `timeAtFreeze` | 0.05 | 0.05 |
| `fredokaReadyAtBuild` | true | true |
| Post synthetic probe | max channel diff 0 across 18 combinations | |
| Station sign canvas hash | `8df1cf62` | `8df1cf62` |

The reference's live debug-menu reading (1411 / 1,773,736) varies with the puff count; the frozen
probe is authoritative. Timings on this profile: a full shell-stage capture ≈ 2 min 20 s for both
targets, compare ≈ 6 s, probe with checks ≈ 1 min; `npm run test:parity` ≈ 75 s on an idle machine (minutes under load).

## 8. Determinism rules

- The constructor renders one frame; the hook runs right after `prepareOverviewIntro()` in the same
  task, so both sites have advanced one 0.05 s step and spawned one puff. That first puff's random
  draws follow an unknown number of UUID draws, so frozen shots hide transients and
  transient-visible shots step > 3.6 s (puff life 2.4–3.6 s).
- The paused loop still runs real-dt code (time of day, camera, cloud camera, render): palettes are
  applied immediately, the intro is nulled, auto-rotate is off and the camera/cloud-camera no-ops are
  installed at freeze time. Both sites dispatch per-frame work through instance members, or the
  no-ops would do nothing.
- Full-scene shots step ≥ 3 s: cloud scale includes `smoothstep(0, 2, age)`.
- The station sign is drawn synchronously during the build; `fredokaReadyAtBuild` records whether
  Fredoka was ready. The probe's `signCanvasHash` catches a font race directly and reloads both sites.
- Compare only captures from the same browser, profile and run (every meta carries the invocation's
  `runId`). Playwright routing disables the HTTP cache, so the patched entry module is always served.
  Always launch a full Chromium by path.

## 9. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Very slow runs | SwiftShader renders at ~1–2 FPS; a reference load takes ~10 s. Waits are state-based (180 s timeout); never add wall-clock sleeps. |
| `Original TrainScene.js: expected exactly one …` | the reference changed. Re-run `npm run parity:fetch` and inspect before touching the hook. Route errors abort the only entry module, so they surface immediately instead of as a readiness timeout; `… was never patched` means the module was never requested. |
| Blocked commands | local hooks reject command text containing `node_modules`, `dist`, `build`, … segments; run entry points through npm scripts or files under `tools/` / `tests/`. |
| DOM shots or `fredokaReadyAtBuild` differ | fonts blocked; allow fonts.googleapis.com. |
| Parity tests skipped | `run npm run parity:fetch`. |
| Research checks skipped | set `PARITY_RESEARCH_DIR`. |
| Page errors in a meta | the shot fails; open the meta JSON and the clone console. |
| Headless-shell launch errors | set `CHROMIUM_PATH` to a full Chromium/Chrome binary. |
| `loader-card` differs only inside the logo mask | the logo's intrinsic aspect ratio is no longer 1482 : 644. |
| A lone clone readiness timeout (180 s) | the page loads three.js and fonts from CDNs; treat it as network and re-run the remaining shots with `--target clone --shots …`. |
| Node build-time check fails on a busy machine | re-run the file alone or set `PARITY_SKIP_PERF=1` for full-suite runs. |

## 10. Verification record by subsystem

What each subsystem's parity proof established when it landed (all re-confirmed by the release
sign-off below). Kept as a record of which checks catch which mistakes.

- **Shell, sky and post.** All shell-stage shots pass; sky max channel diff ≤ 1; DOM shots
  identical; debug-menu computed styles (closed, open, `body.hud-hidden`) identical on both sites;
  post synthetic probe max diff 0 (self-diffs up to 136 against a known differing variant prove it is
  sensitive).
- **World core.** Byte-exact frames, heights, pads, terrain, skirt and `heightTex`; 10,000 equal
  query samples; equal signatures; 444 UUID draws on both sides; build median ≈ 45 ms clone vs
  ≈ 55 ms reference (flat loops and unfrozen constants avoid V8 deopts).
- **Station.** Bit-identical placement, pads, 27 exclusions, signatures, sign recordings and clock;
  the trackside close-ups pixel-identical (mean 0.000, max 0); station probe equal on the first
  attempt.
- **Train.** Bit-identical signature, merged buffers, 1000 placements and 18000 oracle frames; a
  one-ULP change in the puff drift fails within the first second. All 7 train-stage shots identical
  (max channel diff ≤ 2) once the capture CSS disabled UI transitions; before that HUD buttons leaked
  into cheap shots intermittently. Train-only probe: 258 calls / 38,374 triangles on both sites.
- **Village and windmill.** 8 houses in 256 tries, stream at 1024 / 1624, all 96 smoke records, 36
  exclusions, 11 pads, 106 `noShadow` entries and 600 frames of smoke and rotor bit-identical; a
  one-operand regrouping in the smoke formula fails immediately. Regional shots identical (max 0).
- **Residents, trees and rocks.** Tree layers 3749 / 1215 / 932 / 769 with byte-equal buffers,
  canopy grid and 10 000 queries, stream at 78587 after the trees, 60 s of resident poses
  bit-identical; `trees-sway-t1` differs from t0 on 10.9 % of pixels on both sites and the paused hold
  keeps `uTime` 5.05.
- **Camera modes.** 0 difference over 11 708 frames; `--camera-ui` identical on both sites; camera
  shots identical (max 0). A headless canvas click logs `THREE.PointerLockControls: Unable to use
  Pointer Lock API` on both sites.
- **Sheep.** 24 pasture sheep, clearing at frame 348 side −1, routes 77.380 / 79.930 / 83.130 m,
  410 s against the real train (night ramp, speed 2.5, doubled time scale) bit-identical with equal
  `[SHEEP]` sequences; hop frames K = [785, 824, 840] on both sites; sheep shots identical.
- **Water, clouds, balloon.** UUID draws 24 / 2128 / 2940, fingerprint 0.23735972004942596, 33 clouds
  bitwise, 300 sim-seconds of drift, pushes and flight identical; water/cloud/balloon shots identical
  (max ≤ 1; the waterfall crop max 0); textures reach 6.
- **Travelers and birds.** First-build draws 2532 / 4 / 948; `[STATION]` events at frames 298,
  1107, 1588, … 10 629 over 10 800 walker-only frames; IK bones at 0.36 within 1e-12; zero
  `Math.random` draws in `birds.update`; 180 s + 60 s lockstep identical; the frozen default overview
  then matched the reference exactly (1373 / 1,762,696 / 419 / 6 / 25).

## 11. Release sign-off (1.0.0)

### Commands

```bash
npm run parity:fetch                       # .parity-cache/original (18 files, sha-checked)
npm test && npm run test:parity            # node: unit + oracle suites, incl. full-scene-signature-parity
npm run check:lines
npm run dev &                              # clone on :4317 (the tools also start it on demand)
npm run parity:signoff                     # capture --shots signoff → compare --shots signoff → probe --states signoff
npm run parity:capture -- --shots ov-day-t0,dom-hud-day --target both --repeat   # noise floor
npm run parity:compare -- --shots ov-day-t0,dom-hud-day --a .parity-output/shots/clone --b .parity-output/shots/clone-repeat
npm run parity:perf -- --runs 10           # BUILD / CPU-submit medians, heap (--skip-heap to omit)
npm run parity:research                    # research recapture on the clone + contact sheet
npm run parity:smoke -- --url http://localhost:4317/
```

A pinned reference fallback, when the live site is unavailable:
`node tools/static-dev-server.mjs --root "$PARITY_RESEARCH_DIR/source" --port 4318` with
`TARGET_URL=http://localhost:4318/`.

Sign-off recipe (in addition to section 4): one browser context per shot; font readiness from the
hook's `fredokaReadyAtBuild`, and the station-sign canvas hash held to the run's reference (the
first font-ready load, the reference's when both sites run); either failing reloads in a fresh
context, up to 2 reloads. `Math.random` is reseeded right before the K steps; a pose override sets
camera, `lookAt` and `controls.target`, then runs the real cloud updater 180 times at 1/60 s;
transients are hidden unless the shot says visible; 3D shots are full-page (HUD included) after 2 rAF
and a settled toast; DOM shots freeze rendering, hide the canvas, run the prelude and screenshot with
animations disabled and the masks painted `#ff00ff`. Masked rects go into the meta as `maskRects`;
compare excludes the union of both sites' rects from numerator and denominator, and a masked shot
without rects fails. Tagged console lines
(`[GAMEPLAY|CAMERA|BIRDS|SHEEP|STATION|VILLAGE|HUD|PAUSE|DEBUG|SETTINGS]`) are stored per shot and
must be equal; the clone must log no page error and no `console.error`. Timeouts: 180 s for the
loader, 120 s for every other in-page step.

Thresholds (unchanged): deterministic ≤ 1.0 / ≤ 0.5 %; transients visible ≤ 3.0 / ≤ 3 %; DOM ≤ 0.5 /
≤ 0.2 %; dom-loading boxes (`.load-card`, `.load-logo`) within 0.5 px with the logo masked. Probe
states compare exactly.

The sign-off set (`tools/parity/signoff-parity-shots.mjs`): 21 3D shots (`ov-day-t0`, `ov-day-t30`,
`ov-day-t30-fx`, `ov-evening-t0`, `ov-evening-t30`, `ov-night-t0`, `ov-night-t30`, `ov-zoom-day`,
`ov-zoom-night`, `pixel-360`, `pixel-720`, `ink-off`, `train-day`, `train-day-fx`, `train-night`,
`bridge-day`, `bridge-evening`, `bridge-evening-fx`, `free-day`, `hud-hidden`, `mobile-ov-day`) and 7
DOM shots (`dom-hud-day`, `dom-hud-night`, `dom-help`, `dom-toast-bridge`, `dom-debug`,
`dom-loading`, `dom-mobile-hud`). Train and bridge shots step 10.85 s after departure so the whole
train is on the bridge (s mod L within [32.6, 40.9]). Probe states: `ov-day-t0`, `ov-night-t0`,
`ov-day-t30`, `train-day`, `bridge-evening`, `free-day`, `pixel-360`, `mobile-ov-day`.

### Independence audit

```bash
R="$PARITY_RESEARCH_DIR"
python3 "$R/verbatim-overlap-check.py" "$R/.." $(git ls-files src styles tools tests index.html assets)
python3 "$R/structural-similarity-check.py" "$R/.." .
grep -rnE "([A-Z][A-Za-z_]*\.(js|css|svg)|index\.html):[0-9]+" src tools tests styles index.html   # empty
sha256sum assets/*.svg "$R"/source/*.svg                                                       # no shared hash
git ls-files .parity-cache .parity-output                                                      # empty
```

Allowed overlap hits (anything else is rewritten in its owning module):

| Allowance | Example |
|---|---|
| standard three.js API idiom | `new THREE.ShaderMaterial(`, the full-screen-quad `gl_Position` line, `three/addons` imports |
| Vercel's official Web Analytics snippet | the `window.vaq` queue stub in `index.html` |
| DOM ids, Tailwind class names, state names and selectors | `#hud-controls`, `body[data-time-of-day="night"] …`, `is-gone` |
| short UI strings and console strings | help-list labels, toasts, loader labels and hints, `[CAMERA] …` logs |
| API names, parity-surface fields, state keys | `update(elapsed, dt, trainPosition, trainMotion)`, `this.flyAlongAnchor`, `state.lastPixelResolution` |
| numeric values, option tables, colours | `npr` call-site options (`stipple: 0.55, stippleScale: 2.4`), CSS values, the FOV table |
| import map / CDN / font links | the unpkg URLs and Google Fonts preconnects |
| standard public algorithm | smoothstep clamp, bilinear value-noise blend |

### Sign-off results (2026-10-03)

- **Target:** the live reference, unchanged since the research snapshot: all 18 fetched files (14 JS,
  `index.html`, the stylesheet, 2 SVGs) equal the research copy by sha256 (manifest aggregate
  `f5e225f57bba0d2d…`). Profile `angle` (SwiftShader via ANGLE), Chromium build 1243.
- **Node:** `npm test` 296 pass, 0 fail, 0 skipped;
  `npm run test:parity` all pass (79 tests), including `full-scene-signature-parity`: construction
  signature equal (1201 entries), the first frame logs exactly the two `[BIRDS] Take off` lines on both
  sides, 435 geometries / 128 materials / 2 textures reachable on both, ordered lists equal, world
  summary equal (station frame 1008, 33 clouds, bridge [30, 178]) with an equal next `world.rand()`,
  and 10 800 lockstep frames (overview with the intro played to completion, side entered while a
  second intro is armed, bridge, orbit, night overview, speedMul 2.5) with every scalar
  `Object.is`-equal, 18 signature checkpoints equal and 189 identical log lines (`[BIRDS]`,
  `[VILLAGE]`, `[STATION]`, `[SHEEP]` and the two in-sim `[CAMERA]` lines). `check:lines` OK (max 199).
- **Noise floor:** `ov-day-t0` and `dom-hud-day` captured twice per site: mean 0, 0 % over, max 0.
- **Browser shots (28/28 pass):** every shot has meanAbsDiff ≤ 2e-6, 0 % of pixels over 16 and a
  maximum channel difference of 0 (19 shots) or 1 (9 shots); every tagged console sequence is equal;
  the clone logged no errors (the reference logs one `console.error` per page for the analytics request
  the harness blocks). dom-loading boxes identical: `.load-card` (530, 261.078, 540 × 377.844),
  `.load-logo` (585, 261.078, 430 × 186.844).

  | shot | class | meanAbsDiff | > 16 | max | log sequence | boxes | verdict |
  |---|---|---|---|---|---|---|---|
  | ov-day-t0 | deterministic | 0.000002 | 0.000 % | 1 | equal | n/a | PASS |
  | ov-day-t30 | deterministic | 0.000001 | 0.000 % | 1 | equal | n/a | PASS |
  | ov-day-t30-fx | transient | 0.000001 | 0.000 % | 1 | equal | n/a | PASS |
  | ov-evening-t0 | deterministic | 0.000002 | 0.000 % | 1 | equal | n/a | PASS |
  | ov-evening-t30 | deterministic | 0.000002 | 0.000 % | 1 | equal | n/a | PASS |
  | ov-night-t0 | deterministic | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | ov-night-t30 | deterministic | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | ov-zoom-day | deterministic | 0.000000 | 0.000 % | 1 | equal | n/a | PASS |
  | ov-zoom-night | deterministic | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | pixel-360 | deterministic | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | pixel-720 | deterministic | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | ink-off | deterministic | 0.000002 | 0.000 % | 1 | equal | n/a | PASS |
  | train-day | deterministic | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | train-day-fx | transient | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | train-night | deterministic | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | bridge-day | deterministic | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | bridge-evening | deterministic | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | bridge-evening-fx | transient | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | free-day | deterministic | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | hud-hidden | deterministic | 0.000002 | 0.000 % | 1 | equal | n/a | PASS |
  | mobile-ov-day | deterministic | 0.000001 | 0.000 % | 1 | equal | n/a | PASS |
  | dom-hud-day | dom | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | dom-hud-night | dom | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | dom-help | dom | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | dom-toast-bridge | dom | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | dom-debug | dom | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |
  | dom-loading | dom | 0.000000 | 0.000 % | 0 | equal | equal | PASS |
  | dom-mobile-hud | dom | 0.000000 | 0.000 % | 0 | equal | n/a | PASS |

- **Probe (8/8 states exactly equal):** renderer counts, world summary, ordered lists (17 glows, 192
  shadow-hidden objects), 45 instanced meshes and the sign-canvas hash `8df1cf62` match.

  | state | calls | triangles | points | lines | geometries | textures | programs | s mod L | vs reference |
  |---|---|---|---|---|---|---|---|---|---|
  | ov-day-t0 | 1371 | 1,759,388 | 0 | 0 | 419 | 6 | 25 | 237.567 | equal |
  | ov-night-t0 | 1391 | 1,762,908 | 0 | 0 | 436 | 6 | 27 | 237.567 | equal |
  | ov-day-t30 | 1372 | 1,760,268 | 0 | 0 | 419 | 6 | 25 | 180.682 | equal |
  | train-day | 1323 | 1,737,724 | 0 | 0 | 419 | 6 | 25 | 37.057 | equal |
  | bridge-evening | 1170 | 1,734,040 | 0 | 0 | 419 | 6 | 25 | 37.057 | equal |
  | free-day | 867 | 1,704,230 | 0 | 0 | 419 | 6 | 25 | 237.567 | equal |
  | pixel-360 | 1371 | 1,759,388 | 0 | 0 | 419 | 6 | 25 | 237.567 | equal |
  | mobile-ov-day | 1010 | 1,704,838 | 0 | 0 | 415 | 5 | 22 | 237.567 | equal |

- **Performance (`parity:perf -- --runs 10`, alternating cold loads, `.parity-output/perf/perf.json`):**

  | metric (median of 10) | reference | clone | ratio | budget |
  |---|---|---|---|---|
  | BUILD ms (BUILDING → PREPARING labels) | 892.95 (CV 11.2 %) | 916.45 (CV 9.1 %) | 1.026 | ≤ 1.10 pass |
  | CPU submit, frozen (inverted EMA) ms | 4.48 | 4.40 | 0.983 | ≤ 1.10 pass |
  | CPU submit, running ms | 4.88 | 4.87 | 1.000 | ≤ 1.10 pass |
  | LOAD ENGINE ms (informational) | 1082.7 | 808.1 | 0.746 | – |
  | navigation → loader hidden ms (informational) | 8525.6 | 7917.2 | 0.929 | – |

  A 5-run pass had CV above 5 %, so the 10-run pass is the verdict (it also passed at 5 runs).
  SwiftShader CVs of 8–14 % are the noise of this profile; alternation keeps both sites under the same
  load. LOAD ENGINE is faster on the clone because its modules came from localhost.

  Heap (one run per site, 1200 page-side steps + 60 frames, sampling every 1 KB including collected
  objects): retained growth clone 497,724 B vs reference 472,088 B (limit reference + 64 KB: pass);
  allocation per step clone 73,825 B vs 101,366 B (≤ 1.10 ×: pass). Clone sites ≥ 1 KB/step mirror
  the reference's: `sheepGroundAt` 23.7 KB (24.6), the exclusion closure in `World#excluded` 14.8 KB
  (15.1), the render pass 9.7 KB (9.7), train placement 3.5 KB, bird animation 5.1 KB (6.7), sheep flock
  2.5 KB (12.5), cloud camera 1.9 KB (1.9), `heightAt` 1.6 KB.
- **Research recapture (28/28 ≥ 7/10, no exceptions):** overlaps 8–10 (01-loading-screen 8 because
  the logo is the project's own artwork; 06b 8; 05-train-camera, 10 and 16 at 9; all others 10);
  ΔmeanLuma within ±2.8; no clone page errors.
- **Independence audit:** 138 overlap hits over 248 tracked files, every one inside an allowance
  (UI/console strings 34, three.js idioms 30, DOM ids/classes/selectors 28, numeric values and option
  tables 24, API names 14, import map/CDN 5, standard algorithms 2, analytics snippet 1); structural
  similarity ≤ 0.22 for every JS/CSS file (`index.html` 0.53 from DOM ids, classes and labels); no
  file:line citations; no shared SVG hashes; nothing under `.parity-cache/` or `.parity-output/`
  tracked.
- **Smoke:** localhost passed every check (no errors, no failed or ≥ 400 requests, loader hidden,
  `[GAMEPLAY] Started`, `H · Hide HUD` toast, pagehide dispose, no analytics request). The GitHub Pages
  deployment that existed at sign-off time passed too, including 404s for the development-only
  paths; it has since been removed (the project is private and unpublished).
- **Instance dispatch:** wrapping `render`, `updateTimeOfDay`, `updateCamera` and
  `world.updateCloudCamera` on the live clone counted 2 calls each within 2 rAF.
- **Style bible 1–15:** all ticked against the contact sheet and the sign-off shots.
- **Reviewer:** the automated sign-off and the visual review of the logo, favicon and style bible were
  done by the implementation agent; the owner's own visual confirmation is still open.
