# CLAUDE.md: Train Diorama

Operating manual for Claude Code in this repo. Code is the ground truth; the docs in `docs/` are
the long-form reference: start with `docs/system-architecture.md` and `docs/code-standards.md`, and
use `docs/diorama-techniques.md` (technique catalogue with real numbers) for the how and why of each
part of the scene.

## Project summary

- An independent, from-scratch, build-free three.js re-creation of the "Train Diorama" scene
  (reference: https://traindiorama.netlify.app/ and https://train-diorama.vercel.app/): a floating
  124 x 124 low-poly valley slab (`SIZE` in `src/world/world-constants.js`) with a looping steam
  train, station, village, windmill, forest, river + waterfall, clouds, hot-air balloon, sheep, birds,
  station travelers, NPR cel shading, stipple, ink outlines, pixel-art mode and day/evening/night palettes.
- Status: **finished, release 1.0.0** (`package.json`). All 14 milestones done and committed. Behaviour
  and pixels match the reference: node lockstep is bit-identical (10 800 frames), the browser sign-off
  passed 28/28 shots (max channel diff 0 or 1/255), 8/8 frozen probe states exactly equal, perf
  within 1.10x of the original.
- The repo is **private and not published**. Local dev only. A static-host deploy is optional
  (`vercel.json` + `.vercelignore` exist, see `docs/deployment-guide.md`) and happens only on the
  owner's explicit request.
- Size: 245 code files (all < 200 lines, max 199), 296 `npm test` cases, 13 parity test files (79 tests).
  Default overview (frozen `ov-day-t0`): 1371 draw calls, 1,759,388 triangles, 419 geometries,
  6 textures, 25 programs; the live debug-menu readout with puffs is ~1411 calls / 1,773,736 triangles.

## Stack and constraints

- Vanilla ES modules, **no bundler, no build step, no framework**. `index.html` loads
  `three@0.186.0` from unpkg through an import map (`three`, `three/addons/`). Node tests resolve
  the same bare `three` specifier from the `three` devDependency (pinned `0.186.0`).
- Node **>= 22** for tooling only (`node --test` glob support). Dev deps: `three 0.186.0`, `playwright 1.62.0`.
- No image textures: all colour is procedural (vertex colours, palettes, shaders, canvas sign).
- Fonts: Fredoka from Google Fonts at runtime (station sign + HUD); `system-ui` fallback.
- Runtime network: unpkg + Google Fonts only (Vercel Analytics script only on `*.vercel.app`).
  Settings persist in `localStorage` key `train-scene-settings-v2`.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Static server `tools/static-dev-server.mjs` on `127.0.0.1:4317` (`--port`, `--root`, `PORT`, `HOST`); refuses dotfiles and the modules folder. No install needed to view. |
| `npm test` | `node --test "tests/unit/**/*.test.mjs"`: 296 tests = unit + cheap oracle cases (~2 s). Oracle cases skip with `run npm run parity:fetch` when the cache is missing. |
| `npm run test:parity` | `node --test --test-concurrency=1 "tests/parity/*.test.mjs"`: 79 heavy original-vs-clone tests, serial (~80 s). |
| `npm run check:lines` | Fails if any `.js/.mjs/.css/.html` under `src styles tools tests` or `index.html` reaches 200 lines. |
| `npm run parity:fetch` | Downloads the original's 18 files into gitignored `.parity-cache/original/`, sha256-pinned, `--strict` (writes nothing on mismatch; atomic temp+rename). Offline: `-- --from <dir>`. |
| `npm run parity:capture` | Playwright frozen captures, `-- --target clone\|original\|both --shots <ids\|signoff> [--repeat]` into `.parity-output/shots/<target>/`. |
| `npm run parity:compare` | Pixel diff + log/box compare: `.parity-output/compare/` heatmaps, `compare-report.json`, `compare/summary.md`. |
| `npm run parity:probe` | Renderer counts, world summary, ordered lists (`-- --states signoff`, `--shot <id> --fields calls,triangles`, `--camera-ui`). |
| `npm run parity:signoff` | Release gate: capture + compare + probe for the 28 sign-off shots and 8 probe states. |
| `npm run parity:perf` | BUILD / CPU-submit medians + heap growth, clone vs original (`-- --runs 10`, default 5; `--skip-heap`). |
| `npm run parity:research` | Re-captures the research poses on the clone; palette overlap + contact sheet. |
| `npm run parity:smoke -- --url <u>` | Smoke check of a served build (errors, requests, loader, toast, dispose, analytics). |

Setup for tests/parity: `npm install` (or `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`), then
`npx playwright install chromium` or set `CHROMIUM_PATH` to a full Chromium/Chrome (never the headless
shell). Env: `CLONE_URL` (default `http://localhost:4317/`; the tools start the dev server on demand),
`TARGET_URL` (reference site), `PARITY_RESEARCH_DIR` (default `<workspace>/plans/260930-train-diorama-clone/research`).

## Folder map

| Path | Contents (key entry files) |
|---|---|
| `index.html` | Page shell, import map, fonts, 22 static DOM ids, analytics stub |
| `package.json`, `vercel.json`, `.vercelignore` | Scripts + devDeps; optional static-deploy config |
| `styles/` | 5 hand-written CSS files; `@layer base, utilities` first, unlayered component files after, `night-theme-overrides.css` last |
| `src/main-entry.js` | Boot: settings, HUD, shortcuts, weighted loading steps, dynamic engine import |
| `src/ui/` | Settings schema + `localStorage` persistence, HUD renderers/actions/bindings, keyboard shortcuts, toast, loader step runner, debug menu |
| `src/engine/` | `diorama.js` (facade), `diorama-scene-composition.js`, `frame-loop-scheduler.js`, `simulation-step.js`, `render-pipeline.js`, palettes, shadow pass, post pass (ink/grain/vignette/pixel dither), resizer, glow registry, `parity-test-hook.js` |
| `src/engine/cameras/` | Mode director + overview orbit/intro, free fly (pointer lock), train fly-along, bridge tripod |
| `src/core/` | `seeded-prng-and-gradient-noise.js` (mulberry32, noise2, fbm, smoothstep, lerp), scalar helpers, colour-management side-effect module |
| `src/materials/` | `shared-lighting-uniforms.js` (frozen uniform bag), `npr-cel-material-factory.js` (cached `npr()`), sky, water, waterfall; `glsl/` shader chunks |
| `src/effects/` | Night headlight cone, instanced window/lamp glow sprites |
| `src/geometry/` | Static-geometry merge by material, `box/colorize/tintGeometry/jitter`, profile extrusion, vents |
| `src/world/` | `world.js` (World class + queries), `world-build-steps.js` (16 ordered steps), `world-per-frame-update.js`, `world-constants.js`; subfolders terrain, track, bridge, station, village, windmill, trees, rocks, water, sky (clouds), balloon, perches |
| `src/life/` | Animated life: `village/` residents + dog, `sheep/` flock + track-escape FSM, `station/` travelers + walker, `birds/` flocks |
| `src/train/` | `train.js` + car builders, station stop motion, smoke puff pool (70), brake sparks, headlight uniforms |
| `tests/unit/` | node:test unit suites + cheap oracle cases (`*.test.mjs`) |
| `tests/parity/` | Heavy original-vs-clone suites; `fixtures/` |
| `tests/helpers/` | Original module loader, DOM shim, original World stepper, simulation oracle + clone driver, scene signatures, hashes |
| `tools/` | Dev server, line gate; `tools/parity/` browser harness (shot lists, hide sets, capture, compare, probes, perf, smoke) |
| `assets/` | Own logo (Fredoka outlines) + clock favicon SVGs |
| `docs/` | Long-form docs (below); `docs/images/` final screenshots |
| `.parity-cache/`, `.parity-output/` | Gitignored oracle source and harness output. Never commit, never import from `src/`. |

## Architecture in 15 lines

1. `index.html` → `src/main-entry.js`: load settings → render HUD → bind HUD + keys → `pagehide` dispose.
2. Loading steps: LOADING ENGINE (30, `import('./engine/diorama.js')`) → BUILDING VALLEY AND TRAIN (60) → PREPARING FIRST FRAME (10, one rAF).
3. Build step: `new Diorama(#scene)` → apply 9 saved settings in fixed order ending `prepareOverviewIntro()` → `installParityTestHook` (same task).
4. Then `[GAMEPLAY] Started` → intro → `mountDebugMenu` → toast `H · Hide HUD`.
5. `Diorama` ctor: fields → `WebGLRenderer` (no AA, DPR ≤ 2, linear output) → camera (near 0.3, far 1500) + OrbitControls + free-fly.
6. `composeDioramaScene`: World → birds → free pose → Train → sparks → `initTrainMotion` → sky (r 700) → 70 puffs → shadow-hidden list → glow registry (last).
7. Then shadow pass → main RT with depth texture + post pass → `setTimeOfDay('day', true)` → resize → first `loop()`.
8. `new World()`: `world.rand = mulberry32(42)` then `WORLD_BUILD_STEPS`: buildTrackFrames, findBridge, buildHeightmap, buildTrack, buildBridge, buildStation,
9. buildVillage, buildWindmill, buildTerrain (bake after all pads), createVillageResidents, buildTrees, buildRocksAndSheep, buildWater, buildClouds (last `rand` consumer), buildBalloon, buildBirdPerches.
10. Frame loop (cap 120 fps, `nextFrameDeadline`): `realDt`, `dt = min(0.05, realDt)` → `updateTimeOfDay(realDt)` → `world.nightAmount = uNight`.
11. If `!paused && timeScale > 0`: `stepSimulation(dt * timeScale)` = time + `uTime` → `updateTrain` → `world.update` (11 slots) → `birds.update`.
12. `world.update` slots: clock, track sheep, flock, walker, residents, logs, travelers, chimney smoke, windmill, cloud drift, balloon.
13. Always (even paused): `updateCamera(dt)` → `world.updateCloudCamera(camera.position, dt)` → `render()`.
14. `render`: info reset → glow visibility → headlight uniforms → sky follows camera → one `updateMatrixWorld` → shadow → main RT → post.
15. Frame/CPU EMAs (α 0.1) feed the debug menu. Every member is read from `d` each frame (instance dispatch).

Camera mode ids: `overview` (1), `orbit` = Free (2), `side` = Train (3), `bridge` (4/B); FOV 42/65/48/42.
Time-of-day ids `day`, `evening`, `night`; transitions take 3 s of real time. Pixel modes 720/540/360p.

## Hard rules

- **Files < 200 lines** (`npm run check:lines`). Split by responsibility before you hit it; several
  test/tool files sit at 190-199, so new cases go in a new file.
- **kebab-case** descriptive filenames (`train-station-motion-controller.js`). Named exports only.
- **Comments:** short, one line, state the *why*. No plan/phase/finding references ("P07", "§4"),
  never cite the original's files or line numbers.
- **Seeded determinism.** PRNG streams: A `mulberry32(1337)` noise tables at module load;
  W `world.rand = mulberry32(42)` for placement (village + chimney smoke, windmill, trees, rocks + sheep,
  clouds); B `mulberry32(7821)` per bird system; `Math.random` only for puffs, sparks and three's UUIDs.
  **Never reorder build steps, draws or Object3D creation** (each Object3D draws `Math.random`
  for its UUID). Adding a draw mid-stream shifts every later placement.
- **Float-exact operand order:** keep each formula's grouping; JS doubles are not associative.
  Three smoothstep flavours exist (core `smoothstep(a,b,x)` allows reversed edges, `MathUtils.smoothstep`,
  `smootherstep`); do not swap them.
- **Frozen shared tables:** `G`, `NIGHT_UNIFORMS`, `SHADER_NIGHT_UNIFORMS`, `LIGHTING_UNIFORMS`,
  `PALETTES`, `CAMERA_FOV`, `WORLD_BUILD_STEPS` are frozen. Hold uniform objects by reference;
  never reassign a key, never `.clone()` a `ShaderMaterial`. Exception: do **not** freeze constants
  read in hot per-vertex loops (`POND`, `RIVER`): frozen objects caused a V8 deopt loop.
- **`npr(options)` identity** is `JSON.stringify(options)`: keep option literal keys, order and values
  identical at shared call sites, or you create a new material and shift draw calls.
- **No per-frame allocation** in hot paths: reuse scratch vectors (`d.tmpA`, `d.tmpB`, module scratch),
  indexed `for` loops instead of iterator allocation, no closures per frame. The heap probe checks it.
- **Colour management disabled:** `src/core/disable-three-color-management.js` is imported first by
  `diorama.js`, `world.js`, `shared-lighting-uniforms.js`, the palettes, train materials, sparks and
  colour-sensitive tests; output is `LinearSRGBColorSpace`. Palette hex values are display-space; never convert.
- **Glow/cone materials stay `transparent: true`** (`ADDITIVE_GLOW_RENDER_STATE`; merge skips
  transparent meshes); the glow registry collection stays last in composition.
- **Instance dispatch:** the loop calls `d.updateTimeOfDay`, `d.updateCamera`, `d.world.updateCloudCamera`,
  `d.render` (and `stepSimulation` calls `d.updateTrain`) on the instance every frame; never cache, bind
  or destructure them, or the parity freeze no-ops stop working.
- **Independence:** the original has no licence. Never copy, adapt or lightly edit its JS, CSS,
  GLSL, HTML or SVG. Write from your own specs (tables, formulas, prose). It is used only as a
  runtime black-box oracle from `.parity-cache/`, which is gitignored and never imported by `src/`.
  Allowed overlap: DOM ids, Tailwind class names, UI/console strings, the storage key, numbers,
  three.js idioms, standard algorithms in your own words. Gates:
  `python3 <plan-dir>/research/verbatim-overlap-check.py <plan-dir> <files>` and
  `structural-similarity-check.py <plan-dir> .` (no file above 0.30 except the DOM-dictated
  `index.html` at 0.53; JS/CSS max 0.22).
- **Fix at the lowest failing layer** (node signature → lockstep scalars/logs → browser lists/counts →
  pixels → perf). Never loosen a threshold or compensate in the harness.
- **Kept quirks:** user-visible oddities of the original are kept on purpose; see
  `docs/development-roadmap.md` (post-parity backlog, 28 items). Do not "fix" them without the owner's approval.

## Testing and parity workflow

1. Unit level: `npm test` and `npm run check:lines` must be green before any commit.
2. Node parity (needs `npm run parity:fetch`): `npm run test:parity`. Suites load the original modules
   in node, step the original World build in memory (`World.prototype` patched per construction,
   restored in `finally`), compare scene-graph signatures, world summaries and a seeded lockstep
   simulation (`Object.is` scalars, identical `[TAG]` log lines). Tests restore any global uniform
   `.value` they mutate.
3. Browser parity: `parity:capture -- --target both` → `parity:compare` → `parity:probe`. Both sites
   load with `?parity=freeze` (frozen after the ctor frame and one 0.05 s step), then are advanced with
   fixed-dt stepping; `Math.random` is reseeded per side; transients (puffs, sparks) are hidden unless
   a shot says visible.
4. Thresholds (0..255): deterministic ≤ 1.0 mean / ≤ 0.5 % pixels over 16; transients ≤ 3.0 / ≤ 3 %;
   DOM ≤ 0.5 / ≤ 0.2 %; loader boxes within 0.5 px; probes exact. Capture both targets in one call (same `runId`).
5. Release: `npm run parity:signoff`, `parity:perf -- --runs 10`, independence audit. Details and
   the sign-off numbers: `docs/parity-testing-guide.md` ("Release sign-off (1.0.0)").

`?parity` exposes `window.__diorama` + `window.__parityBuildInfo` (`fredokaReadyAtBuild`) and logs
`[PARITY] Hook installed: live|freeze`; it is dormant without the query param.

## Git conventions

- Identity is **repo-local**: `tranhuuhuy297 <tranhuuhuy297@gmail.com>` (`git config user.name/user.email`,
  never `--global`; the global identity is a different work account). Check `git config --get user.email`
  before the first commit in a new repo.
- Conventional commits: `feat:`, `fix:`, `test:`, `refactor:` for code; `docs:`, `chore:` for
  docs/tooling only. Subject describes the change; no AI mentions, phase numbers or finding ids.
- Stage explicit paths (no `git add -A` / `git add .`); check `git status --porcelain`.
- **Agents never commit or push unless the user explicitly asks in this session.** An agent once made
  6 unauthorized commits because its definition said "commit"; this rule overrides agent definitions.
- Never commit `.parity-cache/`, `.parity-output/`, `node_modules/`, `.claude/agent-memory/`, scratch
  scripts, logs or copies of the original's source. `git ls-files .parity-cache .parity-output` must be empty.

## Environment gotchas

- **Headless WebGL is SwiftShader (~1-2 FPS, sim runs ~0.1x real time).** Never wait on wall-clock time
  or judge speed from headless runs; freeze + fixed-dt stepping, waits on state (loader hidden, toast
  settled, frames processed). Readiness timeout 180 s, other in-page steps 120 s. An original page load takes ~10 s.
- **Shell hook blocks command text** containing `node_modules`, `dist`, `build`, `vendor`, `coverage`,
  `target` or `.git` path segments. Run things through npm scripts or files under `tools/`/`tests/`.
  In scratch scripts load Playwright via `createRequire` on the repo `package.json` or a `file://` URL;
  `NODE_PATH` does not honour its `exports` map.
- **Scratch files go in `/tmp` only.** A stray `tools/smoke-test.mjs` once turned the suite red;
  that is why `npm test` uses an explicit `tests/unit/**` glob. Bare `three` resolves only from repo files.
- **zsh does not word-split `$var`**: loops over a variable silently run once. Use `bash -c '...'`, a
  heredoc script, or `${=var}`.
- **`pkill -f <pattern>` kills its own shell** when the pattern is in the command line (exit 144).
  Stop background servers by PID.
- **Fredoka race:** the station sign canvas is drawn synchronously at build; if the font has not
  loaded, the fallback font is baked. The harness reloads in a fresh context (up to 2 reloads) on a
  `fredokaReadyAtBuild` or sign-hash mismatch; re-run the shot before debugging code.
- CDN flakes (unpkg/fonts) cause occasional 180 s readiness timeouts: retry the single shot first.
- CSS tables in the plan used `›` for the descendant combinator (a space), not `>`.
- Subagents cannot write report `.md` files in this setup: return content as text/structured output.

## Docs

| Doc | Read it for |
|---|---|
| `README.md` | Overview, screenshots, quick start, scripts, controls, documentation index, credits |
| `docs/project-overview-pdr.md` | Goal, fixed decisions, parity acceptance, acceptance status, open items |
| `docs/system-architecture.md` | Module graph, boot order, DOM contract, CSS cascade, uniform bag, NPR material, merge, PRNG, every subsystem, cameras, render budget, parity test hook, "Parity harness overview", data flow |
| `docs/codebase-summary.md` | Module index with line counts, files outside the tree, 147-feature traceability table |
| `docs/code-standards.md` | Independence, file rules, parity-critical rules, engine conventions, tests, harness conventions, sign-off lessons, tool-path hygiene, git |
| `docs/design-guidelines.md` | Style bible (15 visual acceptance criteria), contact sheet, HUD/loader tokens, logo spec |
| `docs/parity-testing-guide.md` | Node/browser/probe harness, setup, determinism rules, troubleshooting, sign-off results |
| `docs/development-roadmap.md` | Milestone history and the post-parity backlog (28 kept quirks) |
| `docs/project-changelog.md` | Per-release changes 0.1.0 → 1.0.0 with measured numbers |
| `docs/deployment-guide.md` | Local use; optional static deploy (Vercel config, ignore list, analytics, rollback) |
| `docs/diorama-techniques.md` + `docs/techniques/` | Technique catalogue (14 chapters): what each technique does, exact numbers, files, cost, pitfalls |
| `docs/how-it-was-built.md` | The multi-agent method that built this repo: timeline, workflow scripts, prompts, costs, 16 incidents and lessons |
| `docs/prompt-log/` | The owner's prompts and the original Workflow scripts as they ran |

Plan artifacts (outside the repo, `<workspace>/plans/260930-train-diorama-clone/`): `plan.md`,
`cross-module-contracts.md`, `folder-tree.md`, `phase-01..14-*.md`, `post-parity-optional-fixes.md`,
`research/analysis-*.md`, `research/features-inventory.md`, `research/visual-reference.md`,
`research/captures/` (reference PNGs + capture logs), independence checkers `research/*.py`
(`research/source/` is the original's downloaded code: oracle only, never copy from it),
`workflows/implementation-notes.md` (facts discovered per phase), and `prompt-log/`
(`process-facts.md` timeline, costs and 16 incident lessons; `workflow-scripts/`).
The prompts and the workflow scripts are also copied into `docs/prompt-log/`.
