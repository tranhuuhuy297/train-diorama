# System architecture

Mirrors the project's cross-module contracts. This file is a living summary; later phases append
their own sections (engine, world, train, life) without rewriting what is here.

## Runtime

Vanilla ESM, no bundler. `index.html` ships an import map:

```json
{ "imports": {
  "three": "https://unpkg.com/three@0.186.0/build/three.module.js",
  "three/addons/": "https://unpkg.com/three@0.186.0/examples/jsm/"
} }
```

Node tests resolve the same bare `three` specifier from the `three` devDependency (its package
`exports` map also serves `three/addons/*`), so engine code imports cleanly in both the browser
and `node --test`.

## Module map (this phase)

```
index.html
  ├ styles/*.css  (base-reset-and-utilities → hud-panel-and-controls → loading-overlay
  │                 → toast-and-debug-menu → night-theme-overrides)
  └ src/main-entry.js
      ├ ui/settings-schema-defaults.js
      ├ ui/settings-local-storage-persistence.js
      ├ ui/hud-button-renderers.js
      ├ ui/hud-state-actions.js
      ├ ui/hud-dom-event-bindings.js
      ├ ui/keyboard-shortcuts.js
      ├ ui/shortcut-toast.js
      ├ ui/loading-screen-step-runner.js
      ├ ui/debug-menu-panel.js            (mounted after loading; imports hud-button-renderers' element())
      ├ engine/parity-test-hook.js        (no imports; dormant without ?parity)
      └ ⇢ engine/diorama.js (dynamic import; engine facade: renderer, cameras/controls, shadow +
                             post passes, frame loop; see Engine module graph below)
```

No cycles. Renderer modules (`hud-button-renderers.js`) import only the settings schema.

## Boot order (`src/main-entry.js`)

1. Load settings, create the saver, create a mutable (initially unset) `diorama` binding, create
   the HUD actions bound to a `getDiorama()` getter.
2. Render the HUD from state (`renderModes`, `renderToggles`, `renderTimeOfDay`), bind HUD DOM
   events, bind keyboard shortcuts, register a once-only `pagehide` disposer. Every call these
   make onto the diorama is optional-chained, since it may not exist yet.
3. Run three weighted loading steps: import the engine module (30), construct `Diorama`, apply
   the nine pieces of saved state to it in a fixed order ending with `prepareOverviewIntro()`,
   then `installParityTestHook(diorama)` in the same synchronous task (60), wait one animation
   frame (10).
4. Log `[GAMEPLAY] Started`; if an overview intro was prepared, start it and log
   `[CAMERA] Overview intro started`; `mountDebugMenu(diorama)`; toast `H · Hide HUD`. Errors
   anywhere in `boot()` are caught and passed to `console.error`.

Because step 3 applies state by calling the diorama directly (not through the HUD actions), boot
never produces a `[CAMERA] Mode` log or a save; `localStorage` stays `null` until the first user
action.

## DOM contract

22 static ids are looked up through `element(id)`, which throws `Missing interface element: <id>`
on a miss. Five containers are rendered dynamically (`#camera-modes`, `#time-of-day`, `#toggles`,
`#outline-toggle`, `#pixel-resolution`); their serialized markup (attribute order, class-token
order, text) is part of parity, not just their visual result. State hooks: `body[data-time-of-day]`,
`body.hud-hidden`, `#shortcut-toast.is-visible` / `.hud-hidden`, `#loading.is-working` /
`.is-gone` / `[hidden]` / `[aria-busy]`, `#help[hidden]`, `#controls-button[aria-expanded]`.
Runtime-only DOM: the canvas inside `#scene`, and `details#debug-menu` appended to `body` after
loading (see "Debug menu and parity hook" below; its own ids `debug-layers` and
`debug-performance` go through the same `element(id)` lookup).

## CSS cascade design

Tailwind's compiled output puts utilities inside `@layer utilities` (preflight in `@layer base`);
every hand-written component rule in the original is unlayered, so it always wins regardless of
selector specificity (per the CSS Cascade Layers spec, an unlayered rule beats any layered rule).
The clone reproduces this exactly:

- `styles/base-reset-and-utilities.css` declares `@layer base, utilities;` first, then a preflight
  subset in `base` and 69 utility rules in `utilities`.
- `:root` radius variables and a second `[hidden] { display: none !important; }` rule sit
  unlayered at the bottom of that same file. Both `[hidden]` rules (the layered one in `base` and
  this unlayered copy) carry `!important`, so either alone already beats a normal declaration such
  as `#loading { display: grid }` regardless of layer (an `!important` declaration wins over every
  normal declaration, whatever layer it is in); the unlayered copy exists to mirror the original's
  cascade structure, not because the layered rule needs help winning.
- `hud-panel-and-controls.css`, `loading-overlay.css`, `toast-and-debug-menu.css` and
  `night-theme-overrides.css` are all unlayered component files, loaded in that order, with the
  night overrides last so they win any same-specificity conflict.

## Diorama facade (P01 stub replaced by the real engine in P03)

`src/engine/diorama.js` exports a `Diorama` class that satisfies the UI contract (fields, camera
modes, time-of-day ids, the overview dolly-in intro, `logCameraPose`). From P03 on it is the real
engine: a `WebGLRenderer`, the frame loop, the sky dome, shadow/post passes and the overview
camera. The world (P05) and the train (P07, see "Train" below) are composed in; birds are added at
their reserved constructor slot in a later phase without changing this file's public surface.

## Placeholders for later phases

- `world/*`: the core (terrain, track, bridge) landed in P05 (see "World core" below); station,
  village, windmill, trees, rocks, water, sky, balloon and perches are added across P06–P13.
- `train/*`: landed in P07 (see "Train" below).
- `life/*` (villagers, sheep, station travellers, birds): added across P09–P13; the village
  residents landed in P09 (see "Village residents, forest and rocks" below), the sheep flock in
  P11 (see "Sheep flock" below).

## Shared lighting uniform bag (`src/materials/shared-lighting-uniforms.js`)

Every shader material in this scene reads the same handful of `{ value }` objects by reference,
so a writer's mutation (palette transitions, the shadow pass, the headlight rig) is visible to
every material on the next draw with no rebinding pass. Consumers hold references and never
`.clone()` a `ShaderMaterial` or replace a bag entry (the containers are `Object.freeze`d).

| Bag | Keys (order) | Notes |
|---|---|---|
| `G` | uLightDir, uLightColor, uShadowTint, uAmbient, uShadowMap, uShadowMatrix, uShadowTexel, uFogColor, uFogNear, uFogFar, uTime, uZenith, uHorizon, uHill, uMist, uSunColor | 16 entries; written by the P03 palette/shadow/render-pipeline code |
| `NIGHT_UNIFORMS` | uNight, uSaturation, uHeadlightPosition, uHeadlightDirection | uSaturation is read only by the post pass (P03) |
| `SHADER_NIGHT_UNIFORMS` | uNight, uHeadlightPosition, uHeadlightDirection | a frozen *view* onto the same three `NIGHT_UNIFORMS` objects — the set every shader material spreads |
| `LIGHTING_UNIFORMS` | the 16 `G` keys, then the 4 `NIGHT_UNIFORMS` keys | exposed later as `diorama.lightingUniforms` |

Additive exports beyond the cross-module contract (documented here per the contract's own
allowance): `SHADER_NIGHT_UNIFORMS`; `ADDITIVE_GLOW_RENDER_STATE` (`{transparent, depthWrite,
blending}`, frozen), the single render-state object spread by both `createLightCone` and
`createLightGlows` so the two factories cannot drift apart; and from
`src/core/seeded-prng-and-gradient-noise.js`, `NOISE_PERMUTATION_TABLE` (`Uint8Array(512)`) and
`NOISE_GRADIENT_TABLE` (`[cos, sin][256]`) — both are read-only by convention and exist for tests
only.

**Contract §2 correction:** sky, water and waterfall materials (P03/P12) spread the full
`SHADER_NIGHT_UNIFORMS` set (uNight + the headlight pair), not just `G + uNight` — verified
against the original source. This has no visual effect, since three.js silently ignores uniforms
absent from a program's active set; it only matters for uniform-key parity assertions.

## NPR cel material (`src/materials/npr-cel-material-factory.js` + `materials/glsl/*`)

`npr(options = {})` returns a cached `THREE.ShaderMaterial`. **Identity rule:** the cache key is
`JSON.stringify(options)`, so two call sites share one material instance *iff* their option
literals are identical, including key order (`undefined` values drop out, as JSON does). Callers
must pass the exact literal shape listed at each call site in later phases — never a normalised
or reordered one — or the merge-batch partition and draw-call count will drift from the original.

Defines are inserted only for truthy options, in a fixed order: `FLOWERS, STRATA, DOUBLE_SIDED,
TREE_SWAY, NIGHT_GLOW, LOCAL_GLOW`. Uniform key order: the 16 `G` entries, the 3
`SHADER_NIGHT_UNIFORMS` entries (same singleton objects), then `uColor, uStipple, uStippleScale,
uEmissive, uOpacity`, and finally — only when `options.localGlow` is set —
`uLocalGlowPosition, uLocalGlowRadius, uLocalGlowStrength`.

GLSL interface (uniform/attribute names+types, `#ifdef` names, `COMMON_GLSL` function
signatures) is a parity target; shader *text* is not — the clone shaders are written fresh from
formula tables, and equivalence beyond the interface is judged on rendered GPU output.

| Shader | Uniforms | Attributes | `#ifdef` names |
|---|---|---|---|
| `COMMON_GLSL` | the 14 shared uniforms (uLightDir..uHeadlightDirection) | none | none |
| NPR vertex | `uTime` (TREE_SWAY only) | `topY` (STRATA only) | LOCAL_GLOW, TREE_SWAY, STRATA, USE_INSTANCING, USE_COLOR, USE_INSTANCING_COLOR |
| NPR fragment | COMMON set + uColor/uStipple/uStippleScale/uEmissive/uOpacity; LOCAL_GLOW adds uLocalGlowPosition/Radius/Strength | none | LOCAL_GLOW, STRATA, DOUBLE_SIDED, FLOWERS, NIGHT_GLOW |
| Cone vertex / fragment | – / uNight, uLength, uStrength | none | none |
| Glow vertex / fragment | – / uNight | glowCenter (vec3), glowSize (vec2), glowNormal (vec3), glowStrength (float) | none |

`COMMON_GLSL` function signatures: `hash13(vec3)`, `hash12(vec2)`, `hash11(float)`,
`vnoise(vec3)`, `shadowAt(vec3,vec3)`, `headlightAt(vec3,vec3)`, `nprShade(vec3,vec3,vec3,float,float)`,
`applyFog(vec3,vec3)`.

## Night glow sprites and the headlight cone (`src/effects/*`)

Both `createLightCone` and `createLightGlows` build a `ShaderMaterial` named
`NIGHT_LIGHT_GLOW_MATERIAL_NAME` (`'night-light-glow'`) and spread the same frozen
`ADDITIVE_GLOW_RENDER_STATE` object (`transparent: true, depthWrite: false, blending: Additive`);
a later phase's registry collects every mesh whose `material.name` equals that constant once
after scene composition and toggles visibility on `uNight > 0`. **Both materials are always
`transparent: true`** — this is load bearing, not incidental: `mergeStaticGeometry` only bakes
non-transparent meshes, so any downstream builder that accidentally makes a glow or cone material
opaque would get silently merged into an unrelated static batch.

## Static geometry merge (`src/geometry/merge-static-geometry-by-material.js`)

`mergeStaticGeometry(root, excluded)` walks `root`'s children (the root's own transform is never
baked) and bakes every eligible mesh (`isMesh`, has a `uv` attribute, `!material.transparent`)
into one merged `Mesh` per material, appended to `root` in first-seen-material order. Kept quirks:

- Excluded subtrees are neither visited nor `updateMatrix()`ed — their `.matrix` stays stale.
- Removing a merged source drops its whole subtree, including any non-merged (e.g. transparent)
  children; emptied groups stay in the tree.
- Normals are rebuilt from the *original* (untransformed) normal attribute using the plain upper
  3×3 of the accumulated matrix (`Matrix3.setFromMatrix4`), **not** an inverse-transpose — this
  matches the NPR vertex shader's `mat3(modelMatrix)` and is deliberate for non-uniformly scaled
  geometry (e.g. roofs).
- A mirrored subtree (`determinant(M) < 0`) gets its triangle winding flipped in place.
- A missing `normal` attribute on an eligible mesh throws (`TypeError`), matching the original merge (unguarded normal read).

## PRNG noise stream A (`src/core/seeded-prng-and-gradient-noise.js`)

Built once at module evaluation from `mulberry32(1337)`: 255 Fisher-Yates draws (building the
512-entry permutation table), then 256 gradient-angle draws. Independent of `world.rand` (seed
42, added in P05) and the bird-flock PRNG (seed 7821, added in P13). `fbm` uses lacunarity 2.03
and a final ×1.6 normalisation; see `code-standards.md`'s "Parity-critical rules" section for the
three inline-expression substitutions (`wrapAngle`, `positiveModulo`, `exponentialResponse`) that
later phases may use in place of the equivalent inline formula.

## Parity test infrastructure (this phase)

- `tools/parity/fetch-original-source.mjs`: sha256-pinned, all-or-nothing fetch of the 18
  original-deployment files into `.parity-cache/original/` (gitignored, vercelignored).
- `tests/helpers/original-module-loader.mjs`: `originalSkipReason`/`importOriginal` (guarded
  dynamic import so a missing cache skips cleanly instead of crashing a whole test file) and
  `extractGlslInterface` (uniform/attribute/`#ifdef`/function-signature extraction for GLSL
  interface comparisons — never a text comparison).

## Engine module graph (P03)

```
diorama.js (facade, owns every field) — constructor order:
  scene+uniforms -> UI state -> clock/motion -> camera-rig state -> scratch/loop
  -> renderer -> camera -> createOverviewControls -> bindOverviewIntroInterrupt
  -> createFirstPersonControls -> bindClickToLock
  -> composeDioramaScene (World, Train, sparks, motion init, sky, puffs, shadow-hidden list, glow registry)
  -> createShadowDepthPass -> createPostPass
  -> setTimeOfDay('day', true) -> ResizeObserver + resize() -> loop(now)

frame-loop-scheduler.createFrameLoop(d) -> loop(now), 120fps-capped deadline cadence:
  d.updateTimeOfDay(realDt) -> d.world.nightAmount = uNight
  -> [if !paused && timeScale>0] simulation-step.stepSimulation(d, dt*timeScale)
       (time/uTime -> d.updateTrain -> d.world.update(time, simDt, loco position, motion))
  -> d.updateCamera(dt) -> d.render() -> performanceStats EMA (alpha 0.1)

render-pipeline.renderDioramaFrame(d):
  info.reset() -> night-light-glow-registry.applyNightGlowVisibility -> writeHeadlightUniforms
  -> sky.position = camera.position
  -> scene.updateMatrixWorld() (once) -> shadowPass.render(...) -> render(scene, camera) -> mainRT
  -> render(postScene, postCam) -> canvas
```

**Instance-member dispatch rule.** `frame-loop-scheduler.js` and `simulation-step.js` read every
member (`updateTimeOfDay`, `updateCamera`, `render`, `world`, `train`, `birds`, ...) from `d`
inside the frame/step body — never cached, never `.bind`'d, never destructured at
`createFrameLoop`/module scope. An instance override assigned after construction (the later
parity-capture no-ops) therefore takes effect on the very next frame with no edit to either file.
`stepSimulation` is the only function the loop imports directly; it never calls a camera/render/
palette function itself.

**Singleton uniform binding.** Every `ShaderMaterial` built in this scene (sky, later: npr/water/
waterfall/glows) spreads `G`/`NIGHT_UNIFORMS`/`SHADER_NIGHT_UNIFORMS` by reference, never a fresh
`{ value }` wrapper — see the P02 section above. The sky's uniform set is `G` (16 keys, G's own
order) then `uNight, uHeadlightPosition, uHeadlightDirection` (the `SHADER_NIGHT_UNIFORMS` view);
the shader itself never reads the headlight pair. Writers: `time-of-day-palettes-and-transition.js`
(12 palette keys, real unclamped dt, `uLightDir` renormalised every step),
`custom-shadow-depth-pass.js` (`uShadowMap`/`uShadowTexel` once, `uShadowMatrix` per render),
`simulation-step.js` (`uTime`).

**Sky dome and post pass** are written fresh from formula tables (independent implementation);
equivalence is judged on rendered pixels, not shader text. The sky uses the ascending-edge
`1 - smoothstep(-0.25, -0.02, y)` mist form (mathematically identical to a reversed-edge
`smoothstep`, avoids GLSL's undefined behaviour for `edge0 > edge1`). The post pass's 4x4 Bayer
matrix is built recursively from one 2x2 cell (`bayer2(c) = 0.5*c.x + 0.75*c.y - c.x*c.y`,
`bayer4 = bayer2(inner) + 0.25*bayer2(outer)`), reproducing the standard ordered-dither table.

**Phase 03 render budget** (default overview, clone only, measured via `renderer.info`): 2 draw
calls, 962 triangles (`SphereGeometry(700,32,16)` = 960 + the post quad = 2), 2 geometries, 4
textures (shadow RT colour+depth, main RT colour+depth), 2 programs. The shadow pass's override
program is not compiled yet (nothing opaque is drawn into the scene besides the shadow-hidden
sky).

**Overview camera.** `OrbitControls` is created at `OVERVIEW_HOME` before its target is set (its
own constructor calls `update()` once against the default `(0,0,0)` target, which is the source of
`position0`'s few-ULP float noise after `saveState()`). The 3.2s intro eases with
`smootherstep` (`p*p*p*(p*(6p-15)+10)`) from a pose 1.22x further out than home. Leaving overview
back to overview always re-runs a damping-off double reset (`reset()` applied twice): the first
flushes the still-pending auto-rotate delta, the second lands within float-epsilon of home. The
intro-interrupt `'start'` listener is bound by `bindOverviewIntroInterrupt(d)` as a separate step
after `controls` is assigned, keeping the facade's field order `camera, controls,
onOverviewInteraction, firstPersonControls`.

## Debug menu and parity hook (runtime)

- `ui/debug-menu-panel.js` appends `details#debug-menu` (summary `···` with `title` then
  `aria-label` `Debug menu`; `.debug-content` > `strong` `Scene debug`, `#debug-layers` with the
  Trees and Clouds checkbox rows, `pre#debug-performance`) as the last child of `body`. Layer
  objects are resolved at toggle time from `diorama.world?.treeLayers` and the `group` of each
  `diorama.world?.clouds` entry, so a world-less Diorama toggles nothing but still logs
  `[DEBUG] Trees|Clouds: shown|hidden`. The perf readout (labels padded to 13 columns, triangles
  grouped by the default locale) refreshes on `toggle` and every 500 ms, only while open; a
  once-only `pagehide` clears the interval. CSS lives in `styles/toast-and-debug-menu.css`.
- `engine/parity-test-hook.js` `installParityTestHook(d, search)`: no `parity` param → `'off'`,
  no globals, no output. `?parity` → `window.__parityBuildInfo = {fredokaReadyAtBuild}`, then
  `window.__diorama = d`, log `[PARITY] Hook installed: live`. `?parity=freeze` → the same plus
  `d.paused = true` (not persisted, UI state untouched) before the log. It is the only source of
  `[PARITY]` console output.

## Parity harness (node + browser)

```
NODE (tests/)                                           BROWSER (tools/parity/)
original-module-loader → .parity-cache/original          playwright-browser-launcher → full Chromium + clone server :4317
minimal-dom-shim (recording 2D canvases)                 page-parity-helpers: seed → open ?parity=freeze → ready → freeze
original-world-stepper (prototype patch + restore)         → shot state → seeded fixed-dt steps → pose → hide → render → rAF×2
original-simulation-oracle (ctx on Diorama.prototype)    original-site-route-hooks (our hook after the single anchor)
quantised-number-hashing + scene-graph-signature         dom-shot-page-helpers, parity-shot-list (stages, thresholds)
  → multiset / ordered compare                           capture → compare (heatmaps, report) → probe (+ post synthetic, checks)
```

Refined capture recipe (contract recipe plus these determinism fixes): the `updateCamera` and
`world.updateCloudCamera` no-ops are installed **at freeze time**, before any stepping (the
stashed originals are what page-side steps call), because the paused loop keeps running real-dt
camera and cloud code; every shot calls `setMode('overview')` before its own mode so
`camPos/camTarget` start from the deterministic home pose; `Math.random` is reseeded inside the
same synchronous evaluate as the stepping; both hooks record `__parityBuildInfo` (Fredoka
readiness at build time; compare warns on a mismatch, like on `timeAtFreeze`, only once both
sites build a world). Full detail: `parity-testing-guide.md`.

Instance dispatch verified: the frame loop calls `d.updateTimeOfDay`, `stepSimulation(d, …)`,
`d.updateCamera` and `d.render` through the instance on every frame, so the freeze overrides take
effect. `world.nightAmount` and `d.world.updateCloudCamera(d.camera.position, dt)` join the loop
when the world (nightAmount) and clouds (cloud camera) land; both must keep the same
instance-lookup form.

## Deferred parity hand-off (sky/post shader pixels) — landed

Both groups below now live in the harness: the four sky-direction shots are in
`tools/parity/parity-shot-list.mjs` (stage `shell-and-sky`, `reference: null`), and the post
synthetic-input probe is `tools/parity/post-pass-synthetic-input-probe.mjs`, run by
`npm run parity:probe` (`--skip-post-probe` to omit). Baseline: all four sky-direction shots max
channel diff ≤ 1; post probe max diff 0 across 18 combinations. The original specification:

The sky and post shaders are independently written from formula tables, so their pixel parity is
proven by rendered output, never by comparing shader source. Two capture groups are specified here
and still need a home in the capture-harness shot list:

- **Sky-direction shots** (clone vs original only, no reference PNG — they pin the independently
  written sky shader's sun/moon/star/ridge/mist terms by direction, not by the home framing).
  Camera at `(0, 4, 0)`, looking at `position + 10 * direction`, sky-only hide set:

  | id | time of day | direction |
  |---|---|---|
  | sky-sun-day | day | `PALETTES.day.uLightDir` |
  | sky-moon-night | night | `PALETTES.night.uLightDir` |
  | sky-stars-night | night | normalize(0, 0.8, −0.6) |
  | sky-hills-evening | evening | (1, 0, 0) |

  Threshold: meanAbsDiff ≤ 1.0, pixels with any channel diff > 16 ≤ 0.5%.

- **Post synthetic-input oracle probe** (output parity for the independently written post shader).
  After construction and freeze, on both sites: build a 64×64 RGBA8 colour `DataTexture`
  (R = 4x, G = 4y, B = 128; Nearest) and a 64×64 float `RedFormat` depth `DataTexture` (0.98 where
  x < 32 and y < 32, else 0.995; Nearest); point `postMat`'s `tColor`/`tDepth` at them; set `uRes`
  to (64, 64); keep `uNear`/`uFar` as constructed. For each combination of `uOutline` ∈ {1, 0} ×
  (`uNight`, `uSaturation`) ∈ {(0, 1), (1, 2.5), (0.5, 1.75)} × (`uPixel`, `uThick`) ∈
  {(0, 1), (0, 1.8), (1, 1)}: render `postScene`/`postCam` into a 64×64 RGBA8 RT, read back, then
  restore every uniform/texture. Pass: max per-channel diff clone vs original ≤ 1 per combination.

A review probe against the current shaders passed both groups (sky-direction max diff ≤ 1 per
shot; post probe max diff 0 across all 18 combinations, with self-diffs up to 136 against a known
differing variant confirming the probe is sensitive).

## World core (`src/world/`, P05)

```
World ctor: group, noShadow, N=1200, frames, heights (Float32 201²), bridge, stationS, exclusions,
  buildingFoundations, windmillBlades (Group), clouds, treeLayers, houseSmoke, stationTravelers,
  sheepStates, nightAmount, sheepTransforms (+ clone-only trackSheep [], sheep/sheepLegs/sheepEars null),
  balloon (Group), birdPerches, rand = mulberry32(42)
  -> runWorldBuildSteps(world, {stopAfter, skip})
     1 buildTrackFrames  track/track-spline-frames-and-queries   curve, length, frames[0..1200], sx/sz
     2 findBridge        track/bridge-span-detection            bridge [30, 178]
     3 buildHeightmap    terrain/terrain-heightmap-grading       graded heights + trackNearestGrid
     4 buildTrack        track/track-ballast-rails-sleepers      ballast, 2 rails, 383 sleepers
     5 buildBridge       bridge/*                                deck, girders, rails, 76 posts, arch,
                                                                 columns, braces, piers, abutments
     6 buildStation      station/build-station                   station group, building + landing pads,
                                                                 footpath, 27 exclusions (P06)
     [7 buildVillage, 8 buildWindmill: later phases, both call flattenBuildingGround]
     9 buildTerrain      terrain/terrain-skirt-plinth-and-water-height-texture
                         surface (+ colours, FLOWERS) -> skirt (topY, STRATA) -> plinth -> heightTex
    10 createVillageResidents  world-build-steps → life/village       residents on the first two homes, yards r2.2 ×2 (P09)
    11 buildTrees        trees/tree-instanced-layers            4 instanced layers, canopy grid (W4) (P09)
    12 buildRocksAndSheep world-build-steps → rocks/*, life/sheep  ≤ 80 rocks (W5a), then the sheep flock (W5b) (P11)
     [13 buildWater .. 16 buildBirdPerches: later phases]
```

- **Registry rules.** Steps keep the original method names so the oracle stepper can stop/skip at
  matching points. Later phases insert only at the slots above: 6–8 between `buildBridge` and
  `buildTerrain` (terrain must bake after every pad), 10–16 after `buildTerrain`. Unknown `skip`
  names are ignored (so `WORLD_CORE_SKIP` stays valid as steps land); an unknown `stopAfter`
  throws `Unknown world build step: <name>`; a skipped stop target still stops.
- **Builders** are plain `(world, …) => void` functions; `world.js` only initialises fields,
  runs the registry and wraps the queries. No builder imports `world.js` (no cycles).
- **Nearest-track cache.** `buildHeightmap` stores `world.trackNearestGrid = {index: Uint16Array,
  distance: Float64Array}` (201², clone-only field). Pads and the terrain colours read it instead
  of re-running `nearest()` at the same grid coordinates (`-HALF + i·STEP`, `gridCoordinate`), so
  outputs are bit-identical; `ensureTrackNearestGrid` builds it lazily when grading was skipped.
  Distances stay Float64 (pad weights consume the double); the terrain copies them into its own
  Float32 `trackD` exactly like the reference.
- **Float32 storage points:** `heights`, `sx`/`sz`, terrain positions (colour inputs are read back
  from them), `trackD`, normals/colours, skirt positions. Formulas keep the stated operand order,
  `Math.hypot` vs √Σ choices and `**` vs products (R5); see the phase spec for each recipe.
- **UUID draws (Math.random stream M).** Every Object3D, BufferGeometry, Material, Texture and
  Source draws 4 values. The world core creates exactly 56 Object3D (group, windmillBlades,
  balloon, 53 meshes), 53 geometries, 1 DataTexture + its Source = 111 UUIDs = 444 draws on a warm
  npr cache (+10 materials cold). No helper Groups, clones or module-scope scene objects; the
  world is composed before the sky so browser Math.random streams stay aligned.
- **npr request order** (material ids drive opaque sort ties): ballast, rail, sleeper, red,
  darkRed, stone, terrain, skirt, wood, trim — option keys/order exactly as the material table.
- **Child order of `world.group`** (53): ballast, rail −0.52, rail +0.52, sleepers; deck girder;
  side girder/handrail for s = −1 then +1; posts; ribs −1.15, +1.15; per span i = 1..19 piers or
  columns (+ brace on even i); abutments sA, sB; terrain, skirt, wood slab, trim slab. Station,
  village and windmill groups land between the bridge and the terrain.
- **Performance note.** `POND`/`RIVER` are deliberately unfrozen and the grid passes use flat
  (not nested) loops: frozen constants in the hot `riverDist` path and nested one-shot loops both
  sent V8 into deopt loops that made the build slower than the reference. Clone build ≈ 45 ms vs
  ≈ 55 ms for the reference core in node.
- **Quirks kept for parity:** the ≈1.09 sleeper seam gap before s = 0, the heightTex half-texel
  shift + 8-bit quantisation, `heightAt` bilinear vs the mesh diagonal split, the arch in the chord
  plane (track deviates up to 0.77), the unclamped bridge upper index, `nearest` error up to
  ≈0.115, asymmetric arch springs.

## Station (`src/world/station/`, P06)

```
buildStation(world)                                    build step 6 (after buildBridge, before buildTerrain)
 ├ placeStationSite         station-site-placement      nearest sample to (-45.5, -2) = frame 1008, stationS = distance + 4.5,
 │                                                       group at p + r·side·2.7, lookAt BEFORE attaching, freeCameraStart, stationSite
 ├ createStationMaterials   station-palette-materials   platform, edge, wood, darkWood, green, cream, roof (npr request order)
 ├ platform/edge → shelter → bench                      station-platform-shelter-bench
 ├ building shell (pad #1) → windows (glows → noShadow[0]) → façade trims → clock
 ├ mergeStaticGeometry(building, {minute pivot, hour pivot})   9 batches: cream, roof, green, darkWood,
 │                                                       window, shutterWood, shutterPanel, wood, platform
 ├ name board → sign (canvas) → [traveler slot] → traveler cases → [grandmother slot] → case stack
 ├ lamps (3 shared geometries, glows → noShadow[1])
 ├ stairs (pad #2) → footpath ribbon (26 × r1.8 exclusions, mesh in world.group) → r8 station exclusion
```

- **Frames and baked extension.** Station group local +z runs along the track, local +x = −r;
  o = `localOutward` = −side = −1, E = `PLATFORM_EXTENSION` = (2.6 × 1.3) − 2.6 =
  0.7800000000000002 (computed, never the literal 0.78). Parts on the widened platform use
  x = (a·o) + o·E (`shiftedX` / `addShiftedBox`); the slab, edge, building and stairs are not
  shifted; the lamp-halo mesh is moved to x = o·E while its instance centres keep the unshifted x.
  `freeCameraStart` is taken before any shift. No shift loop runs, and no `world.rand` draw happens.
- **Order effects.** Pads: graded → building pad (yaw atan2(forward)) → landing pad (yaw =
  group `rotation.y`) → later houses/windmill → `buildTerrain`. Exclusions start with the 26 path
  circles, then the r8 disc. `world.noShadow` = [window halos, lamp halos]; `world.group` gains the
  station group (70 children: 69 meshes + the building) and the path mesh as its last child.
- **Sign.** 1024×256 canvas drawn synchronously through the global `document` (20 context writes,
  Fredoka with a sans-serif fallback), `CanvasTexture` with `SRGBColorSpace` and anisotropy 4, on a
  `MeshBasicMaterial` DoubleSide plane: unlit, so it ignores night, fog and shadows and renders
  darker than its hex values under disabled colour management (kept for parity). Missing 2D
  context → throws `Station name canvas context unavailable`.
- **Clock.** `updateStationClock(world, t)`: minute = (((dir·t)·π)·2)/60, hour =
  dir·(π/2 + ((t·π)·2)/720), dir = `stationClockDirection` = o. Fresh hands sit at 12:00; t = 0
  gives 3:00, and the constructor's first 0.05 s step shows ≈3:00 on the first frame.
- **Per-frame orchestrator.** `World#update(elapsed, dt, trainPosition, trainMotion)` →
  `updateWorld` (`world-per-frame-update.js`), called by `stepSimulation` right after
  `time += simDt; uTime = time` (so it freezes with pause or time scale 0). Fixed slot order:

  | Slot | System | Phase |
  |---|---|---|
  | 1 | station clock | P06 |
  | 2–3 | track-sheep FSM + log + speed/direction; pasture flock | P11 |
  | 4 | station walker update (dt) | P13 |
  | 5 | village residents update (elapsed, dt) | P09 |
  | 6 | log resident event, then traveler event | P09/P13 |
  | 7 | station travelers idle + head-look | P13 |
  | 8 | chimney smoke | P08 |
  | 9 | windmill rotor | P08 |
  | 10–11 | clouds; balloon | P12 |

  `update` assumes a fully built world; the only guards are slots 2–3 (skipped while `world.sheep`
  is null) and slot 5 (`villageResidents?.update(…) ?? null`), the partial-world convention. Tests
  call `updateStationClock` on partial worlds.
- **Error strings added:** `Station name canvas context unavailable`.

## Train (`src/train/`, P07)

```
new Train()                                            object/material/geometry ids follow this order
 ├ group, cars, noShadow, chimney, headlight, front/rear scratch vectors
 ├ createTrainMaterials()  13 materials: 7 npr, cabGlass (MeshBasic), 3 driver npr, 2 raven npr
 ├ locomotive Group L
 │  ├ buildLocomotiveBody   shell + glazed cab (3 glass planes → noShadow) → buildDriverAndRaven → cab fittings
 │  ├ buildLocomotiveFront  door + 10 bolts (1 shared Ico) → buffers → hook/beam → cowcatcher (no uv) → 5 pilot bars
 │  │                       → 3 lamps → halos (createLightGlows → noShadow) → headlight anchor + cone (→ noShadow)
 │  ├ createWheelParts()    6 shared geometries (44 wheel groups use them)
 │  ├ buildLocomotiveWheels per side: 3 drivers, pony, static coupling rod (wheel order = spark round-robin)
 │  └ chimney anchor (0, 2.9, 1.95)
 ├ buildTender(m)
 ├ createCoachMaterials() → createWindowGridTemplate(windowBar)
 ├ per COACH_COLORS: createCoachBodyMaterial → buildPassengerCoach (grids = template.clone(); 12 halos → noShadow)
 ├ mergeStaticGeometry(car.obj, wheel groups) per car, only after all six cars exist
 └ offsets 0 / 4.1 / 8.2 / 13.25 / 18.3 / 23.35 (half lengths + 0.45 gap), cars added to group
```

- **Ids and UUIDs.** Every object, material and geometry id matches the original's relative to each
  counter's start (`createLightGlows` allocates the instanced geometry before its template quad, as
  the original does). The `Math.random` draw total is equal too (9652), but the clone creates all
  13 train materials up front while the original creates cab glass, driver and raven materials
  inline, so the UUIDs of the locomotive group, its 3 glass planes (meshes and geometries) and
  those 6 materials differ; every later node gets the same UUID.
  UUIDs never reach rendering (program cache keys and render-list sorting use ids and sources).
- **Part tables.** Builders describe parts as rows `[shape, args, material, x, y, z, extras]`
  emitted in order by `addParts` (`train-mesh-helpers.js`): a list-valued coordinate emits one
  part per value with a fresh geometry each; per-side blocks run the whole block for side −1, then
  +1 (x mirrored as side·x); extras bake a geometry transform, set mesh scale / `rotation.x`, or push
  onto `noShadow`. Shared geometries (bolt, wheel parts, muntin bars via cloning) are created outside
  the tables.
- **Placement.** `update(world, s)`: per car d = s − offset, front/rear = `pointAtS(d ± 0.34·len)`,
  position = (front + rear)·0.5, `lookAt(front)`, every wheel `rotation.x = d / r`. `s` is never
  wrapped (`pointAtS` wraps).
- **Simulation (`Diorama#updateTrain` → `updateTrainAndEffects`).** `stepTrainStationMotion`
  (pure; cruise 7.5·speedMul, response min(1, 0.9·dt), brake zone 26 with
  target max(0.35, vmax·√(ahead/26)), snap when the step reaches the stop, 4 s dwell, justLeft
  cleared only for 30 < ahead < L − 30) → `train.update` → `computeBrakeStrength`
  (min(1, decel/3) while station braking above 0.1) → `brakeSparks.update` (Math.random ×4 per
  spark) → `puffPool.update` (Math.random ×7 per puff). The pool owns the puff timer; Diorama
  exposes it as the `puffTimer` accessor pair and `puffs` is the pool's own record array.
- **Composition (R9).** world → train → sparks (heightAt bound to the world) → `initTrainMotion`
  (s = stationS + 1, justLeft, speed 2) → sky → 70 puffs → shadow list [sky, sparks,
  world.noShadow…, train.noShadow…, puff meshes…] → glow registry (train glows are its last six).
- **Per frame.** `stepSimulation`: time/uTime → `updateTrain(simDt)` → `world.update(time, simDt,
  loco position, {distance: s, speed, length: totalLength})` (a fresh record each step).
  `renderDioramaFrame`: glow visibility → `writeHeadlightUniforms` (anchor world position;
  normalize(0, −0.08, 1) turned by the locomotive's own quaternion) → sky follow → matrices → passes.
- **Matrix refresh points.** Sparks refresh the loco world matrix (parents only) before spawning;
  chimney and headlight positions use `getWorldPosition`. `stepSimulation` allocates no
  UUID-bearing three objects.
- **Dispose.** `brakeSparks.dispose()` runs before the glow disposal loop; train and puff
  geometries/materials are never disposed (kept for parity).
- **Quirks kept for parity:** static coupling rods while the crank pins turn; static driver and
  raven; brake-strength spike (capped at 1) when the slider drops mid-brake; dt = 0 while slowing
  gives strength 1; `puffTimer` drifts negative while standing at speedMul 0; puff emission
  silently skipped when all 70 are live; `s` never wrapped; the motion record is allocated per
  step; sparks bounce on the terrain heightmap (≈ trackY − 0.42), not the ballast, and do not
  inherit the train's velocity.

## Village and windmill (`src/world/village/`, `src/world/windmill/`, P08)

```
buildVillage(world)                                    build step 7 (after buildStation); first world.rand consumer (W1)
 ├ createVillagePalette()  cream, 5 roofs, dark, window glass, shutterWood (= the station's), shutterPanel,
 │                         shutter/panel boxes, jittered puff Ico, smoke, stone, leaves, petals, flower Ico
 ├ repeat while houses < 8 and tries < 600:  angle = r·π·2, radius = 11 + r·14 (2 draws per try)
 │    reject (no draws): height ∉ [0.9, 9] → slope_1.5 > 2.2 → nearest-track < 6.5 → Vector2 gap < 5 → excluded(·, 3)
 │    accept: Group at (x, h, z), lookAt(pond at h) → W, D, H (3 draws) → window glows (→ noShadow)
 │            → flattenBuildingGround (yaw atan2(pond − site), falloff 2.8) → addHouseShell (roof n mod 5)
 │            → registerChimneySmoke (1 + 12×5 draws; puffs → noShadow, houseSmoke) → addHouseDoorAndTrim
 │            → addHouseWindows (shutter index (3n + 2w + (side+1)/2) mod 4) → mergeStaticGeometry(house, every puff so far)
 │            → world.group.add(house) → footprint → exclusion r2.6
 ├ < 2 houses → Error 'Village residents require two houses'; villageHomes = first two footprints
 └ buildVillageShrubs      one InstancedMesh (6 per house, house-local spots, size/tint/yaw by running index, no draws)

buildWindmill(world)                                   build step 8 (W2: always 600 draws)
 ├ findWindmillSite        300 × (x, z) around (24, −10) ± 8; skip nearest < 8; strictly highest heightAt wins
 ├ Group at site + (0, −0.3, 0), lookAt(0, y, 30) → pad 3.64², yaw atan2(−x, 30 − z), falloff 3.5
 ├ materials tower, foundation, roof, sail (double-sided), wood → tower, foundation ring, cap
 ├ windmillRoofHeight = (group y + cap y) + 0.8 → door, jambs, lintel, plank, knob, 2 steps
 ├ buildWindmillHayBales   straw, strawEnds, twine; stacks A (3 bales) and B (2), each y = ground − group y − 0.05
 ├ buildWindmillRotor      world.windmillBlades at (0, 5.4, 1.3): 4 arms (spar, sail) + hub sphere
 └ world.group.add(windmill) → exclusion r4.5
```

- **Measured layout.** 8 houses in 256 tries; the world stream stands at draw 1024 after the
  village and 1624 after the windmill (`windmillRoofHeight` 22.266444503377606). `world.group`
  gains houses 1–8, the shrub mesh and the windmill (children 51–60), then the 4 terrain meshes.
  `world.noShadow` grows by 13 per house (glows, then 12 puffs): 106 entries. Exclusions: 27 station
  → 35 after the houses → 36 with the windmill. buildingFoundations: 2 station pads → 10 → 11.
- **Merge.** Per house, 9 merged meshes appended in first-encounter material order (cream, roof,
  shutterWood, dark, flowerPetals, stone, window glass, flowerLeaves, shutterPanel); vent and shutter
  groups stay behind empty; glows (transparent) and every puff (excluded set) stay separate. The
  windmill is not merged: 65 meshes.
- **Order effects.** Shrubs sample heights after every house pad but before the windmill pad; bales
  after the windmill pad; `buildTerrain` bakes the final heights. Materials and geometries are
  created lazily inside the build (material ids feed the opaque sort; geometry ids follow allocation).
- **Per frame.** Slot 8 `updateChimneySmoke(world.houseSmoke, elapsed, dt)`: cycle = elapsed/3.5 +
  phase, house-local drift/bob/wobble, scale envelope core-smoothstep(0, 0.12) × (1 − smoothstep(0.72,
  1)), spin += spin·dt; allocation-free. Slot 9 `updateWindmillRotor`: rotation.z −= dt·0.9 (≈ 7 s
  per turn, clockwise from the front). Both read sim time only, so they freeze with pause / time
  scale 0.
- **Render accounting.** Main pass +21·H + 66 draws (9 merged + 12 puffs per house, 1 shrub mesh, 65
  windmill), shadow pass +9·H + 66 (puffs and glows are noShadow); scale-0 puffs still draw. With
  H = 8 the clone's frozen default went from 556 to 928 calls (+372).
- **Error strings added:** `Village residents require two houses`.
- **Quirks kept for parity:** shrub heights sampled before the windmill pad; puffs are opaque, fade
  by scale only and drift in each house's own frame; scale-0 puffs still issue draw calls; the
  windmill is unmerged; shutter angles repeat every 4 houses; hard throw below 2 houses.

### Parity tooling additions (modification-map entries)

- `tools/parity/page-hide-set-application.mjs`: hide set `unbuiltAfterWindmill` (every
  `world.group` child after the windmill and its 4 terrain meshes, `stationTravelers[].figure`,
  `d.birds.group`). It runs on both sites; on the clone it hides nothing until those later build
  steps land, and entries drop out of the comparison automatically as they do.
- `tools/parity/shot-region-projection.mjs` (new): named regions `village` (houses ∪ shrubs) and
  `windmill`, projected page-side to CSS px (Box3 corners, 12 px pad, clamped); capture stores
  `regions` and `devicePixelRatio` in the shot meta; compare crops both PNGs per region
  (`--region all|none|names`) and judges regional shots on the crops.
- `tools/parity/village-windmill-runtime-probe.mjs` (new): exact probe fields `houseCount`,
  `villageHomePositions`, `windmillPosition`, `windmillQuaternion`, `windmillRoofHeight`,
  `bladeChildCount`, `bladeRotationZ`, `smokeTransforms`, wired into `runtime-counts-probe.mjs`
  (always compared, also under `--fields`).
- `tools/parity/parity-shot-factory-and-camera-poses.mjs` (new): `shot()` factory, defaults
  (incl. `regions: []`) and camera poses split out of `parity-shot-list.mjs`, which gains the stage
  `village-and-windmill` (now active), its four shots and strict `world-core-*` shots.

## Village residents, forest and rocks (`src/life/village/`, `src/world/trees/`, `src/world/rocks/`, P09)

```
createVillageResidents(world)                          build step 10 (after buildTerrain: final heights; no draws)
 ├ new VillageResidents(villageHomes, (x, z) => world.heightAt(x, z), world.group)
 │    materials skin, dark, hair, blouse, dress, apron, shorts, dogCoat, dogCream, collar (npr {color, stipple})
 │    per home: Group (house position + quaternion) → figure (scale 0.8) → body → makeHead (11 parts)
 │              → per side: leg Group (shin, shoe), arm Group (rotation.z ±0.12; upper arm, hand)
 │    dressVillageWoman (frontOffset 0.65, scale.y 0.8·0.7 = 0.5599999999999999, lathe dress, collar puffs,
 │      puff sleeves, hair locks, apron lathe, belt) → dressVillageMan → buildVillageDog (under the man's home)
 │    merges: per resident head, arms, legs, body minus {head, arms}; then dogHead, dogTail, dog minus pivots
 │    update(0, 0)
 └ yards: home.localToWorld(0, 0, depth/2 + frontOffset) → exclusions {x, z, r: 2.2} (woman, man)
buildTrees(world)                                      build step 11 (W4)
 ├ treeCanopyHeights = Float32Array(70²) → createTreeSpeciesGeometries → scatterTrees (14000 attempts)
 ├ npr sway {vertexColors, stipple .55, stippleScale 2.4, treeSway} then bush {same minus treeSway}
 └ per species: computeBoundingBox → InstancedMesh(count) → per instance setMatrixAt, setColorAt, stamp
                → world.group.add → world.treeLayers.push (array from World init, never replaced)
buildRocksAndSheep(world)                              build step 12 (W5a rocks, then W5b sheep)
 ├ buildRiversideRocks: Dodecahedron(.6) jitter(.4, 9) '#9d978c', InstancedMesh(80), count = placed
 └ buildSheepFlock (see "Sheep flock" below)
```

- **Measured layout.** 3749 conifers, 1215 round, 932 cluster, 769 bushes (6665 trees; autumn
  46/36/26, blossom 18/15/18 on round/cluster/bush), 80 rocks. The world stream stands at draw
  78587 after the trees and 84673 after the rocks. `world.group` children: terrain/skirt/plinth
  61–64, home 0 (woman) 65, home 1 (man, dog) 66, tree layers 67–70, rocks 71. Exclusions 36 →
  38. Canopy grid: 3478 non-zero cells, max 26.08.
- **Canopy query.** `World#treeCanopyHeightAt(x, z, r)` → max over the cells covering
  [x ± r] × [z ± r] (low index clamped from below, high from above, so a square off the grid is
  empty), starting from 0. Stamps use the double-precision instance matrix, padded by 0.6 for the
  sway, in species-then-push order (Float32 cells).
- **Per frame.** Slot 5 `villageResidents.update(elapsed, dt)` (walk cycle, ground snap through
  `home.localToWorld`, heading blend `wrapAngle(θ* − θ)·exponentialResponse(dt, 4)`, stride
  sin(7t), breathing, head/arm drift, dog head and tail); slot 6 logs its event. Tree sway is the
  existing `TREE_SWAY` vertex block on `G.uTime` (sim time), so it freezes with pause; the shadow
  override material has no sway.
- **Render accounting.** Main pass +38 draws (33 resident meshes, 4 tree layers, rocks), shadow
  pass +38; the clone's frozen default went from 928 to 1004 calls, 326,946 to 1,657,126 triangles,
  322 to 360 geometries, 17 to 20 programs.
- **Quirks kept for parity:** both residents turn from 0 to 0.2 rad in the first seconds (the man
  visibly at load); rocks and trees ignore each other; the canopy grid includes bushes and the 0.6
  pad; `treeCanopyHeightAt` returns 0 (not ground height) where there are no trees and off the
  grid; instance tints colour trunks too; rocks may sit partly below the water plane; the woman's
  non-uniform scale is shaded with `mat3(modelMatrix)` normals; `home.localToWorld` runs every
  frame on static homes; the sheep clearings are added after the trees; tree shadows do not sway.

### Parity tooling additions (modification-map entries)

- `tools/parity/page-shot-actions.mjs` (new, split from `page-parity-helpers.mjs` for the line
  budget): optional shot fields applied after stepping, parking, camera pose and hide sets:
  `uniformTimeOffset` (adds to `uTime` without a sim step), `debugLayerOff` (clicks the
  `#debug-layers` checkbox by label and captures its log line), `inPageCameraPose` (named in-page
  registry; `villageResidentYard` = woman's home frame, camera (−1.5, 2.4, depth/2 + 5.5), target
  (0, 0.7, depth/2 + 0.65)), `holdPausedFrames` (waits n frames paused, records uTime before/after).
  Results go into the capture meta as `shotActions`.
- `tools/parity/intra-site-shot-checks.mjs` (new): shot `relation` {to, expect 'differs' with
  `minOverFraction` | 'identical'} judged per site by `parity:compare`, plus checks of the recorded
  shot actions (paused hold kept uTime, layer switch hid and logged).
- `tools/parity/page-hide-set-application.mjs`: family `water` (direct `world.group` meshes whose
  shader has no `uColor`: water surface and waterfall); `parity-shot-list.mjs` preset
  `cloneMissing` = sheep, water, clouds, balloon, birds, station figures; stage
  `residents-and-forest` (now active) with eight new shots plus the two `station-free-start-*`
  shots, now strict under the same mask; research paths moved to
  `research-capture-paths.mjs`.
- `tools/parity/forest-residents-runtime-probe.mjs` (new): probe section `forest` (`treeCounts`,
  `rockCount`, `residentMeshCount`, `exclusionCount`, `hasSheepFlock`) with the rule "counts equal,
  exclusion delta −3 while only the original has the flock"; probe diffing moved to
  `probe-result-diffing.mjs`.

## Camera modes (`src/engine/cameras/`, P10)

```
UI setMode (hud-state-actions) ──> d.setMode(mode) ──> camera-mode-director.setCameraMode(d, mode)
  1 own-key check on CAMERA_FOV, else throw 'Invalid camera mode: <mode>'
  2 overviewIntro set → null + '[CAMERA] Overview intro interrupted by mode selection' (even on a repeat)
  3 same mode and not overview → return
  4 leaving orbit → saveFreeCameraPose (position, position + view dir; unlock if locked; keys cleared)
  5 mode, PLC.enabled (orbit), camera.fov + updateProjectionMatrix, controls.enabled (overview), autoRotate false
  6 enter: overview → resetOverviewPose | orbit → restoreFreeCameraPose | side → enterFlyAlong | bridge → (glide)
frame loop ──> d.updateCamera(dt) ──> updateCameraRig(d, dt)          dt = min(0.05, realDt), never time-scaled
  overview → updateOverviewCamera (return) | orbit → updateFreeFlyCamera (return, no glide)
  side → computeFlyAlongDesired(d, dt, tmpA, tmpB) → {2, 5} | bridge → computeBridgeDesired → default {2, 2}
  h0 = camPos.y → camPos.lerp(tmpA, α(dt, 2)) → [side] applyFlyAlongHeight(d, dt, h0, tmpA)
  → camTarget.lerp(tmpB, α(dt, k)) → camera.position = camPos, lookAt(camTarget) → [bridge] controls.target = camTarget
canvas 'click' ──> d.onCanvasClick (bindClickToLock): orbit and not locked → firstPersonControls.lock(true)
dispose ──> disposeFirstPersonControls(d): unlock if locked → remove 'click' listener → PLC.dispose()
```

| module | exports |
|---|---|
| `camera-mode-director.js` | `CAMERA_FOV` {overview 42, orbit 65, side 48, bridge 42}, `setCameraMode`, `updateCameraRig` |
| `free-fly-pointer-lock-camera.js` | `FREE_CAMERA_VERTICAL_MARGIN` (5°), `FREE_FLY` {speed 12, sprintSpeed 24, edgeInset 1, groundClearance 1.2, ceiling 200}, `createFirstPersonControls`, `bindClickToLock`, `saveFreeCameraPose`, `restoreFreeCameraPose`, `updateFreeFlyCamera`, `disposeFirstPersonControls` |
| `train-fly-along-camera-rig.js` | `FLY_ALONG` (21 keys), `wideShotBlendAtPhase`, `enterFlyAlong`, `computeFlyAlongDesired`, `applyFlyAlongHeight` |
| `bridge-tripod-camera.js` | `BRIDGE_TRIPOD` {x −3, y 5.5, z 60, targetXLimit 14, targetXScale 0.35, targetY 8.5, targetZ 36}, `computeBridgeDesired` |

**Diorama fields used by the rigs.** `mode`, `camera`, `controls`, `firstPersonControls`,
`movementKeys`, `camPos`, `camTarget`, `freeCameraPose` {position, target} (clones of
`world.freeCameraStart`, set in `composeDioramaScene` right after the world group is added),
`flyAlongElapsed`, `flyAlongSide`, `flyAlongAnchor`, `flyAlongVelocity`, `previousFlyAlongAnchor`,
`tmpA` (desired position), `tmpB` (desired target), `onCanvasClick`; read only: `overviewIntro`,
`autoRotateEnabled`, `paused`, `timeScale`, `s`, `train.loco.obj`, `world.heightAt`,
`world.treeCanopyHeightAt`, `world.pointAtS`, `renderer.domElement`.

- **Free fly.** While the PLC is locked: inputs W−S, D−A, Space−C (held = 1); if any is non-zero the
  heading is `right(camera quaternion)·iR + forward·iF`, `y += iU`, normalised, and the camera moves
  by `heading · (pace·dt)` (24 with either Shift, else 12). Then x and z clamp to ±61 and y to
  [heightAt(x, z) + 1.2, 200] (x/z already clamped). Clamps run only inside the moving branch, so a
  restored pose or mouse look is never clamped. camPos/camTarget always mirror the camera.
- **Train fly-along.** Elapsed advances by the real dt only when not paused and timeScale > 0; phase
  φ = (e·π)·2. The driver anchor (0, 2.45, −1.4) goes through `loco.localToWorld`; the anchor delta
  carries camPos and camTarget (velocity = delta.divideScalar(dt) when dt > 0). Wide-shot blend
  b = ((1 − cos(φ/56))·0.5)³ scales the local offset (σ·(20 + 4 sin(φ/31)), 5 + 2 sin(φ/23),
  7 sin(φ/41)) by lerp(1, 2, b) before the loco rotation; the canopy look radius is lerp(5, 14, b).
  The goal is floored at terrain + 3 and at the max canopy under camPos, under the goal and 0.8 s
  ahead along the velocity, + 1.5. After the position glide, y is replaced by
  `lerp(h0, goal.y, α(dt, goal.y > h0 ? 3 : 0.7))` and floored at terrain + 3 and the r1 canopy + 1.5.
  The side σ is chosen once at entry from the sign of (loco right axis)·(loco position); on this
  loop it is −1 everywhere (outer side).
- **Bridge tripod.** Goal (−3, 5.5, 60) looking at (clamp(pointAtS(s).x, ±14)·0.35, 8.5, 36), with a
  module scratch vector for `pointAtS`; it writes `controls.target` every frame.
- **Lerp flavours.** `Vector3.lerp` (x + (v − x)·α) for camPos/camTarget; `THREE.MathUtils.lerp`
  ((1 − t)·x + t·y) for the distance multiplier, look radius and height override;
  α(dt, k) = `exponentialResponse(dt, k)` = 1 − exp((−dt)·k).
- **Allocation.** No Object3D/Material/Geometry is created by the camera code (three's UUIDs draw
  Math.random), and nothing is allocated per frame.
- **Quirks kept for parity:** `lock(true)` (unadjusted movement) has no fallback and its rejection
  is uncaught; free-cam clamps apply only while moving; rig periods and look-ahead use real dt and
  ignore timeScale; the bridge overwrites `controls.target`; re-pressing 2 in free mode re-logs,
  re-toasts and re-saves settings without touching the camera; the fly-along side is chosen once at
  entry.

### Parity tooling additions (modification-map entries)

- `tests/helpers/clone-simulation-driver.mjs`: ctx gains `freeCameraPose` and `setCloneMode(ctx, mode)`
  (delegates to `setCameraMode`); `stepCloneFrame` already ends with `updateCameraRig(ctx, dt)`
  (unscaled dt) → `updateCloudCamera?.` → `updateMatrixWorld`.
- `tools/parity/camera-mode-parity-shots.mjs` (new; the shot list stays under its line budget):
  `cameraModeShots(stage)` → `train-camera-day` (side, 6.5 s), `bridge-camera-day` (6 s),
  `bridge-camera-evening` (10.5 s), `free-camera-day` (orbit, 6 s), `train-camera-night` (side, 9 s),
  each strict (hide `cloneMissing` + `transient`) plus a `-relaxed` twin (hide `cloneMissing`,
  transient thresholds); stage `residents-and-forest`.
- `tools/parity/camera-ui-runtime-probe.mjs` (new): `parity:probe -- --camera-ui` (see the parity
  testing guide).

## Sheep flock (`src/life/sheep/`, P11)

```
buildSheepFlock(world)                                 tail of build step 12 (W5b, same world.rand after the rocks)
 ├ createSheepInstancedMeshes: ear Ico(.105) → fleece Ico(.42) jitter(.2, 3) → head Ico(.18) → tail Ico(.14)
 │    → mergeGeometries(fleece, head, tail) → leg Box(.1, .3, .1) → npr {vertexColors, stipple .2, stippleScale 4}
 │    → InstancedMesh body 27, legs 108, ears 54 (one shared material)
 ├ spawnPastureSheep: attempts while k < 4000 and placed < 24; x, z = ((r − .5)·124)·.9 (2 draws),
 │    sheepGroundAt(x, z, own normal) → on accept 5 draws: direction, size, phase, speed, turnSpeed
 ├ findTracksideFlockSite: frames 0, 12, 24 … (not bridge, not excluded at pad 2); side −1 then +1:
 │    shoulder p + r·(side·3.5) level, every preset's exit (frame r) dry/level/free; score Σ max(0, 18 − d)
 │    over the pasture sheep; strict > keeps the first best; none → Error 'No safe trackside sheep clearing'
 ├ createTrackSheep: per preset distance ((i/N)·length) + spacing, center, flat tangent, outward
 │    normalize(tangent × UP)·(side·preset.side) → route + member → sheepStates, trackSheep, exclusion r1.2
 ├ counts n / 4n / 2n, frustumCulled false, world.sheep|sheepLegs|sheepEars, group.add(body, legs, ears)
 └ updateSheepFlock(world, 0, 0)                       dt 0: blends stay put, every matrix written
updateWorld slot 2 advanceTrackSheepFlock(world, trainMotion, dt)   per rail sheep: FSM → console.log(event) → speed, direction
updateWorld slot 3 updateSheepFlock(world, elapsed, dt)             sleep → wander → route | pasture → gait → height → pose
```

| module | exports |
|---|---|
| `sheep-geometry-and-instanced-meshes.js` | `SHEEP_CAPACITY` 27, `SHEEP_LEGS` (4 × {x, z, swing}), `SHEEP_EARS` (2 × {x, heading, phase}), `createSheepInstancedMeshes` |
| `sheep-pasture-ground-query.js` | `sheepGroundAt(world, x, z, normalOut)` (also `World#sheepGroundAt`) |
| `pasture-sheep-spawner.js` | `spawnPastureSheep(world)` → placed count |
| `trackside-sheep-flock-site.js` | `findTracksideFlockSite(world)` → {frameIndex, side, score}; `createTrackSheep(world, site)` |
| `build-sheep-flock.js` | `buildSheepFlock(world)` |
| `track-sheep-escape-state-machine.js` (no three.js) | `TRACK_SHEEP_PRESETS` (3, unfrozen), `advanceTrackSheep(route, train, trackLength, dt)`, `advanceTrackSheepFlock(world, trainMotion, dt)` |
| `sheep-locomotion-and-route-motion.js` | `updateSheepFlock(world, elapsed, dt)` |
| `sheep-instance-pose-writer.js` | `createSheepTransforms()` (17 scratch objects, `World` init), `writeSheepInstancePose`, `markSheepInstancesDirty` |

- **Ground query.** Rejects, in order: |x| or |z| > 60; height < 1 or > 8; nearest track sample
  < 5; inside an exclusion grown by 1; fbm(x·0.045 + 10, z·0.045 − 3, 3) > −0.05. Only then is
  the normal written: normalize(h(x − .6) − h(x + .6), 1.2, h(z − .6) − h(z + .6)); the height is
  returned when normal.y ≥ 0.88, else null (normal stays written).
- **State machine.** hopAge ← min(hopDuration + .3, hopAge + dt); ahead = positiveModulo(route −
  train, L), behind = (L − ahead) % L; danger ⇔ ahead < max(18, 3.2·v) or behind < length + 5.
  Danger zeroes clearTime and startles a `track`/`returning` sheep (reactionTime = delay); no
  danger accumulates clearTime and returns a `waiting` sheep after returnDelay. A `startled` sheep
  counts down and jumps (`escaping`, hopAge 0) when the delay ends, ahead < max(5, 1.5·v) or the
  tail window holds. The offset then walks toward 0 / held / 3.5 / 3.5 / 0 at 0 / 0 / escapeSpeed /
  0 / 0.65 m/s; arrival is exact equality (`escaping` → `waiting`, `returning` → `track`). Only the
  last event of a step is returned. Slot 2 copies the route speed to the sheep and faces it along
  the outward vector (+π while returning).
- **Locomotion.** sleep → night amount (0 on the rails) at rate 1.8; wakefulness w = 1 −
  smoothstep(0, .65, sleep); direction += turnSpeed·dt·w and a candidate step speed·dt·w. Rail
  sheep: x, z = center + outward·offset + (tangent·along + outward·across) with along/across easing
  (rate 5) toward a Lissajous sway in `track` mode (heading and speed from its analytic velocity),
  height max(ground, lerp(ballast slope, rail top, rail support)), shared normal = UP. Pasture
  sheep: move only onto valid ground, otherwise turn at 2.4 rad/s and re-query the current spot.
  gait and groundHeight ease at rate 10 (gait goal min(1, speed/.65) on the rails, w on pasture).
- **Pose.** Orientation slerps (rate 8) toward slerp(slope tilt, identity, .55) × heading; body y
  = groundHeight − .05 + trot bob − sleep crouch + hop arc 4p(1 − p)·hopHeight; squash/stretch for
  the hop, the landing (.3 s) and the startled crouch, width 1/√stretch; legs swing ±0.4 rad with
  gait, tuck during the hop and fold with sleep; ears flap with min(1, speed/.34)·.32·w.
- **Measured layout.** 24 pasture sheep in 450 attempts (the stream stands at draw 85693 after the
  sheep, 1020 W5b draws); clearing at track frame 348, side −1 (score 84.44); routes at 77.380,
  79.930 and 83.130 m; 41 exclusions; `world.group` children 72–74 = body, legs, ears.
- **Per-frame cost.** At most two `sheepGroundAt` calls per pasture sheep; no allocation in slots
  2–3 (scratch objects from `world.sheepTransforms`, the movement goal via a switch).
- **Render accounting.** Three instanced layers, drawn in the main and shadow passes: the clone's
  frozen default went from 1004 to 1010 calls, 1,657,126 to 1,681,318 triangles, 360 to 363
  geometries (textures 5, programs 20 unchanged; original 1373 / 1,762,696 / 419 / 6 / 25).
- **Quirks kept for parity:** a pasture sheep with no valid ground at both spots treats the height
  as 0 and sinks (none of the current spawn points qualifies); the startle line is lost when the
  jump fires in the same step; the danger test ignores train speed when the train stands (station
  dwell, speedMul 0); rail sheep never sleep; the shared slope normal leaks between sheep; the
  clearings are added after trees and rocks; pasture sheep ignore each other; the pasture ear flap
  uses the wander speed even while turning; a startle cannot be called off.

### Parity tooling additions (modification-map entries)

- `tools/parity/sheep-flock-parity-shots.mjs` (new; the shot list stays under its budget):
  `SHEEP_HOP_K2` 824 and `sheepFlockShots(stage)` → `sheep-flock-day-closeup` (120 frames),
  `sheep-flock-night-closeup` (600), `sheep-track-hop-1..3` (K2 − 12, K2 + 20, K2 + 90); hide
  `cloneMissing` + `transient`, in-page pose `sheepFlockCloseup`; stage `residents-and-forest`.
  `parity-shot-list.mjs` preset `cloneMissing` drops `sheep` (now water, clouds, balloon, birds,
  station figures).
- `tools/parity/page-shot-actions.mjs`: in-page pose `sheepFlockCloseup` (route 2: center −
  outward·9, + 5 up, + tangent·3, looking at center + 0.5 up).
- `tools/parity/sheep-flock-runtime-probe.mjs` (new) wired into `runtime-counts-probe.mjs`: probe
  section `sheep` (see the parity testing guide).
- `tests/helpers/sheep-flock-parity-lockstep.mjs` (new): `firstSheepFlockMismatch`,
  `runSheepLockstep`.
