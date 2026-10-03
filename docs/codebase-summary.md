# Codebase summary

Tree reflects the repository through phase 13 (scaffold/shell/HUD, core noise/materials/
effects/geometry, the real engine: renderer, frame loop, palettes, sky, shadow/post, pixel
art, overview camera; then the debug menu, the parity hook and the node + browser parity harness;
then the world core: build-step registry, terrain, track and bridge; then the Mossbrook station,
its wall clock and the world per-frame orchestrator; then the train; then the village cottages,
chimney smoke, shrubs and the windmill; then the village residents, the forest with its canopy
height grid and the riverside rocks; then the water, the cloud field and the hot-air balloon; then the
station travelers, the bird perches and the bird flocks). Later phases append rows; they do not rewrite earlier phases' sections.

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
│       └── hook-and-debug-menu-browser-checks.mjs debug-menu + hook exposure checks, live station clock check
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
│   │   ├── clone-simulation-driver.mjs          createCloneSimulation (oracle ctx shape, birds, freeCameraPose), setCloneMode, stepCloneFrame, snapshotTrainState, snapshotLifeState
│   │   ├── sheep-flock-parity-lockstep.mjs      firstSheepFlockMismatch (in-place, Object.is), runSheepLockstep (per-side Math.random + logs by prefix)
│   │   ├── station-travelers-and-birds-first-build.mjs first clone/original builds with draws counted (buildStation, bird material, birds), walker/rig/flock readers
│   │   ├── counted-full-world-builds.mjs        full original/clone builds with Math.random draws counted per named build step
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
│   │   └── parity-station-travelers-and-birds-shots-and-probe.test.mjs travelers/birds shots and poses, probe section, verdicts
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
│       └── fixtures/station-travelers-and-birds-expected.json perch, flock, walker and [BIRDS] timeline fixtures
└── docs/                                        this file, the other skeleton docs, parity-testing-guide.md
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
| P14 | Full-scene parity signature, ship | Pending (see `development-roadmap.md`) |
