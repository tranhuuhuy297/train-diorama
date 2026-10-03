# Project overview & PDR

## Goal

An independent, build-free re-creation of a vanilla three.js train-diorama scene. The rendered
result, procedural layout, timings and quirks must match the reference behaviour exactly, but no
text, markup or artwork is copied from it. The reference site is used only as a black-box test
oracle (via gitignored `.parity-cache/`), never as a text source.

## Fixed decisions (D0–D8)

- **D0 Independent implementation.** Every file is written fresh from phase specs (parameter
  tables, formulas, algorithm descriptions, API contracts). Code comments never cite the
  reference's files or lines. A verbatim-overlap checker gates every phase.
- **D1 Parity.** Visible behaviour, timings and known quirks are reproduced intentionally (see
  `project-changelog.md` and the phase files' "post-parity optional fixes" appendices).
- **D2 Runtime.** Vanilla ESM, no bundler; `three@0.186.0` pinned via an import map on unpkg;
  Fredoka font; hand-written CSS that keeps the original Tailwind utility class *names* as
  selectors (no Tailwind build step).
- **D3 Code shape.** kebab-case filenames, every code file under 200 lines, short one-line
  comments that state the *why*, no plan/phase references in code.
- **D4 Repo.** Local path `train-diorama/`; git identity is repo-local
  (`tranhuuhuy297 <tranhuuhuy297@gmail.com>`), never `--global`; conventional commits.
- **D5 Tests.** `devDependencies` only; bare `node --test` discovers every `tests/**/*.test.mjs`.
- **D6 Parity harness.** From P04 on: node `scene-signature` + oracle tests that run the
  reference modules from a gitignored `.parity-cache/` as a black-box oracle, plus Playwright
  captures/probes against both the clone and the live reference site.
- **D7 Assets.** The L key, console logs and the Vercel analytics stub are kept; the logo and
  favicon are original artwork (Fredoka 700 outlines plus a hand-built motif); the storage key
  stays `train-scene-settings-v2`.
- **D8 Tooling.** Shell commands never reference `node_modules`/`build`/`vendor` path segments;
  tool *file contents* may still contain those literal names.

## Scope of the first phase (P01)

In scope: page shell, import map, hand-written utility CSS, bottom HUD panel, night theme,
shortcuts help panel, settings persistence, keyboard shortcuts, shortcut toast, weighted loading
screen, boot wiring, a non-rendering `Diorama` facade stub, dev/test/lint tooling, and this docs
skeleton.

Out of scope here (later phases): the real WebGL engine and render pipeline (P03), procedural
world/terrain/track/bridge (P05), station (P06), train model and motion (P07), village/windmill
(P08), residents/trees/rocks (P09), free-fly camera completion (P10), sheep (P11), water/clouds/
balloon (P12), station travellers and birds (P13), and the debug menu + parity test harness (P04).

## Feature → phase map (P01; all 147 IDs are traced in `codebase-summary.md`)

| Feature | Description |
|---|---|
| F01.01 | Page shell + import map |
| F01.02 | Hand-written utility CSS |
| F01.03 | Bottom control panel |
| F01.04 | Night HUD theme |
| F01.05 | Shortcuts button + help panel |
| F01.06 | Settings state + localStorage |
| F01.07 | Keyboard shortcuts |
| F01.08 | Right-click resets |
| F01.09 | Shortcut toast |
| F01.10 | Loading step runner |
| F01.11 | Boot wiring + overview intro trigger |
| F01.12 | Debug menu (ships in P04; its CSS ships here) |
| F01.13 | Logo + favicon (original artwork) |

## Parity acceptance

Thresholds and probes are defined once, centrally, and reused by every phase (see
`cross-module-contracts.md` §8 for the authoritative version):

| Shot kind | Mean-abs diff | Pixels with a channel diff > 16 |
|---|---|---|
| Deterministic 3D render | ≤ 1.0 | ≤ 0.5% |
| 3D render with transient effects (smoke, sparks) visible | ≤ 3.0 | ≤ 3% |
| DOM-region element screenshot | ≤ 0.5 | ≤ 0.2% |

DOM geometry (`getBoundingClientRect`) matches within ±0.5 px, except the loader's own boxes
(`.load-card`, `.load-logo`, `.load-bar`, `.load-row`, `.load-hint`, `#load-phase`,
`#load-percent`), which match within 1 px because the logo's artwork — and therefore its exact
rendered box — is intentionally original (D7). Console/log/toast/localStorage strings are
exact-match. From P04 on, renderer/scene-graph signature counts (draw calls, triangles,
geometries, textures, programs) are compared against the reference. The loader logo/favicon are
compared by layout only, never by pixel content.

## Open questions

None outstanding for this phase. The logo/favicon design question is settled (original artwork,
D7); see `design-guidelines.md` for the concrete spec.

## Acceptance status (release 1.0.0)

| requirement | status |
|---|---|
| Node parity: construction signature, ordered lists, world summary, 10 800 lockstep frames, log sequences | met (`full-scene-signature-parity.test.mjs`) |
| `npm test` 0 fail / 0 skipped with the oracle cache; `check:lines` | met (295 tests; max 199 lines) |
| Browser sign-off: 21 3D + 7 DOM shots within thresholds, equal log sequences, 0 clone errors, loader boxes ≤ 0.5 px | met (28/28, max channel diff ≤ 1) |
| Runtime probe: 8 frozen states exactly equal (counts, summary, lists, instanced counts, sign hash) | met |
| Performance: BUILD and CPU-submit medians ≤ 1.10× the original; heap growth and allocation per step | met (BUILD 1.026×, CPU 0.983× / 1.000×, heap +25.6 KB, allocation 0.73×) |
| Research recapture: 28 shots with palette overlap ≥ 7/10 | met (all ≥ 8/10, no exceptions) |
| Independence audit (D0/D7): only allowed overlap hits, no citations, own logo/favicon | met (owner's visual confirmation of the logo pending) |
| 147 feature IDs traced to one owner each with files and a covering test | met (`codebase-summary.md`) |
| Docs final, deployment guide | met |
| Deploy | prepared; Vercel deploy awaits explicit approval; GitHub Pages follows `main` |

Open questions for the owner: deploy to Vercel at all, public or behind Deployment Protection, and
which scope, project name and domain; whether to keep the `?parity` hook on production (default:
keep, it is harmless); whether `modulepreload` hints or SRI should be added post-parity.

