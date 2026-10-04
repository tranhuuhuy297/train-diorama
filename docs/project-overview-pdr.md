# Project overview and PDR

## 1. Summary

| | |
|---|---|
| Project | Train Diorama: an independent, build-free re-creation of the vanilla three.js Train Diorama scene |
| References | [traindiorama.netlify.app](https://traindiorama.netlify.app/), [train-diorama.vercel.app](https://train-diorama.vercel.app/) (same scene; not affiliated) |
| Status | **Complete.** Release 1.0.0 (full-scene parity sign-off, 2026-10-03); documentation refreshed 2026-10-04 |
| Repository | `tranhuuhuy297/train-diorama` on GitHub, **private**; not published (local dev only) |
| Owner identity | `tranhuuhuy297 <tranhuuhuy297@gmail.com>` (repo-local git config) |
| Size | 245 code files (21,395 lines; `src/`, `styles/`, `tools/`, `tests/`, `index.html`), every file under 200 lines (max 199); 296 unit tests, 79 node parity tests |
| Built with | Claude Code (Opus 5.5, 1M context) driving multi-agent Workflow scripts (~30M+ subagent tokens); see `how-it-was-built.md` |
| Next | Post-parity optional fixes and open items (`development-roadmap.md`, "Next") |

## 2. Goal

Re-create the reference scene so that the rendered result, procedural layout, timings and even its
quirks match exactly, while copying no text, markup, shaders or artwork from it. The reference has no
licence, so it was used only as a black-box test oracle (its modules run from a gitignored
`.parity-cache/` in node tests, and its live site is compared in a test browser), never as a text
source.

Secondary goal (2026-10-04 onward): document the finished project in depth: an operating manual for
Claude Code (`CLAUDE.md`), a technique catalogue with the real numbers (`diorama-techniques.md`) and
the full build history (`how-it-was-built.md`, `prompt-log/`).

## 3. Fixed decisions

| Decision | Rule | Why |
|---|---|---|
| Independent implementation | Every file is written fresh from behavioural specs (parameter tables, formulas, algorithm descriptions, API contracts). Comments never cite the reference's files or lines. A verbatim-overlap checker and a structural-similarity checker gate every change and the release. | The reference is unlicensed; copying would be infringement. A plan draft that transcribed it verbatim was refused by the implementer and rewritten. |
| Exact parity, quirks included | Visible behaviour, layout (same seeds 42 / 1337 / 7821, same draw order), timings and known quirks are reproduced on purpose. Fixes for quirks are a post-parity backlog. | A strict, measurable target lets agents verify their own work against an oracle. |
| Runtime | Vanilla ESM, no bundler; `three@0.186.0` pinned via an unpkg import map; Fredoka from Google Fonts; hand-written CSS that keeps the reference's Tailwind utility class names as selectors, with no Tailwind build. | Build-free: any static file server runs it. |
| Code shape | kebab-case file names, every code file under 200 lines (`npm run check:lines`), short comments stating the why, no plan or phase references in code. | Small, descriptively named files are easy for agents to read whole and review. |
| Repository | Repo-local git identity, never `--global`; conventional commits; explicit staging; agents never commit. | Personal identity on a work machine; reviewable history. |
| Tests | `devDependencies` only (`three`, `playwright`); `node --test`; `npm test` runs `tests/unit/**`, `npm run test:parity` the heavy suites. | No test framework to learn; fast unit loop. |
| Parity harness | Node scene-signature and lockstep oracle tests against the cached reference modules; Playwright captures and probes against the live reference and the local clone, frozen in identical seeded states. | Proves output equality without reading the reference as text. |
| Assets and strings | Console logs, the L pose key, the debug menu, the storage key `train-scene-settings-v2` and the Vercel analytics stub are kept; the logo and favicon are original artwork (Fredoka 700 outlines plus a hand-built motif). | Logs and keys are observable behaviour; artwork is expression and must be original. |
| Tooling hygiene | Shell commands never contain `node_modules`/`build`/`vendor`/`dist` path segments (local hooks block them); headless captures freeze the scene and step it at a fixed dt instead of waiting on wall-clock time. | Hooks; SwiftShader renders at ~2 FPS. |
| Publication | Private repository, nothing deployed. `vercel.json` and `.vercelignore` stay for an optional static deploy. | Owner decision on 2026-10-04: the repo went back to private, and since GitHub Pages is not available for private repos on the free plan, the Pages site and its workflow were removed. |

## 4. Scope

In scope and delivered (147 inventoried features, traced in `codebase-summary.md`):

| Area | Delivered |
|---|---|
| Page and UI | page shell and import map, hand-written utility CSS, bottom HUD (camera modes, time of day, pause, turntable, ink lines, train speed, time scale, pixel-art resolution), night theme, shortcuts panel, keyboard shortcuts, right-click resets, toast, weighted loader, `···` debug menu, persistence |
| Engine | renderer, 120 fps-capped deadline loop, three palettes with a 3 s blend, procedural sky, custom 2048² shadow pass, ink/saturation/grain/Bayer/vignette post pass, pixel-art resolution, four camera modes with intro and glides |
| Materials | shared lighting uniforms, NPR cel shader with stipple, strata, flowers, tree sway, night and local glows; water and waterfall shaders; glow sprites and headlight cone |
| World | 16 ordered build steps: track frames, bridge search, heightmap, track, bridge, station, village, windmill, terrain, residents, trees, rocks and sheep, water, clouds, balloon, bird perches; 11 per-frame world update systems in a fixed order |
| Train | locomotive, tender, four coaches, station-stop motion, smoke, brake sparks, headlight |
| Life | village residents and dog, 27 sheep (24 pasture + 3 trackside), two station travelers, 18 birds in 7 flocks |
| Verification | node oracle suites, browser capture/compare/probe, sign-off set, performance budget, research recapture, smoke check, independence audit |

Out of scope: fixing the reference's quirks (backlog in `development-roadmap.md`), a bundled build or
offline fallback for the CDNs (the reference has none), publication.

## 5. Parity acceptance criteria

Thresholds are defined once (`tools/parity/parity-shot-stages-and-hide-sets.mjs`) and reused by every
check:

| Shot kind | Mean-abs diff (0–255) | Pixels with a channel diff > 16 |
|---|---|---|
| Deterministic 3D render | ≤ 1.0 | ≤ 0.5 % |
| 3D render with transient effects (smoke, sparks) visible | ≤ 3.0 | ≤ 3 % |
| DOM-region element screenshot | ≤ 0.5 | ≤ 0.2 % |

DOM geometry (`getBoundingClientRect`) matches within ±0.5 px; the loader card is compared with the
logo's pixels masked (the logo is intentionally original), while its boxes (`.load-card`,
`.load-logo`) must still match within 0.5 px. Console, log, toast and `localStorage` strings are exact.
Renderer counts (draw calls, triangles, geometries, textures, programs) and scene-graph signatures
are compared exactly against the reference. Performance (`tools/parity/performance-budget-probe.mjs`):
BUILD and CPU-submit medians (frozen and running) ≤ 1.10 × the reference; allocation per step
(total and app) ≤ 1.10 × the reference; retained heap growth ≤ the reference + 64 KB. A missing
sample set fails the check.

## 6. Acceptance status (release 1.0.0)

| Requirement | Status |
|---|---|
| Node parity: construction signature, ordered lists, world summary, 10 800 lockstep frames, log sequences | met (`tests/parity/full-scene-signature-parity.test.mjs`) |
| `npm test` 0 fail / 0 skipped with the oracle cache; `check:lines` | met (296 tests; 245 files, max 199 lines) |
| `npm run test:parity` | met (79 tests, ≈ 75 s) |
| Browser sign-off: 21 3D + 7 DOM shots within thresholds, equal log sequences, 0 clone errors, loader boxes ≤ 0.5 px | met (28/28, max channel diff ≤ 1) |
| Runtime probe: 8 frozen states exactly equal (counts, summary, lists, instanced counts, sign hash) | met |
| Performance: BUILD and CPU-submit medians ≤ 1.10 × the reference; heap growth and allocation per step | met (BUILD 1.026 ×, CPU 0.983 × frozen / 1.000 × running, heap +25.6 KB, allocation 0.73 ×) |
| Research recapture: 28 shots with palette overlap ≥ 7/10 | met (all ≥ 8/10, no exceptions) |
| Independence audit: only allowed overlap hits, no citations, own logo and favicon | met (structural similarity ≤ 0.22 for every JS/CSS file; `index.html` 0.53 from shared DOM ids, classes and labels) |
| 147 features traced to files and a covering test | met (`codebase-summary.md`) |
| Documentation: `CLAUDE.md`, technique catalogue, build history, prompt log | met (2026-10-04 pass) |

## 7. Open items

| Item | Owner action |
|---|---|
| Manual headed pointer-lock checklist (in `parity-testing-guide.md`, probe section) | run once in a real browser with `npm run dev` and record the date and browser |
| Visual confirmation of the logo, favicon and style-bible ticks (reviewed by the implementation agent) | confirm or request changes |
| `.vercelignore` lacks `CLAUDE.md` | add it before any Vercel deploy |
| Keep the `?parity` hook in any future public build? | default: keep; it is harmless (exposes the scene only to the tab's own console) |

## 8. Lessons learned

- The expensive part was research and planning (about 16 hours for the planning workflow alone) plus
  the first three milestones; once the cross-module contracts and implementation notes matured, later
  milestones passed review in the first round (milestones 9–13 took about 40–70 minutes each).
- Specs must be tables, formulas and prose, never transcriptions; enforce it with scripts.
- An oracle plus bit-exact lockstep tests turns "looks the same" into a pass/fail check agents can
  run themselves.
- Agents return content; the orchestrator writes files and commits.

Details, costs and the incident list are in `how-it-was-built.md`.
