# Code standards

## Independence (D0)

This is an independent, from-scratch implementation. Never paste, adapt or lightly edit text from
the reference site's JS/CSS/HTML/SVG; it is used only as a black-box test oracle
(`.parity-cache/`, gitignored, never imported by `src/`). Code comments never cite the
reference's files or line numbers — only this repo's own modules/symbols, or stable external
identifiers (RFC numbers, SQLSTATE codes, CVE ids) may be referenced.

Allowed as-is, because they are facts or open vocabulary, not expression: DOM ids, Tailwind
utility class names, short UI strings (labels, toasts, console logs, error messages), the storage
key, standard three.js API idioms, and standard algorithms described in our own words (mulberry32,
hashes, value/gradient noise, smoothstep, Bayer dithering).

Gate before every commit that touches `index.html`, `styles/`, `src/`, `tools/` or `tests/`:
```
python3 <plan-dir>/research/verbatim-overlap-check.py <plan-dir> <changed files>
```
Every reported chunk must be a single declaration, URL or UI string fully dictated by a value in
the relevant phase file; anything else gets rewritten.

Before a release, run the whole independence audit (commands and allowance table in
`parity-testing-guide.md`, "Independence audit"): the overlap checker over every tracked file, the
structural-similarity checker (no file above 0.30 except the DOM-dictated `index.html`), the
file:line citation grep, the SVG hash comparison, and `git ls-files .parity-cache .parity-output`
(must print nothing). Write new code from the phase's tables and prose, never from the original's
text; when an audit hit falls outside the allowances, rewrite the passage in its owning module and
rerun that module's parity tests.

## File rules (R1–R12 digest)

- **R1 Runtime:** vanilla ESM, no bundler; `three@0.186.0` via import map; Node tests resolve the
  same bare specifier from the `three` devDependency.
- **R2–R9:** engine/world/material parity rules that apply once those modules exist (see
  `system-architecture.md`; full detail lives in the plan's cross-module contracts, which are not
  duplicated here to avoid drift).
- **R10 Console strings:** exactly as specified per phase; no incidental extra output.
- **R11 Size & naming:** every code file stays under 200 lines; kebab-case filenames; short
  one-line comments that state the *why*, not a restatement of the code.
- **R12:** output-identical refactors (module splits, caching, scratch-object reuse) are always
  allowed as long as observable behaviour is unchanged.

## Style

- Named exports only (no default exports) — keeps call sites self-documenting under Grep/Search.
- No DOM access at module evaluation time in `src/ui/*`; only `src/main-entry.js` has top-level
  side effects, so every UI module imports cleanly under `node --test`.
- Prefer small pure functions (e.g. `resolveKeyAction`) that are easy to unit test without a DOM.
- `any`-shaped escapes are not applicable (plain JS, no type system); keep inputs validated at the
  boundary instead (see `settings-local-storage-persistence.js`'s all-or-nothing validation).

## Tests

- `npm test` = `node --test "tests/unit/**/*.test.mjs"` (unit + cache-gated oracle cases that are
  cheap); `npm run test:parity` = `node --test --test-concurrency=1 "tests/parity/*.test.mjs"`
  (heavier original-World suites, one process at a time). Files are named `*.test.mjs`; test
  names describe a scenario ("absent key returns a fresh defaults clone"), not a phase or finding id.
- Fakes are minimal, purpose-built stand-ins (a `Map`-backed storage, a DOM-free `EventTarget`
  pair for `window`/`document`), never a full DOM library — keeps intent visible and runtime fast.
- `node:test`'s mock timers (`t.mock.timers` / `test.mock.timers`) drive `setTimeout`/
  `setInterval`; `requestAnimationFrame` is a tiny manual queue flushed explicitly, since it is not
  covered by `mock.timers`.

## Parity harness conventions

- **`[PARITY]` output only behind the hook.** `installParityTestHook` is the single source of
  `[PARITY]` console lines and of `window.__diorama` / `window.__parityBuildInfo`; without the
  `parity` query param nothing is exposed or logged. CLI progress output is plain text.
- **Per-frame dispatch through instance members.** The frame loop and `stepSimulation` call
  `d.updateTimeOfDay`, `d.updateCamera`, `d.updateTrain`, `d.world.…`, `d.render` on the instance
  every frame — never cached, bound or destructured — so the capture freeze can swap no-ops onto
  the instance. The calls are unguarded: a Diorama without its train or world fails at the cause.
- **CLIs guard `main()`:** a `tools/parity/*.mjs` CLI runs only when its module URL equals
  `pathToFileURL(process.argv[1])`, so tests import its pure parts (`computeDiffMetrics`,
  `diffProbeResults`, …) without side effects.
- **Shots are gated by descriptive stage names** (`shell-and-sky`, `train`, `village-and-windmill`, `full-scene`), never
  by plan numbers; advance `ACTIVE_PARITY_STAGE` when a stage's features land.
- **Test helpers never modify the original modules on disk.** Partial original builds patch
  `World.prototype` in memory for one construction and restore every patched method in `finally`;
  the original site is patched only inside the Playwright test browser.
- **Research paths resolve in one place:** `resolveResearchDir()` in
  `tools/parity/parity-shot-list.mjs` (`PARITY_RESEARCH_DIR` override); nothing else hard-codes it.
- **Independent implementation:** no text copied from the original; no original file:line
  citations in code comments (see the Independence section).

## D8: tool-path hygiene

Local tooling (and the shell hooks that gate it) blocks any *command text* containing a
`node_modules`/`dist`/`build`/`vendor`/`coverage`/`target`/`.git` path segment. This never applies
to file *contents* — `tools/static-dev-server.mjs` and `.gitignore` legitimately contain the
literal string `node_modules`, since they are the constants those tools act on, never a path typed
into a shell command.

## Parity-critical rules (materials, noise, merge — from P02)

- **D0 independence applies to GLSL too:** shaders are written fresh from each phase's formula
  tables, never adapted from the oracle's source. Parity for GLSL is judged on *interface*
  (uniform/attribute/`#ifdef`/`COMMON` function names+types, via `extractGlslInterface`) and on
  rendered GPU output, never on shader text.
- **R5 float-exact operand order:** keep each formula's grouping exactly as the phase table states
  it (left to right unless bracketed) — JS/GLSL doubles are not associative, and placement/visual
  code downstream depends on bit-identical results.
- **R6 smoothstep flavours:** there are three distinct functions in this codebase (core
  `smoothstep(a,b,x)`, `THREE.MathUtils.smoothstep(x,min,max)`, `THREE.MathUtils.smootherstep`);
  using the wrong one changes bits or shapes. Never "fix" a reversed-edge call to the core JS
  `smoothstep(a,b,x)` (`a > b`) — it is intentional and the fallback clamp behaviour is kept.
  GLSL reversed-edge uses (sky mist, waterfall splash) are rewritten as `1 − smoothstep(lo, hi, x)`
  with ascending edges per R12 — GLSL `smoothstep` is undefined when `edge0 > edge1`.
- **Never `.clone()` a `ShaderMaterial`**, and never reassign a key on `G`/`NIGHT_UNIFORMS`/
  `SHADER_NIGHT_UNIFORMS`/`LIGHTING_UNIFORMS` (all four containers are frozen — this throws by
  design). Both would silently break the shared-uniform-by-reference contract.
- **`npr()` option literals keep the original call site's keys, key order and values (R7)** —
  the cache key is `JSON.stringify(options)`, so a reordered or normalised literal creates a
  distinct, untracked material instance and shifts the merge-batch/draw-call counts.
- **Scalar-helper substitutions** (`wrapAngle`, `positiveModulo`, `exponentialResponse`) may
  replace an equivalent inline expression only when the substitution is exact:
  - `wrapAngle(h − r)` may replace an inline `atan2(sin(h − r), cos(h − r))` call site (station
    walker heading, bird heading, village-resident heading).
  - `positiveModulo(x, L)` may replace an inline `((x % L) + L) % L`, including the wrapped
    fraction form `(((s / L) % 1) + 1) % 1`, which becomes `positiveModulo(s / L, 1)`.
  - `exponentialResponse(dt, r)` may replace an inline `1 − exp(−dt · r)` only when `r` is a
    single operand or a fully parenthesised expression. Never collapse a three-factor exponent
    `−dt · a · b` (it evaluates as `((−dt) · a) · b`, not `−dt · (a · b)`), and never replace the
    cloud-return exponential `exp(−CLOUD_RETURN_RESPONSE · dt)` — its exponent is rate-first, a
    different form from `exponentialResponse`'s dt-first signature.
- **Parity tests restore any global `.value` they mutate**, in a `finally` block — the uniform
  bag and the `npr()` cache are process-global and shared across the whole test file.
- **No original file:line citations in code comments**, ever — phase files may cite them as a
  behaviour reference; `src/`/`tests/`/`tools/` never do.

## Rules learned in the sign-off triage

- **Fix at the lowest failing layer.** Node signature → node lockstep scalars and log lines →
  browser ordered lists and counts → browser pixels → perf. A pixel diff with equal signatures and
  lists points at shader output, uniforms, renderer settings, material creation order (the
  `material.id` tie-break in the renderer's stable sort) or DOM/CSS.
- **Never loosen a threshold or compensate in the harness.** A drift is fixed in its owning module
  (traceability table in `codebase-summary.md`) with a regression assertion in that module's test.
- **Instance dispatch is a contract.** The frame loop reads `updateTimeOfDay`, `updateCamera`,
  `world.updateCloudCamera` and `render` from the instance every frame; caching a reference would
  silently disable the harness overrides on the clone only.
- **Font readiness is judged in the build task.** The station sign is drawn during construction;
  the hook's `fredokaReadyAtBuild` (same task) decides a reload, not the earlier loader label; a
  sign-canvas hash that differs from the run's reference reloads too (same budget of 2).
- **One browser context per sign-off shot**, and every wait is on state (loader hidden, toast
  settled, frames processed), never on wall-clock time: headless SwiftShader runs near 2 FPS.
- **Lockstep stepping swaps `Math.random` and `console.log` per side** only for the duration of
  that side's step, restoring both even on a throw.

## Git and commits

- **Identity:** repo-local only — `git config user.name tranhuuhuy297` and
  `git config user.email tranhuuhuy297@gmail.com`. Never `--global`. Verify with
  `git config --get user.email` before the first commit.
- **Ignore rules:** `.gitignore` (`node_modules/`, `.parity-cache/`, `.parity-output/`, `.vercel/`,
  `*.log`, `.DS_Store`, `.claude/agent-memory/`) is written before `npm install` and before any
  `git add`. `.vercelignore` also drops `.claude/` so local agent notes never ship.
- **Staging:** explicit paths only, never `git add -A`/`git add .`; check `git status --porcelain`
  before every commit.
- **Gate:** `npm test && npm run check:lines` must both be green before every commit.
- **Message type:** conventional commits — `feat:`/`fix:`/`test:`/`refactor:` for code changes;
  `chore:`/`docs:` only for tooling-only or docs-only commits.
- **Message content:** an optional scope (`feat(ui):`), a subject describing the change, no AI
  references, no phase numbers or finding ids.
- **Remote:** never pushed unless explicitly requested.
