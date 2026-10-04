# System architecture

Reference for the finished Train Diorama re-creation, organised by subsystem. The code under `src/`
is the ground truth; every number below was read from it or measured from a full build. "The
reference" means the original deployment the clone is pixel- and behaviour-matched against.

Contents: runtime conventions · module map · boot order · DOM contract and settings · CSS cascade ·
Diorama facade · per-frame order · shared lighting uniforms · palettes · NPR shading · sky, shadows,
post and pixel art · night-glow registry · static merge · random streams · world · train · life
systems · cameras · render budget · parity test hook · parity harness · data flow.

## Runtime conventions

- **Vanilla ESM, no bundler, no build step.** `index.html` ships an import map:

  ```json
  { "imports": {
    "three": "https://unpkg.com/three@0.186.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.186.0/examples/jsm/"
  } }
  ```

  Node tests resolve the same bare `three` specifier from the `three` devDependency (pinned
  0.186.0; its package `exports` map also serves `three/addons/*`), so every engine module imports
  cleanly in both the browser and `node --test`.
- **Colour management off.** `src/core/disable-three-color-management.js` sets
  `THREE.ColorManagement.enabled = false` as a side effect; it is the first import of `diorama.js`,
  the uniform bag, the palettes, `world.js`, the train palette and the brake sparks. All authored
  hex/CSS colours are display-space and are never converted to linear. The renderer outputs
  `LinearSRGBColorSpace`.
- **No image textures.** Colour comes from vertex colours, palettes, shaders and one canvas sign.
  Runtime network: unpkg (three.js) and Google Fonts (Fredoka). The Vercel Analytics script is
  injected only on `*.vercel.app` hosts.
- **Deterministic placement.** Every placement decision draws from seeded `mulberry32` streams
  (see "Random streams"); only smoke puffs, brake sparks and three.js UUIDs use `Math.random`.
- **Allocation discipline.** Every `Object3D`, `BufferGeometry`, `Material`, `Texture` and `Source`
  draws 4 `Math.random` values for its UUID, so builders allocate exactly the three.js objects they
  document, in a fixed order. Per-frame code allocates no UUID-bearing objects (the simulation step
  allocates one plain `{distance, speed, length}` record per step).
- **Instance-member dispatch.** The frame loop and the simulation step read every member
  (`updateTimeOfDay`, `updateCamera`, `render`, `world`, `train`, `birds`, …) from the Diorama
  instance inside the frame body; nothing is cached, bound or destructured at creation. An instance
  override assigned after construction (the parity capture's no-ops) takes effect on the next frame.
- **Float discipline.** Formulas keep the stated operand order, `Math.hypot` vs `√Σ` choices, `**`
  vs products and Float32 storage points, because placement depends on the exact bits. Three helper
  substitutions are allowed (`wrapAngle`, `positiveModulo`, `exponentialResponse`, see
  `code-standards.md`).
- **Files stay under 200 lines** (`npm run check:lines`).

## Module map

```
index.html
  ├ styles/  base-reset-and-utilities → hud-panel-and-controls → loading-overlay
  │          → toast-and-debug-menu → night-theme-overrides
  └ src/main-entry.js                         boot: settings, HUD, loading steps
src/
  core/        disable-three-color-management (side effect), seeded-prng-and-gradient-noise
               (mulberry32, noise2, fbm, smoothstep, lerp), scalar-math-helpers
               (wrapAngle, positiveModulo, exponentialResponse)
  materials/   shared-lighting-uniforms (G, NIGHT_UNIFORMS, views, glow name/render state),
               npr-cel-material-factory, procedural-sky-dome-material, water-surface-material,
               waterfall-curtain-material, glsl/{hash-and-value-noise, npr-lighting-common,
               npr-vertex-shader, npr-fragment-shader}
  effects/     night-light-glow-sprites (createLightGlows), night-headlight-light-cone (createLightCone)
  geometry/    merge-static-geometry-by-material, procedural-geometry-helpers (box, colorize,
               tintGeometry, jitter), extrude-profile-along-frames, building-wall-and-roof-vents
  engine/      diorama (facade), diorama-scene-composition, frame-loop-scheduler, simulation-step,
               render-pipeline, render-resolution-resizer, time-of-day-palettes-and-transition,
               custom-shadow-depth-pass, post-ink-outline-dither-pass, night-light-glow-registry,
               parity-test-hook
  engine/cameras/  camera-mode-director, overview-orbit-camera, free-fly-pointer-lock-camera,
               train-fly-along-camera-rig, bridge-tripod-camera
  world/       world (class), world-build-steps (registry), world-per-frame-update, world-constants
    track/     track-spline-frames-and-queries, bridge-span-detection, track-ballast-rails-sleepers
    terrain/   river-distance-and-natural-height, terrain-heightmap-grading, building-ground-flattening,
               terrain-surface-mesh-and-vertex-colors, terrain-skirt-plinth-and-water-height-texture
    bridge/    bridge-deck-girders-and-railings, bridge-arch-columns-piers-abutments
    station/   build-station, station-site-placement, station-palette-materials,
               station-platform-shelter-bench, station-building-shell-and-roof,
               station-building-windows-and-shutters, station-wall-clock, station-name-board-sign,
               station-luggage-props, station-lamps-with-night-glow, station-stairs-railings-footpath
    village/   village-house-placement, village-house-palette-materials, village-house-body-and-roof,
               village-house-windows-and-shutters, village-chimney-smoke, village-shrubs-instanced
    windmill/  windmill-site-and-body, windmill-hay-bales, windmill-rotor
    trees/     tree-instanced-layers, tree-scatter-rules, tree-species-geometries, tree-canopy-height-grid
    rocks/     riverside-rock-scatter
    water/     river-water-and-waterfall-builder
    sky/       cloud-field-spawner, cloud-drift-fade-and-camera-avoidance
    balloon/   hot-air-balloon-envelope-and-basket, hot-air-balloon-pilot-figure,
               hot-air-balloon-burner-flame-and-flight
    perches/   bird-perch-builders
  train/       train (class), train-palette-materials, train-mesh-helpers,
               locomotive-boiler-and-cab-builder, locomotive-driver-and-raven-builder,
               locomotive-front-end-and-lamps-builder, rolling-stock-wheel-builders, tender-car-builder,
               passenger-coach-builder, train-station-motion-controller, train-frame-update,
               brake-sparks, locomotive-smoke-puff-pool
  life/village/ village-residents, village-resident-materials-and-primitives,
               village-woman-and-man-outfits, village-dog-builder
  life/sheep/  build-sheep-flock, sheep-geometry-and-instanced-meshes, pasture-sheep-spawner,
               sheep-pasture-ground-query, trackside-sheep-flock-site, track-sheep-escape-state-machine,
               sheep-locomotion-and-route-motion, sheep-instance-pose-writer
  life/station/ station-traveler-old-man-figure, station-grandmother-figure, station-figure-parts,
               station-walker-controller, station-walker-leg-ik-and-body-animation,
               station-travelers-idle-and-head-look
  life/birds/  bird-system, bird-geometry-builder, bird-flock-state-machine, bird-flight-poses,
               bird-wing-body-animator
  ui/          settings-schema-defaults, settings-local-storage-persistence, hud-button-renderers,
               hud-state-actions, hud-dom-event-bindings, keyboard-shortcuts, shortcut-toast,
               loading-screen-step-runner, debug-menu-panel
```

### Dependency graph

```
main-entry ──► ui/* (settings, HUD, keys, toast, loader, debug menu)
           ──► engine/parity-test-hook (no imports)
           ──⇢ engine/diorama (dynamic import) ──► engine/* (loop, sim step, render, palettes, passes, cameras)
                    │
                    └► engine/diorama-scene-composition ──► world/world ──► world/* builders ──► geometry/*, materials/*, effects/*
                                                       ├──► train/* ──► materials/npr, effects/*, geometry/merge
                                                       ├──► life/birds ◄── world.birdPerches
                                                       └──► materials/procedural-sky-dome-material
world build steps ──► life/village, life/sheep, life/station (residents, flock and travelers are built inside the world)
core/* is imported by every layer; nothing imports ui/ except main-entry.
```

No import cycles: builders are plain `(world, …) => void` functions and never import `world.js`;
`hud-button-renderers.js` imports only the settings schema; `debug-menu-panel.js` imports only
`element()` from the renderers.

## Boot order (`src/main-entry.js`)

1. `loadSettings()`, `createSettingsSaver(state)`, an unset `activeDiorama` slot with a getter, and
   `createHudActions({state, getDiorama, save})`.
2. `renderModes`, `renderToggles`, `renderTimeOfDay`, `bindHud(state, actions)`,
   `bindKeyboardShortcuts(...)`, then a once-only `pagehide` listener calling
   `getActiveDiorama()?.dispose()`. Every call these make onto the diorama is optional-chained.
3. `runLoadingSteps` with three weighted steps:

   | label | weight | work |
   |---|---|---|
   | `LOADING ENGINE` | 30 | `await import('./engine/diorama.js')` |
   | `BUILDING VALLEY AND TRAIN` | 60 | `new Diorama(element('scene'))`, store it in the slot, apply persisted state, `installParityTestHook(diorama)` — one synchronous task |
   | `PREPARING FIRST FRAME` | 10 | wait one `requestAnimationFrame` |

   Persisted state is applied directly to the instance, in this order: `setMode(mode)`,
   `speedMul = speed`, `timeScale`, `setPixelResolution(PIXEL_MODES[pixelResolution].shortSide)`,
   `setOutline(outline)`, `setTimeOfDay(timeOfDay, true)`, `setAutoRotate(spin)`, `paused`,
   `prepareOverviewIntro()`. The instance is stored before the setters run, so a throwing setter
   still leaves something the `pagehide` handler can dispose.
4. `announceReady()`: log `[GAMEPLAY] Started`; if an overview intro was prepared, set
   `overviewIntro.playing = true` and log `[CAMERA] Overview intro started`; `mountDebugMenu`; toast
   `H · Hide HUD`. Any error in `boot()` reaches `console.error`.

Because boot applies state to the diorama directly (not through HUD actions), it never logs
`[CAMERA] Mode` and never saves; `localStorage` stays empty until the first user action.

### Loading screen (`ui/loading-screen-step-runner.js`)

Reset (visible, `aria-busy="true"`, first hint, 0%) → hint rotation every 2600 ms over five
`LOADING_HINTS` → per step: phase label, `#loading.is-working`, two paint frames (so the label lands
before work blocks), run, clear `is-working`, add the weight to the progress bar
(`.load-fill` width, `#load-percent`, `aria-valuenow`) → `READY` → settle (260 ms, `.is-gone`,
420 ms, `hidden`, `aria-busy="false"`). On failure the phase reads `LOADING FAILED: <message>`, the
hint `Reload the page to try again.`, and the error is rethrown.

## DOM contract and settings

### Static and dynamic DOM

`index.html` holds 22 static ids, looked up through `element(id)` (throws
`Missing interface element: <id>`): `app`, `scene`, `hud-top`, `controls-button`, `help`,
`hide-help`, `hud-controls`, `camera-modes`, `time-of-day`, `speed`, `time-scale-control`,
`time-scale`, `time-scale-value`, `display-controls`, `toggles`, `pixel-resolution`,
`outline-toggle`, `shortcut-toast`, `loading`, `load-phase`, `load-percent`, `load-hint` (the
loader reads its own nodes with `getElementById`).

Five containers are rendered from state; their serialized markup (attribute order, class-token
order, text) is part of parity, not just their look:

| container | content |
|---|---|
| `#camera-modes` | 4 buttons `data-mode`, `title`, `aria-pressed`, `class`; label + key span (`1`–`4`) |
| `#time-of-day` | 3 buttons `type`, `data-time-of-day`, `aria-pressed`, `title`; icon span + label; also sets `body[data-time-of-day]` |
| `#toggles` | `paused` pill (`⏸ Pause` / `▶ Resume`) and the `spin` pill (`Turntable`, only in overview) |
| `#outline-toggle` | `outline` pill (`Ink lines`) |
| `#pixel-resolution` | `<option>` per pixel mode (filled once by `bindHud`) |

State hooks: `body[data-time-of-day]`, `body.hud-hidden`, `#shortcut-toast.is-visible` /
`.hud-hidden`, `#loading.is-working` / `.is-gone` / `[hidden]` / `[aria-busy]`, `#help[hidden]`,
`#controls-button[aria-expanded]`, `#hud-top[hidden]`, `#hud-controls[hidden]`.

Runtime-only DOM: the WebGL canvas inside `#scene` (`display: block`) and `details#debug-menu`,
appended as the last child of `body` after loading: summary `···` (`title` then `aria-label`
`Debug menu`), `.debug-content` > `strong` `Scene debug`, `#debug-layers` (Trees and Clouds
checkbox rows, `checked` set as a property only), `pre#debug-performance`. Layer objects are
resolved at toggle time from `diorama.world?.treeLayers` and each `diorama.world?.clouds[].group`,
so a world-less diorama toggles nothing but still logs `[DEBUG] Trees|Clouds: shown|hidden`. The
readout (labels padded to 13 columns, triangles grouped by the viewer's locale, footer
`All render passes · CPU excludes GPU time`) refreshes on `toggle` and every 500 ms, only while
open; a once-only `pagehide` clears the interval.

### Settings (`ui/settings-*.js`)

`localStorage` key `train-scene-settings-v2`. Ten keys, all required:

| key | default | valid |
|---|---|---|
| `mode` | `overview` | `overview`, `orbit` (Free), `side` (Train), `bridge` |
| `speed` | 1 | finite number in [0, 2.5] |
| `pixelResolution` | `native` | `native`, `pixel720`, `pixel540`, `pixel360` (short sides null/720/540/360) |
| `lastPixelResolution` | `pixel360` | a pixel mode other than `native` |
| `outline` | true | boolean |
| `timeOfDay` | `day` | `day`, `evening`, `night` (a stored `golden` migrates to `evening`) |
| `paused` | false | boolean |
| `spin` | true | boolean |
| `timeScale` | 1 | finite number in [0, 2] |
| `hudVisible` | true | boolean |

Loading is all-or-nothing: any parse error, non-object, missing key or invalid value discards the
whole record with `[SETTINGS] Saved settings discarded` (warn) and returns the defaults. The saver
writes the whole state object; after its first failure (`[SETTINGS] Could not save settings`) it
stops trying.

### HUD actions (`ui/hud-state-actions.js`)

Each action runs state → diorama (optional) → DOM → log → toast → save:

| action | diorama call | log / toast |
|---|---|---|
| `setMode(mode)` | `setMode` | re-render modes + toggles, `[CAMERA] Mode: <mode>`; Free mode toast (only once a diorama exists) |
| `setTimeOfDay(id)` | `setTimeOfDay(id)` (3 s blend) | throws `Invalid time of day: <id>`; `[GAMEPLAY] Time of day: <id>` |
| `setPixelResolution(id)` | `setPixelResolution(shortSide)` | remembers non-native ids; `[DEBUG] Pixel resolution: <label>` |
| `setSpeed(v)` / `setTimeScale(v)` | `speedMul` / `timeScale` | slider value (and `<v>×` label) |
| `toggle('paused' \| 'outline' \| 'spin')` | `paused` / `setOutline` / `setAutoRotate` | `[PAUSE] Paused|Resumed` for pause |
| `toggleHudVisible()` | none | `[HUD] Shown|Hidden`; toast `H · HUD shown` / `H · HUD hidden — press H to show` |
| `setHelpVisible(v)` | none | `#help[hidden]`, `aria-expanded` |

`bindHud` registers listeners in a fixed order: time-of-day group, initial value sync (pixel
options, slider values, HUD visibility), camera modes, display toggles, speed, pixel select, time
scale, help panel. Right-click (`contextmenu`) on a control resets it to its default and toasts
(`Camera · Default`, `Time of day · Day`, `<label> · Default`, `Train speed · Default`,
`Pixel art · Native`, `Time scale · Default`). The toast (`ui/shortcut-toast.js`) is one element
whose 2800 ms auto-hide timer restarts with every message.

### Keyboard (`ui/keyboard-shortcuts.js`)

`resolveKeyAction(event, {mode, flightLocked})` is pure. In Free mode with the pointer locked,
`KeyW/A/S/D`, `Space`, `KeyC`, `ShiftLeft/Right` go to `diorama.movementKeys` (with
`preventDefault`) before any other filter. Otherwise repeats, Meta/Ctrl/Alt chords and editable
targets are ignored, then: `L` logs the camera pose, `1`–`4` set the mode, `B` sets bridge and
toasts `B · Bridge camera`, `H` toggles the HUD, `P` flips `native` ↔ `lastPixelResolution`, `O`
toggles ink lines, `X` turns the turntable off if on and flips time scale 0 ↔ 1 (logs
`[GAMEPLAY] Time scale: <n>`, toasts `X · Time scale · <n>×`), `T` / `Shift+T` cycle the time of
day, `Space` toggles pause (`preventDefault`). `keyup` deletes the code; window `blur` and
`visibilitychange` to hidden clear all held keys.

## CSS cascade

Tailwind's compiled output puts preflight in `@layer base` and utilities in `@layer utilities`;
every hand-written component rule is unlayered, so it beats any layered rule regardless of selector
specificity. The clone reproduces this structure exactly:

- `styles/base-reset-and-utilities.css` declares `@layer base, utilities;` first, then a preflight
  subset in `base` and the utility classes the markup uses in `utilities` (including `@supports`
  colour-mix fallbacks and a `hover: hover` media block). `:root` radius variables and a second
  `[hidden] { display: none !important; }` sit unlayered at the bottom. Both `[hidden]` rules carry
  `!important`, so either alone already beats a normal declaration such as `#loading { display:
  grid }`; the unlayered copy mirrors the reference's cascade structure rather than being needed.
- `hud-panel-and-controls.css`, `loading-overlay.css`, `toast-and-debug-menu.css` and
  `night-theme-overrides.css` are unlayered component files loaded in that order; the night
  overrides (`body[data-time-of-day="night"] …`) come last so they win same-specificity conflicts.
  `body.hud-hidden #debug-menu` hides the debug menu with the HUD.

## Diorama facade (`src/engine/diorama.js`)

### Constructor order

```
scene (matrixWorldAutoUpdate = false), lightingUniforms = LIGHTING_UNIFORMS
→ UI state: mode 'overview', overviewIntro null, autoRotateEnabled true, speedMul 1, timeScale 1,
  paused false, pixelShortSide null, outline true, timeOfDay null, timeOfDayTransition null
→ clock/motion: last = nextFrameAt = performance.now(), time 0, raf 0, s 0, speed 0, stopTimer 0, justLeft false
→ camera-rig state: camPos, camTarget, flyAlongElapsed 0, flyAlongSide 1, flyAlongAnchor,
  flyAlongVelocity, previousFlyAlongAnchor
→ scratch/loop: movementKeys (Set), tmpA, tmpB, loop = createFrameLoop(this)
→ container, renderer (antialias false, powerPreference 'high-performance', info.autoReset false,
  LinearSRGB output, pixel ratio min(devicePixelRatio, 2), canvas appended), performanceStats
  {frameMilliseconds 1000/60, cpuMilliseconds 0}
→ camera PerspectiveCamera(42, 1, 0.3, 1500) at OVERVIEW_HOME → controls = createOverviewControls
  → bindOverviewIntroInterrupt (onOverviewInteraction) → firstPersonControls → bindClickToLock (onCanvasClick)
→ composeDioramaScene(this)
→ shadowPass (+ shadowRT, shadowCam, depthMat) → mainRT 4×4 with DepthTexture → post pass
  (postScene, postCam, postMat)
→ setTimeOfDay('day', true) → ResizeObserver(container) + resize()
→ camPos ← camera.position, camTarget ← controls.target → loop(performance.now())
```

The constructor runs the first frame synchronously. Because `last` was taken before the world was
built, that frame's real dt is the build time, clamped to 0.05 s: every page starts one 0.05 s
simulation step in (the station clock reads ≈3:00 and one smoke puff is live on the first frame).

### Scene composition (`engine/diorama-scene-composition.js`)

Insertion order sets material ids (opaque sort ties), glow order and the random streams:

1. `world = new World()` → `scene.add(world.group)`.
2. `birds = createWorldBirdSystem(world)` (requests the bird material
   `npr({vertexColors: true, stipple: 0.1, stippleScale: 4})` before any flock allocation) →
   `scene.add(birds.group)`.
3. `freeCameraPose = {position, target}` cloned from `world.freeCameraStart` (clones draw no UUIDs).
4. `train = new Train()` → `scene.add(train.group)`.
5. `brakeSparks = new BrakeSparks(world.heightAt bound)` → `scene.add(brakeSparks.mesh)`.
6. `initTrainMotion(d, world.stationS)`: `s = stationS + 1`, `justLeft = true`, `speed = 2`.
7. `sky = Mesh(SphereGeometry(700, 32, 16), skyMaterial())`, `frustumCulled = false`,
   `renderOrder = −1`.
8. `puffPool = new LocomotiveSmokePuffPool(scene)` (70 hidden puff meshes added to the scene),
   `puffs = puffPool.puffs`.
9. `shadowHiddenObjects = [sky, sparks mesh, ...world.noShadow, ...train.noShadow, ...puff meshes]`
   and a parallel `shadowVisibility` array.
10. `nightGlows = collectNightLightGlows(scene)` — last, so it sees every glow.

### Fields

Parity-visible simulation fields: `time`, `s`, `speed`, `stopTimer`, `justLeft`, `puffTimer`
(accessor pair onto `puffPool.timer`), `paused`, `timeScale`, `speedMul`, `camPos`, `camTarget`,
`flyAlong*`. Scene members: `scene`, `world`, `birds`, `train`, `brakeSparks`, `sky`, `puffPool`,
`puffs`, `shadowHiddenObjects`, `shadowVisibility`, `nightGlows`, `freeCameraPose`. Rendering:
`renderer`, `camera`, `controls`, `firstPersonControls`, `shadowPass`, `shadowRT`, `shadowCam`,
`depthMat`, `mainRT`, `postScene`, `postCam`, `postMat`, `ro`, `performanceStats`.

### Methods

| method | behaviour |
|---|---|
| `setMode(mode)` | `setCameraMode(this, mode)` (see "Cameras") |
| `setTimeOfDay(id, immediate = false)` | throws `Invalid time of day: <id>` for a non-own palette key; same id and not immediate → no-op; immediate → clear transition, `applyPalette`; else `beginPaletteTransition` |
| `updateTimeOfDay(realDt)` | `stepPaletteTransition` (null when done) |
| `setPixelResolution(shortSide)` | stores it, `resize()` |
| `setOutline(on)` | `postMat.uniforms.uOutline = on ? 1 : 0` |
| `setAutoRotate(on)` | stores it; `controls.autoRotate = mode === 'overview' && on` |
| `prepareOverviewIntro()` | overview only: arms the 3.2 s dolly-in (see "Cameras") |
| `logCameraPose()` | `[DEBUG] Camera pose: {"mode", "position" {x,y,z}, "rotationDegrees" {x,y,z}}`, 3 decimals |
| `resize()` | `resizeDiorama(this)` |
| `updateTrain(simDt)` | `updateTrainAndEffects(this, simDt)`; returns the brake strength |
| `updateCamera(dt)` | `updateCameraRig(this, dt)` |
| `render()` | `renderDioramaFrame(this)` |
| `dispose()` | `cancelAnimationFrame` → `ro.disconnect()` → `disposeFirstPersonControls` → remove the controls `'start'` listener → `controls.dispose()` → `birds.dispose()` → `brakeSparks.dispose()` → dispose each night glow's geometry and material → `renderer.dispose()` → remove the canvas |

Train and puff geometries/materials are never disposed (kept as in the reference).

## Per-frame order

### Frame loop (`engine/frame-loop-scheduler.js`)

```
loop(now):
  raf = requestAnimationFrame(loop)
  deadline = nextFrameDeadline(now, nextFrameAt)        120 fps cap: skip if now + 0.1 < nextFrameAt,
  if null → return                                        else advance by whole 1000/120 ms intervals
  realDt = (now − last)/1000; dt = min(0.05, realDt); last = now
  d.updateTimeOfDay(realDt)                              palettes blend on real, unclamped dt
  d.world.nightAmount = uNight
  if (!d.paused && d.timeScale > 0) stepSimulation(d, dt · timeScale)
  d.updateCamera(dt)                                     clamped real dt, never time-scaled
  d.world.updateCloudCamera(d.camera.position, dt)       outside the sim gate: clouds part while paused
  d.render()
  frameMilliseconds, cpuMilliseconds EMAs (α 0.1)
```

`stepSimulation` is the only function the loop imports directly; it never calls camera, render or
palette code.

### Simulation step (`engine/simulation-step.js`)

```
d.time += simDt; G.uTime = d.time
d.updateTrain(simDt)                     motion → car placement → brake strength → sparks → smoke
d.world.update(d.time, simDt, d.train.loco.obj.position, {distance: d.s, speed: d.speed, length: d.train.totalLength})
d.birds.update(d.time, d.s, d.speed, d.train.cars)
```

Everything inside freezes with pause or time scale 0: sim time, `uTime` (tree sway, water,
waterfall, balloon local-glow pulse), the train, every world slot and the birds.

### World update slots (`world/world-per-frame-update.js`)

| slot | system |
|---|---|
| 1 | `updateStationClock(world, elapsed)` |
| 2 | `advanceTrackSheepFlock(world, trainMotion, dt)` — rail-sheep state machine, logs its event, speed and facing |
| 3 | `updateSheepFlock(world, elapsed, dt)` — locomotion and instance poses |
| 4 | `travelerEvent = world.stationWalker.update(dt)` |
| 5 | `residentEvent = world.villageResidents?.update(elapsed, dt) ?? null` |
| 6 | log `residentEvent` (if not null), then `travelerEvent` (if not undefined) |
| 7 | `updateStationTravelers(world, elapsed, dt, trainPosition)` — idle sway and head-look |
| 8 | `updateChimneySmoke(world.houseSmoke, elapsed, dt)` |
| 9 | `updateWindmillRotor(world, dt)` |
| 10 | `updateCloudDrift(world.clouds, dt)` |
| 11 | `updateBalloonFlight(world, elapsed)` |

`World#update` assumes a fully built world. The only partial-world guards are slots 2–3 (skipped
while `world.sheep` is null) and slot 5; a world stopped before `buildBalloon` throws in slot 11,
as the reference does.

### Train, sparks and smoke (`train/train-frame-update.js`)

`updateTrainAndEffects(d, dt)`: `stepTrainStationMotion` → `train.update(world, s)` →
`computeBrakeStrength` → `brakeSparks.update(dt, strength, train.loco)` (Math.random ×4 per
spark) → `puffPool.update(dt, train.chimney, speed, stopTimer)` (Math.random ×7 per puff). Details
in "Train".

### Birds

`birds.update(time, s, speed, cars)` derives its own dt from consecutive sim times (0 on the first
call), then per flock: snapshot → decision (may log) → animate every bird. Details in "Life
systems".

### Render pipeline (`engine/render-pipeline.js`)

```
renderer.info.reset()                              (autoReset is off: counts cover every pass)
applyNightGlowVisibility(nightGlows, uNight)        visible ⇔ uNight > 0
writeHeadlightUniforms(train, lightingUniforms)     anchor world position; normalize(0, −0.08, 1) turned by the loco quaternion
sky.position ← camera.position
scene.updateMatrixWorld()                           the only matrix update of the frame
shadowPass.render(renderer, scene, shadowHiddenObjects, shadowVisibility)
setRenderTarget(mainRT); clear(); render(scene, camera)
setRenderTarget(null); render(postScene, postCam)   → canvas
```

## Shared lighting uniform bag (`materials/shared-lighting-uniforms.js`)

One singleton set of `{ value }` objects shared by reference across every shader material, so a
writer's in-place mutation is visible to every material on the next draw with no rebinding pass.
Consumers hold references; nobody clones a `ShaderMaterial` or replaces an entry (the containers
are `Object.freeze`d).

| export | keys (order) | notes |
|---|---|---|
| `G` | uLightDir, uLightColor, uShadowTint, uAmbient, uShadowMap, uShadowMatrix, uShadowTexel, uFogColor, uFogNear (110), uFogFar (420), uTime, uZenith, uHorizon, uHill, uMist, uSunColor | 16 entries |
| `NIGHT_UNIFORMS` | uNight, uSaturation, uHeadlightPosition, uHeadlightDirection | `uSaturation` is read only by the post pass |
| `SHADER_NIGHT_UNIFORMS` | uNight, uHeadlightPosition, uHeadlightDirection | frozen view onto the same three objects |
| `LIGHTING_UNIFORMS` | the 16 `G` keys, then the 4 night keys | `diorama.lightingUniforms` |
| `NIGHT_LIGHT_GLOW_MATERIAL_NAME` | `'night-light-glow'` | glow registry key |
| `ADDITIVE_GLOW_RENDER_STATE` | `{transparent: true, depthWrite: false, blending: Additive}` | spread by both glow factories |

`G`'s initial values are placeholders (e.g. `uLightDir` normalize(0.55, 0.7, 0.45)); the
constructor's `setTimeOfDay('day', true)` overwrites every palette key before the first frame.

**Writers.** Palettes: 12 keys, real unclamped dt, `uLightDir` renormalised every step. Shadow
pass: `uShadowMap` and `uShadowTexel` (1/2048) once at creation, `uShadowMatrix` every render.
Simulation step: `uTime`. Render pipeline: the headlight pair.

**Who spreads what.**

| material | uniform set |
|---|---|
| `npr(...)` | `G`, `SHADER_NIGHT_UNIFORMS`, then its own keys |
| sky | `G`, `SHADER_NIGHT_UNIFORMS` (the shader never reads the headlight pair) |
| water | `G`, `uNight`, `uHeadlightPosition`, `uHeadlightDirection` (no `uSaturation`), `uHeight`, `uSize` |
| waterfall | `G`, `uNight` only (the reference also carries an unused headlight pair; three.js ignores uniforms absent from a program, so output is identical) |
| post | its own keys, plus `uNight`, `uSaturation` by reference |
| glow sprites / headlight cone | `uNight` by reference plus their own keys |

`src/core/seeded-prng-and-gradient-noise.js` also exports `NOISE_PERMUTATION_TABLE`
(`Uint8Array(512)`) and `NOISE_GRADIENT_TABLE` (`[cos, sin][256]`), read-only by convention and
exported for tests.

## Palettes and transitions (`engine/time-of-day-palettes-and-transition.js`)

Twelve keys are written, always in this order: `uNight, uSaturation, uLightDir, uLightColor,
uShadowTint, uAmbient, uFogColor, uZenith, uHorizon, uHill, uMist, uSunColor`.

| key | day | evening | night |
|---|---|---|---|
| uNight | 0 | 0 | 1 |
| uSaturation | 1 | 1 | 2.5 |
| uLightDir (normalised) | (0.55, 0.72, 0.42) | (−0.72, 0.36, 0.4) | (−0.42, 0.8, −0.3) |
| uLightColor | (1.04, 1.0, 0.92) | (1.22, 0.96, 0.72) | (0.44, 0.56, 0.76) |
| uShadowTint | (0.5, 0.57, 0.78) | (0.46, 0.38, 0.64) | (0.22, 0.31, 0.48) |
| uAmbient | (0.55, 0.7, 0.95) | (0.95, 0.62, 0.7) | (0.26, 0.34, 0.52) |
| uFogColor | #cfe4f2 | #f2c6a6 | #344968 |
| uZenith | #4f8fde | #6b76c4 | #172740 |
| uHorizon | #cfe6f4 | #fbc596 | #405575 |
| uHill | #5e9c62 | #8c7488 | #2d4261 |
| uMist | #e4eef6 | #f6d6c6 | #354966 |
| uSunColor | #fff6d8 | #ffe0a0 | #d5e4f7 |

- `applyPalette` copies a palette into the bag in place (identity preserved).
- `beginPaletteTransition` snapshots the bag's current values as the start and keeps a reference to
  the target palette; `stepPaletteTransition` advances `elapsed` by real dt up to 3 s, eases with
  `p²(3 − 2p)`, lerps numbers with `MathUtils.lerp` and vectors/colours with `.copy(start).lerp`,
  renormalises `uLightDir`, and returns null once `p === 1`. Blending continues while paused.
- `uNight` drives everything night-related: NPR night ramp, sky stars, water/waterfall night
  colours, glow visibility, glow and cone alpha, the headlight term, sheep sleep and post ink/grain.
  `world.nightAmount` mirrors it every frame.

## NPR shading model

### Material factory (`materials/npr-cel-material-factory.js`)

`npr(options = {})` returns a cached `ShaderMaterial`. **Identity rule:** the cache key is
`JSON.stringify(options)`, so two call sites share one instance only if their option literals are
identical, including key order (`undefined` values drop out). Callers pass the exact literal shape
of each call site, never a normalised or reordered one, or merge batches and draw calls drift.

- Defaults: `color '#ffffff'`, `stipple 0.1`, `stippleScale 2.0`, `emissive 0`, `uOpacity 1`;
  `vertexColors: !!options.vertexColors`; `side` Double when `doubleSided`, else Front.
- Defines, only for truthy options, in this order: `FLOWERS, STRATA, DOUBLE_SIDED, TREE_SWAY,
  NIGHT_GLOW, LOCAL_GLOW`.
- Uniform key order: 16 `G` entries, the 3 `SHADER_NIGHT_UNIFORMS` entries (same singleton
  objects), `uColor, uStipple, uStippleScale, uEmissive, uOpacity`, then — only with
  `options.localGlow` — `uLocalGlowPosition, uLocalGlowRadius, uLocalGlowStrength`.
- Material creation order matters: material ids are the opaque render-list sort tie-breaker.

### GLSL interface

The interface (uniform/attribute names and types, `#ifdef` names, `COMMON_GLSL` function
signatures) is a parity target; shader text is written independently from formula tables and
judged on rendered output.

| shader | uniforms | attributes | `#ifdef` names |
|---|---|---|---|
| `COMMON_GLSL` | uLightDir, uLightColor, uShadowTint, uAmbient, uShadowMap, uShadowMatrix, uShadowTexel, uFogColor, uFogNear, uFogFar, uTime, uNight, uHeadlightPosition, uHeadlightDirection (14) | none | none |
| NPR vertex | `uTime` (TREE_SWAY only) | `topY` (STRATA only) | LOCAL_GLOW, TREE_SWAY, STRATA, USE_INSTANCING, USE_COLOR, USE_INSTANCING_COLOR |
| NPR fragment | COMMON + uColor, uStipple, uStippleScale, uEmissive, uOpacity; LOCAL_GLOW adds uLocalGlowPosition/Radius/Strength | none | LOCAL_GLOW, STRATA, DOUBLE_SIDED, FLOWERS, NIGHT_GLOW |
| cone vertex / fragment | – / uNight, uLength, uStrength | none | none |
| glow vertex / fragment | – / uNight | glowCenter (vec3), glowSize (vec2), glowNormal (vec3), glowStrength (float) | none |

`COMMON_GLSL` functions: `hash13(vec3)`, `hash12(vec2)`, `hash11(float)`, `vnoise(vec3)` (from
`HASH_AND_VALUE_NOISE_GLSL`, sine-free hashes and trilinear value noise), `shadowAt(vec3, vec3)`,
`headlightAt(vec3, vec3)`, `nprShade(vec3, vec3, vec3, float, float)`, `applyFog(vec3, vec3)`.

### Vertex stage

Optional tree sway (instanced and `TREE_SWAY`): phase `dot(instance xz, (0.83, 1.37))`, weight
`smoothstep(0.45, 3, position.y)`, x/z offsets from two sines each on `uTime`. Then the instance
matrix, then world position and `normalize(mat3(modelMatrix) · normal)` — the plain upper 3×3, not
an inverse-transpose (matches the merge's normal bake; deliberate for non-uniformly scaled parts).
Vertex colour = `color` × `instanceColor` where present.

### Fragment stage

1. `N` (flipped on back faces with `DOUBLE_SIDED`); base = `uColor × vertex colour`.
2. `STRATA` (terrain skirt): banded tint from `floor((y + wobble)·0.8)`, bright speckles, and a lip
   below `topY` painted grass (or sand where `topY < 0.2`).
3. `FLOWERS` (terrain surface): on lush, flat, green ground, 1.5-unit tiles with a 28 % chance of a
   pink/yellow/white bloom dot.
4. `nprShade(base, N, P, uStipple, uStippleScale)`:
   - Day part (`uNight < 1`): lit = `clamp(N·L·1.15) × shadowAt`; shade = lit + (two-octave value
     noise − 0.5)·stipple; bands at 0.16 and 0.46 between shadow tone (`base·uShadowTint`), mid tone
     (`mix(uShadowTint, 1, 0.66)`) and lit tone (`base·uLightColor`); a sparkle (`lit·1.16`) where
     shade ≥ 0.88 and stipple ≥ 0.25; + `uAmbient·base·(0.5 + 0.5·N.y)·0.16`.
   - Night part (`uNight > 0`): base desaturated 78 %, moon term `smoothstep(−0.35, 0.85, N·L) ×
     mix(0.62, 1, shadow)` between shadow tint and light colour, + a small ambient; mixed in by
     `uNight`.
   - `+ base × headlightAt(P, N)`.
5. `uEmissive` mixes toward `base·1.1` by `emissive·(1 − uNight)`; `NIGHT_GLOW` mixes toward
   `base·(1.3, 1.02, 0.75)` by `uNight`; `LOCAL_GLOW` adds a pulsing orange term
   (`0.9 + 0.06 sin 9t + 0.04 sin 17t`) fading over `uLocalGlowRadius` in local space, × `uNight`.
6. `applyFog`: `smoothstep(uFogNear, uFogFar, distance to camera)·0.85` toward `uFogColor`.

`shadowAt`: offset the point 0.12 along the normal, project with `uShadowMatrix`, outside [0, 1]
counts as lit, 3×3 PCF with bias 0.0006. `headlightAt`: zero by day; cone
`smoothstep(0.86, 0.97, cos)` × reach `(1 − smoothstep(8, 25, d))/(1 + 0.025 d²)` × facing ×
`uNight × 2.8`, tinted (1, 0.78, 0.42).

## Sky, shadow pass, post pass and pixel art

### Sky dome (`materials/procedural-sky-dome-material.js`)

`SphereGeometry(700, 32, 16)`, `BackSide`, `depthWrite: false` (sky pixels read back as far-plane
depth, so the post outline finds no edge there), follows the camera every frame, hidden from the
shadow pass. Fragment, from the view direction: horizon→zenith gradient over
`smoothstep(0, 0.55, y)`; sun glow `pow(max(v·L, 0), 18)·mix(0.35, 0.06, uNight)` and a hard disc
at `smoothstep(0.9975, 0.998)` (the night `uLightDir` makes it the moon); stars at night above
y 0.05 (hash of `floor(dir·260)` ≥ 0.993, round points, faded in over y 0.05–0.3); three ridge hill
bands painted back to front from a four-harmonic `ridgeProfile` plus jitter; mist below the
horizon via the ascending-edge form `1 − smoothstep(−0.25, −0.02, y)` (mathematically equal to the
reversed-edge form, avoiding GLSL's undefined `edge0 > edge1`). No fog, no shadow sampling.

### Shadow pass (`engine/custom-shadow-depth-pass.js`)

A custom depth render instead of three.js shadows: 2048² `WebGLRenderTarget` with a
`DepthTexture`, `OrthographicCamera(−82, 82, 82, −82, 1, 360)` placed at `uLightDir·170` looking at
the origin, and one override `MeshBasicMaterial({side: DoubleSide, colorWrite: false})`. Each
render: write `uShadowMatrix = Bias · P · V`, save and hide every `shadowHiddenObjects` entry, render
the scene with the override material, restore visibility. The override has no vertex animation, so
tree shadows do not sway. Hidden from the pass: sky, sparks, `world.noShadow` (111 entries: glows,
house smoke, water, waterfall, balloon flames and burner glow), `train.noShadow` (cab glass, lamp
halos, headlight cone, coach halos) and the 70 locomotive puffs.

### Post pass (`engine/post-ink-outline-dither-pass.js`)

Full-screen quad (`PlaneGeometry(2, 2)`, `frustumCulled = false`) with `depthTest`/`depthWrite`
off, sampling `mainRT` colour and depth. Uniforms: `tColor, tDepth, uRes, uNear (0.3), uFar (1500),
uOutline, uThick, uPixel, uNight, uSaturation`.

1. Ink outline: inverse linear depth at the pixel and its four neighbours at `uThick/uRes`;
   Laplacian `(4w0 − Σ)/w0`; ink weight `uOutline·smoothstep(0.006, 0.02, lap)`; colour mixed toward
   `col·(0.22, 0.20, 0.28)` by weight × `mix(0.9, 0.28, uNight)`.
2. Saturation around Rec. 709 luma by `uSaturation` (2.5 at night), clamped.
3. Pixel mode: 4×4 Bayer ordered dither (built from a 2×2 cell:
   `bayer2(c) = 0.5c.x + 0.75c.y − c.x·c.y`, `bayer4 = bayer2(inner) + 0.25·bayer2(outer)`) and
   posterise to 14 levels. Native mode: per-pixel grain `mix(0.975 + 0.05·hash, 1, uNight)`.
4. Vignette: `smoothstep(0.45, 1.05, 1.35·|uv − 0.5|)` toward `mix(0.84, 0.94, uNight)`.

### Pixel art and resize (`engine/render-resolution-resizer.js`)

`computeRenderResolution(width, height, dpr, shortSide)`: native size = CSS size × dpr; with a
short side (720/540/360) the scale is `min(1, shortSide / min(nativeW, nativeH))`; render size is
floored (≥ 1); outline thickness is 1 in pixel mode, else `max(1, 0.9·dpr)`. `resizeDiorama` sets
the canvas size, `mainRT` size, the colour texture's min/mag filter (Nearest in pixel mode, else
Linear; depth stays Nearest), `uRes`, `uThick`, `uPixel` and the camera aspect. Quirk kept: the
filter swap reaches WebGL only on the next render-target size change.

## Night-glow registry (`engine/night-light-glow-registry.js`, `effects/*`)

- `createLightGlows(lights)`: one instanced view-facing halo mesh per call. Each light is
  `{position, size, normal, strength}`; an all-zero normal is omnidirectional, a non-zero one fades
  the halo when seen from behind (`smoothstep(0, 0.4, facing)`). The `InstancedBufferGeometry` is
  allocated before its template `PlaneGeometry(1, 1)` (whose index/position/uv attributes it
  shares); the bounding sphere is derived from each halo's reach box. Fragment: Gaussian core × rim
  cut, tint (1, 0.78, 0.45), alpha × `uNight`.
- `createLightCone({length, radius, strength})`: open `CylinderGeometry(radius, 0.12, length, 48)`
  along +z, `BackSide`, alpha = rim fade × axial fade × `uStrength × uNight`, tint (1, 0.8, 0.48).
- Both materials are named `'night-light-glow'` and spread `ADDITIVE_GLOW_RENDER_STATE`. They are
  always `transparent: true`; this is load-bearing, because the static merge bakes only
  non-transparent meshes.
- `collectNightLightGlows(scene)` traverses once after composition and keeps every mesh with a
  `ShaderMaterial` of that name, in scene order: station window halos, station lamp halos, 8 house
  window halos, the balloon burner glow, then the train's six (locomotive lamp halos, headlight
  cone, four coach window halos) — 17 meshes. `applyNightGlowVisibility` sets `visible = uNight > 0`
  every render; invisible glows cost no draw calls by day.

## Static geometry merge (`geometry/merge-static-geometry-by-material.js`)

`mergeStaticGeometry(root, excluded = new Set())` walks `root`'s descendants pre-order (the root's
own transform is never baked) and bakes every eligible mesh (`isMesh`, has a `uv` attribute,
`!material.transparent`) into one merged `Mesh` per material, appended to `root` in first-seen
material order. Kept behaviours:

- Excluded subtrees are neither visited nor `updateMatrix()`ed; their `.matrix` stays stale.
- Removing a merged source drops its whole subtree, including any non-merged (e.g. transparent)
  children; emptied groups stay in the tree.
- Normals are rebuilt from the original normal attribute with the plain upper 3×3 of the
  accumulated matrix (`Matrix3.setFromMatrix4`), not an inverse-transpose, matching the NPR vertex
  shader.
- Non-indexed geometry gets a sequential index; a mirrored subtree (`det < 0`) has its winding
  flipped.
- A missing `normal` attribute on an eligible mesh throws a `TypeError` (unguarded read, as in the
  reference) and stops the walk; `mergeGeometries` returning null throws
  `Static geometry attributes must match`.

Merges in the scene: the station building (minus the clock-hand pivots), each village house (minus
every smoke puff registered so far), each resident's head/arms/legs/body and the dog, each train
car (minus its wheels), the balloon (minus the envelope), the station traveler and grandmother
parts. `colorize` deletes `uv`, so vertex-coloured trees, rocks and shrubs are never merge-eligible.

Geometry helpers (`procedural-geometry-helpers.js`): `box(w, h, d, material, x, y, z, parent)`;
`colorize(geometry, color, flat = true)` (expands indexed input, drops uv, faceted normals, constant
colour); `tintGeometry` (bird variant: expands and disposes indexed input, keeps uv/normals);
`jitter(geometry, amount, seed)` (sin-hash radial wobble). `extrude(frames, profile, caps)` sweeps a
closed profile along `{p, r, u}` frames with hard edges and no uv. `addWallVent` / `addRoofVent`
build louvred and capped vents.

## Random streams

| stream | seed / source | drawn by |
|---|---|---|
| noise tables | `mulberry32(1337)` at module evaluation | 255 Fisher–Yates draws (512-entry permutation), then 256 gradient angles |
| `world.rand` | `mulberry32(42)`, created in the `World` constructor before any build step | village, windmill, trees, rocks, pasture sheep, clouds |
| birds | `mulberry32(7821)`, one per `createBirdSystem` | 3 draws per bird (size, phase, heading) |
| `Math.random` | browser / node | three.js UUIDs (4 per object), smoke puffs (7 per launch), brake sparks (4 per spark); tests reseed it per side |

`fbm(x, y, oct = 4)` sums `noise2` octaves with lacunarity 2.03 and halving amplitude, normalised
and multiplied by 1.6; `smoothstep(a, b, x)` accepts reversed edges (`a === b` yields NaN).

### `world.rand` draw order across the 16 build steps

| step | draws |
|---|---|
| 1–6 `buildTrackFrames`, `findBridge`, `buildHeightmap`, `buildTrack`, `buildBridge`, `buildStation` | none |
| 7 `buildVillage` | per try: angle, radius (2); per accepted house: width, depth, wall height (3), smoke base phase (1), 12 puffs × 5 (driftX, driftZ, wobble, size, spin). 8 houses in 256 tries → stream at draw 1024 |
| 8 `buildWindmill` | always 300 × (x, z) = 600 → 1624 |
| 9 `buildTerrain`, 10 `createVillageResidents` | none |
| 11 `buildTrees` | per attempt (14000): x, z; per open site: accept roll; per accepted tree: type roll (drawn even when high ground forces a conifer), size, yaw, stretch, tint index, and for non-conifers two accent rolls (autumn 0.04, blossom 0.02) → 78587 |
| 12 `buildRocksAndSheep` | rocks: per attempt x, z; per placed rock size + 3 Euler angles; stops when 80 are placed → 84673. Pasture sheep: per attempt x, z; per accepted sheep direction, size, phase, speed, turnSpeed; 24 sheep in 450 attempts (1020 draws) → 85693. The trackside clearing draws nothing |
| 13 `buildWater` | none |
| 14 `buildClouds` | per cloud: blobCount, clusterCount, 8 per blob (size, y-squash, 2 for x, 2 for y, 2 for z), position (3), speed (1, the cloud's last). Clouds are the last consumer: after a full build the next draw is 0.23735972004942596 on both sides, so equal cloud layouts prove every earlier draw |
| 15 `buildBalloon`, 16 `buildBirdPerches` | none |

## World (`src/world/`)

### World class (`world/world.js`)

Constructor field order (part of the parity surface): `group`, `noShadow`, `N` (1200), `frames`,
`heights` (Float32 201²), `bridge`, `stationS`, `exclusions`, `buildingFoundations`,
`windmillBlades` (Group), `clouds`, `treeLayers`, `houseSmoke`, `stationTravelers`, `sheepStates`,
`nightAmount`, `sheepTransforms` (17 scratch objects), `trackSheep`, `sheep`/`sheepLegs`/
`sheepEars` (null until built), `balloon` (Group), `birdPerches`, `rand = mulberry32(42)`, then
`runWorldBuildSteps(this, options)`. Only three `Object3D` are created here (group, windmill
blades, balloon). Fields added by builders: `curve`, `length`, `sx`/`sz`, `trackNearestGrid`,
`freeCameraStart`, `stationSite`, `stationWalker`, `stationClock*`, `villageHomes`,
`windmillRoofHeight`, `heightTex`, `villageResidents`, `treeCanopyHeights`, `balloonFlame`.

Queries: `nearest(x, z)` → `{i, d}` (stride-8 scan, then a ±8 wrapped refinement; ties keep the
earlier sample), `inBridge(i)`, `heightAt(x, z)` (bilinear over the grid, clamped just inside the
far edge), `excluded(x, z, pad = 0)` (any keep-out circle grown by `pad`), `pointAtS(s, target?)` /
`tangentAtS(s, target?)` (arc length wrapped into [0, 1)), `flattenBuildingGround(pad)`,
`sheepGroundAt(x, z, normalOut)`, `treeCanopyHeightAt(x, z, r)`, `update(...)`,
`updateCloudCamera(cameraPosition, dt)`.

### Build registry (`world/world-build-steps.js`)

```
 1 buildTrackFrames        curve, length, frames[0..1200], sx/sz
 2 findBridge              bridge = [first, last] frame span
 3 buildHeightmap          graded heights + trackNearestGrid
 4 buildTrack              ballast, 2 rails, sleepers
 5 buildBridge             deck, girders, handrails, posts, arch ribs, columns, braces, piers, abutments
 6 buildStation            station group, figures, walker, pads, footpath, exclusions
 7 buildVillage            8 houses, smoke, shrubs, villageHomes
 8 buildWindmill           site, pad, body, bales, rotor
 9 buildTerrain            surface, skirt, plinth, heightTex (bakes after every pad)
10 createVillageResidents  residents on the first two homes + yard exclusions
11 buildTrees              4 instanced layers + canopy grid
12 buildRocksAndSheep      rocks, then the sheep flock
13 buildWater              water quad + waterfall curtain
14 buildClouds             33 clouds (last world.rand consumer)
15 buildBalloon            balloon, flame, burner glow
16 buildBirdPerches        bridge, station roof, trackside perch records
```

`WORLD_BUILD_STEPS` is a frozen array of writable `{name, run}` entries; `runWorldBuildSteps` reads
`step.run` at call time, so tests can wrap a step. Options `{stopAfter, skip}` exist for partial
test builds: unknown `skip` names are ignored, an unknown `stopAfter` throws
`Unknown world build step: <name>`, and a skipped stop target still stops.

### Final layout of a full build

- `world.group`: 111 children. Track/bridge meshes 0–48, station group 49, footpath 50, houses
  51–58, shrubs 59, windmill 60, terrain surface/skirt/plinth wood/plinth trim 61–64, resident homes
  65 (woman) and 66 (man and dog), tree layers 67–70, rocks 71, sheep body/legs/ears 72–74, water 75,
  waterfall 76, 33 clouds 77–109, balloon 110.
- `world.noShadow`: 111 entries (station window halos, station lamp halos, per house its window
  halos then 12 smoke puffs, water, waterfall, two flame cones, burner glow).
- `world.exclusions`: 41 (26 footpath circles r1.8, the station disc r8, 8 houses r2.6, windmill
  r4.5, 2 resident yards r2.2, 3 rail sheep r1.2).
- `world.buildingFoundations`: 11 pads (station building, stair landing, 8 houses, windmill).
- The core steps (track, bridge, terrain) create 53 meshes, 53 geometries and one `DataTexture`
  with its `Source`; with the group, windmill blades and balloon that is 111 UUIDs (444 draws) on a
  warm npr cache.

### Track (`world/track/`)

- 14 control points (`TRACK_CONTROL_POINTS`) form a closed centripetal Catmull-Rom loop,
  counter-clockwise from above, front straight at z = 36, station near (−45.5, −2). Sampled into
  N + 1 = 1201 arc-length frames `{p, r (outward = tangent × up), u}`; the last wraps to u = 0 to
  close extrusions. `sx`/`sz` are Float32 caches of the first N sample positions.
- `findBridge`: the longest run of frames where natural ground is 2.6 below the rails and the river
  is within 20, padded by 3 frames each end (start clamped at 0, end unclamped); strictly longer runs
  win, so the earliest equal run is kept. Result: frames [30, 178].
- `buildTrack`: ballast extrusion (`#a39a8c`, double-sided), two rails at ±0.52 (`#8f8f9e`), one
  `InstancedMesh` of `BoxGeometry(1.9, 0.12, 0.32)` sleepers every 0.72 of arc length
  (`floor(length/0.72)` = 383), lifted 0.08. npr request order: ballast, rail, sleeper.
- Quirks kept: the ≈1.09 sleeper seam gap before s = 0; `nearest` error up to ≈0.115.

### Terrain (`world/terrain/`)

- `naturalHeight`: `6 + 6.5·fbm(0.028x + 3.1, 0.028z − 7.3, 4)`, a rim rise `11·smoothstep(0.6,
  1.3, r/HALF)`, hills at (−24, −16) and (24, −10), then lerp toward −1.4 by the river valley
  `1 − smoothstep(2.5, 17, riverDist)`. `riverDist` = min(distance to the pond rim (−4, −6, r8),
  distance to the 4-segment river polyline). `POND`/`RIVER` stay unfrozen and grid passes use flat
  loops (frozen constants in the hot path and nested one-shot loops sent V8 into deopt loops).
- `buildHeightmap` (201² grid over 124 units, `gridCoordinate(i) = −62 + i·0.62`): caches the
  nearest track sample per vertex (`trackNearestGrid = {index: Uint16Array, distance:
  Float64Array}`), then grades: on the bridge span carve to `min(natural, rail − 1.8)` within 3.5;
  elsewhere ease onto `rail − 0.42` with `1 − smoothstep(2.3, 7.5, d)`.
  `ensureTrackNearestGrid` builds the cache lazily when grading was skipped; pads and terrain colours
  read it instead of re-running `nearest()`, bit-identically.
- `flattenBuildingGround(pad)`: rectangle = footprint/2 + 0.8 margin, rotated; weight
  `1 − smootherstep(outside, 0, falloff)`, × `smootherstep(dist to each earlier pad, 0, 0.8)`, ×
  `smootherstep(track distance, 2.3, 3.5)`; heights lerp toward the pad height; the pad is appended
  to `buildingFoundations` (field order `x, z, height, halfWidth, halfDepth, rotation, falloff`).
  Pad order: station building → stair landing → houses → windmill → `buildTerrain`.
- `buildTerrain`: the surface mesh (indexed grid, Float32 positions, vertex colours from height
  bands low/mid/high wobbled by fbm, rock on slopes > 0.3, a dirt band within 3.4 of the track off
  the bridge, sand-to-rock in the river bed; `npr({vertexColors, stipple 0.42, stippleScale 1.3,
  flowers})`), the strata skirt (walls from the rim down to y −7 with a `topY` attribute,
  `#9a6a44`, `strata`, double-sided), the plinth (wood slab and trim slab boxes), and `heightTex`: a
  201² `RedFormat` byte texture of `(h + 3)/12`, Linear filtered, read by the water shader.
- Float32 storage points: `heights`, `sx`/`sz`, terrain positions (colour inputs are read back from
  them), the terrain's own `trackD`, normals/colours, skirt positions. Track distances stay Float64
  for pad weights.
- Quirks kept: the heightTex half-texel shift and 8-bit quantisation; `heightAt` is bilinear while
  the mesh splits cells along a diagonal.

### Bridge (`world/bridge/`)

Materials red `#b8432f`, darkRed `#8a2f24` (both double-sided), stone `#b9ae98`. Deck extrusion
(darkRed) and per side a girder and a handrail along the curved deck frames; railing posts every
fourth frame at ±1.67 (one `InstancedMesh`, 76 posts). The arch follows the straight chord between
the end frames: springs at chord fractions 0.13 and 0.87 sunk 0.6 below the pre-pad graded ground,
crown 1.35 below the mean deck height, a parabola over the sloped spring line. Two rib extrusions at
±1.15 (48 steps, capped), then per span i = 1..round(len/1.7)−1 spandrel column pairs inside the arch
(height > 0.25; a cross brace on even i) or approach pier pairs outside (height > 0.5), then two
stone abutments. Quirks kept: the arch lies in the chord plane (the track deviates up to 0.77) and
the springs are asymmetric.

### Station (`world/station/`, figures in `life/station/`)

```
buildStation(world)
 ├ placeStationSite        nearest sample to (−45.5, −2) = frame 1008; stationS = distance + 4.5;
 │                         group at p + r·side·2.7, lookAt along the track before attaching;
 │                         freeCameraStart; world.stationSite
 ├ createStationMaterials  platform, edge, wood, darkWood, green, cream, roof (npr request order)
 ├ platform + edge → shelter → bench
 ├ building shell (pad #1) → windows (halos → noShadow) → façade trims → clock
 ├ mergeStaticGeometry(building, {minute pivot, hour pivot})   9 batches: cream, roof, green, darkWood,
 │                                                             window, shutterWood, shutterPanel, wood, platform
 ├ name board → sign (canvas)
 ├ traveler (old man) → createPlatformWalker → stationTravelers[0] = {figure, head, 0.8, 0} → his suitcases
 ├ grandmother (shares the traveler's shoulder geometry) → stationTravelers[1] = {figure, head, 0.7, 1.7} → case stack
 ├ lamps (3 shared geometries; halos → noShadow)
 └ stairs (landing pad #2) → footpath ribbon (26 × r1.8 exclusions; mesh in world.group) → r8 station exclusion
```

- **Frames and the platform extension.** Station local +z runs along the track, local +x = −r;
  `localOutward` o = −side = −1. `PLATFORM_EXTENSION` E = `2.6·1.3 − 2.6` = 0.7800000000000002 (the
  computed float, never the literal 0.78). Parts on the widened platform use `x = a·o + o·E`
  (`shiftedX`, `addShiftedBox`); the slab, edge, building and stairs are not shifted; the lamp-halo
  mesh moves to x = o·E while its instance centres keep the unshifted x. `freeCameraStart` is taken
  before any shift; no `world.rand` draw happens in the station.
- **Order effects.** `world.group` gains the station group (70 children: 69 meshes + the building)
  and the footpath mesh. Material creation order: the base set, window glass, shutter wood, shutter
  panel, the sign's `MeshBasicMaterial`, the traveler outfit, suitcase leather and trim, the
  grandmother's outfit (dress, shawl, handbag, skin, grey hair, trim), the stack leathers, lantern,
  footpath.
- **Sign.** 1024×256 canvas painted synchronously through `document` (20 context writes; text
  `Mossbrook`, `R A I L W A Y   S T A T I O N`, `VALLEY LINE  ·  EST. 1892`, a `PLATFORM 1` badge;
  Fredoka with a sans-serif fallback), `CanvasTexture` (sRGB, anisotropy 4) on an unlit
  `MeshBasicMaterial` DoubleSide plane, so it ignores night, fog and shadows and renders darker than
  its hex values under disabled colour management. No 2D context → throws
  `Station name canvas context unavailable`. Whatever fonts are ready at build time are used; the
  parity hook records that state.
- **Clock.** `updateStationClock(world, t)`: minute `rotation.x = (dir·t·2π)/60`, hour
  `dir·(π/2 + (t·2π)/720)`, dir = o. Fresh hands sit at 12:00; t = 0 gives 3:00.

### Village (`world/village/`)

```
buildVillage(world)                                     first world.rand consumer
 ├ createVillagePalette()  cream, 5 roofs, dark, window glass, shutterWood (= the station's), shutterPanel,
 │                         shutter/panel boxes, jittered puff Ico, smoke, stone, leaves, petals, flower Ico
 ├ while houses < 8 and tries < 600: angle = r·2π, radius = 11 + r·14 around the pond (2 draws)
 │    reject without drawing: height ∉ [0.9, 9] → slope over ±1.5 > 2.2 → nearest track < 6.5
 │      → another house within 5 → excluded(·, 3)
 │    accept: Group at (x, h, z) looking at the pond → W, D, H (3 draws) → window halos (→ noShadow)
 │      → flattenBuildingGround (yaw atan2(pond − site), falloff 2.8) → addHouseShell (roof n mod 5)
 │      → registerChimneySmoke (1 + 12×5 draws; puffs → noShadow, houseSmoke) → door and trim
 │      → windows (shutter angle index (3n + 2w + (side+1)/2) mod 4)
 │      → mergeStaticGeometry(house, every puff so far) → world.group.add → exclusion r2.6
 ├ fewer than 2 houses → Error 'Village residents require two houses'; villageHomes = first two footprints
 └ buildVillageShrubs      one InstancedMesh (6 per house, house-local spots; size/tint/yaw by running index, no draws)
```

- 8 houses; per house 9 merged meshes in first-encounter order (cream, roof, shutterWood, dark,
  flowerPetals, stone, window glass, flowerLeaves, shutterPanel); vent and shutter groups stay
  behind empty; halos and puffs stay separate.
- Chimney smoke (slot 8): cycle = elapsed/3.5 + phase, house-local drift/bob/wobble, rise 3 per
  cycle, scale envelope `smoothstep(0, 0.12) × (1 − smoothstep(0.72, 1))`, spin += spin·dt;
  allocation-free. Puffs are opaque, fade by scale only, and still issue draw calls at scale 0.
- Quirks kept: shrub heights are sampled after every house pad but before the windmill pad;
  shutter angles repeat every 4 houses; hard throw below 2 houses.

### Windmill (`world/windmill/`)

`findWindmillSite`: 300 × (x, z) in (24, −10) ± 8 (always 600 draws), skip track distance < 8, the
strictly highest `heightAt` wins. Group at site − 0.3 y, looking at (0, y, 30); pad 3.64² with yaw
`atan2(−x, 30 − z)` and falloff 3.5. Materials tower, foundation, roof, sail (double-sided), wood.
Tower, foundation ring, cap; `windmillRoofHeight = group y + cap y + 0.8` (22.266444503377606,
which also sets the cloud band heights); doorway (door, jambs, lintel, plank, knob, two steps); two
hay-bale stacks (3 and 2 bales, each 0.05 below the ground under its origin, sampled after the
windmill pad); the rotor on `world.windmillBlades` at (0, 5.4, 1.3): 4 arms (spar, sail) and a hub
sphere. Unmerged: 65 meshes. Exclusion r4.5. Slot 9 turns the rotor `rotation.z −= dt·0.9`
(≈7 s per turn, clockwise from the front).

### Trees (`world/trees/`)

- `createTreeSpeciesGeometries`: conifer (trunk + 3 cones), round (trunk + crown), cluster (trunk +
  3 crowns), bush (one crown); crowns are jittered icospheres; every part is `colorize`d and each
  species merged into one non-indexed geometry.
- `scatterTrees`: 14000 attempts over ±(124 − 1.5)/2; filters ground ≥ 0.7, track gap ≥ 4 (3 on the
  bridge), not excluded, slope over ±0.8 ≤ 2.4; acceptance
  `smoothstep(−0.1, 0.35, fbm + 0.45·rim ramp + 0.2 above 11)·0.92 + 0.02`; species by roll
  (cut-offs 0.22/0.55/0.8), forced conifer above 12; size 0.75–1.5, random yaw, stretch 0.9–1.2;
  one of five tints, autumn (2.0, 1.05, 0.5) or blossom (2.3, 1.2, 1.6, wins) on non-conifers.
- Layers: `npr({vertexColors, stipple 0.55, stippleScale 2.4, treeSway})` for the three tree species,
  the same minus `treeSway` for bushes; one `InstancedMesh` per species, pushed onto
  `world.treeLayers` (filled in place; the debug menu holds the array).
- Measured: 3749 conifers, 1215 round, 932 cluster, 769 bushes (autumn 46/36/26 and blossom
  18/15/18 on round/cluster/bush).
- Canopy grid: 2-unit cells over ±70 (70² Float32), each instance stamps its bounding box × the
  double-precision matrix, padded by 0.6 for sway, in species-then-push order (3478 non-zero cells,
  max 26.08). `treeCanopyHeightAt(x, z, r)` = max over the covering cells starting from 0 (low index
  clamped from below, high from above, so a square off the grid is empty and returns 0, not ground
  height).
- Quirks kept: instance tints colour trunks too; tree shadows do not sway; rocks and trees ignore
  each other.

### Rocks (`world/rocks/`)

`buildRiversideRocks`: `colorize(jitter(DodecahedronGeometry(0.6), 0.4, 9), '#9d978c')`,
`npr({vertexColors, stipple 0.3, stippleScale 3})`, capacity 80, up to 3000 attempts over 95 % of
the base, ground in [−0.3, 1.2] and not excluded; size 0.4–1.5, random tumble, y-squash 0.7;
`count` = placed (80). Rocks may sit partly below the water plane.

### Water and waterfall (`world/water/`, `materials/water-*`)

- Water: `PlaneGeometry(124, 124, 1, 1)` rotated flat at y 0, unlit, opaque, `FrontSide`.
  Fragment: ground `h = 12·R − 3` sampled at `(xz + 62)/124` (no half-texel correction); discard
  where h > 0.08; shallow→deep over `smoothstep(0.15, 1.5, −h)`; ripple crest
  `step(0.76, 0.7·n1 + 0.3·n2)` mixed 0.75 toward the ripple tint; shore foam where
  `−h + 0.35·(n − 0.5) ≤ 0.18`; × `mix(1.1·uShadowTint, 1, shadowAt)` (cloud shadows land on water);
  moonlit colours by `uNight`; + headlight × (0.48, 0.65, 0.75); fog.
- Waterfall: the x-range of below-zero ground on the last heightmap row (columns 92..109, x −4.96 to
  5.58) gets a 24 × 8 curtain from the lip (z 62.05) dropping 18 and bowing out by `1.35·√drop`, uv v
  = 1 at the lip. Fragment: streak noise `(14u, 2.5v + 2.2t)` and detail `(30u, 6v + 3.5t)`,
  light/dark blue, white spray, white sides, a foot splash, night blend, fog. `DoubleSide`.
- Both run on `G.uTime` (sim time) and freeze while paused; both are in `world.noShadow`. The water
  uploads `heightTex`, which brings the texture count to 6.
- Quirks kept: the shoreline half-texel offset (≈0.31 units) and 8-bit height quantisation
  (≈0.047 units); the waterfall drops to y ≈ −18, far below the plinth base.

### Clouds (`world/sky/`)

- `buildClouds`: one material `npr({color '#ffffff', stipple 0.22, stippleScale 0.7})`, one
  `IcosahedronGeometry(1, 1)`. Bands in spawn order: 8 high clouds (roof + 15..25, z −18..57,
  travel 220), 7 far clouds (roof + 7..19, z −73..−43, size 1.6), 18 low-bank clouds (y −4..0 past
  the front edge, travel 124). Per cloud: 8–12 blobs in 2–3 clusters, 4 edge accents (no draws),
  position, speed; the temporary meshes are baked into one `InstancedMesh(blobs + 4)` with sphere
  colliders, a radius and a bounding sphere; scale starts at 0. 33 `CloudState` records in
  `world.clouds`.
- Slot 10 `updateCloudDrift(clouds, dt)` (sim time): age, +x drift, wrap at x > travelWidth/2 (the
  avoidance offset is zeroed), scale = size × edge fade-in × fade-out × `smoothstep(0, 2, age)`.
- `updateCloudCamera(clouds, cameraPosition, dt)` (real clamped dt, every frame, also paused):
  decay = `exp(−1.8·dt)` once per call; each offset ·= decay, snapped to 0 below 1e−10 squared;
  group = position + offset. Clouds at scale 0 or hidden by the debug menu stop there. Within
  `radius·s + 1.5` (`Math.hypot`), the push direction is the offset's own (else away from the
  camera, else +x) and the push is the largest `√(along² + reach² − |c|²) − along` over every
  buffered blob sphere the line meets, applied only if at least one sphere contains the camera.
- Quirks kept: scale-0 clouds inside a frustum still cost a draw call per pass; a wrap zeroes the
  offset (an invisible pop at the band edge); avoidance assumes uniform scale and no rotation.

### Balloon (`world/balloon/`)

- Envelope: a 9-point lathe profile with 14 sectors → `toNonIndexed()` (the indexed lathe is
  discarded), no uv, smooth normals, colour per 6-vertex quad: red `#d93f36` when sector + row is
  even, else cream `#fff4e4` (336/336). Basket (185 boxes), pilot group at (−0.12, −2.9, 0.13) scale
  0.64, 4 ropes, 4 sandbags. All use `LOCAL_GLOW {position (0, −1.9, 0), radius 4.5, strength 0.65}`
  and merge into balloon-local space in 9 batches (basketTrim, wood, wicker, jacket, jacketTrim,
  skin, hair, rope, bag); the envelope is excluded; the passenger group stays empty.
- Burner bar and can (outside the local glow and the merge), `balloonFlame` (two `NIGHT_GLOW`
  emissive cones, noShadow) and a burner halo (`createLightGlows`, noShadow, joins the glow
  registry). The balloon is the last child of `world.group`.
- Slot 11 `updateBalloonFlight(world, elapsed)`: position `(34 cos θ, 27 + 1.2 sin(t/2),
  26 sin θ − 4)` with θ = 0.035t; yaw 0.1t regardless of heading; flame `scale.y = 0.9 + 0.06 sin 9t
  + 0.04 sin 17t`. Closed-form, allocation-free.

### Bird perches (`world/perches/`)

Step 16 produces every perch record `{id, positions, outward, trackDistance}` from finished data
(frames, bridge span, station transform, final heights, exclusions never change after creation):

- Bridge flocks `bridge-1..3` at span fractions [0.12, 0.19, 0.32], [0.43, 0.48], [0.69, 0.84, 0.89],
  on the rail top at ±1.67 (even flocks on the right rail).
- `station-roof`: three shelter-roof spots mapped through the station group, then shifted by
  `outward·E` in world space.
- Trackside clusters at loop fractions 0.08, 0.36, 0.56, 0.73: each seed scans 60 frames in steps of
  3 for a spot off the bridge, on dry ground within 2.5 of rail height, not excluded and ≥ √0.45 from
  accepted spots. An empty cluster keeps its number, so ids follow the cluster index:
  `trackside-1` (all candidates on the bridge) is dead, leaving `trackside-2..4`.

Seven flocks, 18 birds. The reference records bridge and roof perches inside its bridge and station
builds; producing all of them last gives bit-identical records, but a build stopped at or before
`buildStation` has no perches in the clone.

## Train (`src/train/`)

```
new Train()                              object/material/geometry ids follow this order
 ├ group, cars, noShadow, chimney, headlight, front/rear scratch vectors
 ├ createTrainMaterials()                13: black, red, supportRed, gold, silver, roofMaterial, glow,
 │                                       cabGlass (MeshBasic, transparent 0.26), driverCoat, driverSkin,
 │                                       driverHat, ravenFeathers, ravenWings
 ├ locomotive Group
 │  ├ buildLocomotiveBody   shell + glazed cab (3 glass planes → noShadow) → driver and raven → cab fittings
 │  ├ buildLocomotiveFront  door + 10 bolts (1 shared Ico) → buffers → hook/beam → cowcatcher (no uv)
 │  │                       → 5 pilot bars → 3 lamps → halos (→ noShadow) → headlight anchor (0, 2.1, 2.5)
 │  │                       + cone {length 18, radius 4.5, strength 0.2} (→ noShadow)
 │  ├ createWheelParts()    6 shared geometries (44 wheel groups use them)
 │  ├ buildLocomotiveWheels per side: 3 drivers, pony, static coupling rod (wheel order = spark round-robin)
 │  └ chimney anchor (0, 2.9, 1.95)
 ├ buildTender(m)                        length 2.7
 ├ createCoachMaterials() (cream band with nightGlow, gray, windowBar) → window-grid template
 ├ per COACH_COLORS (maroon, maroon, green, maroon): body material → buildPassengerCoach
 │                                       (length 4.6, 8 wheels, 12 window halos in one mesh → noShadow)
 ├ mergeStaticGeometry(car.obj, wheel meshes) per car, only after all six cars exist
 └ offsets 0 / 4.1 / 8.2 / 13.25 / 18.3 / 23.35 (half lengths + 0.45 gap); totalLength = last offset + half length
```

- **Part tables.** Builders describe parts as rows `[shape, args, material, x, y, z, extras]`
  emitted by `addParts` (`train-mesh-helpers.js`): a list-valued coordinate emits one part per value
  with a fresh geometry each; per-side blocks run the whole block for side −1, then +1 (x mirrored);
  extras bake a geometry transform, set scale or `rotation.x`, or push onto `noShadow`.
- **Ids and UUIDs.** Every object, material and geometry id matches the reference relative to each
  counter's start, and the `Math.random` total (9652) is equal. The clone creates all 13 materials up
  front while the reference creates cab glass, driver and raven materials inline, so the UUIDs of the
  locomotive group, its 3 glass planes (meshes and geometries) and those 6 materials differ; every
  later node gets the same UUID. UUIDs never reach rendering.
- **Placement.** `update(world, s)`: per car d = s − offset, front/rear = `pointAtS(d ± 0.34·len)`,
  position = midpoint, `lookAt(front)`, every wheel `rotation.x = d/r`. `s` is never wrapped.
- **Station motion** (`train-station-motion-controller.js`, pure over `{s, speed, stopTimer,
  justLeft, speedMul}`): dwell while `stopTimer > 0` (speed 0; the step that ends it sets
  `justLeft`); `justLeft` clears only for 30 < ahead < L − 30; braking when not `justLeft`,
  ahead < 26 and top speed > 0, target `max(0.35, 7.5·speedMul·√(ahead/26))` (speed snaps down to a
  lower target); response `min(1, 0.9·dt)`; when the step reaches the stop it snaps exactly onto it
  and starts a 4 s dwell.
- **Brake sparks** (`brake-sparks.js`): strength = `min(1, ((prev − speed)/dt)/3)` while station
  braking above speed 0.1 and slowing, else 0. Emission `(40 + 140·strength)·1.4` per second into a
  ring of 269 instanced unit boxes (`MeshBasicMaterial #ffe56b`, `frustumCulled = false`), launched
  round-robin from the locomotive wheel rims (the loco world matrix is refreshed first), 4
  `Math.random` draws each (kick x, y, z, lifetime 0.7–1.15 s), gravity 9.8, bounce on the terrain
  heightmap (×−0.48 up, ×0.7 drag), velocity-aligned streaks shrinking with life.
- **Smoke puffs** (`locomotive-smoke-puff-pool.js`): 70 meshes (`IcosahedronGeometry(0.5, 1)`,
  `npr({color '#fbfbff', stipple 0.3, stippleScale 2.2})`) added straight to the scene. The pool owns
  the timer; interval `(stopTimer > 0 ? 0.55 : max(0.07, 0.3 − 0.03·speed))/1.2`, emitting only when
  moving above 0.1 or dwelling; a launch takes the chimney world position and draws 7 values
  (lifetime 2.4–3.6, size, velocity xyz, spin xy); puffs rise, drift +x 0.8/s, swell and collapse.
- **Headlight.** `writeHeadlightUniforms` (render time) writes the anchor's world position and
  `normalize(0, −0.08, 1)` turned by the locomotive quaternion (valid because the train group never
  moves).
- Quirks kept: static coupling rods while the crank pins turn; static driver and raven; a brake
  strength spike (capped at 1) when the slider drops mid-brake; dt = 0 while slowing gives strength
  1; `puffTimer` drifts negative while standing at speedMul 0; a puff emission is silently skipped
  when all 70 are live; the motion record is allocated per step; sparks bounce on the terrain
  (≈ trackY − 0.42), not the ballast, and do not inherit the train's velocity.

## Life systems (`src/life/`)

### Village residents (`life/village/`)

`createVillageResidents` (build step 10, after the terrain bake, no draws) builds
`new VillageResidents(villageHomes, heightAt, world.group)`:

- Materials skin, dark, hair, blouse, dress, apron, shorts, dogCoat, dogCream, collar
  (`npr({color, stipple})`). Per home: a Group copying the house transform → figure (scale 0.8) →
  body → head (11 parts) → per side a leg group (shin, shoe) and an arm group (rotation.z ±0.12;
  upper arm, hand). The woman (front offset 0.65, `scale.y` 0.8·0.7 = 0.5599999999999999, lathe
  dress, collar puffs, puff sleeves, hair locks, apron, belt), the man, then the dog under the man's
  home. Merges per resident (head, arms, legs, body minus head and arms), then the dog parts.
  `update(0, 0)` at the end.
- Yards: `home.localToWorld(0, 0, depth/2 + frontOffset)` → exclusions r2.2 (woman, man).
- Slot 5 `update(elapsed, dt)`: a 28 s cycle; the woman walks out over [4, 12) and back over
  [18, 26) across a 1.5-wide yard, logging `[VILLAGE] Woman starts walking` / `[VILLAGE] Woman stops
  in yard`; ground snap through `home.localToWorld`; heading blend
  `wrapAngle(θ* − θ)·exponentialResponse(dt, 4)`; stride `sin(7t)`, breathing, head/arm drift, dog
  head look and tail wag. Slot 6 logs the event.
- Quirks kept: both residents turn from 0 to 0.2 rad in the first seconds; the woman's
  non-uniform scale is shaded with `mat3(modelMatrix)` normals; `home.localToWorld` runs every
  frame on static homes.

### Sheep (`life/sheep/`)

```
buildSheepFlock(world)                   tail of build step 12, same world.rand after the rocks
 ├ createSheepInstancedMeshes  ear Ico(.105) → fleece Ico(.42) jitter(.2, 3) → head Ico(.18) → tail Ico(.14)
 │                             → merge(fleece, head, tail) → leg Box(.1, .3, .1) → npr {vertexColors, stipple .2, stippleScale 4}
 │                             → InstancedMesh body 27, legs 108, ears 54 (one shared material)
 ├ spawnPastureSheep           ≤ 4000 attempts, ≤ 24 sheep; x, z over 90 % of the base (2 draws);
 │                             sheepGroundAt → on accept 5 draws: direction, size, phase, speed, turnSpeed
 ├ findTracksideFlockSite      frames 0, 12, 24 … (not bridge, not excluded at pad 2); side −1 then +1:
 │                             shoulder p + r·(side·3.5) level, every preset's exit dry/level/free;
 │                             score Σ max(0, 18 − d) over pasture sheep; strict > keeps the first best;
 │                             none → Error 'No safe trackside sheep clearing'
 ├ createTrackSheep            per preset: route distance (i/N)·length + spacing, center, flat tangent,
 │                             outward; → sheepStates, trackSheep, exclusion r1.2
 ├ counts n / 4n / 2n, frustumCulled false, world.sheep|sheepLegs|sheepEars, group.add(body, legs, ears)
 └ updateSheepFlock(world, 0, 0)         dt 0: every matrix written
```

- **Measured layout.** 24 pasture sheep in 450 attempts; clearing at track frame 348, side −1
  (score 84.44); routes at 77.380, 79.930 and 83.130 m; 27 sheep in total.
- **Ground query** (`sheepGroundAt`, also `World#sheepGroundAt`): rejects in order |x| or |z| > 60;
  height < 1 or > 8; nearest track < 5; inside an exclusion grown by 1;
  `fbm(0.045x + 10, 0.045z − 3, 3) > −0.05`. Only then the normal
  `normalize(h(x − .6) − h(x + .6), 1.2, h(z − .6) − h(z + .6))` is written; the height is returned
  when normal.y ≥ 0.88, else null (the normal stays written).
- **Rail-sheep state machine** (`track-sheep-escape-state-machine.js`, no three.js; three
  `TRACK_SHEEP_PRESETS`, unfrozen, shared by reference): track → startled → escaping → waiting →
  returning → track. hopAge ← `min(hopDuration + .3, hopAge + dt)`; ahead =
  `positiveModulo(route − train, L)`, behind = `(L − ahead) % L`; danger ⇔ ahead < `max(18, 3.2·v)`
  or behind < length + 5. Danger zeroes clearTime and startles a `track`/`returning` sheep
  (reaction delay); no danger accumulates clearTime and returns a `waiting` sheep after its return
  delay. A startled sheep jumps (`escaping`, hopAge 0) when the delay ends, ahead <
  `max(5, 1.5·v)` or the tail window holds. Offsets walk toward 0 / held / 3.5 / 3.5 / 0 at
  0 / 0 / escapeSpeed / 0 / 0.65 m/s; arrival is exact equality. Only the last event of a step is
  returned; slot 2 logs it (`[SHEEP] Startles: approaching train, sheep <id>`, `[SHEEP] Jumps off
  track: sheep <id>`, `[SHEEP] Returns to track: train clear, sheep <id>`), copies the route speed
  and faces the sheep along the outward vector (+π while returning).
- **Locomotion** (slot 3): sleep → night amount (0 on the rails) at rate 1.8; wakefulness
  `w = 1 − smoothstep(0, .65, sleep)`; direction += turnSpeed·dt·w. Rail sheep: centre + outward·offset
  + an eased Lissajous sway in `track` mode, height `max(ground, lerp(ballast slope, rail top, rail
  support))`, normal = up. Pasture sheep move only onto valid ground, otherwise turn at 2.4 rad/s.
  Gait and ground height ease at rate 10.
- **Pose** (`sheep-instance-pose-writer.js`): orientation slerps (rate 8) toward
  `slerp(slope tilt, identity, .55) × heading`; body y = ground − .05 + trot bob − sleep crouch + hop
  arc `4p(1 − p)·hopHeight`; squash/stretch for hop, landing (.3 s) and the startled crouch; legs
  swing ±0.4 rad, tuck in the hop and fold with sleep; ears flap with `min(1, speed/.34)·.32·w`.
- **Per-frame cost.** At most two `sheepGroundAt` calls per pasture sheep; no allocation (scratch
  from `world.sheepTransforms`).
- Quirks kept: a pasture sheep with no valid ground at both spots treats the height as 0 and sinks
  (no current spawn point qualifies); the startle line is lost when the jump fires in the same step;
  the danger test ignores train speed when the train stands; rail sheep never sleep; the shared slope
  normal leaks between sheep; pasture sheep ignore each other; a startle cannot be called off.

### Station travelers (`life/station/`)

- **Figures.** `buildStationTravelerOldMan(site, materials)` → `{figure, head, legs, rig,
  shoulderGeometry}`: 6 loose leg meshes (IK) then the body group (arm −1, arm +1, head, merged
  trousers/coat/trim); head = hat group + merged skin/grey hair/dark wood; arm −1 holds the cane.
  `buildStationGrandmother(site, materials)` → `{figure, head}`: head then 7 merged batches; she shares
  only the shoulder geometry. `attachMesh` (`station-figure-parts.js`) is the shared part helper.
- **Platform lane.** `createPlatformWalker` builds the walker at the pre-widening lane
  (x = −0.6·o), then applies `x + o·E` to the figure and the half-shift `w = (o·E)/2` (figure − w;
  start, end, the three stops and both leg targets + w). Every lane x is 0.20999999999999985 (not
  0.21); the grandmother ends at −0.5300000000000002.
- **Walker** (`StationWalker`, slot 4): wait 5 s, turn on the spot at 1.8 rad/s, two in-place steps,
  then 0.7 s steps of ≤ 0.2 to the next stop; waits 8 / 10 / 6 s after stops 1 / 2 / 3. The swinging
  foot follows `p²(3 − 2p)` with a 0.085 lift; 2-bone IK (segment 0.36) keeps the knee forward; body
  bob/sway, head/hat tilt, arm swing and cane follow the eased bounce/swing; the cane shaft is
  resized each frame from fresh world matrices so its tip touches the platform. `update(dt)` returns
  `[STATION] Traveler walks: stop <n>` / `[STATION] Traveler arrives: stop <n>` or `undefined`.
- **Idle and head-look** (slot 7, `updateStationTravelers`): non-walkers sway (roll .018, nod .012,
  stretch .008 of base scale); every traveler turns the head toward the locomotive, clamped to
  ±0.85 rad, faded by `1 − smoothstep(12, 32, distance)` from the figure origin, eased at
  `min(1, 2.8·dt)`. Scratch vectors are module-level.
- Quirks kept: the walker's shoe has no ankle pitch; head-look distance is measured from the figure
  origin; the grandmother stands behind the default free-camera start, so the default Free view
  never shows her.

### Birds (`life/birds/`)

- `createBirdSystem({perches, trackLength, heightAt, canopyHeightAt, material})` →
  `{group 'Bird flocks', flocks, update, dispose}`. Own PRNG `mulberry32(7821)`; per bird scale
  `(0.68 + r·0.18)·0.6`, phase, heading = outward yaw ± 0.75; take-off delay 0.09 s per index. Per
  flock: centre, tangent, flight height = perch + 5 raised over 24 orbit samples to clear ground + 3
  and canopy + 2. Birds start perched, already facing their idle heading. Geometries:
  `createBirdGeometries` (20), one rig per bird (`createBirdRig`).
- **Flock state machine** (`bird-flock-state-machine.js`, no three.js): snapshot `approaching` =
  moving (v > 0.2) and (ahead < `max(19, 2.5v)` or a car within 12 m); `clear` = every car > 24 m and
  not (moving and ahead < `max(26, 3v)`). perched → flying on approach (`[BIRDS] Take off: <id>,
  train approaches`); flying → returning after > 7 s when clear (`[BIRDS] Return: <id>, track
  clear`, captures return start/velocity); returning → flying if no longer clear (`[BIRDS] Take off:
  <id>, train interrupts landing`, captures departure) or → perched after 3.6 s (`[BIRDS] Perch:
  <id>`). `computeFlockSnapshot` writes into a reused target.
- **Poses** (`bird-flight-poses.js`): perched (peck/look idle, folded wings), flying (orbit 7 ± 3 out,
  ±5 along, bobbing at flight height, eased from the departure with the launch velocity fading),
  returning (Hermite glide home with momentum and a 0.7 hop). Orientation (`bird-wing-body-animator`):
  capped slerp (≤ 4 rad/s, eased by `1 − e^(−9dt)`), pitch along the climb, bank `−turn/dt·0.22`
  clamped to ±0.48. Wings: 21 rad/s beat, glides, spread, landing flare and touchdown squash.
- No per-frame allocation and no random draws after construction; `dispose()` removes the group and
  disposes the bird geometries.
- Quirks kept: the station-roof flock keeps circling through the 4 s stop (clear needs every car
  > 24 m away); the bank angle depends on dt.

## Cameras (`src/engine/cameras/`)

```
UI setMode → d.setMode(mode) → setCameraMode(d, mode)
  1 own-key check on CAMERA_FOV, else throw 'Invalid camera mode: <mode>'
  2 overviewIntro set → null + '[CAMERA] Overview intro interrupted by mode selection' (even on a repeat)
  3 same mode and not overview → return (re-selecting overview re-homes it)
  4 leaving orbit → saveFreeCameraPose (position, position + view dir; unlock if locked; keys cleared)
  5 mode; firstPersonControls.enabled = orbit; camera.fov + updateProjectionMatrix;
    controls.enabled = overview; controls.autoRotate = false
  6 enter: overview → resetOverviewPose | orbit → restoreFreeCameraPose | side → enterFlyAlong | bridge → nothing (glide)
frame loop → d.updateCamera(dt) → updateCameraRig(d, dt)       dt = min(0.05, realDt), never time-scaled
  overview → updateOverviewCamera | orbit → updateFreeFlyCamera (no glide)
  side → computeFlyAlongDesired → glide {2, 5} | bridge → computeBridgeDesired → glide {2, 2}
  h0 = camPos.y → camPos.lerp(tmpA, α(dt, kPos)) → [side] applyFlyAlongHeight(d, dt, h0, tmpA)
  → camTarget.lerp(tmpB, α(dt, kTarget)) → camera.position = camPos, lookAt(camTarget)
  → [bridge] controls.target = camTarget
canvas 'click' → onCanvasClick: orbit and not locked → firstPersonControls.lock(true)
dispose → disposeFirstPersonControls: unlock if locked → remove 'click' → PointerLockControls.dispose()
```

| module | exports |
|---|---|
| `camera-mode-director.js` | `CAMERA_FOV` {overview 42, orbit 65, side 48, bridge 42}, `setCameraMode`, `updateCameraRig` |
| `overview-orbit-camera.js` | `OVERVIEW_HOME` (−55.522, 62.771, 130.519), `OVERVIEW_TARGET` (0, 4, 0), `OVERVIEW_INTRO` {duration 3.2, distanceMultiplier 1.22}, `createOverviewControls`, `bindOverviewIntroInterrupt`, `prepareOverviewIntro`, `updateOverviewCamera`, `resetOverviewPose` |
| `free-fly-pointer-lock-camera.js` | `FREE_CAMERA_VERTICAL_MARGIN` (5°), `FREE_FLY` {speed 12, sprintSpeed 24, edgeInset 1, groundClearance 1.2, ceiling 200}, `createFirstPersonControls`, `bindClickToLock`, `saveFreeCameraPose`, `restoreFreeCameraPose`, `updateFreeFlyCamera`, `disposeFirstPersonControls` |
| `train-fly-along-camera-rig.js` | `FLY_ALONG` (21 keys), `wideShotBlendAtPhase`, `enterFlyAlong`, `computeFlyAlongDesired`, `applyFlyAlongHeight` |
| `bridge-tripod-camera.js` | `BRIDGE_TRIPOD` {x −3, y 5.5, z 60, targetXLimit 14, targetXScale 0.35, targetY 8.5, targetZ 36}, `computeBridgeDesired` |

- **Overview.** `OrbitControls` is created with the camera already at `OVERVIEW_HOME` and before its
  target is set; its constructor's own `update()` against the default origin target is why
  `position0` carries a few ULPs of noise after `saveState()`. Config: target (0, 4, 0), damping 0.06,
  auto-rotate speed −0.245, distance 25–240, max polar 1.5. `prepareOverviewIntro` (overview only)
  starts the camera 1.22× further out along home→target; `updateOverviewCamera` advances
  `elapsed` only while `playing`, eases with smootherstep `p³(p(6p − 15) + 10)`, and logs
  `[CAMERA] Overview intro completed` at p = 1; otherwise `controls.update(dt)`. The `'start'`
  listener (`[CAMERA] Overview intro interrupted by input`) is bound as a separate step so the
  facade's field order stays `camera, controls, onOverviewInteraction, firstPersonControls`.
  `resetOverviewPose`: damping off, `reset()` twice (the first flushes the pending damped delta, the
  second lands on home), damping restored, auto-rotate = `autoRotateEnabled`.
- **Free fly.** `PointerLockControls` (polar angles limited by the 5° margin; `unlock` clears held
  keys). While locked and any input is held: heading = right·(D − A) + forward·(W − S), `y +=
  Space − C`, normalised, moved by `heading·pace·dt` (24 with either Shift, else 12); x, z clamp to
  ±61, y to `[heightAt + 1.2, 200]`. Clamps run only inside the moving branch, so a restored pose or
  mouse look is never clamped. camPos/camTarget mirror the camera every frame. The free pose starts
  at `world.freeCameraStart` (on the platform) and is kept between visits.
- **Train fly-along.** Elapsed advances by real dt only when not paused and timeScale > 0; phase
  φ = e·2π. The driver anchor (0, 2.45, −1.4) goes through `loco.localToWorld`; the anchor delta
  carries camPos and camTarget (velocity = delta/dt when dt > 0). Wide-shot blend
  b = `((1 − cos(φ/56))·0.5)³` scales the local offset `(σ·(20 + 4 sin(φ/31)), 5 + 2 sin(φ/23),
  7 sin(φ/41))` by `lerp(1, 2, b)` before the loco rotation; the canopy look radius is
  `lerp(5, 14, b)`. The goal is floored at terrain + 3 and at the max canopy under camPos, under the
  goal and 0.8 s ahead along the velocity, + 1.5. After the position glide, y is replaced by
  `lerp(h0, goal.y, α(dt, goal.y > h0 ? 3 : 0.7))`, floored at terrain + 3 and the r1 canopy + 1.5.
  The side σ is chosen once at entry from the sign of (loco right axis)·(loco position); on this loop
  it is −1 everywhere (outer side).
- **Bridge tripod.** Goal (−3, 5.5, 60) looking at `(clamp(pointAtS(s).x, ±14)·0.35, 8.5, 36)`, using
  a module scratch vector; it writes `controls.target` every frame.
- **Lerp flavours.** `Vector3.lerp` (x + (v − x)·α) for camPos/camTarget; `MathUtils.lerp`
  ((1 − t)·x + t·y) for the distance multiplier, look radius and height override;
  α(dt, k) = `exponentialResponse(dt, k)` = `1 − exp(−dt·k)`.
- **Allocation.** The camera code creates no Object3D/Material/Geometry and allocates nothing per
  frame.
- Quirks kept: `lock(true)` (unadjusted movement) has no fallback and its rejection is uncaught;
  free-cam clamps apply only while moving; rig periods and look-ahead use real dt and ignore
  timeScale; the bridge overwrites `controls.target`; re-pressing 2 in Free mode re-logs, re-toasts
  and re-saves without touching the camera.

## Render budget

Measured with `renderer.info` (auto-reset off, so the counts cover the shadow, main and post passes):

| state | draw calls | triangles | geometries | textures | programs |
|---|---|---|---|---|---|
| frozen default overview (`ov-day-t0` sign-off probe, both sites equal) | 1371 | 1,759,388 | 419 | 6 | 25 |
| live debug-menu readout, smoke puffs visible | ≈1411 | ≈1,773,736 | 419 | 6 | — |

The live figures vary with the number of live puffs; the frozen probe is authoritative. The six
textures are the shadow RT colour + depth, the main RT colour + depth, the water `heightTex` and the
station sign canvas.

Where the calls come from (per pass; the shadow pass skips everything in the shadow-hidden list):

- Main pass only (shadow-hidden): the sky, water, waterfall, house smoke, the night glows (at
  night), balloon flames, the cab glass, live locomotive puffs and sparks; the post quad is its own
  pass.
- Village: main +21 per house + 66 (9 merged + 12 puffs per house, the shrub mesh, the 65 windmill
  meshes); shadow +9 per house + 66. Scale-0 puffs still draw.
- Residents, trees and rocks: +38 per pass (33 resident meshes, 4 tree layers, rocks).
- Sheep: 3 instanced layers per pass.
- Clouds: one instanced mesh each, in any frustum whose bounds contain them, even at scale 0.

## Parity test hook (`engine/parity-test-hook.js`)

`installParityTestHook(diorama, search = location.search)`, called in the same synchronous task
as construction, right after `prepareOverviewIntro()`:

- No `parity` query parameter → returns `'off'`; no globals, no output (the production default).
- `?parity` → `window.__parityBuildInfo = {fredokaReadyAtBuild}` (whether `bold 106px Fredoka` and
  `24px Fredoka` were ready, i.e. what the station sign saw; null without `document.fonts`), then
  `window.__diorama = diorama`, log `[PARITY] Hook installed: live`.
- `?parity=freeze` → the same plus `diorama.paused = true` (not persisted, HUD state untouched),
  log `[PARITY] Hook installed: freeze`.

It is the only source of `[PARITY]` console output and exposes no user data. The test browser
patches the same hook into the reference's entry module at the matching point, so both sites are
frozen after exactly one 0.05 s step.

## Parity harness overview

```
NODE (tests/, npm run test:parity)                      BROWSER (tools/parity/, Playwright + full Chromium)
original-module-loader → .parity-cache/original         playwright-browser-launcher → clone static server :4317
minimal-dom-shim (recording 2D canvases)                page-parity-helpers: seed → open ?parity=freeze → ready → freeze
original-world-stepper (prototype patch + restore)        → shot state → seeded fixed-dt steps → pose → hide → render → rAF×2
original-simulation-oracle / clone-simulation-driver    original-site-route-hooks (hook after the single anchor)
quantised-number-hashing + scene-graph-signature        capture → compare (heatmaps, report) → probe (counts, digests)
  → multiset / ordered compares, lockstep frames        sign-off: 28 shots, 8 probe states, perf, research, smoke
```

- `tools/parity/fetch-original-source.mjs` (`npm run parity:fetch`): an sha256-pinned,
  all-or-nothing fetch of 18 reference files into `.parity-cache/original/` (gitignored and
  vercelignored; never shipped or pasted).
- Node: the oracle loads the cached reference modules (DOM shim, prototype patches restored after
  each use) and steps them side by side with the clone; `full-scene-signature-parity.test.mjs` compares the scene-graph signature, the
  ordered composition lists, a world digest and 10 800 lockstep frames (bit-identical). The clone
  driver composes with the runtime `composeDioramaScene` and applies the render's GPU-free side
  effects (glow visibility, headlight uniforms, sky follow) each step; both sides arm the overview
  intro, so intro completion and the mode-selection interrupt are compared too.
- Browser capture recipe: install the `updateCamera` and `world.updateCloudCamera` no-ops at freeze
  time (the paused loop keeps running real-dt camera and cloud code; the stashed originals are what
  page-side steps call); call `setMode('overview')` before each shot's own mode so camPos/camTarget
  start from home; reseed `Math.random` inside the same synchronous evaluate as the stepping; hide
  transients (puffs, sparks) in frozen shots.
- Shot lists per subsystem (camera modes, sheep, water/clouds/balloon, travelers/birds, sign-off),
  stages `shell-and-sky → train → village-and-windmill → residents-and-forest → full-scene`
  (active: `full-scene`), named hide sets, regional crops (`village`, `windmill`, `waterfall`),
  intra-site relations, the post-pass synthetic-input probe (18 uniform combinations, max diff 0) and
  four sky-direction shots (max channel diff ≤ 1).
- Sign-off (`npm run parity:signoff`): 28/28 shots within max channel diff 1/255, 8/8 frozen probe
  states (`ov-day-t0`, `ov-night-t0`, `ov-day-t30`, `train-day`, `bridge-evening`, `free-day`,
  `pixel-360`, `mobile-ov-day`) exactly equal, frame time within 1.10× of the reference.

Full commands, thresholds, determinism rules and the verification record: `parity-testing-guide.md`.

## Data flow

```
user input ─► HUD / keyboard actions ─► state + Diorama setters ─► save (localStorage)
                                              │
requestAnimationFrame ─► frame loop (120 fps cap)
   ├ palettes (real dt) → uniform bag → every material
   ├ sim step (sim dt × timeScale, gated by pause)
   │    time/uTime → train (motion → cars → sparks → puffs)
   │    → world slots 1–11 (clock, sheep, travelers, residents, logs, smoke, rotor, clouds, balloon)
   │    → birds
   ├ camera rig (clamped real dt) → cloud camera avoidance
   └ render: glows → headlight uniforms → sky follow → matrices → shadow → main → post → canvas
```

Console logs are the observable event stream (`[GAMEPLAY]`, `[CAMERA]`, `[PAUSE]`, `[HUD]`,
`[DEBUG]`, `[SETTINGS]`, `[PARITY]`, `[BIRDS]`, `[SHEEP]`, `[STATION]`, `[VILLAGE]`); the parity
harness compares them per shot and per lockstep frame.
