# Code standards

Rules this codebase follows, with the reason for each. The parity-specific rules exist because the
reference implementation is used as an oracle.

## 1. Independent implementation

This is an independent, from-scratch implementation of a reference that has no licence. Never paste,
adapt or lightly edit text from the reference site's JS, CSS, HTML, GLSL or SVG; it is used only as
a black-box test oracle (`.parity-cache/`, gitignored, never imported by `src/`). Code comments never
cite the reference's files or line numbers; they may name only this repo's own modules and symbols or
stable external identifiers.

Allowed as-is, because they are facts or open vocabulary rather than expression: DOM ids, Tailwind
utility class names, short UI strings (labels, toasts, console logs, error messages), the storage
key, standard three.js API idioms, numeric values and option tables, and standard algorithms written
in our own words (mulberry32, hashes, value/gradient noise, smoothstep, Bayer dithering). New code is
written from behavioural specs (parameter tables, formulas, algorithm descriptions, API contracts),
never from the reference's text.

Gate before every commit that touches `index.html`, `styles/`, `src/`, `tools/` or `tests/`. The
two independence checkers live outside the repo, in the research folder that `PARITY_RESEARCH_DIR`
points to:

```bash
python3 "$PARITY_RESEARCH_DIR/verbatim-overlap-check.py" "$PARITY_RESEARCH_DIR/.." <changed files>
```

Every reported chunk must be a single declaration, URL or UI string fully dictated by a value in the
spec; anything else is rewritten. Before a release, run the whole independence audit (commands and
allowance table in `parity-testing-guide.md`, "Independence audit" under "Release sign-off (1.0.0)"): the overlap checker over every tracked
file, the structural-similarity checker (no JS/CSS file above 0.30; `index.html` is exempt because its
DOM ids, classes and labels are dictated), the file:line citation grep, the SVG hash comparison, and
`git ls-files .parity-cache .parity-output` (must print nothing). When an audit hit falls outside the
allowances, rewrite the passage in its owning module and rerun that module's parity tests.

Why: an earlier spec draft transcribed the reference verbatim (433 overlapping chunks); an implementer
correctly refused to build from it. Specs as tables and prose plus the two checker scripts fixed it.

## 2. File rules

| Rule | Detail | Why |
|---|---|---|
| Runtime | Vanilla ESM, no bundler; `three@0.186.0` via the import map; node tests resolve the same bare specifier from the `three` devDependency | build-free deploy; identical module graph in browser and tests |
| Size | Every code file stays under 200 lines (`npm run check:lines`, 245 files, max 199) | small files are easy for agents and reviewers to read whole; splits are named for what they hold |
| Naming | kebab-case, descriptive file names (`track-sheep-escape-state-machine.js`, not `sheep2.js`) | a file name tells an agent what it holds without opening it |
| Comments | short, one line, state the *why*; never reference plans, phases, finding ids or the reference's files | comments outlive plans |
| Exports | named exports only, no default exports | call sites stay greppable |
| Side effects | only `src/main-entry.js` touches the DOM or globals at module evaluation (plus the colour-management side-effect module); `src/ui/*` touches no DOM at import | every module imports cleanly under `node --test` |
| Console output | exact strings per subsystem (`[CAMERA]`, `[SHEEP]`, …); no incidental extra output; `[PARITY]` only behind the hook | log sequences are compared between sites |
| Refactors | output-identical refactors (module splits, caching, scratch-object reuse, a registry instead of inline calls) are always allowed when observable behaviour is unchanged | keeps structure free while parity stays provable |
| Validation | plain JS with no type system; validate at the boundary (e.g. all-or-nothing settings validation) | one place to reason about bad input |

## 3. Parity-critical rules

These rules decide whether outputs stay bit-identical to the oracle. Breaking one usually shows up as
a node lockstep mismatch long before anything looks wrong.

- **Float-exact operand order.** Keep each formula's grouping exactly as specified, left to right
  unless bracketed: doubles are not associative, and accept/reject decisions in placement code
  change how many PRNG draws are consumed. `Math.hypot` vs `√(Σx²)`, `**` vs repeated products and
  iterated products vs `pow` differ in the last bit; use the stated form.
- **Float32 storage points.** Round to Float32 exactly where the reference stores Float32 (heights,
  `sx`/`sz`, canopy heights, instance buffers) and nowhere else.
- **Three smoothstep flavours.** Core `smoothstep(a, b, x)` (reversed edges allowed, used by
  world-side code), `THREE.MathUtils.smoothstep(x, min, max)` (birds, walker, residents) and
  `THREE.MathUtils.smootherstep` (building pads). Using the wrong one changes bits or shapes. Never
  "fix" a reversed-edge core call. In GLSL, reversed-edge uses (sky mist, waterfall splash) are written
  as `1 − smoothstep(lo, hi, x)` because GLSL `smoothstep` is undefined for `edge0 > edge1`.
- **`npr()` option literals** keep the reference call site's keys, key order and values: the cache
  key is `JSON.stringify(options)`, so a reordered or normalised literal creates a distinct material,
  which shifts merge batches, draw calls and the `material.id` sort order.
- **Material creation order** is part of the output: the renderer's opaque sort breaks ties by
  `material.id`, so palettes are created in a fixed table order.
- **Never `.clone()` a `ShaderMaterial`**, and never reassign a key on `G`, `NIGHT_UNIFORMS`,
  `SHADER_NIGHT_UNIFORMS` or `LIGHTING_UNIFORMS` (all frozen; reassigning throws). Both would break
  the shared-uniform-by-reference model.
- **Allocation order.** Every `Object3D`, geometry, material, texture and source draws 4
  `Math.random` values for its UUID; allocate in the reference's order and do not add helper groups,
  clones or module-scope scene objects. No three.js allocation per frame.
- **Scene insertion order** is part of the output (glow collection order, shadow-hidden list,
  transparent tie-breaks, merge batch order).
- **Never reorder world build steps**; `world.rand` is consumed in step order.
- **Scalar-helper substitutions** (`wrapAngle`, `positiveModulo`, `exponentialResponse`) may replace
  an inline expression only when exact:
  - `wrapAngle(h − r)` replaces `atan2(sin(h − r), cos(h − r))` (walker, bird and resident heading).
  - `positiveModulo(x, L)` replaces `((x % L) + L) % L`, including `(((s / L) % 1) + 1) % 1` →
    `positiveModulo(s / L, 1)`.
  - `exponentialResponse(dt, r)` replaces `1 − exp(−dt · r)` only when `r` is a single operand or
    fully parenthesised. Never collapse a three-factor exponent `−dt · a · b` (it evaluates as
    `((−dt) · a) · b`), and never replace the cloud-return `exp(−CLOUD_RETURN_RESPONSE · dt)`
    (rate-first, a different form).
- **GLSL is judged by interface and output**, never by text: uniform/attribute/`#ifdef`/function
  signatures via `extractGlslInterface`, and rendered pixels.
- **Parity tests restore any global `.value` they mutate** in a `finally` block: the uniform bag and
  the `npr()` cache are process-global.

## 4. Engine conventions

- **Instance dispatch.** The frame loop and `stepSimulation` read `updateTimeOfDay`, `updateCamera`,
  `updateTrain`, `world`, `birds`, `world.updateCloudCamera` and `render` from the diorama instance
  every frame: never cached, bound or destructured. The capture freeze swaps no-ops onto the instance;
  caching a reference would silently disable them on the clone only. The calls are unguarded so a
  diorama without its world or train fails at the cause.
- **Registries over inline calls.** World construction is an ordered, named registry
  (`WORLD_BUILD_STEPS`) and the per-frame update is a fixed slot list (`updateWorld`), so tests can
  stop, skip or wrap a step and a new system has exactly one insertion point.
- **Pure state machines.** Behaviour with branching (train motion, rail sheep, bird flocks) lives in
  three.js-free modules that take a snapshot and return the next state, so it is unit-testable and
  fuzzable against the oracle.
- **Scratch objects.** Per-frame code reuses module-level or world-owned scratch vectors
  (`world.sheepTransforms`, `computeFlockSnapshot`'s `target`), never `new` per frame.

## 5. Tests

- `npm test` = `node --test "tests/unit/**/*.test.mjs"` (296 tests: unit plus cheap cache-gated oracle
  cases); `npm run test:parity` = `node --test --test-concurrency=1 "tests/parity/*.test.mjs"` (79
  heavier oracle tests, one process at a time, ≈ 80 s on an idle machine). Files are named `*.test.mjs`; test names
  describe a scenario ("absent key returns a fresh defaults clone"), never a phase or finding id.
- Scratch files live in `/tmp`, never in the repo: a stray `*.test.mjs` would be picked up.
- Fakes are minimal purpose-built stand-ins (a `Map`-backed storage, a DOM-free `EventTarget` pair,
  a recording 2D canvas), never a full DOM library.
- `node:test` mock timers drive `setTimeout`/`setInterval`; `requestAnimationFrame` is a tiny manual
  queue flushed explicitly.
- Oracle-dependent tests are gated with `{ skip: originalSkipReason([...]) }`, so a missing cache
  reports a skip with `run npm run parity:fetch`, never a failure.
- Golden values that equal the oracle's (FNV-1a hashes of output arrays, layout scalars) live in
  `npm test` so they hold without the cache.

## 6. Parity harness conventions

- **`[PARITY]` output only behind the hook.** `installParityTestHook` is the single source of
  `[PARITY]` lines and of `window.__diorama` / `window.__parityBuildInfo`. CLI progress is plain text.
- **CLIs guard `main()`:** a `tools/parity/*.mjs` CLI runs only when its module URL equals
  `pathToFileURL(process.argv[1])`, so tests import its pure parts without side effects.
- **Shots are gated by descriptive stage names** (`shell-and-sky`, `train`, `village-and-windmill`,
  `residents-and-forest`, `full-scene`); `ACTIVE_PARITY_STAGE` is `full-scene`.
- **Helpers never modify the original modules on disk.** Partial original builds patch
  `World.prototype` in memory for one construction and restore every patched method in `finally`;
  the original site is patched only inside the Playwright test browser.
- **Research paths resolve in one place:** `resolveResearchDir()` in
  `tools/parity/research-capture-paths.mjs` (re-exported by `parity-shot-list.mjs`;
  `PARITY_RESEARCH_DIR` override).
- **Numeric gates guard against empty samples:** `null <= 1.1 * null` is `true` in JS, so every perf
  verdict checks `Number.isFinite` first (a zero-sample run once passed the gate).

## 7. Rules learned in the sign-off triage

- **Fix at the lowest failing layer.** Node signature → node lockstep scalars and log lines →
  browser ordered lists and counts → browser pixels → perf. A pixel diff with equal signatures and
  lists points at shader output, uniforms, renderer settings, material creation order or DOM/CSS.
- **Never loosen a threshold or compensate in the harness.** A drift is fixed in its owning module
  (traceability table in `codebase-summary.md`) with a regression assertion in that module's test.
- **Font readiness is judged in the build task.** The station sign is drawn during construction; the
  hook's `fredokaReadyAtBuild` decides a reload, and a sign-canvas hash that differs from the run's
  reference reloads too (at most 2 reloads in sign-off).
- **One browser context per sign-off shot**, and every wait is on state (loader hidden, toast
  settled, frames processed), never on wall-clock time: headless SwiftShader runs near 2 FPS.
- **Lockstep stepping swaps `Math.random` and `console.log` per side** only for the duration of that
  side's step, restoring both even on a throw.
- **UI transitions leak into screenshots.** The capture CSS sets `transition: none !important` on UI
  descendants: a running transition outranks `!important` and kept HUD buttons visible for several
  frames.

## 8. Tool-path hygiene

Local shell hooks block any command text containing a `node_modules`/`dist`/`build`/`vendor`/
`coverage`/`target`/`.git` path segment. Run entry points through npm scripts or files under
`tools/`/`tests/`; Playwright is imported by file URL from inside the tools. This applies to command
text only: `tools/static-dev-server.mjs` and `.gitignore` legitimately contain the literal
`node_modules`. Shell loops run under `bash -c` or a heredoc, because zsh does not word-split `$var`.

## 9. Git and commits

- **Identity:** repo-local only: `git config user.name tranhuuhuy297` and
  `git config user.email tranhuuhuy297@gmail.com`. Never `--global`. Verify with
  `git config --get user.email` before the first commit.
- **Ignore rules:** `.gitignore` (`node_modules/`, `.parity-cache/`, `.parity-output/`, `.vercel/`,
  `*.log`, `.DS_Store`, `.claude/agent-memory/`) is written before `npm install` and before any
  `git add`.
- **Staging:** explicit paths only, never `git add -A` / `git add .`; check `git status --porcelain`
  before every commit.
- **Gate:** `npm test && npm run check:lines` must both be green before every commit.
- **Message type:** conventional commits: `feat:` / `fix:` / `test:` / `refactor:` for code;
  `chore:` / `docs:` only for tooling- or docs-only commits (the repo has no CI).
- **Message content:** an optional scope (`feat(ui):`), a subject describing the change, no AI
  references, no phase numbers or finding ids.
- **Agents never commit.** Implementation subagents return their work; only the orchestrator (or the
  owner) commits, after review. One agent once made six unreviewed commits because its definition
  said "commit"; they had to be removed.
- **Remote:** the repository is private on GitHub (`tranhuuhuy297/train-diorama`); push only when the
  owner asks.
