export const meta = {
  name: 'train-diorama-analyze',
  description: 'Deep-read every module of train-diorama.vercel.app source + capture visual reference, producing reimplementation specs',
  phases: [
    { title: 'Analyze', detail: '9 source readers (one per subsystem) + 1 visual capture agent' },
  ],
}

const ROOT = '<workspace>/plans/260930-train-diorama-clone'
const SRC = `${ROOT}/research/source`
const OUT = `${ROOT}/research`

const COMMON = `
Context: We are planning a faithful from-scratch re-implementation ("y như" = look/behave the same) of the web page https://train-diorama.vercel.app/ — a cozy stylized Three.js train diorama (vanilla ES modules + importmap, three@0.186 from unpkg, no build step, static deploy on Vercel, NO external 3D models or textures: everything procedural).
The full downloaded original source is in ${SRC}/ (14 JS modules + index.html + Styles.css + 2 SVGs). Module import graph: TrainScene.js (UI/state entry) -> LoadingScreen.js, dynamic import Diorama.js -> Materials.js, World.js, Train.js, BrakeSparks.js, BirdSystem.js; World.js -> Noise.js, StaticGeometry.js, LightGlows.js, StationWalker.js, TrackSheep.js, VillageResidents.js, Materials.js.

Your job: read your assigned scope COMPLETELY (every line — do not skim) and write a reimplementation spec so a developer who never sees the original could rebuild it to look and behave identically.

Write the spec as markdown to the report path given below. Required sections:
1. Scope & responsibilities
2. Public interface: exports, constructor args, methods/fields that OTHER modules call or read (name + signature + semantics). Also list what this scope consumes from other modules.
3. Feature inventory: every visual element, behavior, interaction, animation. Be exhaustive — small details (vents, lanterns, window glows, flags, fence posts, smoke, easing) matter for fidelity.
4. Algorithms: step-by-step description of each non-trivial algorithm (geometry generation, placement/scattering rules, spline math, shader math, animation/state machines, per-frame update order). Include formulas.
5. Key constants: colors (hex), dimensions, counts, seeds, speeds, timings, thresholds, uniform values — tabulate them; fidelity depends on these.
6. Performance techniques (instancing, merging, render targets, LOD, caching) and gotchas/edge cases.
7. Suggested reimplementation file split: kebab-case filenames, each file < 200 lines (user rule), with responsibility and estimated line count.
8. Risks / tricky parts and open questions.

Rules: describe in your own words; do NOT paste large verbatim code blocks (short formulas or shader snippets <= 8 lines are OK when math is essential). Do not modify anything in ${SRC}. Only write your own report file.
Return the structured summary (reportPath must be the absolute path you wrote).`

const SCOPES = [
  { key: '01-ui-shell-state', desc: 'UI shell, HUD, state & persistence, shortcuts, loading screen',
    files: 'index.html, Styles.css, TrainScene.js, LoadingScreen.js, TrainDiorama_Logo.svg, ClockFavicon.svg',
    extra: 'Cover HUD layout/styling (Tailwind-like utility classes in index.html — determine whether Tailwind CDN is actually loaded or classes are hand-written in Styles.css), keyboard map, settings validation + localStorage, toast, loading phases/progress, how TrainScene drives Diorama (method calls), right-click-to-reset sliders, pause/time-scale semantics, HUD hide. Describe the logo SVG visually.' },
  { key: '02-diorama-renderer-cameras-post', desc: 'Renderer, cameras, palettes, post-processing, render loop',
    files: 'Diorama.js (all 663 lines)',
    extra: 'Cover renderer setup, time-of-day palettes and transitions (all uniform values per palette), sky, 4 camera modes and transitions/controls, pixel-art render target + Bayer dither + upscale, outline/ink pass, per-frame update order, resize handling, how Train/World/Birds/Sparks are wired, public API used by TrainScene.' },
  { key: '03-materials-noise-glows', desc: 'NPR material system, noise, static geometry merge, light glows',
    files: 'Materials.js, Noise.js, StaticGeometry.js, LightGlows.js',
    extra: 'Cover the shader chunk system (G, npr, skyMaterial exports), cel banding, shadow tint, rim, fog, night mode, window emissives, vertex colors, noise functions, geometry merging strategy, glow sprites/halos. Give uniform lists and GLSL math.' },
  { key: '04-world-terrain-track', desc: 'World core: helpers, constructor, heightmap, terrain, river, track spline',
    files: 'World.js lines 1-547 (helpers segDist/riverDist/naturalHeight/extrude/colorize/jitter/box/vents, class World constructor, nearest, inBridge, heightAt, sheepGroundAt, pointAtS/tangentAtS, excluded, findBridge, buildHeightmap, flattenBuildingGround, buildTerrain, buildTrack)',
    extra: 'Also list ALL module-level constants in World.js (grep the top of file) and the order the constructor calls build* methods. Cover diorama footprint/base/sides, terrain coloring, river path, track control points and spline parametrization.' },
  { key: '05-world-bridge-station', desc: 'World: bridge and station',
    files: 'World.js lines 548-1165 (buildBridge, buildStation)',
    extra: 'Skim World.js lines 1-340 only as needed for helper semantics. Enumerate every sub-part of bridge and station (platform, canopy, building, clock, benches, lamps, signage, vents...) with dimensions/colors.' },
  { key: '06-world-village-windmill-trees-rocks', desc: 'World: village, windmill, trees, rocks & sheep placement',
    files: 'World.js lines 1166-1638 (buildVillage, buildWindmill, buildTrees, treeCanopyHeightAt, buildRocksAndSheep)',
    extra: 'Skim World.js lines 1-340 only as needed for helper semantics. Cover house archetypes, placement rules, windmill animation, tree species/instancing/scatter rules, rock scatter, sheep spawning.' },
  { key: '07-world-water-clouds-balloon-update', desc: 'World: water, clouds, bird perches, balloon, sheep update, world update loop',
    files: 'World.js lines 1639-2150 (buildWater, buildClouds, updateCloudCamera, buildTracksideBirdPerches, buildBalloon, updateSheep, update)',
    extra: 'Skim World.js lines 1-340 only as needed. Cover water shading/animation, cloud generation + camera-dependent fading, balloon flight path, sheep behaviors/state machine, full per-frame update order.' },
  { key: '08-train-brake-sparks', desc: 'Train model, motion along track, brake sparks',
    files: 'Train.js, BrakeSparks.js',
    extra: 'Cover locomotive + carriages geometry (every part), wheel/rod animation, smoke/steam, headlight/night lights, motion model (speed, accel/brake on curves, station stops?), how position/motion is exposed to Diorama/World, spark particle system.' },
  { key: '09-life-birds-sheep-walkers-villagers', desc: 'Ambient life: birds, track sheep, station walker, village residents',
    files: 'BirdSystem.js, TrackSheep.js, StationWalker.js, VillageResidents.js',
    extra: 'Cover flocking/perching/scare-by-train logic, sheep on track behavior, walker paths and animation, villager behaviors, instancing, how each is updated and what it reads from World/Train.' },
]

const SPEC_SCHEMA = {
  type: 'object',
  properties: {
    scope: { type: 'string' },
    reportPath: { type: 'string' },
    features: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, description: { type: 'string' },
      complexity: { type: 'string', enum: ['S', 'M', 'L', 'XL'] } }, required: ['name', 'description', 'complexity'] } },
    interfaces: { type: 'array', items: { type: 'string' }, description: 'cross-module APIs provided/consumed' },
    suggestedFiles: { type: 'array', items: { type: 'object', properties: {
      file: { type: 'string' }, responsibility: { type: 'string' }, estLines: { type: 'number' } }, required: ['file', 'responsibility', 'estLines'] } },
    risks: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['scope', 'reportPath', 'features', 'interfaces', 'suggestedFiles', 'risks', 'openQuestions'],
}

const VISUAL_SCHEMA = {
  type: 'object',
  properties: {
    success: { type: 'boolean' },
    method: { type: 'string' },
    captures: { type: 'array', items: { type: 'object', properties: {
      path: { type: 'string' }, state: { type: 'string' }, notes: { type: 'string' } }, required: ['path', 'state', 'notes'] } },
    reportPath: { type: 'string' },
    styleSummary: { type: 'string' },
    problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['success', 'method', 'captures', 'reportPath', 'styleSummary', 'problems'],
}

const VISUAL_PROMPT = `
Goal: capture a visual reference set of the LIVE site https://train-diorama.vercel.app/ so a re-implementation can be compared against it, and write ${OUT}/visual-reference.md describing each shot.

Tooling available: Playwright 1.62 is installed in <workspace>/3d (see its tools/probe-view.mjs and tools/check-controls.mjs for how the user already drives WebGL pages headlessly — READ those first and reuse their launch flags). Browsers: /usr/bin/google-chrome and ~/.cache/ms-playwright/chromium-*. Put your capture script at ${OUT}/capture-visual-reference.mjs and load playwright via createRequire('<workspace>/3d/package.json'). Save PNGs to ${OUT}/captures/. Do NOT modify anything inside the 3d project.
If WebGL fails headless, try: headless new + args ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'], or channel 'chrome', or headed via xvfb-run if installed. Verify the canvas actually rendered (not blank) by viewing the PNGs with the Read tool.

Viewport 1600x900. Wait until #loading is gone/hidden (poll), then an extra ~2s. Capture at least:
1 loading screen (early), 2 overview day (default), 3 overview evening (press T), 4 overview night (T again), back to day,
5 train camera (key 3), 6 bridge camera (key 4), 7 free camera (key 2; screenshot without pointer lock is fine), 8 overview pixel-art (key P; also note which resolution), 9 overview with ink outlines OFF (key O), 10 shortcuts panel open (click #controls-button), 11 HUD hidden (H), 12 a close-up: overview + mouse-wheel zoom in toward the station/bridge, 13 mobile viewport 390x844 overview.
Also record a few frames 1s apart in train camera to observe motion, and note the default localStorage key 'train-scene-settings-v2' (clear it before starting so defaults apply).

Then Read every PNG and write visual-reference.md: per shot — filename, state, composition, dominant palette (estimate hex), lighting/shading style (cel bands, outline thickness, fog, sky gradient), notable objects visible, HUD appearance. End with a "Style bible" section: overall art direction in 10-15 bullets a developer can use as acceptance criteria.
If capture is impossible, explain exactly why in problems[] and still write the report with whatever you got.`

phase('Analyze')
const results = await parallel([
  ...SCOPES.map(s => () => agent(
    `${COMMON}\n\nYOUR SCOPE: ${s.desc}\nFiles: ${s.files} (all under ${SRC}/)\nFocus: ${s.extra}\nReport path: ${OUT}/analysis-${s.key}.md`,
    { label: `analyze:${s.key}`, phase: 'Analyze', schema: SPEC_SCHEMA })),
  () => agent(VISUAL_PROMPT, { label: 'visual-capture', phase: 'Analyze', schema: VISUAL_SCHEMA }),
])

const specs = results.slice(0, SCOPES.length)
const visual = results[SCOPES.length]
const missing = SCOPES.filter((s, i) => !specs[i]).map(s => s.key)
if (missing.length) log(`Missing analyses: ${missing.join(', ')}`)
return {
  specs: specs.filter(Boolean).map(s => ({
    scope: s.scope, reportPath: s.reportPath,
    featureCount: s.features.length,
    features: s.features.map(f => `${f.complexity} ${f.name}`),
    interfaces: s.interfaces, suggestedFiles: s.suggestedFiles,
    risks: s.risks, openQuestions: s.openQuestions,
  })),
  visual,
  missing,
}
