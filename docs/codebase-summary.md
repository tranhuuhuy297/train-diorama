# Codebase summary

Tree reflects the repository at release 1.0.0, the full-scene parity sign-off (scaffold/shell/HUD, core noise/materials/
effects/geometry, the real engine: renderer, frame loop, palettes, sky, shadow/post, pixel
art, overview camera; then the debug menu, the parity hook and the node + browser parity harness;
then the world core: build-step registry, terrain, track and bridge; then the Mossbrook station,
its wall clock and the world per-frame orchestrator; then the train; then the village cottages,
chimney smoke, shrubs and the windmill; then the village residents, the forest with its canopy
height grid and the riverside rocks; then the water, the cloud field and the hot-air balloon; then the
station travelers, the bird perches and the bird flocks; then the full-scene sign-off tools, the performance
budget probe, the research recapture, the deployment smoke check and the final docs). Below the tree: the
module index with line counts, the files outside the unified tree, and the 147-row feature traceability table.

```
train-diorama/
├── index.html                                   page shell: DOM, import map, fonts, analytics stub
├── package.json / package-lock.json             scripts (dev/test/test:parity/check:lines/parity:*), devDependencies
├── vercel.json / .vercelignore / .gitignore      deploy + ignore config
├── README.md                                     quick start, scripts, structure, credits
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
│   │   │   ├── pasture-sheep-spawner.js                 spawnPastureSheep: 24 sheep in ≤ 4000 attempts (W5b draws)
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
│       │   ├── village-house-placement.js                     buildVillage: ring search (W1 draws), reject tests, pads, merge, r2.6 exclusions, villageHomes
│       │   ├── village-house-palette-materials.js             ROOF_COLORS, createVillagePalette (14 items in creation order)
│       │   ├── village-house-body-and-roof.js                 addHouseShell, addHouseDoorAndTrim, chimneyCentre
│       │   ├── village-house-windows-and-shutters.js          SHUTTER_ANGLES, shutterAngleIndex, window glows, windows + shutters
│       │   ├── village-chimney-smoke.js                       registerChimneySmoke (61 draws), updateChimneySmoke (slot 8)
│       │   └── village-shrubs-instanced.js                    SHRUB_COLORS, buildVillageShrubs (6 per house, no draws)
│       ├── trees/
│       │   ├── tree-species-geometries.js                     TREE_TRUNK_COLOR, createTreeSpeciesGeometries (conifer, round, cluster, bush)
│       │   ├── tree-scatter-rules.js                          scatterTrees: 14000 attempts (W4 draws), tints, autumn/blossom accents
│       │   ├── tree-instanced-layers.js                       buildTrees: canopy grid, sway/bush materials, 4 layers → treeLayers
│       │   └── tree-canopy-height-grid.js                     70×70 Float32 grid: stampCanopyHeights, treeCanopyHeightAt
│       ├── rocks/
│       │   └── riverside-rock-scatter.js                      buildRiversideRocks: ≤ 80 instanced dodecahedra (W5a draws)
│       ├── perches/
│       │   └── bird-perch-builders.js                         buildBirdPerches (step 16): bridge-1..3, station-roof, trackside-2..4
│       ├── water/
│       │   └── river-water-and-waterfall-builder.js           findWaterfallMouth, createWaterfallGeometry (8×24), buildWater (step 13)
│       ├── sky/
│       │   ├── cloud-field-spawner.js                         createCloudSpawners (A 8 / B 7 / C 18), buildClouds (step 14, W7 draws, last W consumer)
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
│   │   ├── village-walk-cycle-and-tree-rock-scatter.test.mjs walk-cycle table, canopy grid edges, W4/W5a draw accounting (stub worlds)
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
│       ├── full-scene-signature-parity.test.mjs         whole scene vs the oracle: signature, R9 lists, world summary, 6 × 1800 lockstep frames + logs
│       └── fixtures/station-travelers-and-birds-expected.json perch, flock, walker and [BIRDS] timeline fixtures
└── docs/                                        overview/PDR, architecture, this file, standards, design, roadmap, changelog, parity guide, deployment guide
```

## Phase status

| Phase | Scope | Status |
|---|---|---|
| P01 | Scaffold, shell, HUD, settings, loading screen | Complete |
| P02 | Core math/noise, shared materials, geometry helpers, parity oracle | Complete |
| P03 | Engine: renderer, frame loop, palettes, sky, shadow/post, pixel art, overview camera | Complete |
| P04 | Debug menu, parity hook, node + browser parity harness | Complete |
| P05 | World core: build-step registry, terrain, track, bridge | Complete |
| P06 | Mossbrook station, wall clock, world per-frame orchestrator | Complete |
| P07 | Train model, station-stop motion, smoke puffs, brake sparks, headlight | Complete |
| P08 | Village cottages, chimney smoke, shrubs, windmill (build steps 7–8, update slots 8–9) | Complete |
| P09 | Village residents, forest + canopy grid, riverside rocks (build steps 10–12, update slots 5–6) | Complete |
| P10 | Camera modes: free fly (pointer lock), train fly-along rig, bridge tripod | Complete (headed pointer-lock check pending) |
| P11 | Sheep flock: pasture sheep, trackside clearing, rail-sheep escape state machine (build step 12, update slots 2–3) | Complete |
| P12 | Water + waterfall shaders, 33-cloud field with camera avoidance, hot-air balloon (build steps 13–15, update slots 10–11, frame step 7) | Complete |
| P13 | Station travellers (walker IK, grandmother, head-look), bird perches (build step 16), bird flocks (update slots 4, 6, 7; birds after the world) | Complete |
| P14 | Full-scene parity sign-off, performance budget, docs, deployment prep | Complete (deploy itself awaits approval) |

## Module index (line counts)

245 code files, every one under 200 lines (`npm run check:lines`). Counts are `wc -l` at release 1.0.0.

- `./` (1 files, 100 lines): index.html 100
- `src/` (1 files, 72 lines): main-entry.js 72
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
- `src/world/perches/` (1 files, 111 lines): bird-perch-builders.js 111
- `src/world/rocks/` (1 files, 37 lines): riverside-rock-scatter.js 37
- `src/world/sky/` (2 files, 200 lines): cloud-drift-fade-and-camera-avoidance.js 91, cloud-field-spawner.js 109
- `src/world/station/` (11 files, 646 lines): build-station.js 48, station-building-shell-and-roof.js 65, station-building-windows-and-shutters.js 47, station-lamps-with-night-glow.js 37, station-luggage-props.js 44, station-name-board-sign.js 79, station-palette-materials.js 42, station-platform-shelter-bench.js 49, station-site-placement.js 88, station-stairs-railings-footpath.js 98, station-wall-clock.js 49
- `src/world/terrain/` (5 files, 348 lines): building-ground-flattening.js 58, river-distance-and-natural-height.js 38, terrain-heightmap-grading.js 74, terrain-skirt-plinth-and-water-height-texture.js 72, terrain-surface-mesh-and-vertex-colors.js 106
- `src/world/track/` (3 files, 157 lines): bridge-span-detection.js 36, track-ballast-rails-sleepers.js 57, track-spline-frames-and-queries.js 64
- `src/world/trees/` (4 files, 211 lines): tree-canopy-height-grid.js 55, tree-instanced-layers.js 33, tree-scatter-rules.js 71, tree-species-geometries.js 52
- `src/world/village/` (6 files, 353 lines): village-chimney-smoke.js 56, village-house-body-and-roof.js 64, village-house-palette-materials.js 40, village-house-placement.js 73, village-house-windows-and-shutters.js 71, village-shrubs-instanced.js 49
- `src/world/water/` (1 files, 86 lines): river-water-and-waterfall-builder.js 86
- `src/world/windmill/` (3 files, 152 lines): windmill-hay-bales.js 41, windmill-rotor.js 27, windmill-site-and-body.js 84
- `styles/` (5 files, 447 lines): base-reset-and-utilities.css 145, hud-panel-and-controls.css 85, loading-overlay.css 97, night-theme-overrides.css 45, toast-and-debug-menu.css 75
- `tests/helpers/` (18 files, 1424 lines): clone-simulation-driver.mjs 157, clone-world-factory.mjs 21, counted-full-world-builds.mjs 55, fresh-process-train-material-ids.mjs 29, minimal-dom-shim.mjs 67, oracle-camera-controls-stub.mjs 29, original-module-loader.mjs 98, original-simulation-oracle.mjs 175, original-world-stepper.mjs 71, quantised-number-hashing.mjs 48, scene-graph-signature.mjs 119, scene-signature-key-builders.mjs 97, sheep-flock-parity-lockstep.mjs 89, smoke-puff-behaviour-checks.mjs 69, station-travelers-and-birds-first-build.mjs 103, synthetic-merge-rig.mjs 106, typed-array-fnv1a-hash.mjs 8, world-summary-digest.mjs 83
- `tests/parity/` (13 files, 2023 lines): camera-modes-parity.test.mjs 188, full-scene-signature-parity.test.mjs 180, harness-self-check.test.mjs 153, residents-trees-rocks-parity.test.mjs 176, sheep-flock-oracle-train-parity.test.mjs 84, sheep-flock-parity.test.mjs 137, station-parity.test.mjs 110, station-travelers-and-birds-parity.test.mjs 184, terrain-track-bridge-parity.test.mjs 182, train-model-and-motion-parity.test.mjs 174, train-simulation-oracle-and-composition-parity.test.mjs 154, village-windmill-parity.test.mjs 146, water-clouds-balloon-parity.test.mjs 155
- `tests/unit/` (38 files, 4910 lines): bird-flock-state-machine.test.mjs 102, camera-mode-director-switching.test.mjs 90, diorama-scene-composition-order.test.mjs 46, frame-cadence-and-render-resolution.test.mjs 188, free-fly-fly-along-and-bridge-camera-rigs.test.mjs 179, hud-right-click-reset-to-defaults.test.mjs 72, keyboard-shortcut-resolution.test.mjs 199, loading-screen-hint-rotation.test.mjs 43, loading-screen-step-runner.test.mjs 104, loading-screen-test-fixtures.mjs 99, merge-static-geometry-and-glows.test.mjs 198, npr-material-cache-and-glsl-parity.test.mjs 199, original-route-hook-error-surfacing.test.mjs 74, overview-intro-and-camera-modes.test.mjs 178, parity-capture-css-hides-ui-without-transitions.test.mjs 22, parity-compare-meta-warnings.test.mjs 51, parity-forest-residents-shots-actions-and-probe.test.mjs 141, parity-harness-pure-logic.test.mjs 166, parity-metrics-math.test.mjs 87, parity-sheep-shots-and-probe.test.mjs 70, parity-shot-list-selection-and-stages.test.mjs 65, parity-signoff-shots-and-verdicts.test.mjs 164, parity-station-shots-hide-families-and-parking.test.mjs 99, parity-station-travelers-and-birds-shots-and-probe.test.mjs 82, parity-village-windmill-shots-regions-and-probe.test.mjs 119, parity-water-clouds-balloon-shots-and-probe.test.mjs 96, parity-world-core-hide-set-and-strict-shots.test.mjs 80, seeded-prng-and-gradient-noise.test.mjs 184, settings-validation-and-persistence.test.mjs 147, shadow-post-and-render-pipeline-passes.test.mjs 182, station-sign-clock-and-build-counts.test.mjs 165, time-of-day-transition.test.mjs 198, track-sheep-escape-state-machine.test.mjs 181, train-station-motion-controller.test.mjs 169, village-and-windmill-build-logic.test.mjs 151, village-walk-cycle-and-tree-rock-scatter.test.mjs 142, waterfall-cloud-avoidance-and-balloon-flight.test.mjs 193, world-core-helpers-registry-and-golden-values.test.mjs 185
- `tools/` (2 files, 166 lines): check-file-line-limits.mjs 54, static-dev-server.mjs 112
- `tools/parity/` (42 files, 3747 lines): camera-mode-parity-shots.mjs 26, camera-ui-runtime-probe.mjs 194, capture-parity-shots.mjs 156, compare-parity-shots.mjs 163, deployment-smoke-check.mjs 137, dom-shot-page-helpers.mjs 87, fetch-original-source.mjs 167, forest-residents-runtime-probe.mjs 34, hook-and-debug-menu-browser-checks.mjs 136, intra-site-shot-checks.mjs 53, original-site-route-hooks.mjs 75, page-hide-set-application.mjs 75, page-parity-helpers.mjs 178, page-shot-actions.mjs 75, parity-metrics-math.mjs 79, parity-shot-factory-and-camera-poses.mjs 32, parity-shot-list.mjs 141, parity-shot-stages-and-hide-sets.mjs 27, parity-shot-validation.mjs 55, performance-budget-probe.mjs 153, playwright-browser-launcher.mjs 106, png-diff-in-page.mjs 75, post-pass-synthetic-input-probe.mjs 96, probe-result-diffing.mjs 27, research-capture-paths.mjs 21, research-recapture-and-contact-sheet.mjs 141, runtime-counts-probe.mjs 192, scenario-probe-sections.mjs 27, sheep-flock-parity-shots.mjs 24, sheep-flock-runtime-probe.mjs 92, shot-region-projection.mjs 77, signoff-page-helpers.mjs 101, signoff-parity-shots.mjs 113, signoff-shot-capture.mjs 181, signoff-shot-verdicts.mjs 59, signoff-state-probe.mjs 88, station-runtime-probe.mjs 96, station-travelers-and-birds-parity-shots.mjs 20, station-travelers-and-birds-runtime-probe.mjs 37, village-windmill-runtime-probe.mjs 24, water-clouds-balloon-parity-shots.mjs 36, water-clouds-balloon-runtime-probe.mjs 71

## Files outside the unified tree

Files that exist in the repository but not in the planned folder tree, with the phase that created them.
They keep the planned tools and tests under 200 lines or add a covering test; their roles in the test and
parity graph are described in `system-architecture.md` ("Files outside the unified tree").

| creating phase | file | purpose |
|---|---|---|
| P01 | `package-lock.json` | pinned dev dependency tree (playwright 1.62.0, three 0.186.0) |
| P01 | `tests/unit/loading-screen-hint-rotation.test.mjs` | loader hint rotation cases split from the step-runner test |
| P01 | `tests/unit/loading-screen-test-fixtures.mjs` | shared fake loader DOM, manual rAF and microtask helpers |
| P02 | `tests/helpers/synthetic-merge-rig.mjs` | synthetic merge rig + describeTree for the static-merge tests |
| P03 | `tests/unit/shadow-post-and-render-pipeline-passes.test.mjs` | post uniforms, shadow pass and render order |
| P04 | `tests/helpers/quantised-number-hashing.mjs` | quantise / hashNumbers / hashString for signatures |
| P04 | `tests/helpers/scene-signature-key-builders.mjs` | material, geometry, instance and texture keys of the signature |
| P04 | `tests/unit/parity-harness-pure-logic.test.mjs` | hook, route patch, perf text, metrics, shim, signatures |
| P04 | `tests/unit/parity-compare-meta-warnings.test.mjs` | capture-meta warnings of the compare tool |
| P04 | `tests/unit/original-route-hook-error-surfacing.test.mjs` | route-hook errors beat the readiness timeout |
| P04 | `tools/parity/dom-shot-page-helpers.mjs` | capture CSS, DOM actions, settle, clip rectangles |
| P04 | `tools/parity/hook-and-debug-menu-browser-checks.mjs` | debug-menu and hook exposure browser checks |
| P04 | `tools/parity/post-pass-synthetic-input-probe.mjs` | post-pass outputs on synthetic inputs, both sites |
| P04 | `tools/parity/probe-result-diffing.mjs` | probe JSON diffing |
| P04 | `tools/parity/research-capture-paths.mjs` | research capture folder resolution |
| P05 | `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` | world helpers, build-step registry, golden values |
| P05 | `tests/unit/diorama-scene-composition-order.test.mjs` | composition order, shadow list, glow registry |
| P05 | `tests/unit/parity-world-core-hide-set-and-strict-shots.test.mjs` | allButWorldCore hide set and strict world-core shots |
| P05 | `tools/parity/page-hide-set-application.mjs` | in-page hide sets and families |
| P06 | `tests/helpers/typed-array-fnv1a-hash.mjs` | FNV-1a-32 golden hashes of typed arrays |
| P06 | `tests/unit/station-sign-clock-and-build-counts.test.mjs` | sign canvas writes, clock angles, station goldens |
| P06 | `tests/unit/parity-station-shots-hide-families-and-parking.test.mjs` | station shots, hide families, train parking |
| P06 | `tests/unit/parity-shot-list-selection-and-stages.test.mjs` | shot validation, stage gating and selection |
| P06 | `tools/parity/station-runtime-probe.mjs` | station probe section, sign hash, live clock |
| P07 | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` | 18 000-frame train oracle lockstep, composition layout |
| P07 | `tests/helpers/oracle-camera-controls-stub.mjs` | camera + control stubs shared by oracle and driver |
| P07 | `tests/helpers/smoke-puff-behaviour-checks.mjs` | smoke emission/lifetime behaviour checks |
| P07 | `tests/helpers/fresh-process-train-material-ids.mjs` | cold-cache train material id rows (child process) |
| P07 | `tests/unit/parity-capture-css-hides-ui-without-transitions.test.mjs` | capture CSS hides UI roots without transitions |
| P08 | `tests/unit/village-and-windmill-build-logic.test.mjs` | village and windmill build logic |
| P08 | `tests/unit/parity-village-windmill-shots-regions-and-probe.test.mjs` | village shots, regions, probe section |
| P08 | `tools/parity/shot-region-projection.mjs` | named screen regions and device crops |
| P08 | `tools/parity/parity-shot-factory-and-camera-poses.mjs` | shot() factory and shared camera poses |
| P08 | `tools/parity/village-windmill-runtime-probe.mjs` | village/windmill probe section |
| P09 | `tests/unit/village-walk-cycle-and-tree-rock-scatter.test.mjs` | walk-cycle table, canopy grid, scatter draw accounting |
| P09 | `tests/unit/parity-forest-residents-shots-actions-and-probe.test.mjs` | forest shots, page actions, forest probe |
| P09 | `tools/parity/intra-site-shot-checks.mjs` | same-site shot relations and action results |
| P09 | `tools/parity/page-shot-actions.mjs` | uniform offset, layer switch, in-page poses, paused hold |
| P09 | `tools/parity/forest-residents-runtime-probe.mjs` | tree/rock/resident probe section |
| P10 | `tests/unit/camera-mode-director-switching.test.mjs` | setCameraMode switching rules |
| P10 | `tests/unit/free-fly-fly-along-and-bridge-camera-rigs.test.mjs` | free-fly, fly-along and bridge rigs |
| P10 | `tools/parity/camera-mode-parity-shots.mjs` | camera-mode shots |
| P10 | `tools/parity/camera-ui-runtime-probe.mjs` | live camera UI / pointer-lock probe |
| P11 | `tests/helpers/sheep-flock-parity-lockstep.mjs` | sheep lockstep helpers |
| P11 | `tests/parity/sheep-flock-oracle-train-parity.test.mjs` | sheep against the oracle train |
| P11 | `tests/unit/parity-sheep-shots-and-probe.test.mjs` | sheep shots and probe section |
| P11 | `tools/parity/sheep-flock-parity-shots.mjs` | sheep close-ups and hop shots |
| P11 | `tools/parity/sheep-flock-runtime-probe.mjs` | sheep probe section |
| P12 | `tests/helpers/counted-full-world-builds.mjs` | full builds with Math.random draws counted per step |
| P12 | `tests/unit/waterfall-cloud-avoidance-and-balloon-flight.test.mjs` | waterfall, cloud drift/avoidance, balloon flight |
| P12 | `tests/unit/parity-water-clouds-balloon-shots-and-probe.test.mjs` | water/cloud/balloon shots and probe section |
| P12 | `tools/parity/water-clouds-balloon-parity-shots.mjs` | water, waterfall, balloon and cloud shots |
| P12 | `tools/parity/water-clouds-balloon-runtime-probe.mjs` | water/cloud/balloon probe section |
| P13 | `tests/parity/fixtures/station-travelers-and-birds-expected.json` | perch, flock, walker and [BIRDS] fixtures |
| P13 | `src/life/station/station-figure-parts.js` | attachMesh helper shared by the traveler figures |
| P13 | `tests/helpers/station-travelers-and-birds-first-build.mjs` | first builds with draws counted, rig/flock readers |
| P13 | `tests/unit/parity-station-travelers-and-birds-shots-and-probe.test.mjs` | travelers/birds shots and probe section |
| P13 | `tools/parity/station-travelers-and-birds-parity-shots.mjs` | traveler and bird shots |
| P13 | `tools/parity/station-travelers-and-birds-runtime-probe.mjs` | travelers/birds probe section |
| P13 | `tools/parity/scenario-probe-sections.mjs` | per-scenario probe sections and verdicts |
| P13 | `tools/parity/parity-shot-stages-and-hide-sets.mjs` | stages, thresholds, hide sets |
| P13 | `tools/parity/parity-shot-validation.mjs` | shot list validation |
| P14 | `tests/helpers/world-summary-digest.mjs` | self-contained world summary, ordered lists, instanced counts, sign hash |
| P14 | `tools/parity/parity-metrics-math.mjs` | pure verdict math (EMA inversion, palette overlap, heap attribution) |
| P14 | `tests/unit/parity-metrics-math.test.mjs` | unit tests of the verdict math |
| P14 | `tools/parity/performance-budget-probe.mjs` | parity:perf CLI |
| P14 | `tools/parity/research-recapture-and-contact-sheet.mjs` | parity:research CLI |
| P14 | `tools/parity/deployment-smoke-check.mjs` | parity:smoke CLI |
| P14 | `tools/parity/signoff-parity-shots.mjs` | sign-off shot set, probe states, research equivalents |
| P14 | `tools/parity/signoff-page-helpers.mjs` | sign-off in-page helpers (moved out of page-parity-helpers to stay < 200 lines) |
| P14 | `tools/parity/signoff-shot-capture.mjs` | sign-off capture (one context per shot) |
| P14 | `tools/parity/signoff-shot-verdicts.mjs` | log-sequence, box, noise-floor and summary verdicts |
| P14 | `tools/parity/signoff-state-probe.mjs` | parity:probe --states signoff |
| P14 | `tools/parity/png-diff-in-page.mjs` | PNG diff code split out of the compare CLI |
| P14 | `tests/unit/parity-signoff-shots-and-verdicts.test.mjs` | sign-off list, verdicts, probe and smoke judges |
| P14 | `tests/unit/hud-right-click-reset-to-defaults.test.mjs` | covering test for the right-click resets |

## Feature traceability (147 IDs)

Every feature ID of the research inventory, its single owning phase, the files that implement it, the test or
sign-off check that covers it, and the phases that contributed slots or helpers. "sign-off <id>" refers to the
browser sign-off shots and probe states in `tools/parity/signoff-parity-shots.mjs`.

| ID | owner | files | covering test | contributors |
|---|---|---|---|---|
| F01.01 | P01 | index.html, `src/main-entry.js` | `tools/parity/deployment-smoke-check.mjs` (smoke), sign-off ov-day-t0 | – |
| F01.02 | P01 | `styles/base-reset-and-utilities.css` | sign-off dom-hud-day, dom-help, dom-mobile-hud | – |
| F01.03 | P01 | `src/ui/hud-button-renderers.js`, `src/ui/hud-dom-event-bindings.js`, `styles/hud-panel-and-controls.css` | `tests/unit/keyboard-shortcut-resolution.test.mjs`, sign-off dom-hud-day | – |
| F01.04 | P01 | `styles/night-theme-overrides.css` | sign-off dom-hud-night | – |
| F01.05 | P01 | `src/ui/hud-state-actions.js` | sign-off dom-help | – |
| F01.06 | P01 | `src/ui/settings-schema-defaults.js`, `src/ui/settings-local-storage-persistence.js` | `tests/unit/settings-validation-and-persistence.test.mjs` | – |
| F01.07 | P01 | `src/ui/keyboard-shortcuts.js` | `tests/unit/keyboard-shortcut-resolution.test.mjs` | P10 (flight keys) |
| F01.08 | P01 | `src/ui/hud-dom-event-bindings.js` | `tests/unit/hud-right-click-reset-to-defaults.test.mjs` | – |
| F01.09 | P01 | `src/ui/shortcut-toast.js`, `styles/toast-and-debug-menu.css` | sign-off dom-toast-bridge, hud-hidden | – |
| F01.10 | P01 | `src/ui/loading-screen-step-runner.js`, `styles/loading-overlay.css` | `tests/unit/loading-screen-step-runner.test.mjs`, sign-off dom-loading | – |
| F01.11 | P01 | `src/main-entry.js` | `tests/unit/overview-intro-and-camera-modes.test.mjs`, smoke check | P04 (hook), P03 |
| F01.12 | P04 | `src/ui/debug-menu-panel.js`, `src/engine/parity-test-hook.js` | `tests/unit/parity-harness-pure-logic.test.mjs`, sign-off dom-debug | P01 (CSS) |
| F01.13 | P01 | `assets/train-diorama-logo.svg`, `assets/clock-favicon.svg` | sign-off dom-loading (boxes), independence audit | – |
| F02.01 | P03 | `src/engine/diorama.js` | `tests/unit/shadow-post-and-render-pipeline-passes.test.mjs` | P07, P10, P13 |
| F02.02 | P03 | `src/engine/frame-loop-scheduler.js` | `tests/unit/frame-cadence-and-render-resolution.test.mjs` | P05, P12 |
| F02.03 | P03 | `src/engine/time-of-day-palettes-and-transition.js` | `tests/unit/time-of-day-transition.test.mjs` | – |
| F02.04 | P02 | `src/materials/shared-lighting-uniforms.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` | P03 |
| F02.05 | P03 | `src/materials/procedural-sky-dome-material.js`, `src/engine/diorama-scene-composition.js` | `tests/unit/time-of-day-transition.test.mjs`, `tests/unit/diorama-scene-composition-order.test.mjs` | – |
| F02.06 | P03 | `src/engine/custom-shadow-depth-pass.js` | `tests/unit/shadow-post-and-render-pipeline-passes.test.mjs` | – |
| F02.07 | P03 | `src/engine/post-ink-outline-dither-pass.js` | `tests/unit/shadow-post-and-render-pipeline-passes.test.mjs`, sign-off ink-off | – |
| F02.08 | P03 | `src/engine/render-resolution-resizer.js` | `tests/unit/frame-cadence-and-render-resolution.test.mjs`, sign-off pixel-360/720 | – |
| F02.09 | P03 | `src/engine/cameras/overview-orbit-camera.js` | `tests/unit/overview-intro-and-camera-modes.test.mjs` | – |
| F02.10 | P10 | `src/engine/cameras/free-fly-pointer-lock-camera.js` | `tests/unit/free-fly-fly-along-and-bridge-camera-rigs.test.mjs`, `tests/parity/camera-modes-parity.test.mjs` | P03 (PLC creation) |
| F02.11 | P10 | `src/engine/cameras/train-fly-along-camera-rig.js` | `tests/parity/camera-modes-parity.test.mjs`, sign-off train-day | – |
| F02.12 | P10 | `src/engine/cameras/bridge-tripod-camera.js` | `tests/parity/camera-modes-parity.test.mjs`, sign-off bridge-day | – |
| F02.13 | P07 | `src/train/train-station-motion-controller.js` | `tests/unit/train-station-motion-controller.test.mjs` | – |
| F02.14 | P07 | `src/train/locomotive-smoke-puff-pool.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` | – |
| F02.15 | P07 | `src/train/train-frame-update.js`, `src/engine/night-light-glow-registry.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` | P03 (glow registry) |
| F02.16 | P03 | `src/engine/diorama.js`, `src/engine/cameras/camera-mode-director.js` | `tests/unit/camera-mode-director-switching.test.mjs`, smoke check (pagehide dispose) | P07, P10, P13 |
| F03.01 | P02 | `src/materials/shared-lighting-uniforms.js`, `src/core/disable-three-color-management.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` | – |
| F03.02 | P02 | `src/materials/glsl/hash-and-value-noise-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` | – |
| F03.03 | P02 | `src/materials/glsl/npr-lighting-common-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` | – |
| F03.04 | P02 | `src/materials/glsl/npr-lighting-common-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs`, sign-off train-night | P07 |
| F03.05 | P02 | `src/materials/glsl/npr-fragment-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` | – |
| F03.06 | P02 | `src/materials/npr-cel-material-factory.js`, `src/materials/glsl/npr-vertex-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` | – |
| F03.07 | P02 | `src/materials/glsl/npr-fragment-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` | – |
| F03.08 | P02 | `src/materials/glsl/npr-fragment-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` | P05 |
| F03.09 | P02 | `src/materials/glsl/npr-fragment-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` | P05 |
| F03.10 | P02 | `src/materials/glsl/npr-vertex-shader-glsl.js` | `tests/unit/npr-material-cache-and-glsl-parity.test.mjs` | P09 |
| F03.11 | P12 | `src/materials/water-surface-material.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` | – |
| F03.12 | P12 | `src/materials/waterfall-curtain-material.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` | – |
| F03.13 | P03 | `src/materials/procedural-sky-dome-material.js` | `tests/unit/time-of-day-transition.test.mjs`, sign-off ov-night-t0 | – |
| F03.14 | P02 | `src/core/seeded-prng-and-gradient-noise.js` | `tests/unit/seeded-prng-and-gradient-noise.test.mjs` | – |
| F03.15 | P02 | `src/geometry/merge-static-geometry-by-material.js` | `tests/unit/merge-static-geometry-and-glows.test.mjs` | – |
| F03.16 | P02 | `src/effects/night-headlight-light-cone.js` | `tests/unit/merge-static-geometry-and-glows.test.mjs` | P07 |
| F03.17 | P02 | `src/effects/night-light-glow-sprites.js` | `tests/unit/merge-static-geometry-and-glows.test.mjs` | – |
| F04.01 | P05 | `src/world/world-constants.js`, `src/core/scalar-math-helpers.js` | `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` | – |
| F04.02 | P05 | `src/world/terrain/river-distance-and-natural-height.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F04.03 | P05 | `src/world/track/track-spline-frames-and-queries.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F04.04 | P05 | `src/world/track/track-spline-frames-and-queries.js`, `src/world/world.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F04.05 | P05 | `src/world/track/bridge-span-detection.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F04.06 | P05 | `src/world/terrain/terrain-heightmap-grading.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F04.07 | P05 | `src/world/terrain/building-ground-flattening.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | P06, P08 |
| F04.08 | P05 | `src/world/terrain/terrain-surface-mesh-and-vertex-colors.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F04.09 | P05 | `src/world/terrain/terrain-skirt-plinth-and-water-height-texture.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F04.10 | P05 | `src/world/terrain/terrain-skirt-plinth-and-water-height-texture.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F04.11 | P05 | `src/world/track/track-ballast-rails-sleepers.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F04.12 | P05 | `src/geometry/building-wall-and-roof-vents.js` | `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` | – |
| F04.13 | P05 | `src/world/world-build-steps.js`, `src/world/world.js` | `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs`, `tests/parity/full-scene-signature-parity.test.mjs` | P06, P08, P09, P11, P12, P13 |
| F04.14 | P11 | `src/life/sheep/sheep-pasture-ground-query.js` | `tests/parity/sheep-flock-parity.test.mjs` | – |
| F05.01 | P05 | `src/world/track/bridge-span-detection.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F05.02 | P05 | `src/world/bridge/bridge-deck-girders-and-railings.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F05.03 | P13 | `src/world/perches/bird-perch-builders.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | P05 (chord) |
| F05.04 | P05 | `src/world/bridge/bridge-arch-columns-piers-abutments.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F05.05 | P05 | `src/world/bridge/bridge-arch-columns-piers-abutments.js` | `tests/parity/terrain-track-bridge-parity.test.mjs` | – |
| F05.06 | P06 | `src/world/station/station-site-placement.js` | `tests/parity/station-parity.test.mjs` | – |
| F05.07 | P06 | `src/world/station/station-platform-shelter-bench.js` | `tests/parity/station-parity.test.mjs` | P13 (roof perch) |
| F05.08 | P06 | `src/world/station/station-platform-shelter-bench.js` | `tests/parity/station-parity.test.mjs` | – |
| F05.09 | P06 | `src/world/station/station-building-shell-and-roof.js` | `tests/parity/station-parity.test.mjs` | – |
| F05.10 | P06 | `src/world/station/station-building-windows-and-shutters.js` | `tests/parity/station-parity.test.mjs` | – |
| F05.11 | P06 | `src/world/station/station-wall-clock.js` | `tests/unit/station-sign-clock-and-build-counts.test.mjs` | – |
| F05.12 | P06 | `src/world/station/station-name-board-sign.js` | `tests/unit/station-sign-clock-and-build-counts.test.mjs`, sign-off probe sign hash | – |
| F05.13 | P06 | `src/world/station/station-lamps-with-night-glow.js` | `tests/parity/station-parity.test.mjs` | – |
| F05.14 | P13 | `src/life/station/station-traveler-old-man-figure.js`, `src/life/station/station-walker-controller.js`, `src/life/station/station-figure-parts.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | P06 (slot) |
| F05.15 | P13 | `src/life/station/station-grandmother-figure.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | P06 (slot) |
| F05.16 | P13 | `src/life/station/station-travelers-idle-and-head-look.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F05.17 | P06 | `src/world/station/station-luggage-props.js` | `tests/parity/station-parity.test.mjs` | – |
| F05.18 | P06 | `src/world/station/station-stairs-railings-footpath.js` | `tests/parity/station-parity.test.mjs` | – |
| F05.19 | P06 | `src/world/station/station-stairs-railings-footpath.js` | `tests/parity/station-parity.test.mjs` | – |
| F05.20 | P06 | `src/world/station/station-site-placement.js` | `tests/parity/station-parity.test.mjs` | – |
| F06.01 | P05 | `src/geometry/procedural-geometry-helpers.js`, `src/geometry/building-wall-and-roof-vents.js`, `src/world/terrain/building-ground-flattening.js` | `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` | – |
| F06.02 | P08 | `src/world/village/village-house-placement.js` | `tests/parity/village-windmill-parity.test.mjs` | – |
| F06.03 | P08 | `src/world/village/village-house-body-and-roof.js`, `src/world/village/village-house-palette-materials.js` | `tests/parity/village-windmill-parity.test.mjs` | – |
| F06.04 | P08 | `src/world/village/village-house-windows-and-shutters.js` | `tests/parity/village-windmill-parity.test.mjs` | – |
| F06.05 | P08 | `src/world/village/village-chimney-smoke.js` | `tests/unit/village-and-windmill-build-logic.test.mjs` | – |
| F06.06 | P08 | `src/world/village/village-house-placement.js`, `src/geometry/merge-static-geometry-by-material.js` | `tests/parity/village-windmill-parity.test.mjs` | – |
| F06.07 | P08 | `src/world/village/village-shrubs-instanced.js` | `tests/parity/village-windmill-parity.test.mjs` | – |
| F06.08 | P08 | `src/world/windmill/windmill-site-and-body.js` | `tests/parity/village-windmill-parity.test.mjs` | – |
| F06.09 | P08 | `src/world/windmill/windmill-hay-bales.js` | `tests/parity/village-windmill-parity.test.mjs` | – |
| F06.10 | P08 | `src/world/windmill/windmill-rotor.js` | `tests/unit/village-and-windmill-build-logic.test.mjs` | – |
| F06.11 | P09 | `src/world/trees/tree-species-geometries.js` | `tests/parity/residents-trees-rocks-parity.test.mjs` | – |
| F06.12 | P09 | `src/world/trees/tree-scatter-rules.js` | `tests/parity/residents-trees-rocks-parity.test.mjs` | – |
| F06.13 | P09 | `src/world/trees/tree-instanced-layers.js` | `tests/parity/residents-trees-rocks-parity.test.mjs` | P02 (sway shader) |
| F06.14 | P09 | `src/world/trees/tree-canopy-height-grid.js` | `tests/unit/village-walk-cycle-and-tree-rock-scatter.test.mjs` | – |
| F06.15 | P09 | `src/world/rocks/riverside-rock-scatter.js` | `tests/parity/residents-trees-rocks-parity.test.mjs` | – |
| F06.16 | P11 | `src/life/sheep/sheep-geometry-and-instanced-meshes.js` | `tests/parity/sheep-flock-parity.test.mjs` | – |
| F06.17 | P11 | `src/life/sheep/pasture-sheep-spawner.js` | `tests/parity/sheep-flock-parity.test.mjs` | – |
| F06.18 | P11 | `src/life/sheep/trackside-sheep-flock-site.js`, `src/life/sheep/build-sheep-flock.js` | `tests/parity/sheep-flock-parity.test.mjs` | – |
| F07.01 | P12 | `src/world/water/river-water-and-waterfall-builder.js`, `src/materials/water-surface-material.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` | – |
| F07.02 | P12 | `src/world/water/river-water-and-waterfall-builder.js`, `src/materials/waterfall-curtain-material.js` | `tests/unit/waterfall-cloud-avoidance-and-balloon-flight.test.mjs` | – |
| F07.03 | P12 | `src/world/sky/cloud-field-spawner.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` | – |
| F07.04 | P12 | `src/world/sky/cloud-drift-fade-and-camera-avoidance.js` | `tests/unit/waterfall-cloud-avoidance-and-balloon-flight.test.mjs` | – |
| F07.05 | P12 | `src/world/sky/cloud-drift-fade-and-camera-avoidance.js` | `tests/unit/waterfall-cloud-avoidance-and-balloon-flight.test.mjs` | – |
| F07.06 | P13 | `src/world/perches/bird-perch-builders.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F07.07 | P12 | `src/world/balloon/hot-air-balloon-envelope-and-basket.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` | – |
| F07.08 | P12 | `src/world/balloon/hot-air-balloon-envelope-and-basket.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` | – |
| F07.09 | P12 | `src/world/balloon/hot-air-balloon-pilot-figure.js` | `tests/parity/water-clouds-balloon-parity.test.mjs` | – |
| F07.10 | P12 | `src/world/balloon/hot-air-balloon-burner-flame-and-flight.js` | `tests/unit/waterfall-cloud-avoidance-and-balloon-flight.test.mjs` | – |
| F07.11 | P11 | `src/life/sheep/track-sheep-escape-state-machine.js` | `tests/unit/track-sheep-escape-state-machine.test.mjs` | – |
| F07.12 | P11 | `src/life/sheep/sheep-locomotion-and-route-motion.js` | `tests/parity/sheep-flock-oracle-train-parity.test.mjs` | – |
| F07.13 | P11 | `src/life/sheep/sheep-instance-pose-writer.js` | `tests/parity/sheep-flock-parity.test.mjs` | – |
| F07.14 | P06 | `src/world/world-per-frame-update.js` | `tests/unit/station-sign-clock-and-build-counts.test.mjs`, `tests/parity/full-scene-signature-parity.test.mjs` | P08, P09, P11, P12, P13 |
| F08.01 | P07 | `src/train/train-palette-materials.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | – |
| F08.02 | P07 | `src/train/locomotive-boiler-and-cab-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | – |
| F08.03 | P07 | `src/train/locomotive-boiler-and-cab-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | – |
| F08.04 | P07 | `src/train/locomotive-driver-and-raven-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | – |
| F08.05 | P07 | `src/train/locomotive-driver-and-raven-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | – |
| F08.06 | P07 | `src/train/locomotive-front-end-and-lamps-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | – |
| F08.07 | P07 | `src/train/locomotive-front-end-and-lamps-builder.js`, `src/effects/night-headlight-light-cone.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | P02 |
| F08.08 | P07 | `src/train/rolling-stock-wheel-builders.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | – |
| F08.09 | P07 | `src/train/tender-car-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | – |
| F08.10 | P07 | `src/train/passenger-coach-builder.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | – |
| F08.11 | P07 | `src/train/train-mesh-helpers.js`, `src/train/train.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | P02 (merge) |
| F08.12 | P07 | `src/train/train.js` | `tests/parity/train-model-and-motion-parity.test.mjs` | – |
| F08.13 | P07 | `src/train/train-station-motion-controller.js` | `tests/unit/train-station-motion-controller.test.mjs` | – |
| F08.14 | P07 | `src/train/locomotive-smoke-puff-pool.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` | – |
| F08.15 | P07 | `src/train/brake-sparks.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` | – |
| F08.16 | P07 | `src/train/brake-sparks.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` | – |
| F08.17 | P07 | `src/train/train-frame-update.js` | `tests/parity/train-simulation-oracle-and-composition-parity.test.mjs` | P02 (headlightAt) |
| F08.18 | P07 | `src/engine/simulation-step.js`, `src/train/train-frame-update.js` | `tests/unit/frame-cadence-and-render-resolution.test.mjs`, `tests/parity/full-scene-signature-parity.test.mjs` | P03, P13 |
| F09.01 | P13 | `src/life/birds/bird-geometry-builder.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F09.02 | P13 | `src/world/perches/bird-perch-builders.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F09.03 | P13 | `src/life/birds/bird-system.js`, `src/life/birds/bird-flock-state-machine.js` | `tests/unit/bird-flock-state-machine.test.mjs` | – |
| F09.04 | P13 | `src/life/birds/bird-flight-poses.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F09.05 | P13 | `src/life/birds/bird-wing-body-animator.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F09.06 | P11 | `src/life/sheep/track-sheep-escape-state-machine.js` | `tests/unit/track-sheep-escape-state-machine.test.mjs` | – |
| F09.07 | P11 | `src/life/sheep/sheep-geometry-and-instanced-meshes.js` | `tests/parity/sheep-flock-parity.test.mjs` | – |
| F09.08 | P11 | `src/life/sheep/pasture-sheep-spawner.js`, `src/life/sheep/sheep-locomotion-and-route-motion.js` | `tests/parity/sheep-flock-oracle-train-parity.test.mjs` | – |
| F09.09 | P11 | `src/life/sheep/trackside-sheep-flock-site.js` | `tests/parity/sheep-flock-parity.test.mjs` | – |
| F09.10 | P11 | `src/life/sheep/sheep-instance-pose-writer.js` | `tests/parity/sheep-flock-parity.test.mjs` | – |
| F09.11 | P13 | `src/life/station/station-traveler-old-man-figure.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F09.12 | P13 | `src/life/station/station-walker-controller.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F09.13 | P13 | `src/life/station/station-walker-leg-ik-and-body-animation.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F09.14 | P13 | `src/life/station/station-walker-leg-ik-and-body-animation.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F09.15 | P13 | `src/life/station/station-travelers-idle-and-head-look.js`, `src/life/station/station-grandmother-figure.js` | `tests/parity/station-travelers-and-birds-parity.test.mjs` | – |
| F09.16 | P09 | `src/life/village/village-residents.js`, `src/life/village/village-woman-and-man-outfits.js`, `src/life/village/village-dog-builder.js`, `src/life/village/village-resident-materials-and-primitives.js` | `tests/parity/residents-trees-rocks-parity.test.mjs` | – |
| F09.17 | P09 | `src/life/village/village-residents.js` | `tests/unit/village-walk-cycle-and-tree-rock-scatter.test.mjs` | – |
