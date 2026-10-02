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
| `clone-simulation-driver.mjs` | `createCloneSimulation({world})` (ctx with the oracle's shape: sim fields, `cameraRig()` stubs, `puffTimer` accessor onto the pool; `world` defaults to a clone World), `stepCloneFrame(ctx, dt)`, `snapshotTrainState(ctx)` |
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
  (`PARITY_SKIP_PERF=1` skips it).
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
  (unscaled dt) → `world.updateCloudCamera?.(camera.position, dt)` → `scene.updateMatrixWorld()`,
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
5. Optional camera pose, then hide sets (always after stepping: puff spawns re-show meshes).
6. 3D shots: UI hidden, rendering on, 2 rAFs, full-viewport screenshot. The capture CSS
   (`captureCssText`) hides each UI root and all its descendants with `transition: none
   !important`: a running transition outranks `!important`, so the seven `transition-all` HUD
   buttons would otherwise stay visible for several SwiftShader frames and leak into cheap shots.
   DOM shots: canvas hidden (flat `#app` backdrop), rendering off (keeps SwiftShader from starving
   timers), actions, finite animations awaited, clip around the selectors, `mask` painted `#ff00ff`.

Shot schema: `{id, stage, kind '3d'|'dom', viewport, mode, timeOfDay, pixelShortSide, outline,
seconds, hide, camera, fresh, actions, selectors, pad, mask, keepToast, reportOnly, parkTrain,
regions, thresholdClass, reference}`. `regions` names screen regions (`village`, `windmill`; see
"Regions" below) the shot is judged on. `camera` is `{position, target, fov?}` in world space, or with
`relativeTo: 'loco' | 'station'` in that object's local frame (station group = parent of the
clock building, the same lookup on both sites), or `{relativeTo: 'freeCameraStart', fov}` (copies
`world.freeCameraStart`); a missing `fov` keeps the mode's FOV. `parkTrain` runs `parkTrainAway`
after stepping: `train.update(world, (s + L/2) % L)` when both a train and a world exist (moves
the hidden train and so its headlight uniform away from the station; no-op otherwise). `reportOnly` shots are never picked by stage selection (request them with `--shots`)
and `parity:compare` prints them as `REPORT(PASS|FAIL)` without failing the run.
`reference` is a bare research capture file name or `null` (clone-vs-original only). Consecutive
non-fresh shots on one viewport share a page load; fresh shots (`seconds > 0` or actions, or set
explicitly) get their own.

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
`allButWorldCore` (every mesh except `d.sky` whose material is neither terrain (`FLOWERS` define)
nor skirt (`STRATA` define) nor one of the flat world-core signatures `uColor hex|uStipple`:
`a39a8c|0.5` ballast, `8f8f9e|0.05` rail, `6e4a32|0.25` sleeper, `6b4630|0.12` plinth wood,
`3f2a1f|0.1` plinth trim, `b8432f|0.12` red, `8a2f24|0.1` dark red, `b9ae98|0.35` stone; on the
full original it keeps exactly the 53 core children). Presets: `skyOnly`, `transient`,
`allFamilies` (every family above except `world`/`allButWorldCore`, plus the transients). The in-page
function lives in `page-hide-set-application.mjs`; restores run in reverse order so overlapping
sets give back the original visibility.

Stages: `shell-and-sky` → `train` → `village-and-windmill` → `full-scene`. A shot runs when its
stage index is ≤ the selected stage; `--shots` overrides gating. To add a shot, append one line in
`parity-shot-list.mjs` at its stage (the `shot()` factory and the camera poses live in
`parity-shot-factory-and-camera-poses.mjs`); when a stage's features land, advance
`ACTIVE_PARITY_STAGE` (now `village-and-windmill`).

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

A shot passes when sizes match, both metas have no page errors and both metrics are within its
class. Regional shots (metas with `regions`) are judged per region instead: both PNGs are cropped
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
building pad exists on the clone; 14/12/03/17 → the four `village-windmill-*` shots. Not captured: 02a/02 (time-dependent
intro, covered by unit tests), 05-motion-2..3 and 06 (mid-blend), 11/11b (overview with the UI
hidden), 12b (manual orbit drag). The four sky-direction shots (`sky-sun-day`,
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
