# Codebase summary

The repository at release 1.0.0 (full-scene parity sign-off), refreshed for the 2026-10-04
documentation pass. Sections: the annotated file tree, the module index with line counts, the
support modules that exist to keep files small or to cover a behaviour with a test, and the feature
traceability table (every scene feature → the files that implement it → the test or sign-off check
that proves it).

Quick facts:

| Fact | Value |
|---|---|
| Code files | 245 (`index.html`, 5 CSS files, JS under `src/`, MJS under `tests/` and `tools/`), 21,395 lines |
| Largest file | 199 lines (`tests/unit/keyboard-shortcut-resolution.test.mjs`); `npm run check:lines` fails at 200 |
| Runtime modules | 126 JS files under `src/` (8,563 lines), loaded unbundled through the import map |
| Tests | 296 unit tests in 37 test files (`npm test`), 79 node parity tests in 13 files (`npm run test:parity`) |
| Repository contents | code, docs (incl. `docs/techniques/`, `docs/prompt-log/`), 7 screenshots, two SVG assets, config; `.parity-cache/`, `.parity-output/`, `node_modules/`, `.vercel/`, `.claude/agent-memory/` are gitignored |
| Dependencies | none at runtime (three.js and Fredoka from CDNs); devDependencies `three@0.186.0`, `playwright@1.62.0` |

```
train-diorama/
├── index.html                                   page shell: DOM, import map, fonts, analytics stub
├── package.json / package-lock.json             scripts (dev/test/test:parity/check:lines/parity:*), devDependencies
├── vercel.json / .vercelignore / .gitignore      optional static-host config + ignore rules
├── README.md                                     status, gallery, quick start, scripts, structure, docs index, controls, credits
├── CLAUDE.md                                     operating manual for Claude Code: commands, folder map, hard rules, gotchas
├── assets/
│   ├── train-diorama-logo.svg                   original Fredoka wordmark + locomotive motif
│   └── clock-favicon.svg                        original clock glyph
├── styles/
│   ├── base-reset-and-utilities.css             layer order, preflight subset, 69 utilities, :root, [hidden]
│   ├── hud-panel-and-controls.css               panel, sliders, segmented TOD, help list
│   ├── loading-overlay.css                      loader card, bar, breathe animation
│   ├── toast-and-debug-menu.css                 toast states + debug menu styles
│   └── night-theme-overrides.css                body[data-time-of-day=night] overrides
├── src/
│   ├── main-entry.js                            boot: settings, HUD, loading steps, parity hook, intro, debug menu, toast
│   ├── ui/
│   │   ├── settings-schema-defaults.js          MODES, TIMES_OF_DAY, PIXEL_MODES, DEFAULT_STATE, validators
│   │   ├── settings-local-storage-persistence.js loadSettings, createSettingsSaver
│   │   ├── shortcut-toast.js                    showToast
│   │   ├── hud-button-renderers.js              element(), TOGGLES, renderModes/Toggles/TimeOfDay
│   │   ├── hud-state-actions.js                 createHudActions, applyHudVisibility
│   │   ├── hud-dom-event-bindings.js            bindHud: delegated clicks/inputs, right-click resets
│   │   ├── keyboard-shortcuts.js                isEditableTarget, resolveKeyAction, bindKeyboardShortcuts
│   │   ├── loading-screen-step-runner.js        runLoadingSteps, LOADING_HINTS
│   │   └── debug-menu-panel.js                  mountDebugMenu (Trees/Clouds toggles), formatPerformanceText
│   ├── engine/
│   │   ├── diorama.js                           Diorama facade: real engine, ctor order, UI API, updateTrain, puffTimer accessors, dispose (birds before sparks)
│   │   ├── diorama-scene-composition.js         createWorldBirdSystem; composeDioramaScene: world, birds, free pose, train, sparks, motion init, sky, puffs, shadow-hidden list, glow registry
│   │   ├── frame-loop-scheduler.js              120fps deadline loop, per-frame order (world.nightAmount), perf EMA
│   │   ├── simulation-step.js                   stepSimulation: time/uTime, updateTrain, world.update(time, simDt, loco position, motion), birds.update
│   │   ├── time-of-day-palettes-and-transition.js PALETTES (3x12), applyPalette, begin/stepPaletteTransition
│   │   ├── night-light-glow-registry.js         collectNightLightGlows, applyNightGlowVisibility
│   │   ├── custom-shadow-depth-pass.js          2048^2 depth RT, ortho light cam, bias matrix
│   │   ├── post-ink-outline-dither-pass.js      ink outline + saturation + grain/Bayer + vignette
│   │   ├── render-pipeline.js                   renderDioramaFrame: info/glows/headlight uniforms/sky/matrices/shadow/main/post
│   │   ├── render-resolution-resizer.js         computeRenderResolution, resizeDiorama
│   │   ├── parity-test-hook.js                  installParityTestHook: ?parity / ?parity=freeze + build info
│   │   └── cameras/
│   │       ├── overview-orbit-camera.js         OrbitControls config, intro prepare/step, double reset
│   │       ├── free-fly-pointer-lock-camera.js  PLC creation, click-to-lock, WASD/Space/C/Shift flight + clamps, pose save/restore, dispose
│   │       ├── train-fly-along-camera-rig.js    FLY_ALONG, wide-shot blend, side entry, rig transport, canopy/terrain floors, height response
│   │       ├── bridge-tripod-camera.js          BRIDGE_TRIPOD, clamped pan toward the track point under the train
│   │       └── camera-mode-director.js          CAMERA_FOV, setCameraMode (validate → intro → save → enter), updateCameraRig (shared glide)
│   ├── core/
│   │   ├── disable-three-color-management.js    ColorManagement.enabled = false side effect
│   │   ├── seeded-prng-and-gradient-noise.js     mulberry32, stream-A tables, noise2, fbm, smoothstep, lerp
│   │   └── scalar-math-helpers.js                wrapAngle, positiveModulo, exponentialResponse
│   ├── materials/
│   │   ├── shared-lighting-uniforms.js           G, NIGHT_UNIFORMS, SHADER_NIGHT_UNIFORMS, LIGHTING_UNIFORMS
│   │   ├── glsl/
│   │   │   ├── hash-and-value-noise-glsl.js      hash13/12/11, vnoise
│   │   │   ├── npr-lighting-common-glsl.js       COMMON_GLSL: shadowAt, headlightAt, nprShade, applyFog
│   │   │   ├── npr-vertex-shader-glsl.js         NPR_VERTEX_SHADER (instancing, TREE_SWAY, mat3 normals)
│   │   │   └── npr-fragment-shader-glsl.js       NPR_FRAGMENT_SHADER (STRATA, FLOWERS, NIGHT_GLOW, LOCAL_GLOW)
│   │   ├── npr-cel-material-factory.js           npr(options) cached ShaderMaterial factory
│   │   ├── procedural-sky-dome-material.js       skyMaterial(): gradient/sun-moon/stars/ridges/mist
│   │   ├── water-surface-material.js             waterMaterial(heightTex, size): height discard, depth ramp, ripples, foam, night, headlight
│   │   └── waterfall-curtain-material.js         waterfallMaterial(): DoubleSide streaks, side foam, foot splash, night
│   ├── effects/
│   │   ├── night-headlight-light-cone.js         createLightCone
│   │   └── night-light-glow-sprites.js           createLightGlows (instanced halo billboards)
│   ├── geometry/
│   │   ├── merge-static-geometry-by-material.js  mergeStaticGeometry
│   │   ├── procedural-geometry-helpers.js        box, colorize, tintGeometry (bird variant), jitter
│   │   ├── extrude-profile-along-frames.js       extrude(frames, profile, caps)
│   │   └── building-wall-and-roof-vents.js       addWallVent, addRoofVent
│   ├── life/
│   │   ├── birds/
│   │   │   ├── bird-geometry-builder.js                 createBirdGeometries (merged tinted body + wing/tip/tail), createBirdRig (12 objects), disposeBirdGeometries
│   │   │   ├── bird-flock-state-machine.js              decideBirdFlock (perched/flying/returning, [BIRDS] logs), computeFlockSnapshot (scratch target); no three
│   │   │   ├── bird-flight-poses.js                     createBirdFlightPoses: perched (idle + folded wings), flying (orbit), returning (glide + hop)
│   │   │   ├── bird-wing-body-animator.js               rotateBirdTowards (capped slerp), orientBirdAlongFlight (pitch/bank), animateBirdWingsAndBody
│   │   │   └── bird-system.js                           createBirdSystem: mulberry32(7821) flocks, flight heights, init snap, update, dispose
│   │   ├── station/
│   │   │   ├── station-figure-parts.js                  attachMesh(geometry, material, parent, position, scale?)
│   │   │   ├── station-traveler-old-man-figure.js       buildStationTravelerOldMan: IK legs, arm pivots, cane, hat, body regroup, 5 merges
│   │   │   ├── station-walker-controller.js             StationWalker (wait/turn/step, [STATION] logs), createPlatformWalker (widening float ops)
│   │   │   ├── station-walker-leg-ik-and-body-animation.js poseWalkerLegs (2-bone IK), animateWalkerBody (bob/sway/arms/cane floor solve)
│   │   │   ├── station-grandmother-figure.js            buildStationGrandmother: skirt, shawl, spectacles, bun, handbag, 2 merges, shift
│   │   │   └── station-travelers-idle-and-head-look.js  updateStationTravelers (slot 7): idle sway for non-walkers, faded head-look
│   │   ├── sheep/
│   │   │   ├── sheep-geometry-and-instanced-meshes.js   SHEEP_CAPACITY 27, SHEEP_LEGS, SHEEP_EARS, createSheepInstancedMeshes (body/leg/ear layers)
│   │   │   ├── sheep-pasture-ground-query.js            sheepGroundAt(world, x, z, normalOut): pasture mask + slope normal
│   │   │   ├── pasture-sheep-spawner.js                 spawnPastureSheep: 24 sheep in ≤ 4000 attempts (world.rand, after the rocks)
│   │   │   ├── trackside-sheep-flock-site.js            findTracksideFlockSite (clearing score), createTrackSheep (3 routes + r1.2 clearings)
│   │   │   ├── build-sheep-flock.js                     buildSheepFlock: meshes → pasture → clearing → rail sheep → counts → add → pose
│   │   │   ├── track-sheep-escape-state-machine.js      TRACK_SHEEP_PRESETS, advanceTrackSheep, advanceTrackSheepFlock (slot 2, [SHEEP] logs)
│   │   │   ├── sheep-locomotion-and-route-motion.js     updateSheepFlock (slot 3): sleep, wander, blocked turn, route sway, rail height
│   │   │   └── sheep-instance-pose-writer.js            createSheepTransforms, writeSheepInstancePose (tilt, bob, hop, legs, ears), markSheepInstancesDirty
│   │   └── village/
│   │       ├── village-resident-materials-and-primitives.js 10 resident materials, shape/block parts, row emitters, makeHead
│   │       ├── village-woman-and-man-outfits.js         dressVillageWoman (lathe dress, apron, belt, sleeves, locks), dressVillageMan
│   │       ├── village-dog-builder.js                   buildVillageDog: body, head + tail pivots, collar (build program, no merges)
│   │       └── village-residents.js                     VillageResidents (homes, merges, update slot 5), resolveVillageWalkCycle (28 s)
│   ├── train/
│   │   ├── train.js                              class Train: builder order, per-car merge, offsets, totalLength, update(world, s)
│   │   ├── train-palette-materials.js            13 loco/crew npr + cab glass, coach cream/gray/windowBar, COACH_COLORS
│   │   ├── train-mesh-helpers.js                 add, boxGeometry, cylinderAlongZ/X, SIDES, addParts part-table emitter
│   │   ├── locomotive-boiler-and-cab-builder.js  chassis, boiler, stack, dome, glazed cab → crew → fittings, whistle
│   │   ├── locomotive-driver-and-raven-builder.js static driver + raven group
│   │   ├── locomotive-front-end-and-lamps-builder.js smokebox door/bolts, buffers, cowcatcher, pilot bars, lamps, halos, headlight cone
│   │   ├── rolling-stock-wheel-builders.js       6 shared wheel geometries, small/driving wheel groups, loco wheels (spark order) + rods
│   │   ├── tender-car-builder.js                 tender: tank, coal, coping, 4 wheels
│   │   ├── passenger-coach-builder.js            window-grid template (cloned), one coach + 12 window halos
│   │   ├── train-station-motion-controller.js    pure station-stop machine, brake strength, initTrainMotion
│   │   ├── brake-sparks.js                       BrakeSparks: 269 instanced streaks, emission, bounce
│   │   ├── locomotive-smoke-puff-pool.js         LocomotiveSmokePuffPool (70 puffs), puffEmissionInterval
│   │   └── train-frame-update.js                 updateTrainAndEffects, writeHeadlightUniforms
│   └── world/
│       ├── world.js                              class World: field init, rand = mulberry32(42), build steps, queries, treeCanopyHeightAt
│       ├── world-constants.js                    SIZE, HALF, SEG, STEP, BOTTOM, UP, RIGHT, POND, RIVER, track points
│       ├── world-build-steps.js                  WORLD_BUILD_STEPS registry (writable entries) + runWorldBuildSteps; createVillageResidents (yards r2.2), buildRocksAndSheep, buildWater/Clouds/Balloon, buildBirdPerches (16)
│       ├── world-per-frame-update.js             updateWorld: fixed slot order (1 clock, 2–3 sheep, 4 walker, 5–6 residents + logs, 7 travelers, 8 smoke, 9 rotor, 10 clouds, 11 balloon)
│       ├── terrain/
│       │   ├── river-distance-and-natural-height.js           segDist, riverDist, naturalHeight
│       │   ├── terrain-heightmap-grading.js                   buildHeightmap, nearest-track grid cache, heightAt
│       │   ├── building-ground-flattening.js                  flattenBuildingGround (rotated pads)
│       │   ├── terrain-surface-mesh-and-vertex-colors.js      grid mesh, normals, colour rules, FLOWERS material
│       │   └── terrain-skirt-plinth-and-water-height-texture.js buildTerrain: surface, strata skirt, plinth, heightTex
│       ├── track/
│       │   ├── track-spline-frames-and-queries.js             curve, 1201 frames, sx/sz, nearest, pointAtS, tangentAtS
│       │   ├── bridge-span-detection.js                       findBridge, inBridge
│       │   └── track-ballast-rails-sleepers.js                buildTrack: ballast, rails, 383 sleepers
│       ├── bridge/
│       │   ├── bridge-deck-girders-and-railings.js            buildBridge: deck, girders, handrails, 76 posts
│       │   └── bridge-arch-columns-piers-abutments.js         createBridgeChord, arch ribs, columns, braces, piers, abutments
│       ├── station/
│       │   ├── build-station.js                               buildStation: fixed call order, traveler + walker after the sign, grandmother between the luggage builders
│       │   ├── station-site-placement.js                      frame 1008, stationS, group, freeCameraStart, shiftedX, r8 exclusion
│       │   ├── station-palette-materials.js                   npr option tables, createStationMaterials, case colours
│       │   ├── station-platform-shelter-bench.js              slab, edge line, shelter, bench
│       │   ├── station-building-shell-and-roof.js             pad #1, body, prism roof, vents, ridge, door, façade trims
│       │   ├── station-building-windows-and-shutters.js       panes, hinged shutters, sills, mullions, window halos
│       │   ├── station-wall-clock.js                          clock build + updateStationClock (60 s / 720 s periods)
│       │   ├── station-name-board-sign.js                     gate board, 20-step canvas sign, MeshBasic plate
│       │   ├── station-lamps-with-night-glow.js               2 hex lamps (3 shared geometries), omni halos
│       │   ├── station-luggage-props.js                       traveler cases, grandmother's 3-case stack
│       │   └── station-stairs-railings-footpath.js            pad #2, 5 steps, railings, footpath ribbon + 26 exclusions
│       ├── village/
│       │   ├── village-house-placement.js                     buildVillage: ring search (first world.rand consumer), reject tests, pads, merge, r2.6 exclusions, villageHomes
│       │   ├── village-house-palette-materials.js             ROOF_COLORS, createVillagePalette (14 items in creation order)
│       │   ├── village-house-body-and-roof.js                 addHouseShell, addHouseDoorAndTrim, chimneyCentre
│       │   ├── village-house-windows-and-shutters.js          SHUTTER_ANGLES, shutterAngleIndex, window glows, windows + shutters
│       │   ├── village-chimney-smoke.js                       registerChimneySmoke (61 draws), updateChimneySmoke (slot 8)
│       │   └── village-shrubs-instanced.js                    SHRUB_COLORS, buildVillageShrubs (6 per house, no draws)
│       ├── trees/
│       │   ├── tree-species-geometries.js                     TREE_TRUNK_COLOR, createTreeSpeciesGeometries (conifer, round, cluster, bush)
│       │   ├── tree-scatter-rules.js                          scatterTrees: 14000 attempts on world.rand, tints, autumn/blossom accents
│       │   ├── tree-instanced-layers.js                       buildTrees: canopy grid, sway/bush materials, 4 layers → treeLayers
│       │   └── tree-canopy-height-grid.js                     70×70 Float32 grid: stampCanopyHeights, treeCanopyHeightAt
│       ├── rocks/
│       │   └── riverside-rock-scatter.js                      buildRiversideRocks: ≤ 80 instanced dodecahedra (world.rand)
│       ├── perches/
│       │   └── bird-perch-builders.js                         buildBirdPerches (step 16): bridge-1..3, station-roof, trackside-2..4
│       ├── water/
│       │   └── river-water-and-waterfall-builder.js           findWaterfallMouth, createWaterfallGeometry (8×24), buildWater (step 13)
│       ├── sky/
│       │   ├── cloud-field-spawner.js                         createCloudSpawners (A 8 / B 7 / C 18), buildClouds (step 14, last world.rand consumer)
│       │   └── cloud-drift-fade-and-camera-avoidance.js       CLOUD_CAMERA_BUFFER, CLOUD_RETURN_RESPONSE, updateCloudDrift (slot 10), updateCloudCamera
│       ├── balloon/
│       │   ├── hot-air-balloon-envelope-and-basket.js         BALLOON_LOCAL_GLOW, BALLOON_ENVELOPE_PROFILE, envelope geometry/mesh, basket (185 boxes), ropes, sandbags
│       │   ├── hot-air-balloon-pilot-figure.js                buildBalloonPilot (scaled group, merged with the basket)
│       │   └── hot-air-balloon-burner-flame-and-flight.js     buildBalloon (step 15: merge, burner, flame, glow), updateBalloonFlight (slot 11)
│       └── windmill/
│           ├── windmill-site-and-body.js                      findWindmillSite (600 draws), buildWindmill, windmillRoofHeight, r4.5 exclusion
│           ├── windmill-hay-bales.js                          HAY_BALE_STACKS, 2 stacks / 5 bales on the levelled ground
│           └── windmill-rotor.js                              buildWindmillRotor (4 arms + hub), updateWindmillRotor (slot 9, 0.9 rad/s)
├── tools/
│   ├── static-dev-server.mjs                    http static server, correct MIME types, traversal guards
│   ├── check-file-line-limits.mjs               fails the build on any code file >= 200 lines
│   └── parity/
│       ├── fetch-original-source.mjs            sha256-pinned fetch of 18 original files into .parity-cache/
│       ├── playwright-browser-launcher.mjs      launch profiles, viewports, full-Chromium path, clone server
│       ├── original-site-route-hooks.mjs        anchor patch of the original's entry module (test browser only)
│       ├── page-parity-helpers.mjs              seeded Math.random, freeze, shot state, fixed-dt steps, pose (loco/station/free start), parkTrainAway
│       ├── page-shot-actions.mjs                shot page actions: uniformTimeOffset, debugLayerOff, inPageCameraPose (named), holdPausedFrames
│       ├── page-hide-set-application.mjs        in-page hide sets incl. allButWorldCore, the station-era families, unbuiltAfterWindmill, water
│       ├── dom-shot-page-helpers.mjs            capture CSS, DOM actions (reshowLoader), settle, clip
│       ├── parity-shot-list.mjs                 shots and selection; re-exports stages/hide sets and validation
│       ├── parity-shot-stages-and-hide-sets.mjs  PARITY_STAGES, ACTIVE_PARITY_STAGE (full-scene), THRESHOLDS, HIDE_SETS, HIDE_PRESETS, expandHideSets
│       ├── parity-shot-validation.mjs           shotListErrors: enums, hide sets, transients, references, regions, poses, relations
│       ├── station-travelers-and-birds-parity-shots.mjs travelers close-up, roof take-off, bridge birds in flight (full-scene)
│       ├── research-capture-paths.mjs           research-dir resolver, capture paths, skip reason
│       ├── parity-shot-factory-and-camera-poses.mjs shot() record factory + defaults, home/zoomed/chase/bridge poses
│       ├── camera-mode-parity-shots.mjs         camera-mode shots (side/bridge/orbit), strict + relaxed twins
│       ├── sheep-flock-parity-shots.mjs         sheep close-ups (day, night) and three hop shots around SHEEP_HOP_K2
│       ├── water-clouds-balloon-parity-shots.mjs zoomed overview, waterfall ROI, balloon/water/waterfall close-ups, Clouds switch-off; poses B/W/F
│       ├── camera-ui-runtime-probe.mjs          parity:probe --camera-ui: mode keys, toasts, glide/snap, click-to-lock, flight-key capture
│       ├── shot-region-projection.mjs           named regions (village, windmill, waterfall): page-side projection, device crops, selection
│       ├── capture-parity-shots.mjs             CLI parity:capture (sessions, PNG + meta incl. regions), prepareShotScene
│       ├── compare-parity-shots.mjs             CLI parity:compare (metrics, per-region crops, heatmaps, meta warnings, report)
│       ├── intra-site-shot-checks.mjs           same-site relations (differs/identical) and shot-action result checks
│       ├── runtime-counts-probe.mjs             CLI parity:probe (renderer.info, world fields, scenario sections, station, sheep, diff; --shot, --fields)
│       ├── scenario-probe-sections.mjs          collect + judge per-scenario sections (village, forest, water/clouds/balloon, travelers/birds)
│       ├── station-travelers-and-birds-runtime-probe.mjs flocks, birds, perch ids, flock modes, travelers, walker pose + comparison rules
│       ├── village-windmill-runtime-probe.mjs   exact village/windmill probe fields (homes, windmill transform, rotor, smoke)
│       ├── forest-residents-runtime-probe.mjs   tree/rock/resident counts, exclusion count + expected sheep-clearing delta
│       ├── sheep-flock-runtime-probe.mjs        sheep section: layer counts, routes, first pasture spots, stranding candidates, hop frames K1..K3
│       ├── water-clouds-balloon-runtime-probe.mjs time, 33-cloud layout, roof height, balloon position, water/waterfall presence + comparison rules
│       ├── probe-result-diffing.mjs             diffProbeResults, per-scenario diffTargets
│       ├── station-runtime-probe.mjs            station probe section, sign hash, frozen + live clock checks, font-race reload
│       ├── post-pass-synthetic-input-probe.mjs  post material outputs on synthetic inputs, cross-site diff
│       ├── hook-and-debug-menu-browser-checks.mjs debug-menu + hook exposure checks, live station clock check
│       ├── signoff-parity-shots.mjs             SIGNOFF_SHOTS (21 3D + 7 DOM), SIGNOFF_PROBE_STATES, RESEARCH_EQUIVALENTS, --shots signoff
│       ├── signoff-page-helpers.mjs             freezeRendering, hideSceneCanvas, forceLoadingCardState, toast/cloud settle, load marks, CPU sampler, boxes
│       ├── signoff-shot-capture.mjs             one context per shot, 120 s step bound, font + sign-hash retry, 3D / DOM shots, mask rects, sidecars
│       ├── signoff-shot-verdicts.mjs            log-sequence and box verdicts, noise-floor share, summary.md
│       ├── signoff-state-probe.mjs              parity:probe --states signoff: counts + digests per frozen state, exact verdict
│       ├── png-diff-in-page.mjs                 computeDiffMetrics (mask rects excluded) + in-page decode/measure/heatmap
│       ├── parity-metrics-math.mjs              EMA inversion, median/CV, palette keys + overlap, loader phase ms, heap attribution
│       ├── performance-budget-probe.mjs         CLI parity:perf: BUILD/LOAD marks, CPU-submit medians, CDP heap sampling, perf.json
│       ├── research-recapture-and-contact-sheet.mjs CLI parity:research: staged research script, palette overlap, contact sheet
│       └── deployment-smoke-check.mjs           CLI parity:smoke: errors, requests, loader, toast, pagehide dispose, analytics, excluded paths
├── tests/
│   ├── helpers/
│   │   ├── original-module-loader.mjs           guarded oracle import + extractGlslInterface
│   │   ├── synthetic-merge-rig.mjs              shared rig builder + describeTree for merge tests
│   │   ├── minimal-dom-shim.mjs                 document.createElement('canvas') with a recording 2D context
│   │   ├── original-world-stepper.mjs           buildOriginalWorld({stopAfter, skip}) via prototype patch + restore
│   │   ├── original-simulation-oracle.mjs       fake ctx on the original Diorama prototype, stepping, snapshots
│   │   ├── oracle-camera-controls-stub.mjs      cameraRig(): camera + controls stubs for oracle and clone driver
│   │   ├── quantised-number-hashing.mjs         quantise, hashNumbers, hashString
│   │   ├── typed-array-fnv1a-hash.mjs           fnv1aHex: FNV-1a-32 of a typed array's bytes (golden hashes)
│   │   ├── scene-graph-signature.mjs            DFS signatures, multiset/ordered compare
│   │   ├── scene-signature-key-builders.mjs     material/geometry/instance/texture keys
│   │   ├── clone-world-factory.mjs              createCloneWorld(options), WORLD_CORE_SKIP (CM off + DOM shim first)
│   │   ├── clone-simulation-driver.mjs          createCloneSimulation (oracle ctx shape via composeDioramaScene), setCloneMode, stepCloneFrame, snapshotTrainState, snapshotLifeState
│   │   ├── sheep-flock-parity-lockstep.mjs      firstSheepFlockMismatch (in-place, Object.is), runSheepLockstep (per-side Math.random + logs by prefix)
│   │   ├── station-travelers-and-birds-first-build.mjs first clone/original builds with draws counted (buildStation, bird material, birds), walker/rig/flock readers
│   │   ├── counted-full-world-builds.mjs        full original/clone builds with Math.random draws counted per named build step
│   │   ├── world-summary-digest.mjs             self-contained summarizeWorld / summarizeOrderedLists / summarizeInstancedCounts / hashStationSignCanvas
│   │   ├── smoke-puff-behaviour-checks.mjs      trackPuffs + assertPuffBehaviour: spec-formula smoke gaps, lifetimes, steady state
│   │   └── fresh-process-train-material-ids.mjs Train material id rows from a child process (cold npr cache)
│   ├── unit/
│   │   ├── settings-validation-and-persistence.test.mjs
│   │   ├── keyboard-shortcut-resolution.test.mjs
│   │   ├── loading-screen-step-runner.test.mjs
│   │   ├── loading-screen-hint-rotation.test.mjs     hint rotates every 2600ms, wraps, stops on completion
│   │   ├── loading-screen-test-fixtures.mjs          shared fake DOM, manual rAF + microtask helpers
│   │   ├── seeded-prng-and-gradient-noise.test.mjs   golden values + bitwise oracle parity
│   │   ├── npr-material-cache-and-glsl-parity.test.mjs  cache semantics, bag defaults, GLSL interface parity
│   │   ├── merge-static-geometry-and-glows.test.mjs     synthetic rig merge + cone/glow parity
│   │   ├── time-of-day-transition.test.mjs              palettes, transition maths, sky material, glow registry
│   │   ├── frame-cadence-and-render-resolution.test.mjs deadline cadence, loop order (nightAmount write), instance-override dispatch
│   │   ├── diorama-scene-composition-order.test.mjs     world, birds, train, sparks, sky, puffs; shadow list; train glows last; departure state
│   │   ├── train-station-motion-controller.test.mjs     motion: cruise, justLeft window, √ profile, snap, dwell, laps, strength, smoke interval
│   │   ├── shadow-post-and-render-pipeline-passes.test.mjs post uniforms, shadow pass, render pipeline order + headlight uniforms
│   │   ├── overview-intro-and-camera-modes.test.mjs     controls config, intro easing/logs, double reset, modes
│   │   ├── camera-mode-director-switching.test.mjs      setCameraMode: validation, intro interrupt, free-pose save/restore, side entry, FOV/flags
│   │   ├── free-fly-fly-along-and-bridge-camera-rigs.test.mjs camera constants, wide-shot blend, bridge pan, free flight clamps, side rig, click-to-lock, dispose
│   │   ├── parity-harness-pure-logic.test.mjs           hook, patch, perf text, metrics, shim, signatures
│   │   ├── parity-shot-list-selection-and-stages.test.mjs shot validation, stage gating, selection, hide expansion, research dir
│   │   ├── parity-compare-meta-warnings.test.mjs        compareMetas: run/env, capability, world-gated timing+font, cloud warnings
│   │   ├── original-route-hook-error-surfacing.test.mjs route-hook errors win over the readiness timeout
│   │   ├── world-core-helpers-registry-and-golden-values.test.mjs helpers, registry, golden scalars + FNV hashes, 444 UUID draws
│   │   ├── parity-world-core-hide-set-and-strict-shots.test.mjs allButWorldCore in-page set, strict world-core shots
│   │   ├── station-sign-clock-and-build-counts.test.mjs  sign writes, clock angles, placement, golden layout + FNV hashes, step slot, counts, merge order
│   │   ├── parity-station-shots-hide-families-and-parking.test.mjs station shots, hide families, parkTrainAway, camera frames
│   │   ├── parity-capture-css-hides-ui-without-transitions.test.mjs captureCssText: UI roots + descendants, transitions off
│   │   ├── village-and-windmill-build-logic.test.mjs     shutter cycle, smoke formula, rotor, shrubs, village guard, site search, windmill structure
│   │   ├── parity-village-windmill-shots-regions-and-probe.test.mjs village shots, unbuiltAfterWindmill, regions + crops, probe section
│   │   ├── village-walk-cycle-and-tree-rock-scatter.test.mjs walk-cycle table, canopy grid edges, tree/rock world.rand draw accounting (stub worlds)
│   │   ├── parity-forest-residents-shots-actions-and-probe.test.mjs forest shots, water/figure hide sets, page actions, forest probe, relations
│   │   ├── track-sheep-escape-state-machine.test.mjs   FSM windows, reaction delay, same-step jump, escape/return, flock loop, fuzz vs original
│   │   ├── parity-sheep-shots-and-probe.test.mjs        sheep shots, close-up pose, probe section and comparison rules
│   │   ├── waterfall-cloud-avoidance-and-balloon-flight.test.mjs mouth + curtain grid, drift/fade, camera push, flight formulas, envelope checker, water materials
│   │   ├── parity-water-clouds-balloon-shots-and-probe.test.mjs water/cloud/balloon shots, waterfall region, probe section and rules
│   │   ├── bird-flock-state-machine.test.mjs            transition table + boundaries, capture flags, snapshot thresholds, wrap, x/z cars, scratch target
│   │   ├── parity-station-travelers-and-birds-shots-and-probe.test.mjs travelers/birds shots and poses, probe section, verdicts
│   │   ├── parity-metrics-math.test.mjs                 EMA inversion, median/CV, palette keys + overlap, loader marks, heap attribution
│   │   ├── parity-signoff-shots-and-verdicts.test.mjs   sign-off list, equivalents, log/box verdicts, summary, probe judge, smoke judge
│   │   └── hud-right-click-reset-to-defaults.test.mjs   right-click resets: defaults, suppressed menu, reset toasts
│   └── parity/
│       ├── harness-self-check.test.mjs                  cache-gated original World/stepper/oracle checks (npm run test:parity)
│       ├── terrain-track-bridge-parity.test.mjs         world core vs original: bytes, queries, signatures (multiset + ordered), material request order, draws, build time
│       ├── station-parity.test.mjs                      station vs original: placement, pads, exclusions, signatures, child order, sign, clock, baked terrain
│       ├── train-model-and-motion-parity.test.mjs       train goldens; signature, id order, byte-equal merged buffers, update(world, s) ×1000 vs original
│       ├── train-simulation-oracle-and-composition-parity.test.mjs 18000-frame oracle A/B (original/clone World), composition, headlight, behaviour
│       ├── village-windmill-parity.test.mjs             village/windmill vs original: draw index, transforms, smoke, glows, pads, shrubs, signatures, 600 frames
│       ├── residents-trees-rocks-parity.test.mjs        clone log timing; original: yards, tree/rock buffers, canopy grid + queries, stream, resident poses, world.group
│       ├── camera-modes-parity.test.mjs                 11 708 frames vs the oracle: side sweep, train rig, bridge, free flight clamps, pose save/restore
│       ├── sheep-flock-parity.test.mjs                  build after step 12 (stream, ground sweep, states, clearing, exclusions, layers, world.group) + 60 s synthetic train
│       ├── sheep-flock-oracle-train-parity.test.mjs     oracle train lockstep: 260 s day/night/wake, 90 s at speedMul 2.5, 60 s of 0.1 s steps
│       ├── water-clouds-balloon-parity.test.mjs         cold-cache full builds: UUID draws per step, fingerprint, 33 clouds, signatures, materials, 300 s lockstep
│       ├── station-travelers-and-birds-parity.test.mjs  first-build draws, perches, flock init, lane floats, walker events, oracle lockstep (180 s + 60 s at dt 0.1)
│       ├── full-scene-signature-parity.test.mjs         whole scene vs the oracle: signature, ordered lists (scene children, glows, shadow-hidden), world summary, 6 × 1800 lockstep frames + logs
│       └── fixtures/station-travelers-and-birds-expected.json perch, flock, walker and [BIRDS] timeline fixtures
└── docs/
    ├── project-overview-pdr.md                  goal, decisions, scope, acceptance status
    ├── system-architecture.md                   runtime, engine, build steps, per-frame order, every subsystem
    ├── codebase-summary.md                      this file
    ├── code-standards.md                        code rules, parity-critical rules, tests, git
    ├── design-guidelines.md                     style bible, HUD/loader tokens, logo and favicon spec
    ├── parity-testing-guide.md                  node oracle, browser capture/compare/probe, sign-off results
    ├── development-roadmap.md                   14 milestones, post-parity backlog (28 kept quirks)
    ├── project-changelog.md                     version history
    ├── deployment-guide.md                      local use; optional static-host deploy
    ├── diorama-techniques.md                    index of the technique catalogue in techniques/
    ├── how-it-was-built.md                      research → plan → multi-agent implementation story
    ├── techniques/                              14 technique chapters (01-scene-composition-and-scale.md … 14-performance-budget-and-scaling-up.md)
    ├── prompt-log/                              owner prompts and the original Workflow scripts as they ran
    └── images/                                  7 screenshots (overview day/evening/night/pixel art, train, bridge, bridge at night)
```

## Module index (line counts)

`wc -l` per directory on 2026-10-04 (245 code files, every one under 200 lines).

- `./` (1 file, 100 lines): index.html 100
- `src/` (1 file, 72 lines): main-entry.js 72
- `src/core/` (3 files, 106 lines): disable-three-color-management.js 5, scalar-math-helpers.js 15, seeded-prng-and-gradient-noise.js 86
- `src/effects/` (2 files, 140 lines): night-headlight-light-cone.js 56, night-light-glow-sprites.js 84
- `src/engine/` (11 files, 622 lines): custom-shadow-depth-pass.js 48, diorama-scene-composition.js 54, diorama.js 186, frame-loop-scheduler.js 39, night-light-glow-registry.js 17, parity-test-hook.js 21, post-ink-outline-dither-pass.js 105, render-pipeline.js 22, render-resolution-resizer.js 39, simulation-step.js 11, time-of-day-palettes-and-transition.js 80
- `src/engine/cameras/` (5 files, 380 lines): bridge-tripod-camera.js 21, camera-mode-director.js 63, free-fly-pointer-lock-camera.js 92, overview-orbit-camera.js 84, train-fly-along-camera-rig.js 120
- `src/geometry/` (4 files, 220 lines): building-wall-and-roof-vents.js 48, extrude-profile-along-frames.js 52, merge-static-geometry-by-material.js 62, procedural-geometry-helpers.js 58
- `src/life/birds/` (5 files, 430 lines): bird-flight-poses.js 79, bird-flock-state-machine.js 61, bird-geometry-builder.js 86, bird-system.js 138, bird-wing-body-animator.js 66
- `src/life/sheep/` (8 files, 543 lines): build-sheep-flock.js 25, pasture-sheep-spawner.js 34, sheep-geometry-and-instanced-meshes.js 51, sheep-instance-pose-writer.js 110, sheep-locomotion-and-route-motion.js 92, sheep-pasture-ground-query.js 30, track-sheep-escape-state-machine.js 108, trackside-sheep-flock-site.js 93
- `src/life/station/` (6 files, 506 lines): station-figure-parts.js 11, station-grandmother-figure.js 90, station-traveler-old-man-figure.js 153, station-travelers-idle-and-head-look.js 37, station-walker-controller.js 147, station-walker-leg-ik-and-body-animation.js 68
- `src/life/village/` (4 files, 371 lines): village-dog-builder.js 54, village-resident-materials-and-primitives.js 91, village-residents.js 167, village-woman-and-man-outfits.js 59
- `src/materials/` (5 files, 319 lines): npr-cel-material-factory.js 60, procedural-sky-dome-material.js 79, shared-lighting-uniforms.js 48, water-surface-material.js 78, waterfall-curtain-material.js 54
- `src/materials/glsl/` (4 files, 253 lines): hash-and-value-noise-glsl.js 32, npr-fragment-shader-glsl.js 79, npr-lighting-common-glsl.js 86, npr-vertex-shader-glsl.js 56
- `src/train/` (13 files, 953 lines): brake-sparks.js 113, locomotive-boiler-and-cab-builder.js 68, locomotive-driver-and-raven-builder.js 83, locomotive-front-end-and-lamps-builder.js 112, locomotive-smoke-puff-pool.js 78, passenger-coach-builder.js 109, rolling-stock-wheel-builders.js 60, tender-car-builder.js 33, train-frame-update.js 25, train-mesh-helpers.js 74, train-palette-materials.js 57, train-station-motion-controller.js 62, train.js 79
- `src/ui/` (9 files, 685 lines): debug-menu-panel.js 79, hud-button-renderers.js 60, hud-dom-event-bindings.js 117, hud-state-actions.js 105, keyboard-shortcuts.js 96, loading-screen-step-runner.js 100, settings-local-storage-persistence.js 48, settings-schema-defaults.js 62, shortcut-toast.js 18
- `src/world/` (4 files, 246 lines): world-build-steps.js 77, world-constants.js 37, world-per-frame-update.js 30, world.js 102
- `src/world/balloon/` (3 files, 254 lines): hot-air-balloon-burner-flame-and-flight.js 83, hot-air-balloon-envelope-and-basket.js 106, hot-air-balloon-pilot-figure.js 65
- `src/world/bridge/` (2 files, 162 lines): bridge-arch-columns-piers-abutments.js 113, bridge-deck-girders-and-railings.js 49
- `src/world/perches/` (1 file, 111 lines): bird-perch-builders.js 111
- `src/world/rocks/` (1 file, 37 lines): riverside-rock-scatter.js 37
- `src/world/sky/` (2 files, 200 lines): cloud-drift-fade-and-camera-avoidance.js 91, cloud-field-spawner.js 109
- `src/world/station/` (11 files, 646 lines): build-station.js 48, station-building-shell-and-roof.js 65, station-building-windows-and-shutters.js 47, station-lamps-with-night-glow.js 37, station-luggage-props.js 44, station-name-board-sign.js 79, station-palette-materials.js 42, station-platform-shelter-bench.js 49, station-site-placement.js 88, station-stairs-railings-footpath.js 98, station-wall-clock.js 49
- `src/world/terrain/` (5 files, 348 lines): building-ground-flattening.js 58, river-distance-and-natural-height.js 38, terrain-heightmap-grading.js 74, terrain-skirt-plinth-and-water-height-texture.js 72, terrain-surface-mesh-and-vertex-colors.js 106
- `src/world/track/` (3 files, 157 lines): bridge-span-detection.js 36, track-ballast-rails-sleepers.js 57, track-spline-frames-and-queries.js 64
- `src/world/trees/` (4 files, 211 lines): tree-canopy-height-grid.js 55, tree-instanced-layers.js 33, tree-scatter-rules.js 71, tree-species-geometries.js 52
- `src/world/village/` (6 files, 353 lines): village-chimney-smoke.js 56, village-house-body-and-roof.js 64, village-house-palette-materials.js 40, village-house-placement.js 73, village-house-windows-and-shutters.js 71, village-shrubs-instanced.js 49
- `src/world/water/` (1 file, 86 lines): river-water-and-waterfall-builder.js 86
- `src/world/windmill/` (3 files, 152 lines): windmill-hay-bales.js 41, windmill-rotor.js 27, windmill-site-and-body.js 84
- `styles/` (5 files, 447 lines): base-reset-and-utilities.css 145, hud-panel-and-controls.css 85, loading-overlay.css 97, night-theme-overrides.css 45, toast-and-debug-menu.css 75
- `tests/helpers/` (18 files, 1424 lines): clone-simulation-driver.mjs 157, clone-world-factory.mjs 21, counted-full-world-builds.mjs 55, fresh-process-train-material-ids.mjs 29, minimal-dom-shim.mjs 67, oracle-camera-controls-stub.mjs 29, original-module-loader.mjs 98, original-simulation-oracle.mjs 175, original-world-stepper.mjs 71, quantised-number-hashing.mjs 48, scene-graph-signature.mjs 119, scene-signature-key-builders.mjs 97, sheep-flock-parity-lockstep.mjs 89, smoke-puff-behaviour-checks.mjs 69, station-travelers-and-birds-first-build.mjs 103, synthetic-merge-rig.mjs 106, typed-array-fnv1a-hash.mjs 8, world-summary-digest.mjs 83
- `tests/parity/` (13 files, 2023 lines): camera-modes-parity.test.mjs 188, full-scene-signature-parity.test.mjs 180, harness-self-check.test.mjs 153, residents-trees-rocks-parity.test.mjs 176, sheep-flock-oracle-train-parity.test.mjs 84, sheep-flock-parity.test.mjs 137, station-parity.test.mjs 110, station-travelers-and-birds-parity.test.mjs 184, terrain-track-bridge-parity.test.mjs 182, train-model-and-motion-parity.test.mjs 174, train-simulation-oracle-and-composition-parity.test.mjs 154, village-windmill-parity.test.mjs 146, water-clouds-balloon-parity.test.mjs 155
- `tests/unit/` (38 files, 4923 lines): bird-flock-state-machine.test.mjs 102, camera-mode-director-switching.test.mjs 90, diorama-scene-composition-order.test.mjs 46, frame-cadence-and-render-resolution.test.mjs 188, free-fly-fly-along-and-bridge-camera-rigs.test.mjs 179, hud-right-click-reset-to-defaults.test.mjs 77, keyboard-shortcut-resolution.test.mjs 199, loading-screen-hint-rotation.test.mjs 43, loading-screen-step-runner.test.mjs 104, loading-screen-test-fixtures.mjs 99, merge-static-geometry-and-glows.test.mjs 198, npr-material-cache-and-glsl-parity.test.mjs 199, original-route-hook-error-surfacing.test.mjs 74, overview-intro-and-camera-modes.test.mjs 178, parity-capture-css-hides-ui-without-transitions.test.mjs 22, parity-compare-meta-warnings.test.mjs 51, parity-forest-residents-shots-actions-and-probe.test.mjs 141, parity-harness-pure-logic.test.mjs 166, parity-metrics-math.test.mjs 95, parity-sheep-shots-and-probe.test.mjs 70, parity-shot-list-selection-and-stages.test.mjs 65, parity-signoff-shots-and-verdicts.test.mjs 164, parity-station-shots-hide-families-and-parking.test.mjs 99, parity-station-travelers-and-birds-shots-and-probe.test.mjs 82, parity-village-windmill-shots-regions-and-probe.test.mjs 119, parity-water-clouds-balloon-shots-and-probe.test.mjs 96, parity-world-core-hide-set-and-strict-shots.test.mjs 80, seeded-prng-and-gradient-noise.test.mjs 184, settings-validation-and-persistence.test.mjs 147, shadow-post-and-render-pipeline-passes.test.mjs 182, station-sign-clock-and-build-counts.test.mjs 165, time-of-day-transition.test.mjs 198, track-sheep-escape-state-machine.test.mjs 181, train-station-motion-controller.test.mjs 169, village-and-windmill-build-logic.test.mjs 151, village-walk-cycle-and-tree-rock-scatter.test.mjs 142, waterfall-cloud-avoidance-and-balloon-flight.test.mjs 193, world-core-helpers-registry-and-golden-values.test.mjs 185
- `tools/` (2 files, 166 lines): check-file-line-limits.mjs 54, static-dev-server.mjs 112
- `tools/parity/` (42 files, 3749 lines): camera-mode-parity-shots.mjs 26, camera-ui-runtime-probe.mjs 194, capture-parity-shots.mjs 156, compare-parity-shots.mjs 163, deployment-smoke-check.mjs 137, dom-shot-page-helpers.mjs 87, fetch-original-source.mjs 167, forest-residents-runtime-probe.mjs 34, hook-and-debug-menu-browser-checks.mjs 136, intra-site-shot-checks.mjs 53, original-site-route-hooks.mjs 75, page-hide-set-application.mjs 75, page-parity-helpers.mjs 178, page-shot-actions.mjs 75, parity-metrics-math.mjs 79, parity-shot-factory-and-camera-poses.mjs 32, parity-shot-list.mjs 141, parity-shot-stages-and-hide-sets.mjs 27, parity-shot-validation.mjs 55, performance-budget-probe.mjs 155, playwright-browser-launcher.mjs 106, png-diff-in-page.mjs 75, post-pass-synthetic-input-probe.mjs 96, probe-result-diffing.mjs 27, research-capture-paths.mjs 21, research-recapture-and-contact-sheet.mjs 141, runtime-counts-probe.mjs 192, scenario-probe-sections.mjs 27, sheep-flock-parity-shots.mjs 24, sheep-flock-runtime-probe.mjs 92, shot-region-projection.mjs 77, signoff-page-helpers.mjs 101, signoff-parity-shots.mjs 113, signoff-shot-capture.mjs 181, signoff-shot-verdicts.mjs 59, signoff-state-probe.mjs 88, station-runtime-probe.mjs 96, station-travelers-and-birds-parity-shots.mjs 20, station-travelers-and-birds-runtime-probe.mjs 37, village-windmill-runtime-probe.mjs 24, water-clouds-balloon-parity-shots.mjs 36, water-clouds-balloon-runtime-probe.mjs 71

## Support modules and split files

Files that keep a module under the 200-line budget (a split), share plumbing between suites,
or add a covering test for one behaviour. Their roles in the parity graph are described in
`system-architecture.md` ("Parity harness overview").

| Group | File | Purpose |
|---|---|---|
| Build and runtime | `package-lock.json` | pinned dev dependency tree (playwright 1.62.0, three 0.186.0) |
| Build and runtime | `src/life/station/station-figure-parts.js` | `attachMesh` helper shared by the two traveler figures |
| Loader tests | `tests/unit/loading-screen-hint-rotation.test.mjs` | hint rotation every 2600 ms, wrap-around, stop on completion |
| Loader tests | `tests/unit/loading-screen-test-fixtures.mjs` | shared fake loader DOM, manual rAF and microtask helpers |
| HUD tests | `tests/unit/hud-right-click-reset-to-defaults.test.mjs` | right-click resets each control to its default with its toast; pills flip only when away from default; outside a control the browser menu stays |
| Engine tests | `tests/unit/shadow-post-and-render-pipeline-passes.test.mjs` | post uniforms, shadow pass and render order |
| Engine tests | `tests/unit/diorama-scene-composition-order.test.mjs` | composition order, shadow-hidden list, glow registry |
| Engine tests | `tests/unit/camera-mode-director-switching.test.mjs` | `setCameraMode` switching rules |
| Engine tests | `tests/unit/free-fly-fly-along-and-bridge-camera-rigs.test.mjs` | free-fly, fly-along and bridge rigs |
| World tests | `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` | world helpers, build-step registry, golden values |
| World tests | `tests/unit/station-sign-clock-and-build-counts.test.mjs` | sign canvas writes, clock angles, station goldens |
| World tests | `tests/unit/village-and-windmill-build-logic.test.mjs` | village and windmill build logic |
| World tests | `tests/unit/village-walk-cycle-and-tree-rock-scatter.test.mjs` | walk-cycle table, canopy grid, scatter draw accounting |
| World tests | `tests/unit/waterfall-cloud-avoidance-and-balloon-flight.test.mjs` | waterfall, cloud drift/avoidance, balloon flight |
| Node oracle plumbing | `tests/helpers/synthetic-merge-rig.mjs` | synthetic merge rig + `describeTree` for the static-merge tests |
| Node oracle plumbing | `tests/helpers/quantised-number-hashing.mjs` | `quantise` / `hashNumbers` / `hashString` for signatures |
| Node oracle plumbing | `tests/helpers/scene-signature-key-builders.mjs` | material, geometry, instance and texture keys of the signature |
| Node oracle plumbing | `tests/helpers/typed-array-fnv1a-hash.mjs` | FNV-1a-32 golden hashes of typed arrays |
| Node oracle plumbing | `tests/helpers/oracle-camera-controls-stub.mjs` | camera + control stubs shared by the oracle and the clone driver |
| Node oracle plumbing | `tests/helpers/counted-full-world-builds.mjs` | full builds with `Math.random` draws counted per build step |
| Node oracle plumbing | `tests/helpers/world-summary-digest.mjs` | self-contained world summary, ordered lists, instanced counts, sign hash (also injected into pages) |
| Node lockstep and fixtures | `tests/helpers/smoke-puff-behaviour-checks.mjs` | smoke emission and lifetime checks from the spec formulas |
| Node lockstep and fixtures | `tests/helpers/fresh-process-train-material-ids.mjs` | cold-cache train material id rows from a child process |
| Node lockstep and fixtures | `tests/helpers/sheep-flock-parity-lockstep.mjs` | sheep lockstep helpers |
| Node lockstep and fixtures | `tests/helpers/station-travelers-and-birds-first-build.mjs` | first builds with draws counted, rig and flock readers |
| Node lockstep and fixtures | `tests/parity/fixtures/station-travelers-and-birds-expected.json` | perch, flock, walker and `[BIRDS]` fixtures |
| Node parity suites | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` | 18 000-frame train oracle lockstep, composition layout |
| Node parity suites | `tests/parity/sheep-flock-oracle-train-parity.test.mjs` | sheep against the oracle train |
| Harness unit tests | `tests/unit/parity-harness-pure-logic.test.mjs` | hook, route patch, perf text, metrics, shim, signatures |
| Harness unit tests | `tests/unit/parity-compare-meta-warnings.test.mjs` | capture-meta warnings of the compare tool |
| Harness unit tests | `tests/unit/original-route-hook-error-surfacing.test.mjs` | route-hook errors beat the readiness timeout |
| Harness unit tests | `tests/unit/parity-world-core-hide-set-and-strict-shots.test.mjs` | `allButWorldCore` hide set and strict world-core shots |
| Harness unit tests | `tests/unit/parity-station-shots-hide-families-and-parking.test.mjs` | station shots, hide families, train parking |
| Harness unit tests | `tests/unit/parity-shot-list-selection-and-stages.test.mjs` | shot validation, stage gating and selection |
| Harness unit tests | `tests/unit/parity-capture-css-hides-ui-without-transitions.test.mjs` | capture CSS hides UI roots without transitions |
| Harness unit tests | `tests/unit/parity-village-windmill-shots-regions-and-probe.test.mjs` | village shots, regions, probe section |
| Harness unit tests | `tests/unit/parity-forest-residents-shots-actions-and-probe.test.mjs` | forest shots, page actions, forest probe |
| Harness unit tests | `tests/unit/parity-sheep-shots-and-probe.test.mjs` | sheep shots and probe section |
| Harness unit tests | `tests/unit/parity-water-clouds-balloon-shots-and-probe.test.mjs` | water/cloud/balloon shots and probe section |
| Harness unit tests | `tests/unit/parity-station-travelers-and-birds-shots-and-probe.test.mjs` | travelers/birds shots and probe section |
| Harness unit tests | `tests/unit/parity-metrics-math.test.mjs` | verdict maths: EMA inversion, median/CV, palette keys and overlap, loader marks, heap attribution, a gate that fails on zero samples |
| Harness unit tests | `tests/unit/parity-signoff-shots-and-verdicts.test.mjs` | sign-off set (21 3D + 7 DOM), probe states and research equivalents, `--shots` selection, tagged console sequences, loader boxes, noise floor and summary, probe and smoke judges, mask exclusion, bounded steps, research exceptions |
| Browser tooling splits | `tools/parity/dom-shot-page-helpers.mjs` | capture CSS, DOM actions, settle, clip rectangles |
| Browser tooling splits | `tools/parity/page-hide-set-application.mjs` | in-page hide sets and families |
| Browser tooling splits | `tools/parity/page-shot-actions.mjs` | uniform offset, layer switch, in-page poses, paused hold |
| Browser tooling splits | `tools/parity/shot-region-projection.mjs` | named screen regions and device crops |
| Browser tooling splits | `tools/parity/intra-site-shot-checks.mjs` | same-site shot relations and action results |
| Browser tooling splits | `tools/parity/parity-shot-factory-and-camera-poses.mjs` | `shot()` factory and shared camera poses |
| Browser tooling splits | `tools/parity/parity-shot-stages-and-hide-sets.mjs` | stages, thresholds, hide sets |
| Browser tooling splits | `tools/parity/parity-shot-validation.mjs` | shot list validation |
| Browser tooling splits | `tools/parity/research-capture-paths.mjs` | research capture folder resolution |
| Browser tooling splits | `tools/parity/probe-result-diffing.mjs` | probe JSON diffing |
| Browser tooling splits | `tools/parity/png-diff-in-page.mjs` | PNG diff code split out of the compare CLI |
| Browser tooling splits | `tools/parity/signoff-page-helpers.mjs` | sign-off in-page helpers |
| Browser tooling splits | `tools/parity/signoff-shot-capture.mjs` | sign-off capture (one browser context per shot) |
| Browser tooling splits | `tools/parity/signoff-shot-verdicts.mjs` | log-sequence, box, noise-floor and summary verdicts |
| Per-subsystem shots | `camera-mode-parity-shots.mjs`, `sheep-flock-parity-shots.mjs`, `water-clouds-balloon-parity-shots.mjs`, `station-travelers-and-birds-parity-shots.mjs`, `signoff-parity-shots.mjs` (all in `tools/parity/`) | shot sets kept out of the main list |
| Per-subsystem probes | `station-runtime-probe.mjs`, `village-windmill-runtime-probe.mjs`, `forest-residents-runtime-probe.mjs`, `sheep-flock-runtime-probe.mjs`, `water-clouds-balloon-runtime-probe.mjs`, `station-travelers-and-birds-runtime-probe.mjs`, `scenario-probe-sections.mjs`, `signoff-state-probe.mjs`, `camera-ui-runtime-probe.mjs` | probe sections and their verdicts |
| Browser checks | `hook-and-debug-menu-browser-checks.mjs`, `post-pass-synthetic-input-probe.mjs` | hook exposure, debug menu, live clock; post-pass outputs on synthetic inputs |
| Sign-off CLIs and maths | `parity-metrics-math.mjs`, `performance-budget-probe.mjs`, `research-recapture-and-contact-sheet.mjs`, `deployment-smoke-check.mjs` | `parity:perf`, `parity:research`, `parity:smoke` and their pure maths |

## Feature traceability

All 147 scene features, grouped by area: the files that implement each one and
the test or sign-off check that covers it. "sign-off <id>" refers to the browser sign-off shots and
probe states in `tools/parity/signoff-parity-shots.mjs`; "smoke" to `npm run parity:smoke`.

### Page shell, HUD and UI

| Feature | Files | Covering test or check |
|---|---|---|
| Page shell and importmap | index.html, `src/main-entry.js` | `tools/parity/deployment-smoke-check.mjs` (smoke), sign-off ov-day-t0 |
| Hand-written utility CSS (Tailwind class names, no build) | `styles/base-reset-and-utilities.css` | sign-off dom-hud-day, dom-help, dom-mobile-hud |
| Bottom control panel (#hud-controls) | `src/ui/hud-button-renderers.js`, `src/ui/hud-dom-event-bindings.js`, `styles/hud-panel-and-controls.css` | `tests/unit/keyboard-shortcut-resolution.test.mjs`, sign-off dom-hud-day |
| Night HUD theme | `styles/night-theme-overrides.css` | sign-off dom-hud-night |
| Shortcuts button and help panel | `src/ui/hud-state-actions.js` | sign-off dom-help |
| Settings state and localStorage persistence | `src/ui/settings-schema-defaults.js`, `src/ui/settings-local-storage-persistence.js` | `tests/unit/settings-validation-and-persistence.test.mjs` |
| Keyboard shortcuts | `src/ui/keyboard-shortcuts.js` | `tests/unit/keyboard-shortcut-resolution.test.mjs` |
| Right-click reset to defaults | `src/ui/hud-dom-event-bindings.js` | `tests/unit/hud-right-click-reset-to-defaults.test.mjs` |
| Shortcut toast | `src/ui/shortcut-toast.js`, `styles/toast-and-debug-menu.css` | sign-off dom-toast-bridge, hud-hidden |
| Loading screen step runner | `src/ui/loading-screen-step-runner.js`, `styles/loading-overlay.css` | `tests/unit/loading-screen-step-runner.test.mjs`, sign-off dom-loading |
| Boot wiring and overview intro trigger | `src/main-entry.js` | `tests/unit/overview-intro-and-camera-modes.test.mjs`, smoke check |
| Debug menu | `src/ui/debug-menu-panel.js`, `src/engine/parity-test-hook.js` | `tests/unit/parity-harness-pure-logic.test.mjs`, sign-off dom-debug |
| Logo and favicon assets | `assets/train-diorama-logo.svg`, `assets/clock-favicon.svg` | sign-off dom-loading (boxes), independence audit |

### Engine, render pipeline and cameras

| Feature | Files | Covering test or check |
|---|---|---|
| Renderer setup | `src/engine/diorama.js` | `tests/unit/shadow-post-and-render-pipeline-passes.test.mjs` |
| Frame loop scheduler | `src/engine/frame-loop-scheduler.js` | `tests/unit/frame-cadence-and-render-resolution.test.mjs` |
| Time-of-day palettes and transitions | `src/engine/time-of-day-palettes-and-transition.js` | `tests/unit/time-of-day-transition.test.mjs` |
| Shared lighting uniform binding | `src/materials/shared-lighting-uniforms.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` |
| Sky dome | `src/materials/procedural-sky-dome-material.js`, `src/engine/diorama-scene-composition.js` | `tests/unit/time-of-day-transition.test.mjs`, `tests/unit/diorama-scene-composition-order.test.mjs` |
| Custom shadow depth pass | `src/engine/custom-shadow-depth-pass.js` | `tests/unit/shadow-post-and-render-pipeline-passes.test.mjs` |
| Post pass: ink outline, saturation, grain, dither, vignette | `src/engine/post-ink-outline-dither-pass.js` | `tests/unit/shadow-post-and-render-pipeline-passes.test.mjs`, sign-off ink-off |
| Pixel-art render resolution and resize | `src/engine/render-resolution-resizer.js` | `tests/unit/frame-cadence-and-render-resolution.test.mjs`, sign-off pixel-360/720 |
| Overview orbit camera and intro | `src/engine/cameras/overview-orbit-camera.js` | `tests/unit/overview-intro-and-camera-modes.test.mjs` |
| Free-fly pointer-lock camera | `src/engine/cameras/free-fly-pointer-lock-camera.js` | `tests/unit/free-fly-fly-along-and-bridge-camera-rigs.test.mjs`, `tests/parity/camera-modes-parity.test.mjs` |
| Train fly-along cinematic rig | `src/engine/cameras/train-fly-along-camera-rig.js` | `tests/parity/camera-modes-parity.test.mjs`, sign-off train-day |
| Bridge camera | `src/engine/cameras/bridge-tripod-camera.js` | `tests/parity/camera-modes-parity.test.mjs`, sign-off bridge-day |
| Train station motion simulation | `src/train/train-station-motion-controller.js` | `tests/unit/train-station-motion-controller.test.mjs` |
| Locomotive smoke puff pool | `src/train/locomotive-smoke-puff-pool.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` |
| Headlight and night-glow per-frame updates | `src/train/train-frame-update.js`, `src/engine/night-light-glow-registry.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` |
| Public API facade and dispose | `src/engine/diorama.js`, `src/engine/cameras/camera-mode-director.js` | `tests/unit/camera-mode-director-switching.test.mjs`, smoke check (pagehide dispose) |

### Materials, shaders, noise and effects

| Feature | Files | Covering test or check |
|---|---|---|
| Shared uniform bag G + colour pipeline | `src/materials/shared-lighting-uniforms.js`, `src/core/disable-three-color-management.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` |
| COMMON_GLSL hashes + value noise | `src/materials/glsl/hash-and-value-noise-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` |
| shadowAt: custom 3x3 PCF shadow lookup | `src/materials/glsl/npr-lighting-common-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` |
| headlightAt: train headlight spot on all surfaces at night | `src/materials/glsl/npr-lighting-common-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs`, sign-off train-night |
| nprShade: cel banding + stipple + shadow tint + night mode | `src/materials/glsl/npr-fragment-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` |
| npr() cached material factory + vertex shader | `src/materials/npr-cel-material-factory.js`, `src/materials/glsl/npr-vertex-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` |
| NPR fragment variants: emissive, NIGHT_GLOW, LOCAL_GLOW, DOUBLE_SIDED | `src/materials/glsl/npr-fragment-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` |
| STRATA cliff skirt shader | `src/materials/glsl/npr-fragment-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` |
| FLOWERS terrain shader | `src/materials/glsl/npr-fragment-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` |
| TREE_SWAY instanced tree wind | `src/materials/glsl/npr-vertex-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` |
| Water surface material | `src/materials/water-surface-material.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` |
| Waterfall material | `src/materials/waterfall-curtain-material.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` |
| Procedural sky dome | `src/materials/procedural-sky-dome-material.js` | `tests/unit/time-of-day-transition.test.mjs`, sign-off ov-night-t0 |
| CPU noise: mulberry32, noise2, fbm | `src/core/seeded-prng-and-gradient-noise.js` | `tests/unit/seeded-prng-and-gradient-noise.test.mjs` |
| mergeStaticGeometry(root, excluded) | `src/geometry/merge-static-geometry-by-material.js` | `tests/unit/merge-static-geometry-and-glows.test.mjs` |
| createLightCone headlight beam | `src/effects/night-headlight-light-cone.js` | `tests/unit/merge-static-geometry-and-glows.test.mjs` |
| createLightGlows instanced halo sprites | `src/effects/night-light-glow-sprites.js` | `tests/unit/merge-static-geometry-and-glows.test.mjs` |

### World core: terrain and track

| Feature | Files | Covering test or check |
|---|---|---|
| Module constants and pure helpers | `src/world/world-constants.js`, `src/core/scalar-math-helpers.js` | `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` |
| River distance field and natural height | `src/world/terrain/river-distance-and-natural-height.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Track spline and frames | `src/world/track/track-spline-frames-and-queries.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| nearest / inBridge / excluded / heightAt queries | `src/world/track/track-spline-frames-and-queries.js`, `src/world/world.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Bridge detection | `src/world/track/bridge-span-detection.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Heightmap grading | `src/world/terrain/terrain-heightmap-grading.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| flattenBuildingGround pads | `src/world/terrain/building-ground-flattening.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Terrain surface mesh and vertex colours | `src/world/terrain/terrain-surface-mesh-and-vertex-colors.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Strata skirt sides and wooden plinth | `src/world/terrain/terrain-skirt-plinth-and-water-height-texture.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Water height texture | `src/world/terrain/terrain-skirt-plinth-and-water-height-texture.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Track mesh: ballast, rails, sleepers | `src/world/track/track-ballast-rails-sleepers.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Shared building vent helpers | `src/geometry/building-wall-and-roof-vents.js` | `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` |
| Constructor build order and PRNG sequencing | `src/world/world-build-steps.js`, `src/world/world.js` | `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs`, `tests/parity/full-scene-signature-parity.test.mjs` |
| sheepGroundAt pasture query | `src/life/sheep/sheep-pasture-ground-query.js` | `tests/parity/sheep-flock-parity.test.mjs` |

### Bridge and station

| Feature | Files | Covering test or check |
|---|---|---|
| Bridge span detection (findBridge) | `src/world/track/bridge-span-detection.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Bridge deck girders, handrails and instanced railing posts | `src/world/bridge/bridge-deck-girders-and-railings.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Bridge bird perches | `src/world/perches/bird-perch-builders.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Bridge parabolic arch ribs (chord plane) | `src/world/bridge/bridge-arch-columns-piers-abutments.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Bridge spandrel columns, cross braces, approach piers, stone abutments | `src/world/bridge/bridge-arch-columns-piers-abutments.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` |
| Station placement, stop distance, camera start, exclusion | `src/world/station/station-site-placement.js` | `tests/parity/station-parity.test.mjs` |
| Platform slab, edge line, shelter, roof perch | `src/world/station/station-platform-shelter-bench.js` | `tests/parity/station-parity.test.mjs` |
| Bench | `src/world/station/station-platform-shelter-bench.js` | `tests/parity/station-parity.test.mjs` |
| Station building shell, prism roof, vents, door, trims | `src/world/station/station-building-shell-and-roof.js` | `tests/parity/station-parity.test.mjs` |
| Station windows, shutters, night glows | `src/world/station/station-building-windows-and-shutters.js` | `tests/parity/station-parity.test.mjs` |
| Animated station wall clock | `src/world/station/station-wall-clock.js` | `tests/unit/station-sign-clock-and-build-counts.test.mjs` |
| Station name board with canvas sign | `src/world/station/station-name-board-sign.js` | `tests/unit/station-sign-clock-and-build-counts.test.mjs`, sign-off probe sign hash |
| Station lamps with night glow | `src/world/station/station-lamps-with-night-glow.js` | `tests/parity/station-parity.test.mjs` |
| Walking old-man traveler figure (rig + StationWalker config) | `src/life/station/station-traveler-old-man-figure.js`, `src/life/station/station-walker-controller.js`, `src/life/station/station-figure-parts.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Grandmother figure (idle) | `src/life/station/station-grandmother-figure.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Traveler idle sway + head tracking of train (per frame) | `src/life/station/station-travelers-idle-and-head-look.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Luggage props | `src/world/station/station-luggage-props.js` | `tests/parity/station-parity.test.mjs` |
| Side stairs, railings, landing pad | `src/world/station/station-stairs-railings-footpath.js` | `tests/parity/station-parity.test.mjs` |
| Footpath ribbon draped on terrain | `src/world/station/station-stairs-railings-footpath.js` | `tests/parity/station-parity.test.mjs` |
| Platform-extension shift baked into coordinates | `src/world/station/station-site-placement.js` | `tests/parity/station-parity.test.mjs` |

### Village, windmill, forest, rocks and sheep placement

| Feature | Files | Covering test or check |
|---|---|---|
| Shared helpers: box / jitter / colorize / vents / flattenBuildingGround | `src/geometry/procedural-geometry-helpers.js`, `src/geometry/building-wall-and-roof-vents.js`, `src/world/terrain/building-ground-flattening.js` | `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` |
| Village house placement (up to 8 cottages ringed around the pond) | `src/world/village/village-house-placement.js` | `tests/parity/village-windmill-parity.test.mjs` |
| House body, roof, chimney, door, trim | `src/world/village/village-house-body-and-roof.js`, `src/world/village/village-house-palette-materials.js` | `tests/parity/village-windmill-parity.test.mjs` |
| House windows, flower boxes, swinging shutters, night glows | `src/world/village/village-house-windows-and-shutters.js` | `tests/parity/village-windmill-parity.test.mjs` |
| Chimney smoke puffs (12 per house) + per-frame animation | `src/world/village/village-chimney-smoke.js` | `tests/unit/village-and-windmill-build-logic.test.mjs` |
| Per-house static geometry merge | `src/world/village/village-house-placement.js`, `src/geometry/merge-static-geometry-by-material.js` | `tests/parity/village-windmill-parity.test.mjs` |
| Village shrubs (6 instanced bushes per house) | `src/world/village/village-shrubs-instanced.js` | `tests/parity/village-windmill-parity.test.mjs` |
| Windmill site, body, door, steps | `src/world/windmill/windmill-site-and-body.js` | `tests/parity/village-windmill-parity.test.mjs` |
| Windmill hay bales | `src/world/windmill/windmill-hay-bales.js` | `tests/parity/village-windmill-parity.test.mjs` |
| Windmill rotor + spin animation | `src/world/windmill/windmill-rotor.js` | `tests/unit/village-and-windmill-build-logic.test.mjs` |
| Tree species geometries | `src/world/trees/tree-species-geometries.js` | `tests/parity/residents-trees-rocks-parity.test.mjs` |
| Tree scatter rules (forest clumps) | `src/world/trees/tree-scatter-rules.js` | `tests/parity/residents-trees-rocks-parity.test.mjs` |
| Tree instanced layers + wind sway shader | `src/world/trees/tree-instanced-layers.js` | `tests/parity/residents-trees-rocks-parity.test.mjs` |
| Tree canopy height grid + treeCanopyHeightAt | `src/world/trees/tree-canopy-height-grid.js` | `tests/unit/village-walk-cycle-and-tree-rock-scatter.test.mjs` |
| Riverside rocks | `src/world/rocks/riverside-rock-scatter.js` | `tests/parity/residents-trees-rocks-parity.test.mjs` |
| Sheep geometry + instanced meshes | `src/life/sheep/sheep-geometry-and-instanced-meshes.js` | `tests/parity/sheep-flock-parity.test.mjs` |
| Free meadow sheep spawn (24) | `src/life/sheep/pasture-sheep-spawner.js` | `tests/parity/sheep-flock-parity.test.mjs` |
| Trackside sheep flock site + 3 track sheep | `src/life/sheep/trackside-sheep-flock-site.js`, `src/life/sheep/build-sheep-flock.js` | `tests/parity/sheep-flock-parity.test.mjs` |

### Water, clouds, balloon, perches and world update

| Feature | Files | Covering test or check |
|---|---|---|
| Water surface (pond + river) via height-texture discard | `src/world/water/river-water-and-waterfall-builder.js`, `src/materials/water-surface-material.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` |
| Waterfall off the front edge | `src/world/water/river-water-and-waterfall-builder.js`, `src/materials/waterfall-curtain-material.js` | `tests/unit/waterfall-cloud-avoidance-and-balloon-flight.test.mjs` |
| Procedural cloud field (3 layers, 33 clouds) | `src/world/sky/cloud-field-spawner.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` |
| Cloud drift, wrap and scale fade | `src/world/sky/cloud-drift-fade-and-camera-avoidance.js` | `tests/unit/waterfall-cloud-avoidance-and-balloon-flight.test.mjs` |
| Cloud camera avoidance (push-away + exponential return) | `src/world/sky/cloud-drift-fade-and-camera-avoidance.js` | `tests/unit/waterfall-cloud-avoidance-and-balloon-flight.test.mjs` |
| Trackside bird perches | `src/world/perches/bird-perch-builders.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Balloon envelope (checkerboard lathe) + local burner glow | `src/world/balloon/hot-air-balloon-envelope-and-basket.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` |
| Balloon basket, ropes, sandbags | `src/world/balloon/hot-air-balloon-envelope-and-basket.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` |
| Balloon pilot figure | `src/world/balloon/hot-air-balloon-pilot-figure.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` |
| Balloon burner, flame, night glow, flight path | `src/world/balloon/hot-air-balloon-burner-flame-and-flight.js` | `tests/unit/waterfall-cloud-avoidance-and-balloon-flight.test.mjs` |
| Track-sheep escape state machine | `src/life/sheep/track-sheep-escape-state-machine.js` | `tests/unit/track-sheep-escape-state-machine.test.mjs` |
| Sheep locomotion (pasture wander, sleep, route wander/height) | `src/life/sheep/sheep-locomotion-and-route-motion.js` | `tests/parity/sheep-flock-oracle-train-parity.test.mjs` |
| Sheep instance pose writer (tilt, bounce, hop squash/stretch, legs, ears) | `src/life/sheep/sheep-instance-pose-writer.js` | `tests/parity/sheep-flock-parity.test.mjs` |
| World.update orchestrator + station clock, travelers, chimney smoke, windmill | `src/world/world-per-frame-update.js` | `tests/unit/station-sign-clock-and-build-counts.test.mjs`, `tests/parity/full-scene-signature-parity.test.mjs` |

### Train

| Feature | Files | Covering test or check |
|---|---|---|
| Train material palette | `src/train/train-palette-materials.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Locomotive chassis, boiler, stack, dome, whistle, running boards | `src/train/locomotive-boiler-and-cab-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Locomotive cab with glazing | `src/train/locomotive-boiler-and-cab-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Driver figure | `src/train/locomotive-driver-and-raven-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Raven on driver's shoulder | `src/train/locomotive-driver-and-raven-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Locomotive front end and cowcatcher | `src/train/locomotive-front-end-and-lamps-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Lamps, halos, headlight anchor and beam | `src/train/locomotive-front-end-and-lamps-builder.js`, `src/effects/night-headlight-light-cone.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Locomotive wheels and static coupling rods | `src/train/rolling-stock-wheel-builders.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Tender car | `src/train/tender-car-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Passenger coaches x4 | `src/train/passenger-coach-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Per-car static geometry merge | `src/train/train-mesh-helpers.js`, `src/train/train.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Car offsets, spline placement, wheel roll | `src/train/train.js` | `tests/parity/train-model-and-motion-parity.test.mjs` |
| Motion state machine (station stop) | `src/train/train-station-motion-controller.js` | `tests/unit/train-station-motion-controller.test.mjs` |
| Chimney smoke puffs | `src/train/locomotive-smoke-puff-pool.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` |
| Brake sparks: emission | `src/train/brake-sparks.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` |
| Brake sparks: physics and rendering | `src/train/brake-sparks.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` |
| Night headlight pool on the world | `src/train/train-frame-update.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` |
| Frame integration order | `src/engine/simulation-step.js`, `src/train/train-frame-update.js` | `tests/unit/frame-cadence-and-render-resolution.test.mjs`, `tests/parity/full-scene-signature-parity.test.mjs` |

### Animated life

| Feature | Files | Covering test or check |
|---|---|---|
| Bird geometry and rig | `src/life/birds/bird-geometry-builder.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Bird perches (World-side producer contract) | `src/world/perches/bird-perch-builders.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Bird flock setup and state machine | `src/life/birds/bird-system.js`, `src/life/birds/bird-flock-state-machine.js` | `tests/unit/bird-flock-state-machine.test.mjs` |
| Bird flight poses | `src/life/birds/bird-flight-poses.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Bird orientation, flapping, glide, landing | `src/life/birds/bird-wing-body-animator.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Track sheep flock loop and log lines | `src/life/sheep/track-sheep-escape-state-machine.js` | `tests/unit/track-sheep-escape-state-machine.test.mjs` |
| Sheep geometry and instancing | `src/life/sheep/sheep-geometry-and-instanced-meshes.js` | `tests/parity/sheep-flock-parity.test.mjs` |
| Pasture sheep placement, wander and night sleep | `src/life/sheep/pasture-sheep-spawner.js`, `src/life/sheep/sheep-locomotion-and-route-motion.js` | `tests/parity/sheep-flock-oracle-train-parity.test.mjs` |
| Track clearing selection and track sheep routes | `src/life/sheep/trackside-sheep-flock-site.js` | `tests/parity/sheep-flock-parity.test.mjs` |
| Sheep per-frame matrices (bob, hop, squash, legs, ears) | `src/life/sheep/sheep-instance-pose-writer.js` | `tests/parity/sheep-flock-parity.test.mjs` |
| Station traveler rig (the walker's figure) | `src/life/station/station-traveler-old-man-figure.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Station walker stepping state machine | `src/life/station/station-walker-controller.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Walker 2-bone leg IK (pose) | `src/life/station/station-walker-leg-ik-and-body-animation.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Walker body, arm and cane animation | `src/life/station/station-walker-leg-ik-and-body-animation.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Station travelers head-look and grandmother idle | `src/life/station/station-travelers-idle-and-head-look.js`, `src/life/station/station-grandmother-figure.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` |
| Village resident figures (woman, man, dog) | `src/life/village/village-residents.js`, `src/life/village/village-woman-and-man-outfits.js`, `src/life/village/village-dog-builder.js`, `src/life/village/village-resident-materials-and-primitives.js` | `tests/parity/residents-trees-rocks-parity.test.mjs` |
| Village walk cycle and idle animation | `src/life/village/village-residents.js` | `tests/unit/village-walk-cycle-and-tree-rock-scatter.test.mjs` |
