# Project changelog

## [0.10.0] - 2026-10-03

feat(camera): free-fly pointer-lock camera, train fly-along rig and bridge tripod.

### Added

- `src/engine/cameras/train-fly-along-camera-rig.js`: `FLY_ALONG` (21 keys), `wideShotBlendAtPhase`,
  `enterFlyAlong` (elapsed reset, outer side from the loco right axis, anchor priming),
  `computeFlyAlongDesired` (rig transport with the driver anchor, velocity, 31/23/41 s sines, 56 s
  wide shot, terrain and 3-sample canopy floors with 0.8 s look-ahead; returns the frozen {2, 5}),
  `applyFlyAlongHeight` (rise 3 / sink 0.7, terrain and r1 canopy floors).
- `src/engine/cameras/bridge-tripod-camera.js`: `BRIDGE_TRIPOD`, `computeBridgeDesired` (scratch
  `pointAtS`, clamp ±14 then × 0.35).
- `free-fly-pointer-lock-camera.js`: `FREE_FLY`, `bindClickToLock`, `saveFreeCameraPose`,
  `restoreFreeCameraPose`, `updateFreeFlyCamera` (WASD/Space/C, Shift 24 u/s, clamps ±61 and
  [ground + 1.2, 200] only while moving), `disposeFirstPersonControls`.
- `d.freeCameraPose` (clones of `world.freeCameraStart`) right after the world in the composition.
- Tests: `tests/unit/camera-mode-director-switching.test.mjs`,
  `tests/unit/free-fly-fly-along-and-bridge-camera-rigs.test.mjs`,
  `tests/parity/camera-modes-parity.test.mjs` (exact vs the original over 11 708 frames).
- Parity tooling: `tools/parity/camera-mode-parity-shots.mjs` (`train-camera-day`,
  `bridge-camera-day`, `bridge-camera-evening`, `free-camera-day`, `train-camera-night`, each with a
  `-relaxed` twin; stage `residents-and-forest`), `tools/parity/camera-ui-runtime-probe.mjs`
  (`parity:probe -- --camera-ui`), `setCloneMode` in the clone simulation driver.
  The probe writes the combined `camera-ui-probe.json` plus `camera-ui-probe-<target>.json` per site.

### Changed

- `camera-mode-director.js`: final `setCameraMode` (free pose saved on leaving orbit, per-mode
  entry) and `updateCameraRig` (shared glide tail; bridge writes `controls.target`).
- `diorama.js`: `bindClickToLock` right after the PLC is created; `dispose` goes through
  `disposeFirstPersonControls`.
- `keyboard-shortcut-resolution.test.mjs`: a repeated Space while locked in orbit is still a flight key.

### Pending

- Manual headed pointer-lock checklist (docs/parity-testing-guide.md) not yet run; headless
  Chromium rejects `lock(true)`, so real lock, Esc release and WASD flight are unverified in a
  real browser.

## [0.9.0] - 2026-10-02

feat(world): village residents with their walk cycle, the instanced forest with its canopy height
grid, and the riverside rocks.

### Added

- `src/life/village/`: `VillageResidents` (woman, bare-chested man and dog on copies of the first
  two cottage frames; 10 npr materials in a fixed order; per-resident merges of head, each arm, each
  leg and the body, then dog head, tail and body: 33 meshes), `resolveVillageWalkCycle`
  (`VILLAGE_WALK_CYCLE_SECONDS` 28: walks [4, 12) and [18, 26)), `createVillageResidentMaterials`,
  `shape` / `block` / `makeHead` / row emitters, `dressVillageWoman`, `dressVillageMan`,
  `buildVillageDog`. `update(elapsed, dt)` returns `[VILLAGE] Woman starts walking` /
  `[VILLAGE] Woman stops in yard` on a change.
- Build steps 10–12: `createVillageResidents` (plus two r2.2 yard exclusions), `buildTrees`,
  `buildRocksAndSheep` (rocks only until the sheep flock lands).
- `src/world/trees/`: `createTreeSpeciesGeometries` (conifer, round, cluster, bush; `TREE_TRUNK_COLOR`),
  `scatterTrees` (`TREE_SCATTER_ATTEMPTS` 14000, W4 draw order, `TREE_TINTS`, `AUTUMN_TREE_TINT`,
  `BLOSSOM_TREE_TINT`), `buildTrees` (4 instanced layers, sway material for 0–2, still bush material,
  pushed into `world.treeLayers`), canopy grid (`CANOPY_CELL_SIZE` 2, `CANOPY_HALF` 70,
  `CANOPY_GRID_SIZE` 70, `createCanopyHeightGrid`, `stampCanopyHeights`, `treeCanopyHeightAt`).
- `src/world/rocks/riverside-rock-scatter.js`: `buildRiversideRocks` (`ROCK_CAPACITY` 80,
  `ROCK_ATTEMPTS` 3000, W5a draw order, no instance colour).
- `World#treeCanopyHeightAt(x, z, radius)`; `updateWorld` slots 5 (residents update) and 6
  (resident log line).
- Tests: `tests/unit/village-walk-cycle-and-tree-rock-scatter.test.mjs` (walk-cycle table, canopy
  grid edges, W4/W5a draw accounting on scripted stub worlds),
  `tests/unit/parity-forest-residents-shots-actions-and-probe.test.mjs`,
  `tests/parity/residents-trees-rocks-parity.test.mjs` (clone-only build + 8 log lines at the exact
  frames; original A/B/C: yards, tree buffers, geometries, materials, canopy grid, 10 000 canopy
  queries, stream continuation, resident signatures, 60 s of resident poses at fixed and random dt,
  rock buffers, whole `world.group` signature multiset + ordered, exclusion prefix).
- Parity tooling: stage `residents-and-forest` with shots `overview-day-settled-masked`,
  `overview-zoomed-orbited-masked` (new reference 12b), `overview-night-masked`,
  `village-residents-yard`, `trees-sway-t0`, `trees-sway-t1`, `trees-sway-hold` (all three always
  `fresh`, so the t0 baseline never shares a page with a parked train), `trees-debug-hidden`; hide set `water` and preset `cloneMissing`; shot page actions
  (`page-shot-actions.mjs`: `uniformTimeOffset`, `debugLayerOff`, `inPageCameraPose`,
  `holdPausedFrames`); same-site shot relations and action checks in `parity:compare`
  (`intra-site-shot-checks.mjs`); probe section `forest` (`forest-residents-runtime-probe.mjs`).

### Changed

- `ACTIVE_PARITY_STAGE` advanced to `residents-and-forest`; `station-free-start-day/-night` moved
  into it as strict shots (hide `cloneMissing` + `train` + `transient`).
- Research-capture path helpers moved to `tools/parity/research-capture-paths.mjs` and probe diffing
  to `tools/parity/probe-result-diffing.mjs` (both re-exported from their old modules) to keep the
  shot list and the probe under the 200-line budget.
- Capture metas gain `shotActions`; shots gain `uniformTimeOffset`, `holdPausedFrames`,
  `debugLayerOff`, `inPageCameraPose` and `relation` (shots with page actions get their own page).
- Clone frozen default: 1004 calls / 1,657,126 triangles / 360 geometries / 5 textures / 20 programs.

## [0.8.0] - 2026-10-02

feat(world): village cottages with chimney smoke and shrubs, and the windmill with hay bales and rotor.

### Added

- `src/world/village/`: `buildVillage` (build step 7): ring search around the pond (2 world draws per
  try; reject by height band, slope, track gap, house gap, exclusions), per house a levelled pad,
  walls, prism roof (`ROOF_COLORS`, n mod 5), side/back wall vents, ridge, roof vent, chimney,
  door/inset/knob/doorstep/plinth/cap, corner posts and eaves, two flower-box windows with hinged
  shutters (`SHUTTER_ANGLES`, `shutterAngleIndex`) and a 2-light night halo, 12 chimney puffs
  (`registerChimneySmoke`, `HOUSE_SMOKE_COUNT` 12, `HOUSE_SMOKE_LIFETIME` 3.5), a per-house merge
  (smoke excluded), r2.6 exclusions, `villageHomes`, and the instanced shrubs (`SHRUB_COLORS`,
  `buildVillageShrubs`). Fewer than two houses throws `Village residents require two houses`.
- `src/world/windmill/`: `findWindmillSite` (always 600 draws) and `buildWindmill` (build step 8):
  pad, tower, foundation ring, cap, doorway and steps, `windmillRoofHeight`, `HAY_BALE_STACKS` /
  `buildWindmillHayBales`, `buildWindmillRotor` (`WINDMILL_ROTOR_SPEED` 0.9), r4.5 exclusion.
- `updateWorld` slots 8 (`updateChimneySmoke`) and 9 (`updateWindmillRotor`).
- Tests: `tests/unit/village-and-windmill-build-logic.test.mjs`,
  `tests/unit/parity-village-windmill-shots-regions-and-probe.test.mjs`,
  `tests/parity/village-windmill-parity.test.mjs` (stream position, transforms, smoke records,
  glows, pads, exclusions, heights, shrub buffers, per-house/windmill/world signatures, noShadow
  order, 600 frames of smoke and rotor against the original World update).
- Parity tooling: hide set `unbuiltAfterWindmill`; named shot regions (`shot-region-projection.mjs`)
  stored in capture metas and cropped by `parity:compare` (`--region all|none|names`); stage
  `village-and-windmill` with shots `village-windmill-overview-day`, `-zoomed-day`, `-evening`,
  `-zoomed-night`; probe section `village` (`village-windmill-runtime-probe.mjs`).

### Changed

- `ACTIVE_PARITY_STAGE` advanced to `village-and-windmill`; `world-core-overview` and
  `world-core-bridge` are strict shell-stage shots now that every building pad exists on the clone.
- Shot factory and camera poses moved to `tools/parity/parity-shot-factory-and-camera-poses.mjs`
  (shot list stays under the 200-line budget); shots gain a `regions` field.
- `runtime-counts-probe.mjs` compares the village section in every scenario, also under `--fields`.
- The flat-heightmap registry test skips the village and windmill too (flat ground has no house site).
- `parity-world-core-hide-set-and-report-only-shots.test.mjs` renamed to
  `parity-world-core-hide-set-and-strict-shots.test.mjs`.
- Clone frozen default: 928 calls / 326,946 triangles / 322 geometries / 5 textures / 17 programs.

## [0.7.0] - 2026-10-02

feat(train): train model, station-stop motion, smoke puffs, brake sparks and headlight.

### Added

- `src/train/`: `Train` (locomotive with glazed cab, static driver and raven, smokebox front,
  uv-less cowcatcher, pilot bars, three lamps with halos and the headlight cone; tender; four
  coaches maroon/maroon/green/maroon with cloned X-muntin window grids and 12 window halos each),
  built from part tables in a fixed order, merged per car with the 44 wheel groups excluded, offsets
  0/4.1/8.2/13.25/18.3/23.35, `totalLength` 25.650000000000002 and chord placement + wheel roll in
  `update(world, s)`; palette factories (`createTrainMaterials`, `createCoachMaterials`,
  `createCoachBodyMaterial`, `COACH_COLORS`); `train-mesh-helpers.js` (`add`, `boxGeometry`,
  `cylinderAlongZ/X`, `addParts` part-table emitter).
- Pure station-stop motion (`initTrainMotion`, `stepTrainStationMotion`, `computeBrakeStrength`),
  `BrakeSparks` (269 instanced streaks, `SPARK_CAPACITY`, `SPARK_EMISSION_MULTIPLIER`),
  `LocomotiveSmokePuffPool` (70 puffs, `puffEmissionInterval`), `updateTrainAndEffects` and
  `writeHeadlightUniforms`.
- Diorama parity surface: `updateTrain(simDt)`, `puffTimer` get/set onto the pool, `train`,
  `brakeSparks`, `puffPool`, `puffs`; `brakeSparks.dispose()` in `dispose()`.
- Tests: `tests/unit/train-station-motion-controller.test.mjs` (motion goldens),
  `tests/parity/train-model-and-motion-parity.test.mjs`,
  `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs`, and the node driver
  `tests/helpers/clone-simulation-driver.mjs` (`createCloneSimulation`, `stepCloneFrame`,
  `snapshotTrainState`).
- Browser parity: shots `train-only-braking-front-day`, `-no-effects`, `train-only-dwell-side-day`,
  `train-only-night-headlight`; probe options `--shot <id>` and `--fields a,b`;
  `prepareShotScene` shared by capture and probe.

### Changed

- Composition: world → train → sparks → motion init → sky → 70 puffs; shadow list
  [sky, sparks, world.noShadow, train.noShadow, puffs]; glow registry still last.
- `stepSimulation` runs `updateTrain(simDt)` before `world.update`, which now receives the
  locomotive position and a fresh `{distance, speed, length}` record.
- `renderDioramaFrame` writes the headlight uniforms right after glow visibility.
- `ACTIVE_PARITY_STAGE` advanced to `train`.
- `runWithSeededMathRandom` also accepts a generator function (one stream across calls);
  `cameraRig()` (camera + controls stubs) moved to `tests/helpers/oracle-camera-controls-stub.mjs`,
  shared by the oracle and the clone driver.
- `createLightGlows` allocates the instanced geometry before its template quad, so train and
  station halo geometry ids/UUIDs follow the original allocation order (output unchanged).
- `diorama-scene-composition-order.test.mjs`, the `stepSimulation` case in
  `station-sign-clock-and-build-counts.test.mjs` and the stage counts in
  `parity-shot-list-selection-and-stages.test.mjs` follow the new order and shots; the
  render-pipeline unit test asserts the headlight uniform values and their write order.

### Fixed

- Capture CSS (`captureCssText`) hides UI descendants with `transition: none !important`: the
  `transition-all` HUD buttons otherwise kept rendering for several SwiftShader frames after
  being hidden and leaked into cheap 3D shots, failing strict train shots intermittently.
- `stepCloneFrame` now matches `stepOriginalFrame` and the frame loop: it writes
  `world.nightAmount` from `uNight` first and steps the simulation only when not paused and
  timeScale > 0, at dt·timeScale (no effect on the existing daylight ×1 suites).
- `stepSimulation` calls `updateTrain`, `world.update` and reads `train` unconditionally (contract
  §5); a context without them now throws instead of silently skipping the step. The bare-context
  unit case became a time/uTime-before-train ordering case plus the two throwing cases.
- The 120 s behaviour run's puff check (`live ≤ 70`, always true for a 70-record pool) is replaced
  by spec-formula checks in `tests/helpers/smoke-puff-behaviour-checks.mjs`: emission gaps, a
  2.4–3.6 s lifetime window on live counts and the cruise steady state.
- Material creation order is now tested: `tests/helpers/fresh-process-train-material-ids.mjs`
  builds a Train in a child process (cold npr cache); coach glow id gaps 25/26/25 always, and the
  per-mesh relative material ids/types/names against the original when the cache is present.
- Render-pipeline unit test header and title list the headlight-uniform step.

## [0.6.0] - 2026-10-02

feat(world): Mossbrook station.

### Added

- Station build step (`src/world/station/`, step 6 between `buildBridge` and `buildTerrain`):
  nearest-frame placement (frame 1008, `stationS` = distance + 4.5), oriented station group,
  `freeCameraStart`, `stationSite`; platform slab and edge line, shelter, bench; station building
  with levelled pad, three-sided prism roof (smooth cylinder normals), gable/back/roof vents,
  ridge, door, emissive windows with hinged shutters, sills, mullions and façade trims, merged per
  material (clock hands excluded); animated wall clock (`updateStationClock`, 60 s / 720 s
  periods); name board with the 1024×256 Mossbrook canvas sign (`MeshBasicMaterial`, SRGB
  texture); two lamps with omni night halos; luggage props; stairs with nosings and railings on a
  second pad; footpath ribbon draped on the terrain with 26 r1.8 exclusions, then the r8 station
  exclusion. The platform extension is baked with the computed float 0.7800000000000002.
- `World#update(elapsed, dt, trainPosition, trainMotion)` delegating to the new fixed-slot
  `updateWorld` (`src/world/world-per-frame-update.js`; slot 1 = station clock).
- Error string `Station name canvas context unavailable`.
- Tests: `tests/unit/station-sign-clock-and-build-counts.test.mjs`,
  `tests/unit/parity-station-shots-hide-families-and-parking.test.mjs`,
  `tests/parity/station-parity.test.mjs` (bit-identical placement, heights, pads, exclusions,
  signatures and child order, sign recordings, clock, pads baked into terrain and heightTex).
- Browser parity: hide families `stationFigures`, `sheep`, `balloon`, `villageResidents`,
  `houseSmoke` and preset `allFamilies`; `parkTrainAway` and the shot flag `parkTrain`; camera
  frames `relativeTo: 'station' | 'freeCameraStart'`; shots `station-trackside-closeup-day/-night`
  (strict, stage `shell-and-sky`) and report-only `station-free-start-day/-night`; probe station
  section (`tools/parity/station-runtime-probe.mjs`) with sign canvas hash, Fredoka check, frozen
  check and font-race reload (≤ 3 attempts).
- Live-page probe check `station clock hands follow live sim time` (both sites): once `time` > 0.05,
  `time` and both hands are read in one evaluate and must `Object.is`-equal the in-page formulas.
- `npm test` golden station layout (`stationS`, group position/quaternion/`rotation.y`,
  `freeCameraStart`, `buildingFoundations`, FNV-1a hashes of heights, exclusions and footpath
  position/index) plus the `buildStation` slot check; shared `tests/helpers/typed-array-fnv1a-hash.mjs`.

### Changed

- `stepSimulation` calls `world.update(time, simDt)` right after the `uTime` write (skipped only
  for a context without a world).
- `parity-harness-pure-logic.test.mjs` expects the two station closeups in the shell stage; its
  shot-list cases moved to `tests/unit/parity-shot-list-selection-and-stages.test.mjs`.
- Footpath ribbon samples its 101 sections first, then fills preallocated position/index arrays;
  output (positions, indices, normals, exclusions, UUID draws) is bit-identical.

## [0.5.0] - 2026-10-02

### Added

- World core (`src/world/`): `World` class (original field order, `rand = mulberry32(42)`
  created before the track, query wrappers `nearest`/`inBridge`/`heightAt`/`excluded`/
  `pointAtS`/`tangentAtS`/`flattenBuildingGround`) driven by the ordered `WORLD_BUILD_STEPS`
  registry with test-only `{stopAfter, skip}` (unknown skips ignored, unknown `stopAfter` throws
  `Unknown world build step: <name>`, a skipped stop target still stops).
- Terrain: river distance and natural height, graded heightmap with a cached per-vertex
  nearest-track grid (Float64 distances; built lazily when grading is skipped), rotated building
  pads, vertex-coloured surface with the FLOWERS material, strata skirt (`topY`), wooden plinth
  and the R8 `heightTex`.
- Track and bridge: centripetal spline frames + Float32 `sx`/`sz`, ballast and rail extrusions,
  383 instanced sleepers; bridge span [30, 178], deck/side girders, handrails, 76 instanced posts,
  chord-plane arch ribs, 20 spandrel columns, 7 braces, 8 approach piers, 2 stone abutments.
- Shared geometry helpers: `box`, `colorize`, `tintGeometry`, `jitter`, `extrude`,
  `addWallVent`, `addRoofVent`.
- Tests: `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` (helpers, registry,
  golden scalars and 9 FNV-1a hashes, 444 warm UUID draws; no oracle needed),
  `tests/unit/parity-world-core-hide-set-and-report-only-shots.test.mjs`,
  `tests/unit/diorama-scene-composition-order.test.mjs` (world before sky, shadow-hidden list),
  `tests/parity/terrain-track-bridge-parity.test.mjs` (track, heights, six-pad flatten sequence,
  terrain/skirt/heightTex bytes, 10,000 query samples, multiset and ordered scene signatures,
  npr material request order, part counts, equal UUID draws, build time),
  `tests/helpers/clone-world-factory.mjs` (`WORLD_CORE_SKIP`). The frame-loop test checks the
  `nightAmount` write (after `updateTimeOfDay`, before the sim step, also while paused); the
  colorize test uses a smooth sphere so flat vs kept normals are both observable.
- Browser parity: in-page hide set `allButWorldCore` (terrain/skirt by define, flat world-core
  materials by `uColor hex|uStipple`), report-only shots `world-core-overview` and
  `world-core-bridge` (selected by id only; `parity:compare` prints `REPORT(...)` and never fails
  the run on them).

### Changed

- `composeDioramaScene` builds the World first and adds `world.group` before the sky; the
  shadow-hidden list is the sky followed by `world.noShadow`.
- The frame loop writes `world.nightAmount` from `uNight` right after `updateTimeOfDay`.
- `applyHideSets` moved to `tools/parity/page-hide-set-application.mjs` (re-exported by
  `page-parity-helpers.mjs`) and restores overlapping hide sets in reverse order; the page-side
  step also checks that `updateTrain` exists before calling it.

## [0.4.0] - 2026-10-01

### Added

- `···` debug menu (`ui/debug-menu-panel.js`): body-level `details#debug-menu` with Trees/Clouds
  layer switches (objects resolved at toggle time, safe on a world-less Diorama, always logging
  `[DEBUG] <Label>: shown|hidden`) and a perf readout (FPS, frame/CPU ms, draw calls, triangles,
  geometries, textures) refreshed on `toggle` and every 500 ms while open; the interval is cleared
  on `pagehide`. Mounted after `[GAMEPLAY] Started` and the intro start, before the first toast.
- Opt-in parity hook (`engine/parity-test-hook.js`): `?parity` exposes `window.__diorama` and
  `window.__parityBuildInfo` (Fredoka readiness at build time); `?parity=freeze` also pauses.
  Installed right after `prepareOverviewIntro()`; dormant and silent without the param.
- Node parity harness (`tests/helpers/`): minimal DOM shim with recording 2D canvases, original
  World stepper (`stopAfter`/`skip` via in-memory prototype patching, restored on every exit
  path), simulation oracle on the original Diorama prototype, quantised hashing and scene-graph
  signatures with multiset/ordered comparison. `tests/parity/harness-self-check.test.mjs` (8 cases,
  `npm run test:parity`; prototype restore proven after normal, sentinel-stop, pre-patch and
  mid-build failures), `tests/unit/parity-harness-pure-logic.test.mjs` (15 cases) and
  `tests/unit/parity-compare-meta-warnings.test.mjs` (5 cases) and
  `tests/unit/original-route-hook-error-surfacing.test.mjs` (6 cases).
- Browser parity harness (`tools/parity/`): full-Chromium launcher with a clone server
  autostart, route hook for the original's entry module, frozen fixed-dt seeded stepping,
  DOM-shot helpers, a stage-gated shot list (34 shots; 17 in `shell-and-sky`, including four
  sky-direction shots), `parity:capture` (a shared `runId` per invocation; original route errors
  surface immediately instead of as a readiness timeout), `parity:compare` (heatmaps, thresholds,
  meta warnings: run/profile/browser/renderer mismatches, capability gaps, and build-time and
  font-readiness warnings only once both sites have a world),
  `parity:probe` (renderer.info, world fields, post-pass synthetic-input comparison, hook and
  debug-menu checks).
- `docs/parity-testing-guide.md` with the first baseline: all 17 `shell-and-sky` shots pass (sky
  max channel diff ≤ 1, DOM shots identical); sky-only probe 2 calls / 962 triangles on both
  sites; post probe max diff 0; original frozen default 1373 calls / 1,762,696 triangles / 419
  geometries / 6 textures / 25 programs.

### Changed

- `src/main-entry.js`: installs the parity hook in the build step and mounts the debug menu
  before the first toast.
- `package.json`: `test:parity`, `parity:capture`, `parity:compare`, `parity:probe`; `npm test`
  stays unit-only.

## [0.3.0] - 2026-10-01

### Added

- Real `Diorama` engine (`engine/diorama.js`), replacing the P01 facade at the same path and
  public surface: `WebGLRenderer` (antialias off, pixel ratio ≤ 2, linear colour space), the
  constructor fields Phase 10 later consumes (`autoRotateEnabled`, `raf`, fly-along vectors,
  `tmpA`/`tmpB`, `loop`), `logCameraPose`, `dispose`.
- 120fps-capped frame loop (`engine/frame-loop-scheduler.js`) and `engine/simulation-step.js`:
  every per-frame member is read from the instance at call time (never cached/bound), so a
  later instance override takes effect on the next frame with no edit to either file.
- Time-of-day palettes and 3s smoothstep blend (`engine/time-of-day-palettes-and-transition.js`):
  day/evening/night, written in place into the shared uniform bag, `uLightDir` renormalised
  every step.
- Procedural sky dome (`materials/procedural-sky-dome-material.js`): gradient, sun/moon glow and
  disc, stars, 3 ridge hill bands, mist — written fresh from the engine phase's formula tables.
  Night-glow registry (`engine/night-light-glow-registry.js`).
- Custom 2048² shadow depth pass (`engine/custom-shadow-depth-pass.js`) and the post pass
  (`engine/post-ink-outline-dither-pass.js`): depth-Laplacian ink outline, saturation, film grain
  or a recursively-built 4x4 Bayer posterize, vignette.
- Pixel-art render resolution and resize wiring (`engine/render-resolution-resizer.js`), the
  render pipeline orchestrator (`engine/render-pipeline.js`) and scene composition
  (`engine/diorama-scene-composition.js`).
- Overview `OrbitControls` with the 3.2s dolly-in intro and damping-off double reset
  (`engine/cameras/overview-orbit-camera.js`), `PointerLockControls` creation
  (`engine/cameras/free-fly-pointer-lock-camera.js`), and the camera-mode director
  (`engine/cameras/camera-mode-director.js`).
- 32 new unit/oracle-parity test scenarios across 4 suites; all pass with the parity cache
  present. Headless smoke verified zero console errors and sky-colour regions pixel-matching the
  reference captures (day/evening/night/pixel-art) within the deferred-parity thresholds.

## [0.2.0] - 2026-10-01

### Added

- Seeded PRNG + gradient noise (`core/seeded-prng-and-gradient-noise.js`): `mulberry32`, the
  stream-A permutation/gradient tables (built once from seed 1337), `noise2`, `fbm`, `smoothstep`,
  `lerp`; plus `core/scalar-math-helpers.js` (`wrapAngle`, `positiveModulo`,
  `exponentialResponse`) and the colour-management side-effect module.
- Shared lighting uniform bag (`materials/shared-lighting-uniforms.js`): `G`, `NIGHT_UNIFORMS`,
  `SHADER_NIGHT_UNIFORMS`, `LIGHTING_UNIFORMS`, all frozen singleton containers.
- NPR cel-shading GLSL library (`materials/glsl/*`) and the cached `npr()` material factory
  (`materials/npr-cel-material-factory.js`), written fresh from formula tables; GLSL interface
  (uniform/attribute/`#ifdef`/function-signature) parity verified against the original oracle.
- Night effects: `effects/night-headlight-light-cone.js` (`createLightCone`) and
  `effects/night-light-glow-sprites.js` (`createLightGlows`), both named `'night-light-glow'`.
- Per-material static-geometry merge (`geometry/merge-static-geometry-by-material.js`), including
  the mirrored-winding-flip and plain-mat3-normal quirks.
- Original-source parity oracle: `tools/parity/fetch-original-source.mjs` (sha256-pinned,
  all-or-nothing fetch into gitignored `.parity-cache/original/`) and
  `tests/helpers/original-module-loader.mjs` (guarded import + `extractGlslInterface`).
- 30 new unit/parity test scenarios across 3 suites (noise, materials/GLSL, merge/glows), all
  passing with the cache present; parity cases skip cleanly without it.
- `npm run parity:fetch` script; README "Parity source cache" section.

## [0.1.0] - 2026-09-30

### Added

- Repo scaffold: `package.json`, lockfile, `vercel.json`, `.vercelignore`, `.gitignore`.
- `tools/static-dev-server.mjs` (build-free static server, correct MIME types, traversal/dotfile
  guards) and `tools/check-file-line-limits.mjs` (200-line budget gate).
- Original logo (`assets/train-diorama-logo.svg`) and favicon (`assets/clock-favicon.svg`), hand
  authored from the design-guidelines spec.
- Page shell `index.html`: full DOM per the shell/HUD contract, import map pinned to
  `three@0.186.0`, Fredoka font, Vercel analytics stub (non-local hosts only).
- Hand-written utility CSS across 5 files, reproducing the original's cascade-layer ordering so
  unlayered component rules win over Tailwind-style utilities.
- Settings persistence (`ui/settings-schema-defaults.js`,
  `ui/settings-local-storage-persistence.js`) with all-or-nothing validation and a save circuit
  breaker.
- HUD rendering, actions and DOM bindings (`ui/hud-button-renderers.js`,
  `ui/hud-state-actions.js`, `ui/hud-dom-event-bindings.js`), the shortcut toast
  (`ui/shortcut-toast.js`), and the keyboard shortcut resolver/binder
  (`ui/keyboard-shortcuts.js`).
- Weighted loading screen runner (`ui/loading-screen-step-runner.js`) and boot wiring
  (`src/main-entry.js`).
- A non-rendering `Diorama` facade stub (`src/engine/diorama.js`) implementing the UI contract.
- Unit tests for settings persistence, keyboard shortcut resolution and the loading runner
  (29 scenarios, `node --test`).
- This documentation skeleton.
