# Parity testing guide

How this repo proves that the independent re-implementation looks and behaves like the original
site, without ever using the original as a text source.

## 1. Purpose and the three layers

The clone is written from specs (tables, formulas, contracts). The original is used only at
runtime, as a black-box oracle:

| Layer | Where | What it proves |
|---|---|---|
| Node parity | `tests/parity/*.test.mjs` + `tests/helpers/*` | original modules from `.parity-cache/original` run in node: World build steps, scene-graph signatures, a seeded simulation oracle |
| Browser captures | `tools/parity/capture-…`, `compare-…` | the live original vs the local clone, frozen in identical states, screenshot and pixel-diffed |
| Runtime probe | `tools/parity/runtime-counts-probe.mjs` | `renderer.info`, world/sim fields, post-pass outputs, hook and debug-menu behaviour on both sites |

**Independence rule:** nothing from the original's JS/CSS/GLSL/HTML/SVG is copied into the repo.
Helpers never modify the original modules on disk; the browser hook is our own snippet inserted
into the original's response inside the test browser only. Code comments never cite the
original's files or lines.

## 2. Setup

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install   # or plain npm install
npx playwright install chromium                 # or point CHROMIUM_PATH at a full Chromium/Chrome
npm run parity:fetch                            # original modules → .parity-cache/original (TARGET_URL overrides)
```

`PARITY_RESEARCH_DIR` locates the research material that lives outside the repo (reference PNGs,
the research `captures/capture-log.json` and `capture-log-extras.json` with L-key poses). Default:
`<repo root>/../plans/260930-train-diorama-clone/research` (resolved). It is resolved only by
`resolveResearchDir()` in `tools/parity/parity-shot-list.mjs`. When the directory is absent,
reference checks skip with `research captures not found at … — set PARITY_RESEARCH_DIR` and the
compare report writes `referencePath: null`.

## 3. Node parity

| Helper | API |
|---|---|
| `original-module-loader.mjs` | `originalSkipReason([...files])` → `false` or a skip message; `importOriginal(file)` |
| `minimal-dom-shim.mjs` | `installMinimalDomShim()` → `{canvases}` (idempotent); canvases record every 2D-context set/call in `operations` |
| `original-world-stepper.mjs` | `ORIGINAL_BUILD_STEPS` (14), `CLONE_TO_ORIGINAL_STEP`, `INLINE_ORIGINAL_STEPS`, `toOriginalStep`, `buildOriginalWorld({stopAfter, skip})` → `{world, stoppedAfter, milliseconds}` |
| `original-simulation-oracle.mjs` | `createOriginalSimulation({world})`, `stepOriginalFrame(ctx, dt)`, `setOriginalMode`, `snapshotSimulation`, `runWithSeededMathRandom(seedOrGenerator, fn)` (a seed restarts mulberry32 per call; a generator function keeps one stream running across calls), `withCapturedConsole(fn)`, `ORACLE_MATH_RANDOM_SEED` |
| `oracle-camera-controls-stub.mjs` | `cameraRig()` → `{camera, controls, firstPersonControls}` stubs (home pose, reset semantics only), shared by the oracle and the clone driver |
| `clone-simulation-driver.mjs` | `createCloneSimulation({world})` (ctx with the oracle's shape: sim fields, `cameraRig()` stubs, `puffTimer` accessor onto the pool; without `world` the runtime `composeDioramaScene` builds a clone World and the scene), `stepCloneFrame(ctx, dt)`, `snapshotTrainState(ctx)` |
| `sheep-flock-parity-lockstep.mjs` | `firstSheepFlockMismatch(original, clone)` → null or `{sheepIndex, field, original, clone}` (in place, `Object.is`: count, state fields, orientation, route fields, the three raw instance arrays); `runSheepLockstep({frames, stepOriginal, stepClone, beforeFrame, compare})` → `{mismatch: {frame, …} \| null, logs: {original, clone}}` (per-side `mulberry32(20260930)` Math.random and `[SHEEP]` log buffers, restored in `finally`) |
| `smoke-puff-behaviour-checks.mjs` | `trackPuffs(ctx, dt)` → log with `record(frame)` (call after each step: spawns with the interval the pool saw, live counts, emission gate, speed); `assertPuffBehaviour(log, {expectedDwellGaps})` |
| `fresh-process-train-material-ids.mjs` | `freshProcessTrainMaterialRows('clone' \| 'original')` → per mesh `[material id − smallest, type, name]` from a `new Train()` built in a child node process (cold npr caches); `buildTrainMaterialRows(side)` is what the child runs |
| `quantised-number-hashing.mjs` | `quantise`, `hashNumbers(values, scale)` (two-lane FNV over quantised words), `hashString` |
| `typed-array-fnv1a-hash.mjs` | `fnv1aHex(typedArray)` → 8-hex FNV-1a-32 of the raw bytes (golden hashes in `npm test`) |
| `scene-graph-signature.mjs` | `sceneGraphSignature(root, {exclude, geometry})` → DFS `{path, key}`; `compareSceneSignatures(a, b, {labels, ordered})`; `SHARED_UNIFORM_NAMES` |
| `clone-world-factory.mjs` | `createCloneWorld({stopAfter, skip})` (CM off and the DOM shim installed before the World import); `WORLD_CORE_SKIP` = every non-core step (station … perches) |

World-core suites:
- `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` (always runs, `npm test`):
  geometry helpers, registry semantics, golden scalars (length, bridge, frames, 53 children,
  383/76 instances, height/heightTex ranges, 3,737 sand vertices, abutments, chord
  baseA/baseB/apex) and FNV-1a-32 hashes of the raw bytes of heights, heightTex, sx, sz, terrain
  colour/position/normal and skirt position/topY; a warm build draws `Math.random` exactly 444
  times (111 UUIDs).
- `tests/parity/terrain-track-bridge-parity.test.mjs` (`npm run test:parity`, cache-gated):
  (a) frames/sx/sz/bridge bytes, (b) graded heights, (c) six-pad flatten sequence (heights and
  `buildingFoundations` after each pad, then terrain bytes), (d) terrain/skirt/heightTex bytes and
  texture settings, (e) 10,000 seeded `nearest`/`heightAt`/`pointAtS`/`tangentAtS` samples,
  `inBridge(−2..1202)` and `excluded` with 40 shared circles at pads 0/0.8/1/3, (f) multiset and
  ordered (child order) signatures, npr request order as ranks of the distinct `material.id`s in
  child order (equal on both sides, `[0,1,2,4,3,5,6,7,8,9]`), part counts and chord values,
  (g) equal warm UUID draws, (h) build time: 2 warm-ups
  then 7 rounds alternating which side builds first, median clone ≤ median original
  (`PARITY_SKIP_PERF=1` skips it; the check is timing-sensitive, so on a loaded machine rerun the
  file alone or set the flag for full-suite runs).
Station suites:
- `tests/unit/station-sign-clock-and-build-counts.test.mjs` (`npm test`, no oracle): the sign's 20
  recorded context writes, clock angles via `updateStationClock` (`Object.is` against the formula,
  12:00 before any update, 3:00 at t = 0), placement scalars (frame 1008, o = −1, computed E),
  27 exclusions, 2 pads, 2 halo meshes, 70 station children, 20 building children and the 9 merge
  colours in order, the 600-index path, sign texture settings, and `stepSimulation` → world update.
  Golden layout values (equal to the original's, so they hold without the cache): `stationS`
  236.45464110639873, group position/quaternion/`rotation.y`, `freeCameraStart`, both
  `buildingFoundations`, and FNV-1a-32 hashes of heights, the 27 exclusions (x, z, r as float64),
  footpath position and index; `buildStation` sits strictly between `buildBridge` and `buildTerrain`.
- `tests/parity/station-parity.test.mjs` (cache-gated): `stopAfter: 'buildStation'` on both sides —
  `stationS`, frame 1008, group position/quaternion/rotation, `freeCameraStart`, heights bytes,
  `buildingFoundations`/`exclusions`, multiset + ordered `world.group` signatures with the
  original's `stationTravelers[].figure` excluded, `noShadow` signatures in order, ordered
  (type, material type, colour, position) child tuples of the station group and building, sign
  recordings, and clock angles against the original `World#update` (which throws a `TypeError`
  right after the clock on a partial world); then `stopAfter: 'buildTerrain'` with village and
  windmill skipped for heights, `heightTex` and terrain signatures (pads baked).
Train suites:
- `tests/unit/train-station-motion-controller.test.mjs` (`npm test`): the pure motion
  functions with L = 276.13647750761754 and S = 236.45464110639873 (states built as s = S − a,
  expectations from the same double-remainder distance): cruise, justLeft window (strict 30 / L − 30),
  √ profile, 0.35 floor, exact snap, dwell 241/81/121 frames at 1/60, 0.05, 1/30, speedMul 0 coast,
  slider drop mid-brake, `computeBrakeStrength` gates (dt 0 → 1), lap goldens (brake 2043, snap
  2447, departure 2688, period 2713, max strength 0.3697119847898378 at ×1; 857/1019/1270/1 at ×2.5;
  4018/4809/5101/0.0907… at ×0.5) and the 1 → 2.5 → 0 → 0.5 → 1 schedule over 18000 frames;
  `puffEmissionInterval`. `diorama-scene-composition-order.test.mjs` checks the composed scene:
  children [world, train, sparks, sky, 70 puffs], the shadow list, the train glows last in the
  registry and the departure state.
- `tests/parity/train-model-and-motion-parity.test.mjs`: structure goldens always run (offsets,
  `totalLength` 25.650000000000002, wheel order/radii, children [28, 7, 27, 27, 27, 27], merged
  batches [12, 3, 6, 6, 6, 6] with colours and triangles, 149 meshes, 49 empty groups + 1 empty
  Object3D, 55 geometries, 20998 triangles, 9 `noShadow` objects, 6 glows, cone quaternion); cache-gated:
  multiset + ordered signature vs `new Train()` of the original, object and geometry ids relative
  to each counter's start (allocation order), byte-equal merged
  position/normal/uv/index per car and batch, and `update(world, s)` for s = −40 + k·0.3171
  (k < 1000) with a shared original World and with the clone World (`Object.is` everywhere).
  Material ids are compared in fresh child processes, since the npr cache is warm once any train
  exists: always, the coach glow material ids step 25, 26 (the green coach adds a body material),
  25; cache-gated, the per-mesh `[relative id, type, name]` rows equal the original's. Material id
  is the opaque sort key, so this catches palette or glow creation-order drift that every other
  check misses.
- `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` (cache-gated): the
  composed clone scene's layout equals the oracle's; then the oracle, clone variant A (a second
  original World) and clone variant B (clone World) step 18000 frames at 1/60 on the slider
  schedule, each wrapped in `runWithSeededMathRandom` with its own persistent
  `mulberry32(ORACLE_MATH_RANDOM_SEED)` stream and console silenced. Every frame: s, speed,
  stopTimer, justLeft, puffTimer, recorded brake strength and spark matrix bytes (A); every 30
  frames and at the end: `snapshotTrainState` deep-equal on both ctx shapes plus camera fields
  (A), puffs and cars (B). B's spark buffers are compared only when the clone World's heights are
  byte-equal to the original's (a `[PARITY]` diagnostic says when they are skipped). Then the
  headlight uniforms from `writeHeadlightUniforms` equal the oracle's render values, and a
  120 s run at ×1 checks that strength appears only in the brake zone, live sparks only between a
  lap's first braking frame and its snap + 1.15 s, and the smoke against the spec formulas: a live
  puff on every frame; every spawn gap with the emission gate held equals the interval rounded up
  to whole frames (16 dwell gaps of 0.55/1.2 s → 28 frames); the live count stays between the
  spawns of the last 2.4 s and 3.6 s; after 3.6 s at ≥ 7.4 u/s the mean live count is within 2 of
  mean lifetime ÷ gap (3.0 s ÷ 4 frames = 45).
- Node stepping order is written once, in `stepCloneFrame`: `world.nightAmount ← uNight` →
  `stepSimulation(ctx, dt·timeScale)` only when not paused and timeScale > 0 → `updateCameraRig`
  (unscaled dt) → `world.updateCloudCamera(camera.position, dt)` (unguarded since P12) → `scene.updateMatrixWorld()`,
  mirroring `stepOriginalFrame` and the browser frame loop (the clone ctx has no time-of-day
  transition: for a night run call `applyPalette(LIGHTING_UNIFORMS, 'night')` beside the oracle's
  `setTimeOfDay('night', true)`). Later phases add work inside
  `stepSimulation` (birds) or the camera rig (modes), never to this order. One serializer
  (`snapshotTrainState`) reads only parity-surface fields, so it runs on both ctx shapes.
- Always pair `WORLD_CORE_SKIP` with `stopAfter` at or before `'buildTerrain'`: the original builds
  village residents inline right after the terrain and crashes without a village.

Per-feature pattern:
- Build steps: `buildOriginalWorld({stopAfter: 'buildTrack', skip: [...]})` vs the clone's
  `new World({stopAfter, skip})`, then `compareSceneSignatures` (pass `ordered: true` where scene
  insertion order is part of the contract).
- Simulation: the oracle vs the clone driver, both stepped inside
  `withCapturedConsole(() => runWithSeededMathRandom(seed, …))`, comparing `snapshotSimulation`,
  dynamic signatures (`geometry: false`) and logs.

Rules:
- Import helpers, never the original modules directly.
- Gate original-dependent tests with `{ skip: originalSkipReason([...]) }`; without the cache they
  report a skip, not a failure. Pure harness tests always run.
- Use `exclude` for subtrees the clone has not ported yet. Compare `birdPerches` only after full
  builds (the clone bakes every perch in its last build step).
- The stepper restores every patched `World.prototype` method on every exit path (normal, sentinel
  stop, build error), so stepped and full builds can share one process.
- Signatures never hash shader source; shared lighting/night uniforms are excluded (their binding
  is per build). The oracle skips the original's uniform rebinding, because the original's `npr()`
  cache is process-wide.

## 4. Browser capture

```bash
npm run parity:capture -- --target both          # clone | original | both; --shots a,b; --stage s; --profile p; --out dir
npm run parity:compare                           # --shots a,b; --in dir; --region all|none|name,name
npm run parity:probe                             # see section 6
```

Env: `TARGET_URL` (original, default the live site), `CLONE_URL` (else a static server is
auto-started on port 4317), `CHROMIUM_PATH`, `PARITY_RESEARCH_DIR`.

Recipe (identical on both sites; every in-page step uses parity-surface names only):
1. Fresh context per session: `localStorage` settings cleared once, `Math.random` = mulberry32(20260930)
   via init script (`window.__parityReseed(seed)` resets it), Vercel analytics blocked. The
   original's `TrainScene.js` is route-patched with our hook (exactly one anchor or it fails).
2. Load `?parity=freeze`; wait for the hook, the hidden loader, `#debug-menu` and fonts.
3. Freeze: `paused`, `overviewIntro = null`, auto-rotate off, and **at freeze time** instance
   no-ops for `updateCamera` and `world.updateCloudCamera` (originals stashed), so real-dt code
   in the paused loop cannot move the camera or clouds.
4. Per shot: `setMode('overview')` first (its double reset lands on the deterministic home pose),
   then the shot's mode; palette applied immediately; pixel/outline. Reseed, then step
   `round(seconds·60)` frames at dt 1/60 in one synchronous evaluate (time-of-day, nightAmount,
   time/uTime, train, world, birds, stashed camera + cloud-camera updaters; no render).
5. Optional camera pose, then hide sets (always after stepping: puff spawns re-show meshes), then
   the shot's page actions (`page-shot-actions.mjs`, in this order): `uniformTimeOffset` (adds n to
   `lightingUniforms.uTime` without a sim step), `debugLayerOff` (clicks the `#debug-layers`
   checkbox whose label matches, which works with the `<details>` closed, and captures the change
   handler's log line), `inPageCameraPose` (named in-page registry resolved to world-space points,
   then applied like a `camera`; `villageResidentYard` = home frame of `villageResidents.residents[0]`,
   camera (−1.5, 2.4, depth/2 + 5.5) → target (0, 0.7, depth/2 + 0.65)), `holdPausedFrames` (waits n
   animation frames while paused, recording `uTime` before and after). The results go into the meta
   as `shotActions`.
6. 3D shots: UI hidden, rendering on, 2 rAFs, full-viewport screenshot. The capture CSS
   (`captureCssText`) hides each UI root and all its descendants with `transition: none
   !important`: a running transition outranks `!important`, so the seven `transition-all` HUD
   buttons would otherwise stay visible for several SwiftShader frames and leak into cheap shots.
   DOM shots: canvas hidden (flat `#app` backdrop), rendering off (keeps SwiftShader from starving
   timers), actions, finite animations awaited, clip around the selectors, `mask` painted `#ff00ff`.

Shot schema: `{id, stage, kind '3d'|'dom', viewport, mode, timeOfDay, pixelShortSide, outline,
seconds, hide, camera, fresh, actions, selectors, pad, mask, keepToast, reportOnly, parkTrain,
regions, uniformTimeOffset, holdPausedFrames, debugLayerOff, inPageCameraPose, relation,
thresholdClass, reference}`. `relation` = `{to, expect: 'differs', minOverFraction}` or
`{to, expect: 'identical'}` (same-site check against another shot, see section 5). `regions` names screen regions (`village`, `windmill`; see
"Regions" below) the shot is judged on. `camera` is `{position, target, fov?}` in world space, or with
`relativeTo: 'loco' | 'station'` in that object's local frame (station group = parent of the
clock building, the same lookup on both sites), or `{relativeTo: 'freeCameraStart', fov}` (copies
`world.freeCameraStart`); a missing `fov` keeps the mode's FOV. `parkTrain` runs `parkTrainAway`
after stepping: `train.update(world, (s + L/2) % L)` when both a train and a world exist (moves
the hidden train and so its headlight uniform away from the station; no-op otherwise). `reportOnly` shots are never picked by stage selection (request them with `--shots`)
and `parity:compare` prints them as `REPORT(PASS|FAIL)` without failing the run.
`reference` is a bare research capture file name or `null` (clone-vs-original only). Consecutive
non-fresh shots on one viewport share a page load; fresh shots (`seconds > 0`, DOM actions or any
page action, or set explicitly) get their own.

Hide sets: `world`, `train`, `birds`, `puffs`, `sparks`, `clouds`, `trees`, `stationFigures`
(`world.stationTravelers[].figure`), `sheep` (`world.sheep`, `sheepLegs`, `sheepEars`), `balloon`,
`villageResidents` (`residents[].figure` + `dog`), `houseSmoke` (`houseSmoke[].mesh`) (objects by
field; a family a site lacks hides nothing), `unbuiltAfterWindmill` (every `world.group` child after
the windmill group and the 4 terrain meshes that follow it — on the original 46 children: 2
resident groups, 8 instanced meshes (4 tree layers, rocks, sheep body/legs/ears), water, waterfall,
33 cloud groups and the balloon — plus `world.stationTravelers[].figure` (2) and `d.birds.group`,
49 objects in all; it runs on both sites
and hides nothing on a clone that lacks those steps; as residents/trees/rocks, sheep,
water/clouds/balloon and the station figures/birds land on the clone they are hidden on both sites
alike, so drop this set from a shot once its subject should be compared too) and
`water` (direct `world.group` meshes whose shader has no `uColor` uniform: the water surface and
the waterfall; 2 on the full original) and
`allButWorldCore` (every mesh except `d.sky` whose material is neither terrain (`FLOWERS` define)
nor skirt (`STRATA` define) nor one of the flat world-core signatures `uColor hex|uStipple`:
`a39a8c|0.5` ballast, `8f8f9e|0.05` rail, `6e4a32|0.25` sleeper, `6b4630|0.12` plinth wood,
`3f2a1f|0.1` plinth trim, `b8432f|0.12` red, `8a2f24|0.1` dark red, `b9ae98|0.35` stone; on the
full original it keeps exactly the 53 core children). Presets: `skyOnly`, `transient`,
`allFamilies` (every family above except `world`/`allButWorldCore`, plus the transients). The
former `cloneMissing` preset (systems the clone still lacked, hidden alike on both sites) was
retired when the station figures and birds landed (P13): every shot now compares the full scene
except what it names itself. Presets and hide sets live in `parity-shot-stages-and-hide-sets.mjs`,
validation in `parity-shot-validation.mjs`; `parity-shot-list.mjs` re-exports both. The in-page
function lives in `page-hide-set-application.mjs`; restores run in reverse order so overlapping
sets give back the original visibility.

Stages: `shell-and-sky` → `train` → `village-and-windmill` → `residents-and-forest` → `full-scene`. A shot runs when its
stage index is ≤ the selected stage; `--shots` overrides gating. To add a shot, append one line in
`parity-shot-list.mjs` at its stage (the `shot()` factory and the camera poses live in
`parity-shot-factory-and-camera-poses.mjs`); when a stage's features land, advance
`ACTIVE_PARITY_STAGE` (now `full-scene`, so a plain `npm run parity:capture` runs every
non-report-only shot).

Residents and forest shots (stage `residents-and-forest`; hide `transient`, so the full scene is
compared; the `-masked` ids are historical; deterministic thresholds):

| Shot | Steps | Pose / actions | Reference |
|---|---|---|---|
| `overview-day-settled-masked` | 180 | overview home | 14-overview-day-settled |
| `overview-zoomed-orbited-masked` | 180 | `ZOOMED_ORBITED` (logged 12b pose (−69.894, 19.728, 15.753) → (0, 4, 0)) | 12b-overview-zoomed-orbited |
| `overview-night-masked` | 180 | overview home, night | 04-overview-night |
| `village-residents-yard` | 480 (woman mid-walk, cycle ≈ 8.05) | `inPageCameraPose: 'villageResidentYard'` | – |
| `trees-sway-t0` | 0 | 12b pose, `fresh: true` (own page load, like t1) | 12b-overview-zoomed-orbited |
| `trees-sway-t1` | 0 | 12b pose, `uniformTimeOffset: 5`; relation differs from t0 (≥ 0.05 %) | 12b-overview-zoomed-orbited |
| `trees-sway-hold` | 0 | as t1 + `holdPausedFrames: 20`; relation identical to t1 | – |
| `trees-debug-hidden` | 180 | overview home, `debugLayerOff: 'Trees'` | 14-overview-day-settled |

Sheep shots (`sheep-flock-parity-shots.mjs`; same stage, hide `transient`,
deterministic thresholds, in-page pose `sheepFlockCloseup` = rail sheep 2's center − outward·9 +
(0, 5, 0) + tangent·3, looking at center + (0, 0.5, 0); both sites build it from their own route,
which the probe proves equal):

| Shot | Time of day | Frames stepped | Shows |
|---|---|---|---|
| `sheep-flock-day-closeup` | day | 120 | the three rail sheep grazing on the track |
| `sheep-flock-night-closeup` | night | 600 | night colours (rail sheep stay awake) |
| `sheep-track-hop-1` | day | K2 − 12 = 812 | sheep 2 crouching before its hop |
| `sheep-track-hop-2` | day | K2 + 20 = 844 | sheep 2 mid-hop |
| `sheep-track-hop-3` | day | K2 + 90 = 914 | sheep 2 waiting on its safe spot |

K2 (`SHEEP_HOP_K2`, 824) is the probe's hop frame for sheep 2; the probe fails if the measured K2
differs from the pinned value, so re-measure and update the constant if train or sheep timing changes.

`station-free-start-day` / `-night` (free-camera start pose, FOV 65, train parked away, hide
`train` + `transient`; references 07 and 17) moved here from the shell stage and
are strict now that the trees stand on the clone.

By day `uTime` moves the tree sway and the water/waterfall patterns on both sites (local-glow
flicker is × uNight = 0), so t1 vs t0 shows the sway plus the water; the hold relation still proves
the paused clock.

Water, cloud and balloon shots (`water-clouds-balloon-parity-shots.mjs`; same stage, 600 frames
stepped so sim time is 10.05 s, hide `transient`, deterministic thresholds; the
settled S1/S7 views are `overview-day-settled-masked` / `overview-night-masked` and the evening
bridge is `bridge-camera-evening`):

| Shot | Time of day | Pose / extra | Reference |
|---|---|---|---|
| `overview-zoomed-day-masked` (S5) | day | Z = `ZOOMED` (home dollied by 0.95^14.4 toward (0, 4, 0)) | 12-overview-zoomed-in |
| `overview-zoomed-night-masked` (S4) | night | Z | 17-night-overview-zoomed |
| `overview-day-waterfall-roi` (S2) | day | overview home, region `waterfall` (judged on the crop) | 11b-hud-hidden-no-toast |
| `balloon-closeup-day` (S6) | day | B: (26.92, 26.36, 10.96) → (31.92, 25.06, 4.96) | 12-overview-zoomed-in |
| `balloon-closeup-night` (S6n) | night | B | 17-night-overview-zoomed |
| `water-closeup-day` (W1) | day | W: (−4, 24, 18) → (−2, 0, 2) | 12-overview-zoomed-in |
| `water-closeup-night` (W2) | night | W | 17-night-overview-zoomed |
| `waterfall-closeup-day` (W3) | day | F: (0.3, −4, 96) → (0.3, −9, 64), `clouds` hidden | 11b-hud-hidden-no-toast |
| `waterfall-closeup-night` (W4) | night | F, `clouds` hidden | 17-night-overview-zoomed |
| `clouds-debug-hidden` | day | overview home, `debugLayerOff: 'Clouds'` | 14-overview-day-settled |

Water and waterfall GLSL is never compared as text: the shaders are written independently, and
these renders (plus S1/S7) are the proof of output parity.

Travelers and birds shots (`station-travelers-and-birds-parity-shots.mjs`; stage `full-scene`, mode
`orbit` (free) with a fixed pose applied after stepping, day, native, outline on, `transient`
hidden, deterministic thresholds):

| Shot | Seconds | Pose | Shows | Reference |
|---|---|---|---|---|
| `station-travelers-closeup` | 6 | (−45.479, 10.8, −10.431) → (−47.944, 9.9, −3.52) | walker and grandmother (her only view: she stands behind the default free-camera start) | – (no capture shows her) |
| `station-roof-birds-takeoff` | 0.6 | (−44.5, 12.5, −8.5) → (−49.465, 11.9, −2.46) | the station-roof flock crouching / lifting off at load | – |
| `bridge-birds-in-flight` | 9 | (−11.686, 11.96, 53.896) → (−4.75, 15.5, 36.5) | bridge flocks circling above the deck | 06b-bridge-camera-later |

Village and windmill shots (stage `village-and-windmill`; 3 s stepped, hide `unbuiltAfterWindmill`
+ `transient`, house smoke visible, regions `village` + `windmill`, deterministic thresholds per
region):

| Shot | Time of day | Pose | Reference |
|---|---|---|---|
| `village-windmill-overview-day` | day | overview home | 14-overview-day-settled |
| `village-windmill-zoomed-day` | day | zoomed (12 wheel notches) | 12-overview-zoomed-in |
| `village-windmill-evening` | evening | overview home | 03-overview-evening |
| `village-windmill-zoomed-night` | night | zoomed | 17-night-overview-zoomed |

Regions (`shot-region-projection.mjs`): computed in the page right after `prepareShotScene` (the
camera updater is already a no-op): `village` = Box3 over the houses (distinct parents of
`houseSmoke[].mesh`) ∪ the shrub mesh (the `world.group` child after the last house), `windmill` =
Box3 over `windmillBlades.parent`; the 8 corners are projected with `d.camera` (after
`updateMatrixWorld`) to CSS px, padded 12 px and clamped to the viewport. The meta stores
`regions: [{name, x, y, w, h}]` (CSS px) and `devicePixelRatio`. Both sites compute them; compare
uses the original's (warning if they differ).

Train-only shots (stage `train`; hide `world` + `birds`; both sites reseeded right before stepping;
camera in the locomotive's frame: the page refreshes the loco world matrix (parents only) and
converts both points with `localToWorld`, then `lookAt`):

| Shot | Time of day | Steps (sim time incl. the 0.05 s warm-up) | Pose (loco frame) | Effects | Reference |
|---|---|---|---|---|---|
| `train-only-braking-front-day` | day | 2160 (36.05 s: braking, ahead ≈ 13.08, sparks live) | (4.5, 2.6, 6.5) → (0, 1.2, 0.5) | visible | 05-train-camera |
| `train-only-braking-front-day-no-effects` | day | 2160 | same | hidden | 05-train-camera |
| `train-only-dwell-side-day` | day | 2520 (42.05 s: dwelling) | (−11, 3.2, −9.5) → (0, 1.4, −9.5) | hidden | – |
| `train-only-night-headlight` | night | 540 (9.05 s: on the bridge) | (−14, 5.5, −3) → (0, 1.6, 7) | hidden | 18-night-train-camera |

Threshold class with transient effects: hidden (`hide` includes `transient`, i.e. puffs + sparks)
→ deterministic. Visible → transient (≤ 3.0 / ≤ 3 %), tightened to deterministic only when both
sites are reseeded and the clone's heights near the braking zone are byte-equal to the original's
(sparks bounce on the terrain). Both hold for `train-only-braking-front-day` (heights within 8
units of the track from the stop − 35 to + 5 are equal; only the village/windmill pads differ), so
it is deterministic. The P04 shots `train-only-day`/`-night` (loco chase pose, effects hidden) and
`train-smoke-day` (4 s, smoke visible, transient) are in the same stage.

## 5. Compare

| Class | meanAbsDiff | pixels with a channel diff > 16 |
|---|---|---|
| deterministic | ≤ 1.0 | ≤ 0.5 % |
| transient (puffs/sparks visible) | ≤ 3.0 | ≤ 3 % |
| dom | ≤ 0.5 | ≤ 0.2 % |

A shot passes when sizes match, both metas have no page errors, both metrics are within its
class and its same-site checks hold (`intra-site-shot-checks.mjs`): a `relation` is judged on each
site between this shot's PNG and the `to` shot's PNG (`differs`: share of pixels with a channel
diff > 16 ≥ `minOverFraction`; `identical`: max channel diff 0), and recorded shot actions must have
done their job (`holdPausedFrames`: still paused and `uTimeBefore === uTimeAfter`;
`debugLayerOff`: unchecked and logged `[DEBUG] <label>: hidden`). Results are in
`compare-report.json` under `intraSite`. Regional shots (metas with `regions`) are judged per region instead: both PNGs are cropped
to each region × `devicePixelRatio` (rounded outward, clamped to the image) and every crop must be
within the class; whole-frame metrics are still printed and stored for information (`[name mean=…]`
per region on the console, `regions[]` in `compare-report.json`, region outlines in cyan on the
heat panel). `--region none` judges the whole frame, `--region village` only that region. Warnings (never failures): `runId`, `profile`, `executablePath` or `webglRenderer`
differing (shot folders are never cleared, so a one-target or partial capture leaves stale PNGs
from another run); capability differences; `timeAtFreeze` or
`fredokaReadyAtBuild` differing while both sites have a world (build time and the station sign's
font only exist once a world is built; a world-less clone builds faster and earlier than fonts
load, so they are expected to differ until then); and `cloudOffsetMax > 0` on either site.

Outputs: `.parity-output/shots/<target>/<id>.png|json`, `.parity-output/capture-log.json` (our
metas; not the research capture log), `.parity-output/compare/<id>.png` (original | clone |
heat: grey = equal, amber = diff ≤ 16, red = diff > 16) and `.parity-output/compare-report.json`.

Research capture → shot: 14 → `sky-day`/`hud-day`/`overview-day`, 03 → `sky-evening`, 04 →
`sky-night`/`hud-night`, 08/08b → pixel shots, 09 → ink-off, 10 → `help-panel`, 15 →
`debug-menu` (perf text masked), 16 → `toast-bridge`, 01 → `loader-card` (layout only: the logo
is our own artwork, so `.load-logo` is masked on both sites; its box is still compared), 13 →
mobile shots, 05/18/06b/19/07/12/17 → train/full-scene shots, 14/06b → the report-only
`world-core-overview` (home pose) and `world-core-bridge` (position (−3, 5.5, 60) → (0, 8.5, 36),
FOV 42; fixed target, since the original's bridge camera follows the train), strict since every
building pad exists on the clone; 14/12/03/17 → the four `village-windmill-*` shots; 14/12b/04 → the masked `residents-and-forest`
shots (12b through its logged camera pose). Not captured: 02a/02 (time-dependent
intro, covered by unit tests), 05-motion-2..3 and 06 (mid-blend), 11/11b (overview with the UI
hidden). The four sky-direction shots (`sky-sun-day`,
`sky-moon-night`, `sky-stars-night`, `sky-hills-evening`) look from (0, 4, 0) along a fixed
direction and have no reference.

## 6. Probe

`npm run parity:probe -- [--target t] [--scenario default|sky-only|both] [--profile p] [--strict] [--skip-checks] [--skip-post-probe] [--shot id] [--fields a,b]`

`--shot <id>` probes only that shot's scene, prepared exactly as the capture does
(`prepareShotScene`: shot state, reseeded stepping, parking, pose, hide sets), rendered for 2
frames; the station, post and hook sections are skipped and the output goes to
`probe-<id>.json`. `--fields` limits the cross-site diff to those `renderer` fields. The train-only
probe compares `render.calls` and `render.triangles` only until the full scene exists (programs,
geometries and textures include what the partial clone world compiles on the first frame):
`npm run parity:probe -- --shot train-only-braking-front-day-no-effects --fields calls,triangles`.

Per target: frozen default state (overview, day, native, outline on). Scenario `default` renders
everything, `sky-only` hides world/train/birds/puffs/sparks. Fields: `renderer` (calls, triangles,
points, lines, geometries, textures, programs), canvas, pixel ratio, scene counts, sim, world
(length, stationS, bridge, houses, homes, tree instances, rocks, sheep, clouds, windmill, clock,
free-camera start, exclusions, foundations, perches, heights sum), train, birds; floats at 1e-4.
`village` (null without houses; exact, unrounded): `houseCount` (= `houseSmoke.length / 12`),
`villageHomePositions` (`villageHomes[i].house.position`), `windmillPosition` (world position),
`windmillQuaternion` (the group's own quaternion: `world.group` is the identity, so this is its
world rotation without decomposition noise), `windmillRoofHeight`, `bladeChildCount`,
`bladeRotationZ`, `smokeTransforms` (per puff position, scale, `rotation.y`). After K stepped
frames equal rotor angles and puff transforms on both sites prove `world.update → updateWorld`
slots 8–9. The village section is compared in every scenario, also when `--fields` limits the
renderer fields; the console prints `village equal` or the first differing path. Draw counts under
`unbuiltAfterWindmill`: `npm run parity:probe -- --shot village-windmill-overview-day --fields
calls,triangles`.
The sky-only diff compares only calls/triangles; default compares everything.
`forest` (`forest-residents-runtime-probe.mjs`; null without tree layers): `treeCounts`
(`treeLayers[i].count`), `rockCount` (the instanced mesh after `treeLayers[3]`),
`residentMeshCount` (meshes under `villageResidents.residents[].home`), `exclusionCount` and
`hasSheepFlock`. Judged in every scenario as `PASS|FAIL forest <scenario>`: the three counts must be
equal and the exclusion delta must be −3 per site lacking the flock's three trackside clearings
(0 now that both sites build the flock).
`sheep` (`sheep-flock-runtime-probe.mjs`; its own fresh frozen page per site, default shot state,
no hide sets): `counts` (body, leg, ear instance counts), `routes` (id, distance, center, outward,
tangent per rail sheep, unrounded), `firstPasture` (x, z of the first three pasture sheep),
`strandingCandidates` (pasture sheep within 2.2 of a clearing: the null-height sink candidates) and
`hopFrames` K1..K3: the world update is wrapped in the page, then 4000 frames are stepped at 1/60 s
from the first step after the preamble; Ki is the first frame route i enters `escaping` in an
episode whose startle (or same-step startle + jump) began after frame 60. Printed as `PASS|FAIL
sheep probe: hop frames [K1,K2,K3]`; every field must be equal, all three hops found, and K2 must
equal `SHEEP_HOP_K2`.

`waterCloudsBalloon` (`water-clouds-balloon-runtime-probe.mjs`; in every scenario, null without a
balloon flame; full float precision): `time`, `cloudCount`, per cloud `position` (drift position
without the avoidance offset), `speed`, `travelWidth`, `instanceCount` (the single InstancedMesh
child), `instanceTotal`, `windmillRoofHeight`, `balloon` (position), `water` {`heightTexBound`,
`size`, `inNoShadow`} (first `world.group` mesh with a `uHeight` uniform) and `waterfall` {`side`,
`vertices`, `indices`, `inNoShadow`} (the child right after the water). Printed as `PASS|FAIL
water/clouds/balloon <scenario>`: each site must have 33 clouds with Σ 464 instances, roof height
22.266444503377606, a balloon within 1e-6 of the closed-form flight at its `time`, the water bound
to its own `heightTex` with size 124, a DoubleSide 225-vertex / 1152-index waterfall, both in
`noShadow`, and every value equal across sites. Clouds are the last world.rand consumer, so this
also proves the whole placement stream in the browser.

`stationTravelersAndBirds` (`station-travelers-and-birds-runtime-probe.mjs`; in every scenario,
null without birds or a walker; full float precision): `birdFlocks`, `birds`, `perchIds`,
`flockModes`, `stationTravelers` and `walker` {`position`, `yaw`, `stopIndex`, `wait`}. Printed as
`PASS|FAIL travelers/birds <scenario>`: each site must have 7 flocks, 18 birds, perch ids
`bridge-1, bridge-2, bridge-3, station-roof, trackside-2, trackside-3, trackside-4`, 2 station
travelers, and every value equal across sites. The per-scenario sections (village, forest,
water/clouds/balloon, travelers/birds) are collected and judged by `scenario-probe-sections.mjs`.

Post synthetic-input probe: a 64×64 colour ramp and a two-level float depth texture go through
each site's post material for 18 combinations of outline × (night, saturation) × (pixel,
thickness); outputs must match within 1 per channel. `spreadFromFirst` shows the probe is
sensitive.

Checks (both sites): debug-menu DOM tree and attribute order, toggle logs/visibility with no page
error (a world-less clone toggles nothing but still logs), 0 perf mutations in 1600 ms closed and
≥ 2 open, hidden under `body.hud-hidden`, no `__diorama`/`[PARITY]` without the param, `?parity`
live and unpaused, `?parity=freeze` paused with `[PARITY] Hook installed: freeze`, and
`station clock hands follow live sim time`: on the live `?parity` page, once `time` > 0.05 (the
constructor's single step), one evaluate reads `time` and both hands and each must `Object.is`-equal
the in-page clock formula of that `time`.
`--strict` exits 1 on any diff or failed check (used for sign-off).

Station section (both sites, frozen, `probe.json` → `station`): `stationS`, `freeCameraStart`,
station group position and `rotation.y`, `time` (0.05), minute/hour `rotation.x` and whether each
`Object.is`-equals the clock formula evaluated in the page from that `time` (direction −1, same
operation order; at time = simDt = 0.05 this cannot tell `update(time, …)` from `update(simDt, …)`,
so the live check above is what proves `stepSimulation → world update → slot 1`), `signCanvasHash` (FNV-1a over
the sign canvas `getImageData`), `fredokaBold106` (`document.fonts.check('bold 106px Fredoka')`)
and `frozenAfter30Frames` (hands unchanged after 30 rAF while frozen). Every field must be equal
across sites; if only the sign hash/font flag differ (font race), both sites are reloaded, at
most 3 attempts in all. Printed as `PASS|FAIL station probe after N attempt(s)`.

### Camera UI probe (`--camera-ui`)

`npm run parity:probe -- --camera-ui [--target t]` skips every other section and drives one live
page per site (clone at `?parity`, original through the route hook; no freeze, saved settings
cleared), from `tools/parity/camera-ui-runtime-probe.mjs`:

1. Picks a canvas point where `document.elementFromPoint` is the canvas (clear of the HUD).
2. Presses `2, 3, 4, 1, b` and records `{mode, fov, pressed, toast}` after each (expected orbit/65
   with the exact Free toast, side/48, bridge/42, overview/42, bridge/42 with `B · Bridge camera`),
   then right-clicks a mode button (overview + `Camera · Default`).
3. In one `page.evaluate`: overview → bridge plus 5 × `updateCamera(1/60)` (distance to the tripod
   above 50 after step 1 and strictly falling), overview → side plus one step (`|camPos − tmpA| > 1`,
   no snap), then orbit (camera exactly on `freeCameraPose.position`).
4. Spies `firstPersonControls.lock`: a canvas click in orbit gives `[[true]]`, none while `isLocked`
   is forced true, none in overview.
5. `movementKeys` gets KeyW, then a PLC `'unlock'` event empties it.
6. In orbit with `isLocked` forced: keydown w adds KeyW, keyup removes it, Space neither logs
   `[PAUSE]` nor pauses; unlocked, Space pauses (`[data-toggle="paused"]` `aria-pressed="true"`) and
   Space again resumes.

Writes `.parity-output/camera-ui-probe.json` (`sites.<target>.result`, `.misses`, `differing`), one
`camera-ui-probe-<target>.json` per site (`target`, `result`, `misses`) and
prints `PASS|FAIL <target> camera UI` plus `PASS|FAIL camera UI clone vs original`; any miss or
cross-site difference sets exit code 1. Quaternions are not compared (mouse moves rotate the camera
while `isLocked` is forced), and `[CAMERA] Overview intro …` lines are dropped (load timing).

### Manual headed pointer-lock checklist

Headless Chromium rejects `lock(true)` (unadjusted movement) with "not supported on this platform"
on both sites, so real pointer lock is checked by hand in a headed browser (`npm run dev`).
Status: not yet run (pending; record the date and browser here once done):

- Press 2, click the scene: the cursor locks.
- WASD / Space / C / Shift fly; the edge (±61), ground (+1.2) and ceiling (200) clamps hold.
- Esc: the cursor returns and movement stops (held keys are cleared).
- 3 glides into the train camera; 4 or B glides to the bridge (B shows its toast); 1 snaps home.

## 7. Baseline (2026-10-02 re-run, SwiftShader via ANGLE, 1600×900)

| Measure | Original | Clone (sky + shell only) |
|---|---|---|
| Frozen default `calls / triangles` | 1373 / 1,762,696 | 2 / 962 |
| `geometries / textures / programs` | 419 / 6 / 25 | 2 / 4 / 2 |
| Sky-only `calls / triangles` | 2 / 962 | 2 / 962 |
| `timeAtFreeze` | 0.05 | ≈ 0.034 (no world yet) |
| `fredokaReadyAtBuild` | true | false |
| Post synthetic probe | max channel diff 0 across 18 combinations | |

The research debug-menu numbers (1411 / 1,773,736) were read live with a varying puff count; the
frozen-default probe above is authoritative. Node self-check: `world.length` 276.13647750761754,
`bridge` [30, 178], `stationS` 236.45464110639873, 1201 frames, 660 world-group signature
entries, full build ≈ 0.3 s. Stage `shell-and-sky` (17 shots): all pass with only capability
warnings; sky shots max channel diff ≤ 1, DOM shots identical. Full stage capture ≈ 2 min 20 s
for both targets; compare ≈ 6 s; probe with checks ≈ 1 min. Debug-menu computed styles (closed,
open, `body.hud-hidden`) are identical on both sites.

## 8. Determinism rules

- The constructor renders one frame; the hook runs right after `prepareOverviewIntro()` in the
  same task, so the original has advanced one 0.05 s step and spawned one puff. That first puff's
  random draws follow an unknown number of three.js UUID draws, so frozen shots hide transients
  and transient-visible shots step > 3.6 s (puff life 2.4–3.6 s).
- The paused loop still runs real-dt code (time of day, camera, cloud camera, render): palettes
  are applied immediately, the intro is nulled, auto-rotate is off and the camera/cloud-camera
  no-ops are installed at freeze time. Both sites must dispatch per-frame work through instance
  members, or the no-ops do nothing.
- Full-scene shots step ≥ 3 s: cloud scale includes `smoothstep(0, 2, age)`.
- The station sign is drawn synchronously during the build; `fredokaReadyAtBuild` records whether
  Fredoka was ready (fonts cannot change inside the synchronous build). The probe's
  `signCanvasHash` catches a font race directly and reloads both sites (≤ 3 attempts); captures
  showing a sign mismatch with differing `fredokaReadyAtBuild` should simply be re-run.
- Compare only captures from the same browser, profile and run (every meta carries the capture
  invocation's `runId`; compare warns on any mismatch). Playwright routing disables the
  HTTP cache, so the patched entry module is always served. Always launch a full Chromium by path
  (the default headless shell is a different binary).

## 9. Troubleshooting

- **Slow:** SwiftShader renders at ~1–2 FPS; an original load takes ~10 s. Waits are state-based
  (180 s timeout); never add wall-clock sleeps.
- **Anchor error** (`Original TrainScene.js: expected exactly one …`): the site changed. Re-run
  `npm run parity:fetch` and inspect before touching the hook. Route errors (anchor count, fetch)
  abort the original's only entry module, so they are raised as soon as they happen instead of
  the 180 s readiness timeout; `Original TrainScene.js was never patched` means the module was
  never requested.
- **Blocked commands:** local hooks reject command text containing `node_modules`, `dist`, `build`,
  … path segments; run entry points through npm scripts or files under `tools/`/`tests/`.
- **Fonts blocked:** DOM shots and `fredokaReadyAtBuild` differ; allow fonts.googleapis.com.
- **Cache missing:** parity tests skip with `run npm run parity:fetch`.
- **Research dir missing:** set `PARITY_RESEARCH_DIR`.
- **Page errors in a meta:** the shot fails; open the meta JSON and the clone console.
- **Headless-shell launch errors:** set `CHROMIUM_PATH` to a full Chromium/Chrome binary.
- **`loader-card` differs only inside the logo mask box:** the logo's intrinsic aspect ratio is
  no longer 1482 : 644.

### World core (P05, 2026-10-02)

- Node: all 15 `npm run test:parity` cases pass; byte-exact frames/heights/pads/terrain/skirt/
  heightTex, 10,000 equal query samples, equal signatures, 444 UUID draws on both sides; build
  median ≈ 45 ms clone vs ≈ 55 ms original.
- Browser (report-only, `--shots world-core-overview,world-core-bridge`): overview mean 0.292 /
  0.84 % over 16; bridge mean 0.693 / 1.69 %. The heat maps show differences only at the
  original's building pads (station on the west shelf, the house pads in the valley, the windmill
  pad on the east hill); track, bridge, skirt and plinth are identical. These become enforceable
  once the station (P06) and village/windmill (P08) pads exist on the clone.
- Clone frozen default now 108 calls / 247,146 triangles / 55 geometries / 4 textures / 10
  programs; sky-only probe unchanged (0 fields differ). Stage `shell-and-sky`: all 17 shots still
  pass; `timeAtFreeze` is now 0.05 on both sites, and compare warns on `fredokaReadyAtBuild`
  (original true, clone false: the clone's lighter world builds before Fredoka has loaded). That
  matters once the station sign is drawn at build time (P06).

### Station (P06, 2026-10-02)

- Node: `npm test` (155 cases incl. the two station unit suites) and all 21 `npm run test:parity`
  cases pass; the station build is bit-identical to the original (placement, heights, pads,
  27 exclusions, signatures and child order with figures excluded, sign recordings, clock).
- Browser: `station-trackside-closeup-day` and `-night` (strict, in stage `shell-and-sky`) are
  pixel-identical (mean 0.000, max 0); the report-only `station-free-start-day/-night` differ only
  where the original's trees stand (no trees on the clone until P09). The whole shell stage
  (19 shots) passes. `world-core-overview` improved to mean 0.267 / 0.75 % (only the
  village/windmill pads remain); `world-core-bridge` unchanged (0.693 / 1.69 %).
- Probe: station section equal on the first attempt (sign hash `8df1cf62`, Fredoka loaded on both
  sites, `fredokaReadyAtBuild` true on both); clone frozen default 268 calls / 250,878 triangles /
  132 geometries / 5 textures / 12 programs (original 1373 / 1,762,696 / 419 / 6 / 25).

### Train (P07, 2026-10-02)

- Node: `npm test` 172 cases and all 36 `npm run test:parity` cases pass (≈ 20–35 s, the train
  oracle suite alone ≈ 15–29 s; slower beside a running browser capture; budget 90 s). The train is
  bit-identical to the original: signature (multiset and ordered), merged buffers, 1000
  placements, and 18000 oracle frames (variant A: motion, strength, puffs, spark matrices, camera;
  variant B: motion, strength, puffs, cars). Variant B skips spark buffers: whole-array heights
  differ (village/windmill pads), though not near the braking zone. A one-ULP change in the puff
  drift fails the oracle test within the first second.
- Browser: all 7 `train` shots pixel-identical (mean 0.000, max channel diff ≤ 2), including the
  braking shot with sparks and smoke visible; the whole `train` stage (26 strict shots) passes in
  two consecutive capture + compare runs once the capture CSS disables UI transitions (before
  that, HUD buttons leaked into cheap 3D shots on either site and failed them intermittently).
- Probe: `--shot train-only-braking-front-day-no-effects --fields calls,triangles` → 258 calls /
  38,374 triangles on both sites (sim time 36.05, s 499.6042, speed 5.3187 on both). Clone frozen
  default now 556 calls / 295,786 triangles / 183 geometries / 5 textures / 15 programs (original
  1373 / 1,762,696 / 419 / 6 / 25); sky-only still equal.
- Eyeball review (2026-10-02, after review fixes): world-visible variants of the braking-front
  (day and evening), dwell-side (day) and night-headlight (night and day) poses, captured on both
  sites with the capture helpers and no hide set (scratch output, not committed), checked against
  `05-train-camera.png`, `18-night-train-camera.png` and `19-evening-bridge-camera.png`. Train
  geometry, coach colours (maroon, maroon, green, maroon), cab glass, sparks and puff shading (white
  by day, violet with cream highlights at evening, blue at night) match the original in every pose;
  the night headlight pool lights the same bridge railing posts and sleepers orange and the beam
  cone is identical; by day neither site shows halos or the beam. The only differences are world
  content later phases add (trees, figures, windmill, houses, water, birds, clouds, balloon), which
  also changes what the beam falls on.

### Village and windmill (P08, 2026-10-02)

- Node: `npm test` 186 cases and all 40 `npm run test:parity` cases pass (≈ 21 s). Village and
  windmill are bit-identical to the original: 8 houses in 256 tries (world stream at draw 1024 after
  the village, 1624 after the windmill), house/windmill positions and quaternions, all 96 smoke
  records, glow attributes, villageHomes, 36 exclusions, 11 pads, heights bytes, shrub matrix and
  colour buffers, per-house / windmill / whole-world signatures (multiset and ordered, station
  figures excluded until they land), noShadow order (106 entries), `windmillRoofHeight`
  22.266444503377606, and 600 frames of smoke + rotor against the original `World#update` on a
  stand-in with the not-yet-built systems stubbed. A one-operand regrouping in the smoke formula
  fails that frame test immediately. With every pad present the train oracle's variant B now also
  compares spark buffers (heights equal; its `[PARITY]` diagnostic is gone).
- Browser: the four `village-windmill-*` shots are pixel-identical inside both regions (mean
  0.000, max 0) and on the whole frame (max ≤ 1); `world-core-overview` and `world-core-bridge`
  are now strict and pixel-identical too. The whole `village-and-windmill` stage (32 strict shots)
  passes. `station-free-start-day/-night` (report-only) still differ only where the original's
  trees stand.
- Probe: `--shot village-windmill-overview-day --fields calls,triangles` → 926 calls / 323,638
  triangles on both sites, village section equal after 180 stepped frames (rotor −2.745 at sim time
  3.05 on both). Frozen default: village section equal; clone 928 calls / 326,946 triangles / 322
  geometries / 5 textures / 17 programs (original 1373 / 1,762,696 / 419 / 6 / 25); sky-only equal;
  station probe equal on the first attempt; post synthetic probe max diff 0.
- Flake seen once per run in two runs: a clone session timing out in `waitForDioramaReady` (180 s)
  while the same shots captured fine on retry and in isolation; the page loads three.js and fonts
  from CDNs, so treat a lone readiness timeout as network and re-run the remaining shots with
  `--target clone --shots …`.

### Residents, trees and rocks (P09, 2026-10-02)

- Node: `npm test` (all unit cases pass) and `npm run test:parity` 45 cases pass. The residents, forest and
  rocks are bit-identical to the original: the two r2.2 yard exclusions (38 in all), the four tree
  layers (3749 / 1215 / 932 / 769 instances; autumn 46/36/26 and blossom 18/15/18 on round, cluster
  and bush) with byte-equal matrix and colour buffers, species geometries, bounding boxes, materials
  (TREE_SWAY on layers 0–2 only), the canopy grid bytes and 10 000 `treeCanopyHeightAt` queries, the
  world stream continuing at draw 78587 after the trees, the resident home signatures, 60 s of
  every resident, dog, head and tail transform at dt 1/60 and at random dt, the 80 rocks with the
  whole 80-slot matrix buffer, and the whole `world.group` signature after the rock step (multiset
  and ordered; the original's sheep and station figures excluded). The clone alone logs the eight
  `[VILLAGE]` lines at frames 241, 720, 1080, 1561, 1921, 2401, 2761, 3241 of 3600.
- Browser: the eight `residents-and-forest` shots match (mean 0.000, max channel diff ≤ 1);
  `trees-sway-t1` differs from `trees-sway-t0` on 10.9 % of pixels on both sites, `trees-sway-hold`
  is identical to `trees-sway-t1` with `uTime` 5.05 before and after the paused hold, and
  `trees-debug-hidden` hides the four layers and logs `[DEBUG] Trees: hidden` on both sites. The
  masked original hides 3 sheep meshes, water + waterfall, 33 cloud groups, the balloon, the bird
  group and 2 station figures. `station-free-start-day/-night`, masked the same way, are now strict
  and pixel-identical (max 0). The whole active stage (42 strict shots) passes.
- Probe: forest section `[3749, 1215, 932, 769]` trees, 80 rocks, 33 resident meshes on both
  sites; exclusions 41 (original) vs 38 (clone), delta −3 as expected. Clone frozen default 1004
  calls / 1,657,126 triangles / 360 geometries / 5 textures / 20 programs (original 1373 /
  1,762,696 / 419 / 6 / 25); sky-only equal; station probe equal on the first attempt; post
  synthetic probe max diff 0.

### Camera modes (P10, 2026-10-03)

- Node: `tests/parity/camera-modes-parity.test.mjs` compares 11 708 frames plus every `setMode`
  against the original oracle (camera position/quaternion/fov, camPos, camTarget, controls target,
  every fly-along field, the free pose, PLC/controls flags, key count, s, speed): the maximum
  difference is exactly 0. The sequence covers 6 side entries 7 s apart (side −1 every time), a
  minute of side mode (wide-shot peak, station dwell, paused, dt 0, time scale 2, dt 0.05), a minute
  of bridge (controls target = camTarget, goal x within ±4.9), scripted free flight to x ±61, z −61,
  the ground clamp and the 200 ceiling, no flight while unlocked, and the pose save/restore.
  Both sides get the same synchronous PLC stub and their own `mulberry32(4242)` Math.random stream.
- Browser: the five camera shots and their `-relaxed` twins (at P10 time with `cloneMissing` hidden
  on both sites; since P13 the strict shots hide only `transient` and the twins hide nothing) are
  pixel-identical (mean 0.000, max channel diff 0). Framing matches the references (train cam
  loco right of centre with the coaches trailing up-left; bridge cam low and side-on with the whole
  train on the deck at 10.5 s; free cam on the platform).
- Probe: `--camera-ui` passes on both sites and both sites answer identically.
- Headless pointer lock: a real canvas click in free mode logs
  `THREE.PointerLockControls: Unable to use Pointer Lock API` and an uncaught "options … not
  supported" rejection on both sites (kept quirk); use the headed checklist above.


### Sheep flock (P11, 2026-10-03)

- Node: `tests/parity/sheep-flock-parity.test.mjs` at `stopAfter: 'buildRocksAndSheep'`: the next
  5 `world.rand()` draws, the 10 000-point `sheepGroundAt` grid (values and normals, sentinel
  (7, 7, 7) normals prove written-on-slope-fail and untouched-on-early-return), every sheep state,
  route and the three instance buffers (`firstSheepFlockMismatch`), the clearing (frame 348, side
  −1) and route vectors, the 41 exclusions, the three layer signatures and the whole `world.group`
  (multiset and ordered; only the original's station figures excluded) are identical; 24 pasture
  sheep on both sides, no stranding candidates. Then 60 s against a synthetic train circling at
  7.5 m/s, compared on every frame with identical `[SHEEP]` (frame, line) sequences.
  `tests/parity/sheep-flock-oracle-train-parity.test.mjs` steps the original sim oracle and the
  clone driver in lockstep (per-side `mulberry32(20260930)` Math.random): 260 s with the night
  schedule written through `uNight` (day to 180 s, 3 s ramp, full night to 240 s, 20 s wake; both
  drivers copy it into `world.nightAmount` unchanged), 90 s at speedMul 2.5 and 60 s of 0.1 s steps
  (0.05 s frames at time scale 2, where sheep 1 logs only its jump). Every frame matches bit for bit
  (about 11 s in all). The FSM unit test fuzzes 3 × 20 000 steps against the original state machine.
- Browser: the five sheep shots are pixel-identical (mean 0.000, max channel diff 0), and the
  masked forest shots, camera shots and station free starts, which now include the sheep, still
  match (max channel diff ≤ 1).
- Probe: sheep counts 27 / 108 / 54, routes at 77.380 / 79.930 / 83.130 m, first pasture sheep and
  0 stranding candidates equal on both sites; hop frames K = [785, 824, 840] on both sites. The
  forest section's exclusion delta is now 0. Clone frozen default 1010 calls / 1,681,318 triangles
  / 363 geometries / 5 textures / 20 programs (original 1373 / 1,762,696 / 419 / 6 / 25); sky-only
  equal, station probe equal on the first attempt, post synthetic probe max diff 0, every check
  passes on both sites.

### Water, clouds and balloon (P12, 2026-10-03)

- Node: `tests/parity/water-clouds-balloon-parity.test.mjs` builds the full original and the full
  clone first in its own process (cold npr caches), counting `Math.random` draws inside
  `buildWater` / `buildClouds` / `buildBalloon` (prototype methods on the original, wrapped
  registry `step.run` on the clone; `tests/helpers/counted-full-world-builds.mjs`): 24 / 2128 /
  2940 on both sides. The next `world.rand()` is 0.23735972004942596 on both; all 33 clouds
  (instance matrices, colliders, radius, position, speed, band fields, age, scale, bounding
  spheres) are bitwise equal with Σ 464 instances; water, waterfall, balloon and the last five
  `noShadow` entries match by signature; the whole `world.group` (111 children) matches with only
  the original's station figures excluded; water/waterfall side, transparency, depth flags and the
  water uniform key sequence match. Then 18 000 frames (300 sim-seconds, a 300-frame pause, clouds
  3–8 debug-hidden for 600 frames, a camera that sweeps through each layer and then sits in cloud
  centres) compare every cloud's drift position, offset, group position, scale and age plus the
  balloon pose every 60 frames: identical (about 3 s). `residents-trees-rocks-parity` (C) now
  compares full builds on both sides, since a world stopped at the rock step no longer matches the
  full clone.
- Browser: `overview-day-settled-masked`, `overview-night-masked`, `bridge-camera-evening` and the
  ten new water/cloud/balloon shots are pixel-identical (mean 0.000, max channel diff ≤ 1; the
  `waterfall` crop of S2 max 0).
- Probe: `PASS water/clouds/balloon` in both scenarios; textures 6 on both sites. The default
  scenario still differs only by P13 content (birds, station figures, perches): clone 1087 calls /
  1,745,012 triangles / 380 geometries / 6 textures / 24 programs (original 1373 / 1,762,696 / 419 /
  6 / 25). With `cloneMissing` hidden, `--shot overview-day-settled-masked --fields
  calls,triangles,textures` gives 1092 / 1,749,544 / 6 on both sites, `--shot balloon-closeup-night`
  535 / 1,671,594 / 6 on both. Debug-menu checks (Clouds toggle logs and visibility) pass on both.

### Station travelers and birds (P13, 2026-10-03)

- **First-build draw-count rule.** npr caches materials per module, so a second World in the same
  process draws fewer UUID randoms (the original's `buildStation` draws 2424 on a second build).
  `tests/parity/station-travelers-and-birds-parity.test.mjs` therefore builds one clone World and
  one original World first in its own process (`tests/helpers/station-travelers-and-birds-first-build.mjs`),
  counting draws inside `buildStation` (registry wrapper / prototype wrapper), the first bird
  material request and `createBirdSystem`: 2532 / 4 / 948 on both sides. Never measure these
  through a second construction.
- Node block A (clone only, `tests/parity/fixtures/station-travelers-and-birds-expected.json`):
  perch ids and full-precision track distances, flight heights, centres, sizes/phases/headings,
  delays, lane x 0.20999999999999985 (figure, start/end, stops, leg targets) and grandmother x
  −0.5300000000000002, the merged rig structure, walker-only stepping (0.05 then 10 800 × 1/60) with
  `[STATION]` events at frames 298, 1107, 1588, … 10 629 and the exact final state, IK bones at
  0.36 within 1e−12, zero `Math.random` draws in `birds.update`, and the `[BIRDS]` timeline to
  20.5 s. Block B (original present): perches deep-equal, the whole `world.group` signature with
  both travelers, the constructed walker and both rig trees, flock/bird records and the bird group
  signature, then the oracle and the clone driver in lockstep (first step 0.05, then 1/60 for
  180 s; and real dt 0.05 at time scale 2 for 60 s) comparing `snapshotLifeState` every frame and
  the `[BIRDS]` / `[STATION]` / `[VILLAGE]` lines with their frame numbers (about 10 s in total).
  Earlier station/village/forest/sheep/water suites now compare `world.group` including the
  travelers; stopAfter-`buildStation` tests never compare `birdPerches`.
- Browser: `station-travelers-closeup`, `station-roof-birds-takeoff`, `bridge-birds-in-flight`,
  `free-camera-day`, `bridge-camera-day`, `overview-day` and `station-free-start-day` are
  pixel-identical (mean 0.000, max channel diff ≤ 1).
- Probe: frozen default 1373 calls / 1,762,696 triangles / 419 geometries / 6 textures / 25
  programs on both sites (and 2 / 962 sky-only); 0 differing fields; `PASS travelers/birds` in both
  scenarios.

## 10. Release sign-off (1.0.0)

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

Env: `CLONE_URL` (default `http://localhost:4317/`), `TARGET_URL` (default the reference site; a
pinned fallback is `node tools/static-dev-server.mjs --root "$PARITY_RESEARCH_DIR/source" --port 4318`
with `TARGET_URL=http://localhost:4318/`), `PARITY_RESEARCH_DIR` (default
`../plans/260930-train-diorama-clone/research`, read only), `CHROMIUM_PATH`,
`VERCEL_AUTOMATION_BYPASS_SECRET` (optional).

Sign-off recipe (in addition to section 4): one browser context per shot; the station-sign font
readiness is taken from the hook's `fredokaReadyAtBuild` (same task as the build; the loader-label mark
is recorded too but reads false on both sites because the faces are still loading then), and the
station-sign canvas hash is held to the run's reference (the first font-ready load, the original's when
both sites run); either one failing reloads the page in a fresh context, up to 2 reloads (a hash still
different after that is kept and reported by compare/probe; fonts still not ready fail the shot); `Math.random` is reseeded right before the K steps; a pose override sets camera, `lookAt`
and `controls.target`, then runs the real cloud updater 180 times at 1/60 s; transients (puffs,
sparks) are hidden unless the shot says visible; 3D shots are full-page (HUD included) after 2 rAF
and `waitForToastSettled`; DOM shots freeze rendering, hide `#scene canvas`, run the prelude and
screenshot with animations disabled and the masks painted `#ff00ff` on both sites. The masked
elements' rects (CSS px, relative to the screenshot) go into the meta as `maskRects`; compare
excludes the union of both sites' rects from the metrics (numerator and denominator), and a masked
shot whose metas lack them fails ("recapture"). Tagged console lines
(`[GAMEPLAY|CAMERA|BIRDS|SHEEP|STATION|VILLAGE|HUD|PAUSE|DEBUG|SETTINGS]`) are stored per shot and
must be equal (a sign-off shot with a missing `.console.json` fails); the clone must log no page
error and no `console.error`. Timeouts: 180 s for the loader, 120 s for every other in-page step
(the error names the site, shot and step).

Thresholds (0..255, unchanged): deterministic ≤ 1.0 mean / ≤ 0.5 % of pixels with a channel diff
> 16; transients visible ≤ 3.0 / ≤ 3 %; DOM ≤ 0.5 / ≤ 0.2 %; dom-loading boxes (`.load-card`,
`.load-logo`) within 0.5 px with the logo masked. Probe states compare exactly.

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

| allowance | example |
|---|---|
| standard three.js API idiom | `new THREE.ShaderMaterial(`, the full-screen-quad `gl_Position` line, `three/addons` imports |
| Vercel's official Web Analytics snippet | the `window.vaq` queue stub in `index.html` |
| DOM ids, Tailwind class names, §6 state names and selectors | `#hud-controls`, `body[data-time-of-day="night"] …`, `is-gone` |
| short UI strings and §7 console strings | help-list labels, toasts, loader labels and hints, `[CAMERA] …` logs |
| contract API names, parity-surface fields, state keys | `update(elapsed, dt, trainPosition, trainMotion)`, `this.flyAlongAnchor`, `state.lastPixelResolution` |
| numeric values, option tables, colours | npr call-site options (`stipple: 0.55, stippleScale: 2.4`), CSS values, FOV table |
| import map / CDN / font links | the unpkg URLs and Google Fonts preconnects |
| standard public algorithm | smoothstep clamp, bilinear value-noise blend |

### Sign-off results (2026-10-03)

- **Target:** live reference site, unchanged since the research snapshot: all 18 fetched files
  (14 JS, index.html, Styles.css, 2 SVGs) equal `research/source` by sha256; manifest aggregate
  `f5e225f57bba0d2d…` (`.parity-output/original-manifest.json`). Profile `angle` (SwiftShader via
  ANGLE), Chromium build 1243.
- **Node:** `npm test` 295 pass / 0 fail / 0 skipped; `npm run test:parity` all pass, including
  `full-scene-signature-parity.test.mjs`: construction signature equal (1201 entries), the first frame
  logs exactly the two `[BIRDS] Take off` lines on both sides, 435 geometries / 128 materials /
  2 textures reachable on both, R9 lists equal (`ctxGlowsMatch` true on both), world summary equal
  (stationFrameIndex 1008, clouds 33, bridge [30, 178]) with equal next `world.rand()`, and
  10 800 lockstep frames (overview with the dolly-in intro played to completion, side entered while
  a second intro is armed, bridge, orbit, night overview, speedMul 2.5) with every scalar
  `Object.is`-equal, 18 signature checkpoints equal and 189 identical log lines (`[BIRDS]`,
  `[VILLAGE]`, `[STATION]`, `[SHEEP]` and the two in-sim `[CAMERA]` lines: `Overview intro completed`
  from `updateCamera`, `Overview intro interrupted by mode selection` from `setMode`). The clone side
  is composed by the runtime `composeDioramaScene`. `check:lines` OK (max 199). Hygiene greps empty.
- **Noise floor:** ov-day-t0 and dom-hud-day captured twice per site: mean 0, 0 % over, max 0 on
  both sites (0 % of every limit).
- **Browser shots (28/28 pass):** every shot has meanAbsDiff ≤ 2e-6, 0 % of pixels over 16 and a
  maximum channel difference of 0 (19 shots) or 1 (9 shots); every tagged console sequence is equal;
  the clone logged no errors (the original logs one `console.error` per page for the aborted
  analytics request, which the harness blocks). dom-loading boxes are identical on both sites:
  `.load-card` (530, 261.078, 540 × 377.844), `.load-logo` (585, 261.078, 430 × 186.844).
  Full table: `.parity-output/compare/summary.md`.

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
- **Probe (8/8 states exactly equal):** renderer counts, world summary, ordered lists (17 derived
  glows, 192 shadow-hidden objects), 45 instanced meshes and the sign-canvas hash `8df1cf62` match.
  ov-day-t0 reads 1371 / 1,759,388 / 419 / 6 next to the research's live readout
  1411 / 1,773,736 / 419 / 6 (puffs visible there); textures = 6.

  | state | calls | triangles | points | lines | geometries | textures | programs | s mod L | vs original |
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

  | metric (median of 10) | original | clone | ratio | budget |
  |---|---|---|---|---|
  | BUILD ms (BUILDING → PREPARING labels) | 892.95 (CV 11.2 %) | 916.45 (CV 9.1 %) | 1.026 | ≤ 1.10 pass |
  | CPU submit, frozen (inverted EMA) ms | 4.48 | 4.40 | 0.983 | ≤ 1.10 pass |
  | CPU submit, running ms | 4.88 | 4.87 | 1.000 | ≤ 1.10 pass |
  | LOAD ENGINE ms (informational) | 1082.7 | 808.1 | 0.746 | – |
  | navigation → loader hidden ms (informational) | 8525.6 | 7917.2 | 0.929 | – |

  The first 5-run pass had CV above 5 % (clone BUILD 9.1 %), so the 10-run pass above is the
  verdict; it also passed at 5 runs (BUILD 740.5 vs 797.1 ms). Loads ran under SwiftShader, so CVs of
  8–14 % are the noise of this profile; alternation keeps both sites under the same load. The clone's
  LOAD ENGINE is faster here because its modules come from localhost while the original's come from
  its deployment.

  Heap (one run per site, 1200 page-side steps + 60 natural frames, sampling every 1 KB including
  objects collected by minor and major GC): retained growth clone 497,724 B vs original 472,088 B
  (limit original + 64 KB: pass); allocation per step clone 73,825 B vs original 101,366 B total and
  73,478 B vs 100,966 B app-attributed (≤ 1.10×: pass). Clone app sites ≥ 1 KB/step mirror original
  allocations of the same work: `sheepGroundAt` 23.7 KB (original 24.6 KB), the exclusion test's
  closure in `World#excluded` 14.8 KB (original 15.1 KB), the render pass (`renderDioramaFrame` +
  shadow `render`, 9.7 KB vs the original's `render` 9.7 KB), train placement 3.5 KB, bird animation
  and snapshots 5.1 KB (original bird update 6.7 KB), sheep flock 2.5 KB (original 12.5 KB), cloud
  camera 1.9 KB (original 1.9 KB), `heightAt` 1.6 KB. No scratch-reuse change was needed.
- **Research recapture (28/28 ≥ 7/10, no exceptions):** overlaps 8–10 (01-loading-screen 8, the
  logo is the project's own artwork; 06b 8; 05-train-camera, 10, 16 at 9; all others 10); ΔmeanLuma
  within ±2.8, bucket ratios 0.96–1.01 except the loader (0.54, simpler original logo artwork); no
  clone page errors; `research/captures` untouched. Contact sheet:
  `.parity-output/research-recapture/research-contact-sheet.html`.
- **Independence audit:** 138 overlap hits over 248 tracked files, every one inside an allowance
  (UI/console strings 34, three.js idioms 30, DOM ids/classes/selectors 28, numeric values and
  option tables 24, contract names 14, import map/CDN 5, standard algorithms 2, analytics snippet 1;
  per-hit list in `.parity-output/independence-audit.txt`); structural similarity ≤ 0.22 for every
  JS/CSS file (index.html 0.53: DOM ids, classes and labels); no file:line citations; SVG hashes share
  nothing with the original's; nothing under `.parity-cache/` or `.parity-output/` is tracked.
  Logo/favicon review: the logo is the project's own Fredoka 700 "Train Diorama" wordmark with a
  `#3f2a1f` outline/shadow, `#ca4e36` and `#fbf4e2` fills and a hand-built steam-locomotive motif; the
  favicon is the project's own clock tile at 10:10. Neither reuses or traces the reference artwork.
- **Smoke:** localhost and the GitHub Pages site pass every check (no errors, no failed or ≥ 400
  requests, loader hidden, `[GAMEPLAY] Started`, `H · Hide HUD` toast, pagehide dispose, no analytics
  request; on GitHub Pages the five development-only paths return 404). Vercel: not deployed (awaits
  approval).
- **Instance dispatch:** wrapping `render`, `updateTimeOfDay`, `updateCamera` and
  `world.updateCloudCamera` on the live clone counted 2 calls each within 2 rAF.
- **Style bible 1–15:** checked against the contact sheet and the sign-off shots — 1 framing, 2 cel
  bands, 3 stipple, 4 ink lines, 5 post finish, 6 sky, 7 time of day, 8 palette, 9 geometry, 10 scene
  inventory, 11 cameras, 12 pixel art, 13 HUD, 14 loader (own logo), 15 persistence: all ticked.
- **Reviewer:** automated sign-off run by the implementation agent; the logo/favicon and style-bible
  ticks above are its visual review and await the owner's confirmation.
