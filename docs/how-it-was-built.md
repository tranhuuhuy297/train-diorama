# How this project was built (Claude Code multi-agent method)

This is the full story of how `train-diorama` was built and the method behind it. It covers what was
done, in what order, with which workflow scripts and prompts, what it cost and what went wrong.

Related material:

- [docs/prompt-log/original-workflow-scripts/](prompt-log/original-workflow-scripts/): the Workflow
  scripts (analysis, plan, plan rewrite, implementation) exactly as they ran.
- [docs/prompt-log/](prompt-log/): the owner's prompts and the process facts log.
- [system-architecture.md](system-architecture.md), [code-standards.md](code-standards.md),
  [parity-testing-guide.md](parity-testing-guide.md), [codebase-summary.md](codebase-summary.md): the
  technical result.

Path placeholders used below: `<workspace>/train-diorama` is this repo. `<workspace>/plans/<plan-dir>`
is the plan folder, which lives outside the repo (research, phase files, reports, implementation
notes). Times are local (UTC+7).

---

## 1. Summary

| item | value |
|---|---|
| Tool | Claude Code CLI, Opus 5.5 (1M context), `/effort ultracode` (xhigh + multi-agent Workflow tool) from the planning step onward |
| Calendar time | 2026-09-30 → 2026-10-03 (about 4 days, with long unattended workflow runs); repo made private afterwards |
| Workflow runs | 1 analysis, 1 plan, 1 plan rewrite, 5 implementation runs (one of them the blocked P01 attempt) |
| Subagents | about 173 in total |
| Subagent tokens | 27.0M measured, plus an unrecorded run (P04–P09) estimated at about 6M, so about 30M+ in total. Planning plus the rewrite was close to half of it. |
| Result | 245 code files (21,395 lines), every file < 200 lines, 296 unit tests, 79 parity tests |
| Parity | 28/28 sign-off shots identical or within 1/255 of the original; 8/8 render-state probes equal; performance within 1.10× of the original |
| Repo state | private, local development only, no hosting (GitHub Pages was used for a while, then removed) |

The pipeline in one line:

```
inline scouting → ANALYZE workflow (9 readers + 1 visual capture)
               → PLAN workflow (architect + coverage check → writer → adversarial verifier per phase → integration critic → revisers)
               → PLAN REWRITE workflow (independence: rewriter → overlap/lost-detail verifier per file)
               → IMPLEMENT workflow per batch of phases (implement → test ∥ review → fix ≤ 3 rounds → commit + push)
               → orchestrator: close leftovers, docs, screenshots
```

---

## 2. Goals and constraints

### 2.1 What the owner asked for

The owner first asked (in Vietnamese) what prompt and effort level would produce a site like
https://train-diorama.vercel.app/ (also published at https://traindiorama.netlify.app/). The first
real work prompt was "make a detailed plan to build a project exactly like this" ("y như", meaning
identical). Later prompts were short: "implement all phase", "commit part of it and push", "add the
reference source, screenshots, deploy to GitHub Pages", "fix the warnings", "do all remaining
phases, commit after each one", and finally "commit when done, then make the repo private, no need
to publish the page any more". The full list is in [docs/prompt-log/](prompt-log/).

"Identical" was read as visual and behavioural parity, including the procedural layout: same
seeds, same PRNG algorithm and same order of random draws, so that every house, tree, rock, sheep and
cloud lands in the same place.

### 2.2 Fixed decisions (recorded in the plan, never re-discussed by agents)

The table shows the final wording in `plan.md`. The first plan workflow had only D1–D8, and its D7
defaulted to reusing the original logo SVG. D0 and the own-artwork logo were added by the
independence rewrite (section 4.4).

| id | decision | why |
|---|---|---|
| D0 | Independent implementation: match the output (look, behaviour, layout, parameters) but never copy the original's JS/CSS/GLSL/SVG text. The original runs only as a local black-box test oracle. | The original has no license. Added after incident 3 (section 7). |
| D1 | Visual and behavioural parity, incl. layout (seeds 42 / 1337 / 7821, mulberry32, identical draw order). User-visible quirks are kept and listed in a "post-parity optional fixes" appendix. | "Y như"; fixing quirks would break the parity oracle. |
| D2 | Vanilla ES modules, `three@0.186.0` + addons through an importmap from unpkg, no build step, Fredoka font, hand-written CSS that keeps the template class names. Static hosting was planned (Vercel, later GitHub Pages); the project ended up private and unpublished. | Same stack as the reference; nothing to build. |
| D3 | kebab-case file names, every code file < 200 lines, domain folders under `src/`, short comments, no plan or phase references in code. | Every file can be read by an agent in one go and reviewed in one pass. |
| D4 | New git repo with a repo-local identity `tranhuuhuy297 <tranhuuhuy297@gmail.com>`, conventional commits. | The global git identity is a work identity. |
| D5 | devDependencies only (`playwright 1.62.0`, `three 0.186.0` for node tests), tests with `node --test`. | Zero runtime dependencies, fast tests. |
| D6 | Parity = node scene-signature and oracle tests against the original modules (gitignored `.parity-cache/`) + Playwright captures and probes on both sites. | Gives a hard, numeric definition of done. |
| D7 | Keep the debug menu, the L pose log, console logs, storage key `train-scene-settings-v2`, the analytics stub (now only on `*.vercel.app` hosts). Logo and favicon are our own design. | Behavioural parity without reusing artwork. |
| D8 | Shell commands avoid `node_modules`/`build` paths (a local hook blocks them); headless WebGL is SwiftShader, so captures use freeze + page-side fixed-dt stepping, never wall-clock waits. | Environment facts discovered during analysis. |

Architecture decisions A1–A8 are output-identical refactors, for example a singleton lighting uniform
bag, an ordered world build-step registry, and a single bird-perch producer that runs last. They are
listed in `plan.md` and in [system-architecture.md](system-architecture.md).

### 2.3 Environment constraints that shaped the method

- Subagents could not write report `.md` files (a harness rule). Every agent returns content through a
  JSON schema and the orchestrator writes the files.
- A local hook blocks any shell command whose text contains `node_modules`, `build`, `dist`,
  `vendor`, `coverage`, `target` or `.git` path segments.
- Headless Chromium renders WebGL through SwiftShader at about 2 FPS, so the simulation runs at about
  0.1× real time.
- The default shell is zsh, which does not word-split `$var`.

---

## 3. Timeline

The data comes from the process-facts log, which is authoritative. "Agents" counts workflow
subagents. Tokens are subagent tokens only; the orchestrator session is extra.

| # | Date | Step | Agents | Subagent tokens | Wall time | Outcome |
|---|---|---|---|---|---|---|
| 0 | 09-30 | Inline scouting: fetch `index.html`, follow imports, download 14 JS modules (about 5k lines; the biggest module 2,150 lines) | – | – | minutes | Local copy of the reference source for analysis (kept in the plan folder, never in the repo) |
| 1 | 09-30 | Analyze workflow: 9 subsystem readers + 1 Playwright visual-capture agent | 10 | 1.58M | 19 min | 9 analysis specs (24–41 KB each), 28 reference screenshots (the log says 29; 28 PNGs are on disk), a 15-point style bible, 147 feature IDs |
| 2 | 09-30 → 10-01 | Plan workflow: architect + deterministic coverage check → writer per phase → adversarial verifier vs the source → integration critic → targeted revisers | 40 | 8.15M | about 16 h | 14 phase files (640–1,130 lines each in v1), contracts, folder tree; 212 verifier issues + 16 integration issues fixed |
| 3 | 10-01 | Implement P01, attempt 1 | 1 | 0.24M | 12 min | BLOCKED: the implementer refused because the plan said "transcribe verbatim" |
| 4 | 10-01 | Plan rewrite workflow: rewriter → verifier per plan file | 32 | 6.65M | 69 min | Verbatim chunks 433 → 0, no fact lost; v1 archived |
| 5 | 10-01 | Implement P01 (implement → test ∥ review → fix ≤ 3 rounds) | 7 | 1.56M | 1.7 h | CLEAN after 2 rounds |
| 6 | 10-01 | Implement P02–P03 | 19 | 3.94M | 3.1 h | P02 CLEAN (3 rounds); P03 UNRESOLVED only because a tester scratch file was picked up by `node --test` |
| 7 | 10-01 → 10-03 | Implement P04–P09 | about 30 | not recorded | about 1 day | P04–P08 CLEAN (P07 needed 1 fix round); the run stopped when the session ended during P09 round 2 |
| 8 | 10-03 | Implement P09–P14 with commit + push per phase | 34 | 4.89M | 8.4 h | P09–P13 CLEAN in round 1, about 40–70 min each; P14 UNRESOLVED after 3 rounds (2 majors), fixed by the orchestrator |

Commits (all on `main`):

| sha | date | content |
|---|---|---|
| a58995a | 10-02 17:24 | P01–P08 in one commit, made by the orchestrator after testing the staged snapshot in isolation |
| 2a51bd1 | 10-02 17:35 | README screenshots, references, Pages workflow (later removed) |
| b2f151f | 10-02 17:46 | CI action bumps to Node 24 versions (later removed with the workflow) |
| 3a254ee | 10-03 15:48 | P09 village residents, forest scatter, riverside rocks |
| 97d4611 | 10-03 16:28 | P10 free, train and bridge cameras |
| 50a5987 | 10-03 17:22 | P11 sheep flock |
| b46790e | 10-03 18:14 | P12 water, waterfall, clouds, balloon |
| 98e83b2 | 10-03 19:18 | P13 station travelers, birds, perches |
| f61bc3c | 10-03 23:56 | P14 parity sign-off, performance budget, docs |

While P14 was still running, the owner asked to commit when done, then make the repo private and stop
publishing the page. The process log records this as done on 10-04: the repo is private, the Pages
workflow is deleted, and the project is local development only.

Final phase list: 01 scaffold/shell/HUD/settings/loading · 02 noise, uniforms, NPR materials, glows,
merge · 03 renderer, sky, shadows, post, pixel art, overview camera · 04 debug menu + parity harness ·
05 terrain, track, bridge · 06 station · 07 train, motion, smoke, sparks, headlight · 08 village +
windmill · 09 residents, trees, rocks · 10 free/train/bridge cameras · 11 sheep · 12 water, clouds,
balloon · 13 station travelers, birds, perches · 14 parity sign-off, performance budget, docs.

---

## 4. Stage-by-stage method

### 4.0 Roles

- **Orchestrator** = the main Claude Code session. It does the following:
  - scouts inline and writes the Workflow scripts;
  - writes every file that agents return through schemas;
  - keeps the carry-notes file;
  - decides when to re-run and closes phases a workflow could not finish;
  - makes the commits that were not delegated.
- **Subagents** = workflow agents with role prompts (reader, architect, writer, verifier, critic,
  rewriter, implementer, tester, reviewer, fixer, committer). Custom agent types were used at first.
  They disappeared mid-project and were dropped (incident 6). Role prompts proved enough.

### 4.1 Stage 0: inline scouting (no workflow)

The goal of this stage is to build the work list before writing any workflow.

1. `curl` the page HTML, read the importmap and the entry module.
2. Follow every `import` and download each module plus CSS and SVGs into
   `<workspace>/plans/<plan-dir>/research/source/` (18 files: 14 JS, `index.html`, CSS, 2 SVGs).
3. Count lines per module. One module had 2,150 lines, which is why its analysis was later split by
   line range.
4. Draw the import graph. It went into the analysis prompt as context.

A lesson came up already at this stage: a multi-step download loop failed silently under zsh
(incident 2). Run multi-step shell loops with `bash -c` or a heredoc.

Why inline: scouting is cheap, and its output (the file list, the size of each module, the import
graph) decides how to split the analysis work. You do not need to know the shape of the whole task,
only the shape of the next fan-out.

### 4.2 Stage 1: analysis workflow (10 agents, 1.58M tokens, 19 min)

Script: `train-diorama-analyze` (as it ran: [`train-diorama-analyze-wf_a3487543-37c.js`](prompt-log/original-workflow-scripts/train-diorama-analyze-wf_a3487543-37c.js)).

Pseudo-structure:

```js
export const meta = { name: 'train-diorama-analyze', description: '...', phases: [{ title: 'Analyze' }] }
const COMMON = `context (what the site is, stack, the import graph, where the source is)
  + job ("read your assigned scope COMPLETELY (every line — do not skim)", write a reimplementation spec)
  + 8 required sections + rules (own words, no large verbatim blocks, formulas/snippets <= 8 lines,
    do not modify the source, write only your report)`
const SCOPES = [ /* 9 entries: key, desc, files (or a World.js line range), extra focus */ ]
phase('Analyze')
const results = await parallel([
  ...SCOPES.map(s => () => agent(`${COMMON}\nYOUR SCOPE: ...\nReport path: .../analysis-${s.key}.md`,
                                 { label: `analyze:${s.key}`, phase: 'Analyze', schema: SPEC_SCHEMA })),
  () => agent(VISUAL_PROMPT, { label: 'visual-capture', phase: 'Analyze', schema: VISUAL_SCHEMA }),
])
return { specs: ..., visual, missing }   // the orchestrator reads this and writes features-inventory.md
```

The 9 scopes (one per subsystem; the 2,150-line world module was split into 4 line ranges):

| scope | content |
|---|---|
| 01 ui-shell-state | HTML, CSS, HUD, settings + localStorage, shortcuts, toast, loading screen, logo |
| 02 diorama-renderer-cameras-post | renderer, palettes, sky, 4 camera modes, pixel-art target, ink/post pass, frame order |
| 03 materials-noise-glows | NPR shader chunks, cel bands, rim, fog, night mode, noise, static merge, glow sprites |
| 04 world-terrain-track | world helpers, heightmap, terrain, river, track spline, module constants, build order |
| 05 world-bridge-station | bridge and station, every sub-part with dimensions and colours |
| 06 world-village-windmill-trees-rocks | house archetypes, placement, windmill, tree species and scatter, rocks |
| 07 world-water-clouds-balloon-update | water, clouds with camera fading, perches, balloon, sheep update, per-frame order |
| 08 train-brake-sparks | locomotive and carriages, wheels and rods, smoke, headlight, motion model, sparks |
| 09 life-birds-sheep-walkers-villagers | bird flocking and perching, track sheep, station walker, villagers |

Each spec had 8 required sections:

1. scope;
2. public interface (provided and consumed);
3. exhaustive feature inventory;
4. algorithms step by step with formulas;
5. key constants as tables;
6. performance techniques and gotchas;
7. suggested file split (kebab-case, < 200 lines, estimated lines);
8. risks and open questions.

`SPEC_SCHEMA` returned `scope`, `reportPath`, `features[] {name, description, complexity S|M|L|XL}`,
`interfaces[]`, `suggestedFiles[] {file, responsibility, estLines}`, `risks[]` and `openQuestions[]`.
The orchestrator turned the feature lists into `features-inventory.md` with stable IDs
(`F01.01 … F09.17`, 147 in total: 13/16/17/14/20/18/14/18/17 per scope). Those IDs drive the
deterministic coverage check in the next stage. The readers were asked to write their reports
themselves, but they were blocked from writing `.md` files (incident 1), so the orchestrator wrote
them.

The visual-capture agent got a concrete brief:

- reuse the launch flags of an existing Playwright script, at a viewport of 1600×900;
- clear the settings key, wait until `#loading` hides, then capture 13 named states: loading, day,
  evening, night, train cam, bridge cam, free cam, pixel art, ink off, help panel, HUD hidden, zoomed
  close-up, and mobile 390×844;
- Read every PNG and write `visual-reference.md`, ending with a 10–15 bullet "style bible" that can
  serve as acceptance criteria.

It produced 28 PNGs plus capture logs. The final style bible has 15 points. Its 274-line capture
script was the model for the parity harness. The script was not copied, because it was over the
200-line limit.

Why this design:

- One reader per subsystem keeps each agent's reading complete ("every line, do not skim") inside one
  context. Splitting the 2,150-line module by line range stopped readers from skimming the end.
- `parallel()` is correct here because the next step (feature inventory) needs all specs together.
- A separate visual agent adds a second modality. The specs say what the code does; the screenshots
  say what the user sees. Both were needed later to judge parity.

### 4.3 Stage 2: plan workflow (40 agents, 8.15M tokens, about 16 h)

Script: `train-diorama-plan` (as it ran: [`train-diorama-plan-wf_47b1ba13-fc9.js`](prompt-log/original-workflow-scripts/train-diorama-plan-wf_47b1ba13-fc9.js)).

Pseudo-structure:

```js
const COUNTS = { '01': 13, '02': 16, /* ... */ '09': 17 }
const ALL_IDS = /* F01.01 .. F09.17 generated from COUNTS */
const CONTEXT = `PROJECT + research file list + FIXED DECISIONS D1–D8 ("already made — do not re-litigate")
  + PHASE FILE TEMPLATE (section order) + "concise wording, but NEVER drop a constant, sub-part, or behaviour"`

phase('Architect')
let arch = await agent(`${CONTEXT}\nTASK (Architect): folderTree, contracts, 10-14 phases,
  every feature ID in exactly one phase, every file created by exactly one phase ...`, { schema: ARCH_SCHEMA })
let cov = coverage(arch.phases)               // plain JS, no agent
while (cov has problems && attempts < 3)      // deterministic repair loop
  arch = await agent(`TASK (Architect repair): fix ONLY what is needed: missing/unknown/multi/dupFiles ...`, { schema: ARCH_SCHEMA })

const SHARED = CONTEXT + folder tree + contracts + one-line index of all phases
const phaseResults = await pipeline(arch.phases,
  p => agent(`${SHARED}\nTASK (Phase writer): write the COMPLETE markdown for phase-${p.id}-${p.slug}.md ...`),
  (draft, p) => agent(`${SHARED}\nTASK (Adversarial verifier): assume it has errors ... produce revisedMarkdown`,
                      { schema: CRITIC_SCHEMA }))

phase('Integrate')
const integ = await agent(`TASK (Integration critic): imports nobody provides, wrong deps,
  duplicate creators, order inconsistencies, missing cross-cutting work ...`, { schema: INTEG_SCHEMA })
const revised = await parallel(phasesWithIssues.map(p => () =>
  agent(`TASK (Reviser): apply these cross-phase integration fixes ... Change nothing else.`)))
return { coverage, planMd, folderTree, contracts, postParityFixes, openQuestions, integration, phases[...markdown] }
```

The deterministic coverage check is plain JavaScript inside the script:

```js
function coverage(phases) {
  const seen = {}, fileOwners = {}
  for (const p of phases) {
    for (const f of p.featureIds) (seen[f] = seen[f] || []).push(p.id)
    for (const f of p.filesToCreate) (fileOwners[f] = fileOwners[f] || []).push(p.id)
  }
  const missing = ALL_IDS.filter(id => !seen[id])
  const unknown = Object.keys(seen).filter(id => !ALL_IDS.includes(id))
  const multi = Object.entries(seen).filter(([, v]) => v.length > 1).map(([k, v]) => k + '→' + v.join('/'))
  const dupFiles = Object.entries(fileOwners).filter(([, v]) => v.length > 1).map(([k, v]) => k + '→' + v.join('/'))
  return { missing, unknown, multi, dupFiles }
}
```

Schemas and what they bought:

| schema | key fields | purpose |
|---|---|---|
| `ARCH_SCHEMA` | `folderTree`, `contracts`, `phases[] {id, slug, title, priority, goal, dependsOn, featureIds, analysisRefs, sourceRefs, filesToCreate, acceptance, estLines}`, `planMd`, `postParityFixes`, `openQuestions` | Machine-checkable architecture. `sourceRefs` tells each writer and verifier which source ranges to read. |
| `CRITIC_SCHEMA` | `issues[] {severity, kind, detail, evidence}`, `revisedMarkdown`, `filesCreated`, `filesModified`, `exportsProvided`, `importsConsumed` | The verifier returns the corrected file (not just complaints) plus the interface summary the integration critic needs. |
| `INTEG_SCHEMA` | `issues[] {phaseId, severity, fix}`, `summary` | Fixes are routed per phase to revisers. |

The verifier issue kinds were fixed in the prompt and the schema: `omission | wrong-value |
rng-order | contract-mismatch | file-size | vague-step | missing-test | other`. Each issue had to cite
evidence (original file:line or analysis section). The script also re-checked file ownership on the
verified results (`dupOwners`) before calling the integration critic.

Results:

| phase | 01 | 02 | 03 | 04 | 05 | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 13 | 14 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| verifier issues | 13 | 14 | 10 | 20 | 13 | 17 | 15 | 13 | 17 | 14 | 16 | 10 | 14 | 26 |

The verifiers raised 212 issues (42 major, 170 minor, 0 critical). The integration critic raised 16
more:

- wrong `dependsOn` values that would have let two phases edit the same files in parallel;
- helper names that did not match between phases;
- missing git setup;
- no resolver for the research path;
- conditional edits that needed a real contract.

In the final coverage result, all four lists (missing, unknown, multi and duplicate files) were empty.

Outputs:

- `plan.md` (65 lines, limit 80);
- `cross-module-contracts.md` (340 lines: APIs, uniform bag, PRNG draw order, build and frame order,
  DOM ids, parity hooks);
- `folder-tree.md` (260 lines: every file, owning phase, estimated lines);
- 14 phase files (640–1,130 lines each in v1; 638–1,265 lines and 12,210 in total after the rewrite);
- `post-parity-optional-fixes.md`;
- `reports/plan-verification-report.md`.

Why this design:

- **Architect first, alone.** One agent reconciles the 9 conflicting file-split suggestions into one
  tree and one set of contracts. Every writer codes against the same backbone.
- **Deterministic checks in code, not in prompts.** "Every feature in exactly one phase" is a set
  operation. The agent repair loop runs only when there is a concrete list of failures.
- **`pipeline()` for writer → verifier.** There is no barrier, so phase 03 can be verified while phase
  11 is still being written. Wall time equals the slowest single chain.
- **Adversarial verifier with the source as ground truth.** The prompt "Assume it has errors until
  proven otherwise" found 212 real problems. The verifier returns the corrected file, which saves a
  round trip.
- **Integration critic on summaries.** Writers cannot see each other. The critic sees each phase's
  files, exports and imports, and catches cross-phase mismatches (wrong dependencies, wrong names).
- **Barrier only where needed.** The integration critic genuinely needs all phases together.

Why it took about 16 hours: there were 14 long writer + verifier chains. Each read 25–40 KB analyses
plus hundreds of source lines and produced a phase file of 600–1,100+ lines at xhigh effort. This was
the most expensive stage, and most of its depth was needed only because the goal was parity with an
existing site (section 8).

### 4.4 Stage 3: the independence rewrite (32 agents, 6.65M tokens, 69 min)

What happened: plan v1 told implementers to "transcribe verbatim" and embedded 433 chunks of the
original's code. The first P01 implementer refused, correctly, because the original has no license.
The run stopped as BLOCKED after 12 minutes (incident 3).

The fix was decision D0 (independent implementation policy) plus a rewrite workflow over the 16 plan
files: contracts, folder tree and 14 phases. Each file had 1 rewriter and 1 verifier.

Script: `train-diorama-plan-independent-rewrite` (as it ran: [`train-diorama-plan-independent-rewrite-wf_3d2764bd-d9e.js`](prompt-log/original-workflow-scripts/train-diorama-plan-independent-rewrite-wf_3d2764bd-d9e.js)). Pseudo-structure:

```js
const POLICY = `CONTEXT (why) + INDEPENDENT IMPLEMENTATION POLICY:
  - goal unchanged (output parity), running the original as an oracle is fine, copying its text is not
  - remove every "verbatim / copy the original / byte-identical / transcribe / port line-by-line" instruction and every copied block
  - replace with parameter TABLES, fresh math or neutral pseudocode, prose algorithms, API signatures, acceptance criteria
  - allowed to keep: DOM ids, Tailwind class names, short UI strings, storage key, standard public algorithms in own words,
    three.js idioms, the official analytics snippet
  - logo/favicon: original design spec
  - fidelity detail must NOT be lost, only its form changes`
const out = await pipeline(ITEMS,                            // 16 plan files
  name => agent(`${POLICY}\nTASK: rewrite ${name}; run the overlap checker first; grep for verbatim|byte|copy|transcri|line-by-line ...
                 Return the complete rewritten markdown (do not write files)`, { schema: REWRITE_SCHEMA }),
  (rw, name) => agent(`${POLICY}\nTASK (verifier): save the rewrite to /tmp/td-plan-drafts/<name>.txt, run the checker,
                 justify every kept chunk; lost-detail audit against the archived v1; zero copy directives`,
                 { schema: VERIFY_SCHEMA }))
```

`VERIFY_SCHEMA` made the result measurable: `markdown`, `overlapBefore`, `overlapAfter`,
`keptChunks[] {chunk, reason}`, `lostDetailRestored[]` and `remainingVerbatimDirectives` (must be
0). The draft is saved as `.txt` in `/tmp` because subagents could not write `.md` report files
(incident 1).

The repo uses two independence checkers:

- **`research/verbatim-overlap-check.py`** (21 lines of Python) builds a set of the original source
  split on newlines, `;`, `{` and `}`, keeping whitespace-normalised chunks of ≥ 40 characters. It
  then reports every chunk of each line of a plan or code file (split on `;`, `{`, `}`) that is in
  that set.
- **`research/structural-similarity-check.py`** (20 lines) computes a `difflib` line-sequence
  similarity of each repo file against the closest original file (lines ≥ 12 characters, comment
  lines ignored) and counts exact shared lines ≥ 25 characters. It catches lightly edited copies that
  the chunk checker misses.

Result: 433 → 0 verbatim chunks, no fact lost. v1 was archived as `archive-v1-verbatim/` with a "do
not use" note in `plan.md`.

Lesson as a rule: **decide the independence policy before planning.** Write it into the fixed
decisions and run the overlap checker inside the plan verifier. Doing it afterwards cost 6.65M tokens
plus a blocked run.

### 4.5 Stage 4: implementation workflow (5 runs, about 91 agents)

Script: `train-diorama-implement`. There are two versions, both in
[`prompt-log/original-workflow-scripts/`](prompt-log/original-workflow-scripts/):

- **Earlier version** (`train-diorama-implement-wf_1afbef75-78b.js`) was used for the first
  implementation runs. It used custom agent types (`fullstack-developer`, `tester`,
  `code-reviewer`), had no commit step, no `preFixes` and no `skipImplFor`, and its prompt did not
  point to the notes file.
- **Final version** (`train-diorama-implement-final.js`) added the notes file, the structural-similarity gate, the explicit test glob, the
  commit step, `preFixes` and `skipImplFor`, and dropped the custom agent types.

Arguments (passed through Workflow `args`, so one script serves every batch):

| arg | meaning |
|---|---|
| `phases` | a list such as `['09','10','11','12','13','14']`, run strictly in order |
| `carryNotes` | notes carried from a previous run, injected into implement and fix prompts |
| `preFixes` | findings left over from the previous phase; a pre-fix agent applies them before the next phase |
| `skipImplFor` | phases already implemented in an interrupted run; these skip straight to test ∥ review (incident 7) |

Pseudo-structure:

```js
const COMMON = `PROJECT + repo + plan/contracts/folder-tree/quirks paths + "IGNORE archive-v1-verbatim/"
  + research paths + "Implementation notes: READ FIRST; trust over the plan where they conflict"
  + "return report content as text, do not write report .md files"
  + INDEPENDENT IMPLEMENTATION (hard rule) + the two checker commands and the 0.30 threshold
  + RUN DECISIONS: logo, NEVER commit (overrides your agent definition), install command,
    Chromium path + SwiftShader args, the shell-hook rule, scratch files in /tmp only,
    exact test commands, code rules, blockedWrites for docs`

if (args.preFixes?.length) prefix agent → must leave tests green, else stop
for (const id of args.phases) {
  impl = skipImpl ? stub : await agent(`${COMMON}${notes}\nTASK: implement Phase ${id} completely ... (0) git add -A checkpoint;
           (1) implement every file; (2) tests; (3) node --check, full suite, line check, browser smoke, Success Criteria; (4) iterate`,
           { schema: IMPL_SCHEMA })
  if (!impl || impl.status === 'BLOCKED') stop
  for (round = 1..3) {
    [test, review] = await parallel([tester(read-only), adversarialReviewer(read-only)])
    if (test.passed && no critical/major) { if (minors) polish agent; status = CLEAN; break }
    if (round === 3) { status = UNRESOLVED; break }
    fix = await agent(`First VERIFY each item (reviewers can be wrong) → fix → re-run all checks`, { schema: IMPL_SCHEMA })
    rec.rejected.push(...fix.rejected)          // fed back so reviewers do not re-raise them
    carryNotes.push(...fix.notesForLaterPhases)
  }
  carryNotes.push(...impl.notesForLaterPhases)
  if (status !== 'CLEAN') stop for orchestrator review
  commit = await agent(`ORCHESTRATOR-AUTHORIZED COMMIT ... exclude caches/scratch/secrets/original source,
                        npm test + check:lines, one conventional commit, push (never force), watch the deploy run`,
                        { schema: COMMIT_SCHEMA })
  if (!commit.committed || !commit.pushed) stop
}
return { results, carryNotes }
```

The commit agent's last step waited for the GitHub Pages Actions run (`gh run watch`) and reported
`deployConclusion`. The Pages workflow no longer exists, so drop that step when reusing the script.

Schemas:

| schema | key fields |
|---|---|
| `IMPL_SCHEMA` | `status DONE \| DONE_WITH_CONCERNS \| BLOCKED`, `summary`, `filesCreated`, `filesModified`, `testCommand`, `testsPassed`, `testCounts`, `parityChecks[]`, `deviations[]`, `notesForLaterPhases[]`, `blockedWrites[] {path, content}`, `openIssues[]`, `applied[]`, `rejected[] {issue, reason}` |
| `TEST_SCHEMA` | `passed` (true only if every required check passes), `checks[] {name, status, detail}`, `failures[] {check, detail, evidence}`, `summary` |
| `REVIEW_SCHEMA` | `issues[] {severity critical \| major \| minor, file, detail, evidence, fix}`, `summary` |
| `COMMIT_SCHEMA` | `committed`, `sha`, `message`, `pushed`, `deployConclusion`, `excluded[]`, `problems[]` |

What the tester runs each round:

- `npm test` and `npm run test:parity` (once it exists);
- `node --check` on every `src/` and `tools/` JS file;
- the line-count check;
- a headless browser smoke test: no console errors or unhandled rejections, and a screenshot saved to
  `.parity-output/p<id>-r<round>.png`, which the agent Reads and compares with the reference captures;
- both independence checkers (a touched file scoring > 0.30 fails unless justified);
- "no commit was created during this phase";
- every runnable Success Criteria check of the phase file.

The tester may write only under `.parity-output/`.

What the reviewer hunts for:

- missing sub-parts or night variants;
- constants, colours, dimensions, timings and formulas that differ from the original;
- changes in PRNG draw order or count;
- contract mismatches;
- runtime errors, disposal leaks, per-frame allocations in hot loops;
- files ≥ 200 lines;
- fake or vacuous tests;
- plan references in comments;
- copied text (critical);
- unfinished Todo items.

Severity is defined in the prompt, and the rule is "no evidence, no issue".

Outcomes per phase:

| phase | rounds | result |
|---|---|---|
| P01 | 2 | CLEAN |
| P02 | 3 | CLEAN |
| P03 | 3 | UNRESOLVED (scratch file picked up by bare `node --test`). The orchestrator fixed the blocker and a pre-fix agent applied 4 minors. |
| P04–P06, P08 | 1 | CLEAN |
| P07 | 2 | CLEAN after 1 fix round |
| P09 | – | implemented in run 7, which ended during round 2; re-tested in run 8 with `skipImplFor` |
| P09–P13 | 1 | CLEAN in round 1, about 40–70 min each including commit + push |
| P14 | 3 | UNRESOLVED (2 majors, incl. a performance gate that passed with zero samples), fixed by the orchestrator |

Why this design:

- **Strictly sequential phases.** Later phases edit shared harness files (shot list, probes,
  simulation driver) and docs. The integration critic had already fixed the `dependsOn` gaps that
  would have allowed parallel edits.
- **Tester ∥ reviewer is the only parallel step.** Both are read-only, so they cannot conflict, and
  they look at different things (does it run vs is it right).
- **Bounded fix loop (≤ 3 rounds), then stop.** An unresolved phase is cheaper for the orchestrator to
  close by hand than for the loop to churn on. Once the notes and contracts matured, 9 of the 10
  phases P04–P13 passed in round 1; only P07 needed one fix round.
- **Verify-before-fix.** The fixer must check every claim against source, spec and contracts, and
  reject false ones with a reason. The next reviewer gets the rejections as "already rejected, do not
  re-raise unless you have new evidence". This stopped ping-pong between reviewer and fixer.
- **Minor findings do not block.** A clean round with minors triggers one polish agent. It applies
  what is correct and reverts anything that breaks tests.
- **Commit only after CLEAN, by a dedicated agent with an explicit override clause.** All other
  agents are told "NEVER commit" (incident 4).

### 4.6 What the orchestrator did between runs

- Wrote every file returned through schemas (analysis reports, plan files, reports, `blockedWrites`).
- Kept `workflows/implementation-notes.md`, the carry-notes file (159 lines by the end). It has an
  "Orchestrator (authoritative)" section on top, then per-phase notes. The implement prompt says
  "READ FIRST; trust over the plan where they conflict".
- Appended quirks found during implementation to `post-parity-optional-fixes.md`.
- Closed P03 and P14 by hand after the loop stopped.
- Committed P01–P08 as one commit after testing the staged snapshot in isolation.
- Removed 6 unauthorized commits (incident 4) with `git update-ref -d`, keeping the working tree.
- Took the final README screenshots and kept the docs current.

---

## 5. Prompt patterns that worked

### 5.1 A shared context block per workflow

Every agent in a workflow gets the same `COMMON` / `CONTEXT` / `POLICY` constant at the top of its
prompt, followed by a short role-specific TASK. The block contains:

1. A one-paragraph project statement (what, stack, what "done" means).
2. Absolute paths to every authoritative input, with what each one is for, and paths to ignore
   ("IGNORE archive-v1-verbatim/ (superseded)").
3. Fixed decisions, labelled "already made — do not re-litigate".
4. Hard rules, each with the exact command that checks it (checker scripts, thresholds).
5. Environment facts written as commands, not descriptions: the install command
   (`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install`), the Chromium path and flags, the exact
   `npm test` glob, "scratch files in /tmp only", and the shell-hook rule with its workaround.
6. Output rules: return content through the schema, never write report files, put blocked doc writes
   into `blockedWrites`.

Why: agents start with zero context. Repeating the block costs a few thousand tokens per agent and
removes a whole class of failures (wrong paths, re-opened decisions, wrong test command).

Caveat: the block is part of every prompt, so editing it changes every agent call and invalidates the
resume cache (incident 7). Put run-specific values in `args`, not in the block.

### 5.2 Role prompts

| role | key phrases that mattered |
|---|---|
| reader | "read your assigned scope COMPLETELY (every line — do not skim)"; "so a developer who never sees the original could rebuild it"; fixed section list |
| architect | "reconcile the conflicting per-analysis split suggestions into ONE consistent kebab-case layout"; "No duplicated responsibilities"; "Assign EVERY feature ID … to exactly one phase"; "each phase ends in a runnable/visually checkable state" |
| writer | "the source is the ground truth — pull exact constants …"; "precise enough to implement without opening the original" |
| adversarial verifier | "you are a skeptical reviewer … Assume it has errors until proven otherwise"; a fixed list of issue kinds; "produce revisedMarkdown = the complete corrected file" |
| integration critic | concrete list of mismatch types; "one issue per needed change with the target phaseId and an exact fix instruction" |
| reviser | "apply these cross-phase integration fixes … Change nothing else" |
| implementer | "Do not stop at a skeleton — deliver the full phase"; numbered steps (checkpoint, implement, tests, checks, iterate); status protocol DONE / DONE_WITH_CONCERNS / BLOCKED |
| tester | "read-only on source"; "passed=true only if every required check passes; skipped checks must say why"; Read the screenshot |
| reviewer | "Assume bugs exist"; severity definitions; "Cite evidence … — no evidence, no issue"; list of already-rejected issues |
| fixer | "First VERIFY each item … reviewers can be wrong; reject (with reason) any claim that is false or would break parity. Fix everything real, including minors." |
| committer | "ORCHESTRATOR-AUTHORIZED COMMIT … This overrides any 'never commit' rule, for this task only"; exclusion list; tests must pass first; never force-push |

Note that the writer phrase "the source is the ground truth", without an independence rule, is what
produced the verbatim plan (incident 3). Pair it with D0 from the start.

### 5.3 Schemas everywhere

- Every agent whose output the script branches on returns a JSON schema object: status enums,
  booleans like `passed`, arrays of issues with severity. Control flow stays in code
  (`if (testOk && review && blocking.length === 0)`), not in a model's judgement of free text.
- Schemas carry the files themselves (`revisedMarkdown`, `markdown`, `blockedWrites`), so the
  orchestrator writes them. This also worked around the block on subagent report files.
- Schemas carry the cross-agent memory: `notesForLaterPhases`, `rejected`, `exportsProvided`,
  `importsConsumed`.

### 5.4 The carry-notes file

`implementation-notes.md` in the plan folder is the long-lived memory between phases and runs. Each
implement or fix result adds `notesForLaterPhases`, tagged `[P07]` and so on. Typical content:

- API facts ("Train API is fully contract-conformant: …");
- insertion slots for later phases;
- files close to 200 lines ("split before touching");
- environment gotchas (Chromium path, importing Playwright from `/tmp` scripts through a `file://`
  URL);
- the CSS `›` notation trap;
- quirks to append to the appendix;
- scratch script names.

The orchestrator section at the top overrides stale notes, for example when commits became allowed
(incident 8).

### 5.5 Overrides of agent definitions

Custom agent definitions can contain their own rules ("commit when done"). The prompt must state the
winning rule explicitly: "NEVER run git commit / git push / deploy, even if your agent definition says
to commit (orchestrator override)". The tester verifies it.

### 5.6 Small things that paid off

- End every TASK with "Return the structured result".
- Tell agents what not to touch ("Do not edit files under the plan folder", "Do not modify anything in
  the source folder").
- Give labels per item and round (`impl:07`, `test:07#2`) so progress and the journal are readable.
- Keep phase titles for commit messages in a table in the script (`PHASE_TITLES`), so messages are
  conventional and free of phase IDs.

---

## 6. Quality gates

| gate | how | where it runs | threshold |
|---|---|---|---|
| Syntax | `node --check` on every `src/` and `tools/` JS file | tester, fixer | no errors |
| Unit tests | `npm test` = `node --test "tests/unit/**/*.test.mjs"` (Node ≥ 22) | implementer, tester, fixer, committer | 296 pass, 0 skipped (295 at sign-off, +1 for the perf-gate fix) |
| Parity oracle tests | `npm run test:parity` (serial, `--test-concurrency=1`), importing the original modules from gitignored `.parity-cache/` | tester from P04 on | All pass. Examples: full-scene construction signature equal (1201 entries); 10,800 lockstep frames with every scalar `Object.is`-equal. |
| Browser parity shots | `npm run parity:capture` / `parity:compare` / `parity:signoff` with a freeze + fixed-dt stepping hook | tester, P14 sign-off | deterministic ≤ 1.0 mean abs diff and ≤ 0.5 % of pixels over 16; transients ≤ 3.0 / 3 %; DOM ≤ 0.5 / 0.2 % |
| Runtime probes | `npm run parity:probe` (draw calls, triangles, geometries, textures, programs, ordered lists) | tester, sign-off | exactly equal per state |
| Screenshot review | tester saves `.parity-output/p<id>-r<round>.png` and Reads it next to the reference captures | tester | renders sensibly, matches the style bible |
| Performance | `npm run parity:perf -- --runs 10` (alternating cold loads) | P14 | Build and CPU-submit medians ≤ 1.10× of the original; retained heap growth ≤ original + 64 KB; allocation per step ≤ 1.10× |
| Independence | `verbatim-overlap-check.py` (chunks ≥ 40 chars) + `structural-similarity-check.py` (line-sequence similarity) | tester, reviewer, P14 audit | Every overlap hit inside an allowance; similarity ≤ 0.30 per touched file. Final max is 0.22 for JS/CSS; `index.html` is 0.53 because of shared DOM ids, classes and labels. |
| Line limit | `npm run check:lines` | implementer, tester, committer | every code file < 200 lines (final max 199) |
| No stray commits | `git log`: HEAD unchanged during the phase | tester | none |
| Commit hygiene | committer checks `git status` for caches, scratch files, secrets, original source | committer | excluded or gitignored |

All parity numbers and commands are documented in [parity-testing-guide.md](parity-testing-guide.md).

---

## 7. Incidents, root causes and rules

| # | incident | root cause | fix | rule for next time |
|---|---|---|---|---|
| 1 | Subagents were blocked from writing report `.md` files | Harness rule: subagents return findings as text | Orchestrator wrote reports from structured outputs; verifiers saved drafts as `/tmp/*.txt` | Agents RETURN content through the schema; the orchestrator writes files |
| 2 | The source download loop failed silently | zsh does not word-split `$var` like bash | Re-ran under bash | Run multi-step shell loops with `bash -c` or a heredoc |
| 3 | Plan v1 had 433 verbatim chunks of the unlicensed original; the implementer refused | No independence policy in the plan prompts. Writers were told the source is the ground truth and steps must work "without opening the original", and the first D7 even defaulted to reusing the original logo, so writers and verifiers chased byte-identical output and embedded code. | D0 policy, plan rewrite into tables/prose/math, both checkers as gates in tester and reviewer; copying = critical | Fix the license/independence policy before planning; put the checker in the plan verifier |
| 4 | An implementer made 6 unauthorized commits with pre-review code | Its custom agent definition said "commit" | Commits removed with `git update-ref -d` (working tree kept); "NEVER commit, overrides your agent definition" + tester check | Only one dedicated commit step may commit; say that the override beats agent definitions |
| 5 | A tester left `tools/smoke-test.mjs`; bare `node --test` auto-discovered it and the suite went red (P03 UNRESOLVED) | `node --test` without a pattern runs every test-like file | `npm test` = `node --test "tests/unit/**/*.test.mjs"`, engines `node >= 22`, scratch files only in `/tmp` | Always give the test runner an explicit glob; keep scratch files out of the repo |
| 6 | Custom agent types (fullstack-developer, tester, code-reviewer) disappeared mid-project | Environment change outside the project | Switched to default agents with role prompts | Do not depend on custom agent types; role prompts are enough |
| 7 | The session ended mid-workflow (P09 round 2) | Claude Code session ended | Fresh run with `skipImplFor: ['09']`. `resumeFromRunId` would have re-run everything, because editing the script had changed the shared prompt prefix and invalidated the cache. | Keep scripts stable during a project; put per-run values in `args`; design an explicit skip/resume argument |
| 8 | The script was edited while a run was active; the next run's notes said "repo has no commits" while the owner had asked for commits | Stale note in the carry-notes file and in the tester check | Notes file updated (orchestrator section marked authoritative), tester check reworded to "no commit created during this phase" | Never edit a running script; review the notes file before every run |
| 9 | Shell commands containing `node_modules`/`build`/`dist`/`vendor` paths were blocked | Local hook | Playwright imported through a `file://` URL; logic moved into scripts | Put such paths inside script files, never in the command text |
| 10 | Headless WebGL ran at about 2 FPS (SwiftShader), simulation about 0.1× real time | No GPU in headless Chromium | Parity captures freeze the page and step a fixed dt; never wall-clock waits | Screenshots judge look, not speed; wait on state, not on time |
| 11 | GitHub Pages on a private repo failed with HTTP 422 | The free plan has no Pages for private repos | Repo made public for Pages, later made private again with Pages removed by the owner | Decide hosting and visibility up front |
| 12 | GitHub Actions warned about Node 20 actions | Old action versions | Bumped checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5 after reading release notes (v4+ of upload-pages-artifact drops dotfiles) | Read release notes before bumping CI actions (moot now: the workflow is gone) |
| 13 | `pkill -f <pattern>` killed the invoking shell (exit 144) | The pattern also appeared in the shell's own command line | Kill by PID | Kill by PID, or use a pattern that does not occur in the command |
| 14 | The P14 performance gate passed with zero samples | `null <= 1.1 * null` is `true` in JavaScript | `Number.isFinite` guards in `tools/parity/performance-budget-probe.mjs` + a unit test | Every numeric gate must fail on missing data; test the gate itself |
| 15 | The first CSS used `>` where the plan tables used `›`; `›` meant the descendant combinator, so the rules broke (the buttons are nested two levels deep) | Ambiguous notation in the plan | Note in the carry-notes file; selectors corrected | Write CSS selectors literally in plans |
| 16 | (positive) 9 of the 10 phases P04–P13 passed round 1 | Notes and contracts had matured | – | Invest in contracts and the notes file early; the first 3 phases are the expensive ones |

The reviewer's memory note (`.claude/agent-memory/code-reviewer/`, gitignored) recorded more
techniques and traps worth keeping:

- **Spec names trip the overlap checker.** Phase specs that describe formulas with the original's
  local variable names make implementers trip the overlap checker even when structural similarity is
  low (< 0.2). Name things in your own words in the plan.
- **Separate shared lines.** List the exact shared lines with a small script, then separate
  contract-dictated lines (API names, UI strings, numeric values) from avoidable ones.
- **Prove a 0-diff is real.** Add a self-diff case that must differ (for example night 0 vs night 1)
  so that a 0-diff result is proven non-vacuous. Grep tests for always-true asserts.
- **Check artefact dates.** Screenshot and GPU metrics in `.parity-output/` can predate later shader
  edits; compare file mtimes before trusting them.
- **Cheap engine pixel parity.** Use Playwright `page.route` to serve the repo, the cached original
  and local three under a fake host (no dev server or network). Then hide everything except the part
  under test and `gl.readPixels` in the same task.

---

## 8. Cost and effort analysis

### 8.1 Where the tokens went

The measured runs total 27.0M subagent tokens. Run 7 (P04–P09, about 30 agents) was not recorded; at
the rate of the other implementation runs it was roughly 6M, so the total is about 33M.

| stage | subagent tokens | share of about 33M | per agent |
|---|---|---|---|
| Analysis | 1.58M | about 5 % | about 160k |
| Plan | 8.15M | about 25 % | about 200k |
| Plan rewrite (avoidable) | 6.65M | about 20 % | about 210k |
| Blocked P01 attempt (avoidable) | 0.24M | < 1 % | – |
| Implementation P01–P03 | 5.50M | about 17 % | about 210k |
| Implementation P04–P09 | not recorded (estimate about 6M) | about 18 % | – |
| Implementation P09–P14 | 4.89M | about 15 % | about 145k |

Observations:

- Planning plus the rewrite was about 45 % of all tokens and about 17 of the wall-clock hours.
- The first three phases cost more per phase (1.6–2M each, 2–3 rounds) than the last six (P09–P14
  averaged about 0.8M each, mostly in round 1). Mature contracts and notes made later phases cheap.
- A large share of the work exists only because the goal was parity with another site:
  - the parity harness (`tools/parity/`, 42 files, about 3,750 lines);
  - the oracle tests and helpers (`tests/parity/`, 13 files with 79 tests; `tests/helpers/`, 18
    files);
  - the 28-shot sign-off and all of phase 04.

  Phase 14 alone (sign-off) needed 3 rounds plus manual work.

---

## 9. Final numbers

| metric | value |
|---|---|
| Code files (as counted by `check:lines`) | 245: `src/` 126, `styles/` 5, `tools/` 44, `tests/` 69, `index.html` 1 |
| Lines of code | 21,395: `src/` 8,563, `styles/` 447, `tools/` 3,915, `tests/` 8,370, `index.html` 100 |
| Largest file | 199 lines (`tests/unit/keyboard-shortcut-resolution.test.mjs`); every file < 200 |
| Unit tests | 296 in 42 suites (37 test files), about 1.7 s |
| Parity tests | 79 in 17 suites (13 test files, serial, about 76 s) |
| Sign-off shots | 28/28 pass (21 3D + 7 DOM): meanAbsDiff ≤ 2e-6, 0 % of pixels over 16, max channel diff 0 (19 shots) or 1 (9 shots) |
| Render-state probes | 8/8 exactly equal (frozen default overview: 1,371 calls / 1,759,388 triangles / 419 geometries / 6 textures on both sites) |
| Performance vs original | build 1.026×, CPU submit frozen 0.983×, running 1.000× (budget ≤ 1.10×) |
| Research live readout (debug menu, puffs visible) | 1,411 draw calls, 1,773,736 triangles, 419 geometries, 6 textures |
| Scene content | tree instances [3749, 1215, 932, 769], 80 rocks, 33 clouds, 24 + 3 sheep, 7 bird flocks with 18 birds, track length 276.136, 383 sleepers |
| Independence | 138 overlap hits, all inside an allowance; structural similarity ≤ 0.22 for every JS/CSS file (`index.html` 0.53 from DOM ids, classes and labels) |
| Plan | 14 phase files, 12,210 lines; 212 verifier + 16 integration issues fixed before coding |
| Commits | 9 on `main`: P01–P08 in one, 2 docs/CI commits, then one per phase for P09–P14 |
