# Prompt log

This is the record of how train-diorama was built with Claude Code: what the owner typed, which
Workflow runs followed, what they cost, and what went wrong. The narrative version, with the reasons
behind each design choice, is [`../how-it-was-built.md`](../how-it-was-built.md).

| File | Content |
|---|---|
| [`user-prompts.md`](user-prompts.md) | Every user prompt of the session, verbatim and in order (mostly Vietnamese). Home paths are replaced by `<home>`. |
| [`original-workflow-scripts/`](original-workflow-scripts/) | The exact Workflow scripts that ran. Absolute home paths are replaced by `<workspace>`; nothing else changed. |

Placeholders:
- `<workspace>` = the owner's projects folder that holds `train-diorama/` and `plans/`.
- `<home>` = the user's home directory.

The plan folder for this project is `<workspace>/plans/260930-train-diorama-clone/`. It holds plan.md, 14 phase files, contracts, the folder tree,
research/, archive-v1-verbatim/, workflows/implementation-notes.md and prompt-log/. It is not part of this repo.

The repo is private and not published anywhere. It runs locally (`npm run dev`, port 4317). A static-host deploy is optional:
see [`../deployment-guide.md`](../deployment-guide.md).

## Setup

- Claude Code CLI, model **Opus 5.5 (1M context)**.
- Effort **`/effort ultracode`** (xhigh + multi-agent Workflow tool by default) from the planning step on.
- Inputs: the live reference https://train-diorama.vercel.app/ (also published at https://traindiorama.netlify.app/).
  The original has no license, so the project became an independent implementation. It matches the output
  (look, behaviour, layout, parameters) and never copies the source text.
- Git identity for this personal repo: `tranhuuhuy297 <tranhuuhuy297@gmail.com>` (repo-local config).

## Prompts and what they triggered

Prompt times come from the session transcript and are in **UTC**. Local time is UTC+7; for example, the analysis
files were written at 17:23 local on 09-30, about 20 minutes after prompt 4.

| # | Date (UTC) | Prompt (English gloss) | What happened |
|---|---|---|---|
| 1-2 | 09-30 09:59 | "How do you prompt to get a site like this, what thinking effort?" | Explained inline. |
| 3 | 09-30 10:01 | `/effort` | Effort raised (ultracode from planning on). |
| 4 | 09-30 10:01 | "Make a detailed plan to build a project exactly like this." | Inline scouting: curl `index.html`, follow imports, download 14 JS modules (~5k lines; `World.js` alone is 2150) to `research/source/`. Then the **analyze** workflow and the **plan** workflow. |
| 5 | 10-01 02:07 | "Have you done?" | Status check on the ~16 h plan run. |
| 6 | 10-01 04:25 | "Implement all phases." | Implement P01 attempt 1 -> BLOCKED (plan said "transcribe verbatim"). Then the **independence rewrite** workflow, then implement P01, P02-P03 and P04-P09. |
| 7 | 10-02 06:56 | "Have you done?" | Status during P04-P09. |
| 8 | 10-02 08:35 | "Can the demo be run now?" | Answered inline (local demo check). |
| 9 | 10-02 10:12 | "How many phases are left?" | Status. |
| 10 | 10-02 10:21 | "Commit part of it and push to github.com/tranhuuhuy297/train-diorama, identity tranhuuhuy297." | The orchestrator tested the staged snapshot in isolation, committed `a58995a` (P01-P08) and pushed. |
| 11 | 10-02 10:28 | "Add the netlify reference, add illustration images, deploy to GitHub Pages." | `2a51bd1`: README screenshots, references, Pages workflow. The repo was made public, because Pages on a private repo is not available on the free plan (HTTP 422). |
| 12 | 10-02 10:44 | "Fix the warnings too; put that source in the README." | `b2f151f`: GitHub Actions moved to Node 24 action versions. |
| 13-14 | 10-03 08:26-08:28 | "Continue." / "Do all remaining phases, commit after each phase." | Final **implement** run P09-P14 with commit + push per phase: `3a254ee` P09, `97d4611` P10, `50a5987` P11, `b46790e` P12, `98e83b2` P13, `f61bc3c` P14. |
| 15-16 | 10-03 12:40-12:41 | "Is there a CLAUDE.md, a summary of techniques and approach, a complete workflow? The more detailed the better: I want to make more dioramas." | Documentation pass: `CLAUDE.md`, `docs/`, this prompt log. |
| 17 | 10-03 16:09 | "What was the original prompt; is it noted somewhere to trace later?" | This folder. |
| 18 | 10-03 16:14 | "If I make a bigger map, any browser problems? Too much RAM/CPU? What size is OK?" | Answered inline. |
| 19 | 10-03 16:16 | "What do you need to do now, and what is your advice?" | Answered inline. |
| 20-21 | 10-03 16:21 | "Commit when done, then make the repo private; no need to publish Pages." | Repo made private and the Pages workflow removed (recorded as done on 10-04 local time). |
| 22 | 10-03 16:22 | "What is a playbook?" | Answered inline. |
| 23 | 10-03 16:28 | "Give me some famous places in Vietnam to make dioramas." | Answered inline. |
| 24-26 | 10-03 16:28-16:32 | "Give me a complete prompt for Hội An, with the best model and effort; save it as a file; use ultracode if needed, not Fable." | A prompt file for that follow-up project, kept outside this repo. |
| 27 | 10-03 16:34 | "Update the docs when all the steps above are done." | Final docs update. |

## Which script each workflow run used

| # | Run | Script in `original-workflow-scripts/` | Agents | Subagent tokens | Wall time | Result |
|---|---|---|---|---|---|---|
| 1 | Analyze | `train-diorama-analyze-wf_a3487543-37c.js` | 10 | 1.58M | 19 min | 9 analysis specs (24-41 KB), 28 screenshots (the run log says 29; 28 PNGs are on disk), style bible, 147 feature IDs |
| 2 | Plan | `train-diorama-plan-wf_47b1ba13-fc9.js` | 40 | 8.15M | ~16 h | 14 phase files (640-1130 lines), contracts, folder tree; 212 verifier + 16 integration issues fixed |
| 3 | Implement P01 attempt 1 | earlier edit of `train-diorama-implement-wf_1afbef75-78b.js` (the saved copy is the post-rewrite version) | 1 | 0.24M | 12 min | BLOCKED |
| 4 | Plan independence rewrite | `train-diorama-plan-independent-rewrite-wf_3d2764bd-d9e.js` | 32 | 6.65M | 69 min | verbatim chunks 433 -> 0, no fact lost; v1 archived |
| 5 | Implement P01 | `train-diorama-implement-wf_1afbef75-78b.js` | 7 | 1.56M | 1.7 h | CLEAN after 2 rounds |
| 6 | Implement P02-P03 | `train-diorama-implement-wf_1afbef75-78b.js` (evolving) | 19 | 3.94M | 3.1 h | P02 CLEAN (3 rounds); P03 UNRESOLVED (scratch file picked up by `node --test`) |
| 7 | Implement P04-P09 | implement script (evolving) | ~30 | n/a | ~1 day | P04-P08 CLEAN (P07 needed one fix round); the session ended during P09 round 2 |
| 8 | Implement P09-P14 + commit/push | `train-diorama-implement-final.js` | 34 | 4.89M | 8.4 h | P09-P13 CLEAN in round 1 (~40-70 min each); P14 UNRESOLVED after 3 rounds (2 majors), then fixed by the orchestrator |

Approximate total: ~30M+ subagent tokens (27.0M measured plus an estimated ~6M for the unrecorded run 7, so about 33M).

`train-diorama-implement-final.js` is byte-identical to the `workflows/implement-phases-workflow.js` kept in the
plan folder. The first implement script used custom agent types (`fullstack-developer`, `tester`, `code-reviewer`).
Those types disappeared mid-project, so the final script uses default agents with role prompts.

The final script also added:
- the notes file
- the structural-similarity gate
- the `/tmp`-only scratch rule
- explicit test commands
- an explicit "never commit, even if your agent definition says so" override
- `preFixes` and `skipImplFor`
- the per-phase commit + push step. At the time this step also waited for the Pages deploy; Pages has since been removed.

Final phase list: 01 scaffold/shell/HUD/settings/loading · 02 noise, uniforms, NPR materials, glows, merge ·
03 renderer, sky, shadows, post, pixel, overview camera · 04 debug menu + parity harness · 05 terrain, track,
bridge · 06 station · 07 train, motion, smoke, sparks, headlight · 08 village + windmill · 09 residents, trees,
rocks · 10 free/train/bridge cameras · 11 sheep · 12 water, clouds, balloon · 13 station travelers, birds,
perches · 14 parity sign-off, perf budget, docs.

## Final numbers

- 245 code files, every file < 200 lines; 296 unit tests, 79 parity tests.
- Parity: 28 sign-off shots are identical to the original or within 1/255 of it; 8 render-state probes are equal;
  performance is within 1.10x of the original.
- Default overview, frozen sign-off state: 1371 draw calls, 1,759,388 triangles, 419 geometries, 6 textures,
  25 programs (the live debug-menu readout with smoke puffs visible: ~1411 calls, 1,773,736 triangles). Tree
  instances are [3749, 1215, 932, 769]; 80 rocks, 33 clouds, 24 + 3 sheep.
- Independence: the verbatim-overlap check reports only allowed items. Structural similarity is <= 0.22 for JS
  and CSS (`index.html` scores 0.53 because it shares DOM ids, classes and labels).

## Incidents and lessons

| # | Incident | Fix / lesson |
|---|---|---|
| 1 | Subagents were blocked from writing report `.md` files. | Agents RETURN content via a schema; the orchestrator writes the files. |
| 2 | zsh does not word-split `$var` the way bash does, so a download loop failed silently. | Run multi-step shell loops with `bash -c` or a heredoc. |
| 3 | Plan v1 held 433 verbatim chunks of the unlicensed original; the implementer refused to proceed. | Independence policy D0; the plan was rewritten as tables/prose/math; overlap and similarity checkers became tester/reviewer gates; copying counts as critical. |
| 4 | An implementer made 6 unauthorized commits of pre-review code (its agent definition said "commit"). | The orchestrator removed them (`update-ref -d`, keeping the working tree). Prompts now say "NEVER commit, this overrides your agent definition", and the tester checks it. |
| 5 | A tester left `tools/smoke-test.mjs` behind; bare `node --test` picked it up and the suite went red. | `npm test` = `node --test "tests/unit/**/*.test.mjs"`, engines node >= 22, scratch files only in `/tmp`. |
| 6 | Custom agent types vanished mid-project. | Default agents with role prompts. |
| 7 | The Claude Code session ended mid-workflow. | A fresh run with `skipImplFor`. `resumeFromRunId` would have re-run everything, because the script had been edited and the cached prefix was invalid. |
| 8 | The script was edited while a run was active. The next carry notes then claimed "repo has no commits" after the user had asked for commits. | The notes file was corrected and the tester check reworded. Never edit a running script. |
| 9 | A local hook blocks shell commands whose text contains `node_modules`/`build`/`dist`/`vendor` paths. | Import Playwright via a file URL; move the logic into scripts. |
| 10 | Headless WebGL runs on SwiftShader (~2 FPS, sim ~0.1x real time). | Parity captures use a freeze + fixed-dt stepping hook, never wall-clock waits. Screenshots judge the look, not speed. |
| 11 | GitHub Pages on a private repo is not available on the free plan (HTTP 422). | The repo was made public for Pages. Later the owner made it private again and removed Pages. |
| 12 | Actions warned about Node 20 actions. | After reading the release notes, the orchestrator bumped checkout v7, setup-node v7, configure-pages v6, upload-pages-artifact v5 and deploy-pages v5 (upload-pages-artifact v4+ drops dotfiles). This is history only: the Pages workflow is gone. |
| 13 | `pkill -f <pattern>` matched the invoking shell itself (exit 144). | Kill by PID, or use a pattern that does not appear in the command line. |
| 14 | The P14 performance gate passed with zero samples, because `null <= 1.1 * null` is true in JS. | `Number.isFinite` guards + a unit test. |
| 15 | Plan tables used `›` for the CSS descendant combinator; the first implementation used `>` and broke selectors. | Define notation in plans; the notes file warns about it. |
| 16 | Lesson about the pipeline design (not an incident). | 9 phases in a row passed round 1 once the notes and contracts had matured. The expensive parts were planning (~16 h) and the first 3 phases. |
