export const meta = {
  name: 'train-diorama-implement',
  description: 'Implement train-diorama phases sequentially: implement → (test ∥ review) → fix loop → commit + push per phase',
  phases: [
    { title: 'Implement', detail: 'fullstack-developer implements one phase file' },
    { title: 'Test', detail: 'tester runs suite + phase acceptance checks' },
    { title: 'Review', detail: 'code-reviewer adversarially checks spec/source conformance' },
    { title: 'Fix', detail: 'fix verified failures/issues, re-run tests' },
    { title: 'Commit', detail: 'commit + push each clean phase, wait for Pages deploy' },
  ],
}

const REPO = '<workspace>/train-diorama'
const PLAN = '<workspace>/plans/260930-train-diorama-clone'
const RES = PLAN + '/research'
const FILES = {
  '01': 'phase-01-scaffold-shell-hud.md', '02': 'phase-02-core-noise-materials-effects.md',
  '03': 'phase-03-engine-renderer-sky-post-overview.md', '04': 'phase-04-debug-menu-and-parity-harness.md',
  '05': 'phase-05-world-terrain-track-bridge.md', '06': 'phase-06-world-station.md',
  '07': 'phase-07-train-model-motion-effects.md', '08': 'phase-08-world-village-windmill.md',
  '09': 'phase-09-world-residents-trees-rocks.md', '10': 'phase-10-camera-modes-free-train-bridge.md',
  '11': 'phase-11-life-sheep-flock.md', '12': 'phase-12-world-water-clouds-balloon.md',
  '13': 'phase-13-life-station-travelers-and-birds.md', '14': 'phase-14-parity-perf-docs-deploy.md',
}
const MAX_ROUNDS = 3
const carryNotes = (args && args.carryNotes) ? args.carryNotes.slice() : []

const COMMON = `
PROJECT: independent, build-free re-creation of https://train-diorama.vercel.app/ (vanilla ESM + three@0.186.0 importmap). Output must look/behave like the original, including procedural layout (same seeds, same PRNG algorithm, same sequence of random draws).
Work context (repo): ${REPO}
Plan: ${PLAN}/plan.md ; authoritative contracts: ${PLAN}/cross-module-contracts.md ; file ownership: ${PLAN}/folder-tree.md ; quirks kept for parity: ${PLAN}/post-parity-optional-fixes.md . IGNORE ${PLAN}/archive-v1-verbatim/ (superseded).
Research: ${RES}/analysis-*.md, ${RES}/visual-reference.md, ${RES}/captures/*.png, ${RES}/capture-visual-reference.mjs ; original code in ${RES}/source/ is for understanding behaviour and as a black-box test oracle only.
Implementation notes from earlier phases (READ FIRST; trust over the plan where they conflict): ${PLAN}/workflows/implementation-notes.md
Reports path (if your agent definition asks for one): return report content as text in your final output instead of writing report .md files (the harness blocks subagent report files).

INDEPENDENT IMPLEMENTATION (hard rule): the original has no license. Write your OWN code from the phase spec (parameter tables, formulas, algorithm descriptions, contracts). Never copy or lightly edit text from the original JS/CSS/GLSL/HTML/SVG. Allowed: DOM ids, Tailwind utility class names, short UI strings/labels, the storage key, numeric values/colors, standard public algorithms written your own way (mulberry32, hashes, value noise, Bayer), standard three.js idioms, Vercel's analytics snippet. Check with: python3 ${RES}/verbatim-overlap-check.py ${PLAN} <files...> (every reported chunk must be an allowed item) and python3 ${RES}/structural-similarity-check.py ${PLAN} ${REPO} (line-sequence similarity per file vs closest original file; > 0.30 or many exact non-contract lines = likely lightly-edited copy → rewrite in your own structure). Lines dictated by the contract (API names, UI/console strings, DOM attribute calls) are acceptable.

RUN DECISIONS (from orchestrator; do not ask):
- Logo/favicon: ORIGINAL design per the phase spec (Fredoka wordmark + simple train/clock motif, hand-authored SVG) — never the original artwork. Running the original JS/CSS from gitignored .parity-cache/ as a local test oracle is allowed (never committed or deployed).
- NEVER run git commit / git push / deploy, even if your agent definition says to commit (orchestrator override; the user has not asked). Staging with git add is fine. git init + repo-local user.name/email (tranhuuhuy297 / tranhuuhuy297@gmail.com) is fine. Phase 14 deploy: prepare config + docs only, mark actual deploy as skipped.
- Install deps with: PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install (never download browsers). Playwright launch: executablePath = the newest ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome that exists (1243 known good), args ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] (see ${RES}/capture-visual-reference.mjs). Headless WebGL ≈ 2 FPS: never rely on wall-clock waits; wait on state / use the plan's fixed-dt stepping hook.
- Local shell hook BLOCKS any command whose text contains a path segment node_modules, dist, build, vendor, coverage, target or .git. Never reference such paths in commands (rely on package resolution, e.g. import 'three'); if blocked, move logic into a script under tools/ and run that.
- Scratch/verification scripts go in /tmp only — never leave untracked scratch files in the repo (they get picked up by tooling).
- Test commands: npm test (= node --test "tests/unit/**/*.test.mjs", engines node >=22) and, once it exists, npm run test:parity (serial parity suites). Do not change the test script semantics without updating docs.
- Code rules: every code file < 200 lines, kebab-case names, short dense comments, NO plan/phase/finding references in code or filenames, real implementations (no mocks/fakes to pass tests), follow cross-module-contracts.md exactly. Do not edit files under ${PLAN}.
- Project docs (docs/*.md) are deliverables; if a Write to docs is blocked, put {path, content} in blockedWrites so the orchestrator writes it.`

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['DONE', 'DONE_WITH_CONCERNS', 'BLOCKED'] },
    summary: { type: 'string' },
    filesCreated: { type: 'array', items: { type: 'string' } },
    filesModified: { type: 'array', items: { type: 'string' } },
    testCommand: { type: 'string' },
    testsPassed: { type: 'boolean' },
    testCounts: { type: 'string' },
    parityChecks: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, status: { type: 'string', enum: ['pass', 'fail', 'skipped'] }, note: { type: 'string' } }, required: ['name', 'status', 'note'] } },
    deviations: { type: 'array', items: { type: 'string' }, description: 'any intentional deviation from phase spec/contracts and why' },
    notesForLaterPhases: { type: 'array', items: { type: 'string' }, description: 'facts later phases must know (API changes, env quirks, helpers created)' },
    blockedWrites: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
    openIssues: { type: 'array', items: { type: 'string' } },
    applied: { type: 'array', items: { type: 'string' } },
    rejected: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, reason: { type: 'string' } }, required: ['issue', 'reason'] } },
  },
  required: ['status', 'summary', 'filesCreated', 'filesModified', 'testCommand', 'testsPassed', 'testCounts', 'parityChecks', 'deviations', 'notesForLaterPhases', 'blockedWrites', 'openIssues'],
}
const TEST_SCHEMA = {
  type: 'object',
  properties: {
    passed: { type: 'boolean', description: 'true only if ALL required checks pass' },
    checks: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, status: { type: 'string', enum: ['pass', 'fail', 'skipped'] }, detail: { type: 'string' } }, required: ['name', 'status', 'detail'] } },
    failures: { type: 'array', items: { type: 'object', properties: {
      check: { type: 'string' }, detail: { type: 'string' }, evidence: { type: 'string' } }, required: ['check', 'detail', 'evidence'] } },
    summary: { type: 'string' },
  },
  required: ['passed', 'checks', 'failures', 'summary'],
}
const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
      file: { type: 'string' }, detail: { type: 'string' },
      evidence: { type: 'string', description: 'original source file:line / phase spec section / contract section proving it' },
      fix: { type: 'string' } }, required: ['severity', 'file', 'detail', 'evidence', 'fix'] } },
    summary: { type: 'string' },
  },
  required: ['issues', 'summary'],
}

const COMMIT_SCHEMA = {
  type: 'object',
  properties: {
    committed: { type: 'boolean' }, sha: { type: 'string' }, message: { type: 'string' },
    pushed: { type: 'boolean' }, deployConclusion: { type: 'string', description: 'success | failure | skipped | unknown' },
    excluded: { type: 'array', items: { type: 'string' } }, problems: { type: 'array', items: { type: 'string' } },
  },
  required: ['committed', 'sha', 'message', 'pushed', 'deployConclusion', 'excluded', 'problems'],
}
const PHASE_TITLES = {
  '09': 'village residents, forest scatter with canopy grid, riverside rocks',
  '10': 'free fly, train and bridge camera modes',
  '11': 'pasture and trackside sheep flock',
  '12': 'water, waterfall, cloud field and hot-air balloon',
  '13': 'station travelers, bird flock and perches',
  '14': 'full parity sign-off, performance budget, docs and deploy config',
}

const notesBlock = () => carryNotes.length ? `\nNOTES FROM EARLIER PHASES OF THIS RUN (trust these over the plan where they conflict):\n${carryNotes.map(n => '- ' + n).join('\n')}` : ''

const results = []
if (args.preFixes && args.preFixes.length) {
  log(`Applying ${args.preFixes.length} carried-over fixes before ${args.phases[0]}`)
  const pre = await agent(`${COMMON}${notesBlock()}

TASK: before the next phase starts, apply these carried-over findings from the previous phase in ${REPO}. Verify each against the spec/source first (skip and explain wrong ones). Then run npm test, npm run test:parity if present, and the line-count check; all must be green.
${args.preFixes.map(f => '- ' + f).join('\n')}`, { label: 'prefix', phase: 'Fix', schema: IMPL_SCHEMA })
  results.push({ id: 'prefix', status: pre && pre.testsPassed ? 'CLEAN' : 'FAILED', impl: pre })
  if (!pre || !pre.testsPassed) { log('Pre-fixes left tests red — stopping'); return { results, carryNotes } }
}
for (const id of args.phases) {
  const pf = `${PLAN}/${FILES[id]}`
  const tag = 'P' + id
  log(`${tag}: implementing ${FILES[id]}`)

  const skipImpl = (args.skipImplFor || []).includes(id)
  const impl = skipImpl ? { status: 'DONE', summary: 'implemented in an earlier run', filesCreated: [], filesModified: ['(see git status: all uncommitted changes belong to this phase)'], testCommand: 'npm test', testsPassed: true, testCounts: '', parityChecks: [], deviations: [], notesForLaterPhases: [], blockedWrites: [], openIssues: [] } : await agent(`${COMMON}${notesBlock()}

TASK: implement Phase ${id} completely, exactly as specified in ${pf} (read it fully, plus the contracts and folder tree; all values you need are in the phase file and analyses — read the original only to understand ambiguous behaviour, never to copy text).
Steps: (0) ${id === '01' ? 'the repo already exists with a partial scaffold from an earlier halted attempt (git init + identity, package.json/lock, vercel config, tools/static-dev-server.mjs, tools/check-file-line-limits.mjs, placeholder logo, favicon, index.html): audit each against the phase spec, keep what conforms, rewrite what does not (replace logo/favicon with the spec original design)' : 'run "git add -A" in the repo first to checkpoint earlier phases as staged (so this phase shows as unstaged/untracked); never commit'}; (1) implement every file the phase creates/modifies; (2) write the unit/parity tests it specifies; (3) run node --check on changed JS, the full test suite, the line-count check, a headless browser smoke (page loads, no console errors, screenshot into .parity-output/), and the phase's Success Criteria checks; (4) iterate until they pass. Do not stop at a skeleton — deliver the full phase.
Return the structured result (status per protocol: DONE / DONE_WITH_CONCERNS / BLOCKED).`,
    { label: `impl:${id}`, phase: 'Implement', schema: IMPL_SCHEMA })

  if (!impl || impl.status === 'BLOCKED') {
    results.push({ id, status: 'BLOCKED', impl })
    log(`${tag}: BLOCKED — stopping run`)
    break
  }
  const rec = { id, impl, rounds: [], blockedWrites: [...impl.blockedWrites], rejected: [], status: 'PENDING' }
  let changed = [...new Set([...impl.filesCreated, ...impl.filesModified])]

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const [test, review] = await parallel([
      () => agent(`${COMMON}

TASK (tester, read-only on source): verify Phase ${id} in ${REPO} against ${pf} "Success Criteria" and "Todo List".
Run: npm test (unit suite) and npm run test:parity if that script exists (all phases so far), node --check on every src/ and tools/ JS file, the line-count check (all code files < 200 lines), a headless browser smoke (load via the repo's static server script; fail on console errors / unhandled rejections; save screenshot to .parity-output/p${id}-r${round}.png and Read it to confirm the scene renders sensibly vs ${RES}/captures), the independent-implementation checks (python3 ${RES}/verbatim-overlap-check.py ${PLAN} on every file under src/ styles/ tools/ tests/ assets/ plus index.html — fail if any reported chunk is not an allowed item; python3 ${RES}/structural-similarity-check.py ${PLAN} ${REPO} — fail if any file this phase touched scores > 0.30 unless justified), confirm no commit was created during this phase (orchestrator commits are expected), and every phase-specific acceptance/parity check that is runnable at this point. Do NOT edit source or test files (you may write only under .parity-output/). passed=true only if every required check passes; skipped checks must say why.
Files touched this phase: ${changed.join(', ')}`,
        { label: `test:${id}#${round}`, phase: 'Test', schema: TEST_SCHEMA }),
      () => agent(`${COMMON}

TASK (adversarial code review, read-only): review Phase ${id} implementation in ${REPO} (git status / git diff show this phase's changes vs HEAD and the staged checkpoint; files: ${changed.join(', ')}) against ${pf}, cross-module-contracts.md and the ORIGINAL source it mirrors. Assume bugs exist. Hunt for: missing features/sub-parts/night variants; constants, colors, dimensions, timings, formulas differing from the original; PRNG draw order/count changes (break identical layout); contract/API mismatches with other phases; runtime errors, disposal leaks, per-frame allocations in hot loops; files >= 200 lines; tests that are fake/vacuous or assert wrong values; plan references in code comments; text copied or lightly edited from the original source (run python3 ${RES}/verbatim-overlap-check.py ${PLAN} <changed files> and also eyeball for paraphrased-but-structurally-copied blocks) = critical; anything listed in the phase Todo not actually done.
Severity: critical = crash/wrong output visible or layout divergence; major = spec/parity deviation or missing feature; minor = style/quality. Cite evidence (original file:line or spec section) for every issue — no evidence, no issue.${rec.rejected.length ? `\nAlready-rejected issues (do NOT re-raise unless you have new evidence):\n${rec.rejected.map(r => '- ' + r.issue + ' — ' + r.reason).join('\n')}` : ''}`,
        { label: `review:${id}#${round}`, phase: 'Review', schema: REVIEW_SCHEMA }),
    ])

    const issues = review ? review.issues : []
    const blocking = issues.filter(i => i.severity !== 'minor')
    const minors = issues.filter(i => i.severity === 'minor')
    const testOk = !!(test && test.passed)
    rec.rounds.push({ round, testPassed: testOk, testSummary: test ? test.summary : 'tester returned null', failures: test ? test.failures : [], reviewSummary: review ? review.summary : 'reviewer returned null', issues })
    log(`${tag} round ${round}: tests ${testOk ? 'PASS' : 'FAIL'}, review ${blocking.length} blocking / ${minors.length} minor`)

    if (testOk && review && blocking.length === 0) {
      if (minors.length) {
        const polish = await agent(`${COMMON}

TASK: apply these MINOR review findings to Phase ${id} in ${REPO} where they are correct (verify each against the source/spec first; skip and explain wrong ones). Afterwards run the full test suite + line-count check; revert any change that breaks them. Return structured result (applied/rejected filled).
${minors.map(i => `- [${i.file}] ${i.detail} | evidence: ${i.evidence} | fix: ${i.fix}`).join('\n')}`,
          { label: `polish:${id}`, phase: 'Fix', schema: IMPL_SCHEMA })
        if (polish) { rec.polish = { summary: polish.summary, testsPassed: polish.testsPassed, applied: polish.applied, rejected: polish.rejected }; rec.blockedWrites.push(...polish.blockedWrites) }
        if (polish && !polish.testsPassed) { rec.status = 'POLISH_BROKE_TESTS'; break }
      }
      rec.status = 'CLEAN'
      break
    }
    if (round === MAX_ROUNDS) { rec.status = 'UNRESOLVED'; break }

    const fix = await agent(`${COMMON}${notesBlock()}

TASK: fix Phase ${id} in ${REPO}. First VERIFY each item against the original source / phase spec / contracts — reviewers can be wrong; reject (with reason) any claim that is false or would break parity. Fix everything real, including minors. Then re-run the full test suite, node --check, line-count check and browser smoke until green.
TEST FAILURES:
${test ? test.failures.map(f => `- ${f.check}: ${f.detail} | ${f.evidence}`).join('\n') || '(none)' : '- tester crashed/returned nothing — re-run the full checks yourself'}
REVIEW ISSUES:
${review ? issues.map(i => `- [${i.severity}] ${i.file}: ${i.detail} | evidence: ${i.evidence} | fix: ${i.fix}`).join('\n') || '(none)' : '- reviewer returned nothing — self-review the phase against the spec'}
Return structured result with applied[] and rejected[] filled.`,
      { label: `fix:${id}#${round}`, phase: 'Fix', schema: IMPL_SCHEMA })
    if (fix) {
      rec.rejected.push(...(fix.rejected || []))
      rec.blockedWrites.push(...fix.blockedWrites)
      changed = [...new Set([...changed, ...fix.filesCreated, ...fix.filesModified])]
      carryNotes.push(...fix.notesForLaterPhases.map(n => `[${tag}] ${n}`))
    }
  }

  carryNotes.push(...impl.notesForLaterPhases.map(n => `[${tag}] ${n}`))
  results.push(rec)
  if (rec.status !== 'CLEAN') { log(`${tag}: ${rec.status} — stopping run for orchestrator review`); break }
  log(`${tag}: CLEAN — committing`)
  const commit = await agent(`Work in the git repo ${REPO} (branch main, remote origin = git@github.com:tranhuuhuy297/train-diorama.git).
ORCHESTRATOR-AUTHORIZED COMMIT: the user asked for one commit + push after each finished phase. This overrides any "never commit" rule, for this task only.
Phase ${id} (${PHASE_TITLES[id] || FILES[id]}) has passed tests and review. Every uncommitted change in the working tree belongs to it.
Steps:
1. git config user.name / user.email must be tranhuuhuy297 / tranhuuhuy297@gmail.com (repo-local; set them if not).
2. Review git status. Exclude anything that must not be published: .parity-cache/, .parity-output/, node_modules/, scratch scripts, logs, .env or credentials, files containing tokens/keys, copies of the original site source. If something like that is untracked and not ignored, add it to .gitignore rather than committing it. List what you excluded.
3. Run npm test and npm run check:lines; both must pass, otherwise do not commit (report problems).
4. git add -A, then ONE commit with a conventional message, e.g. "feat: add ${PHASE_TITLES[id] || 'phase ' + id}", body = 2-5 bullets of what was added. No AI references, no plan/phase IDs in the message.
5. git push origin main. If rejected, git pull --rebase origin main then push (never force-push).
6. Find the "Deploy to GitHub Pages" Actions run for the new commit (gh run list -R tranhuuhuy297/train-diorama --limit 3) and wait for it (gh run watch <id> --exit-status). Report its conclusion.
Return the structured result.`, { label: `commit:${id}`, phase: 'Commit', schema: COMMIT_SCHEMA })
  rec.commit = commit
  if (!commit || !commit.committed || !commit.pushed) { log(`${tag}: commit/push failed — stopping`); rec.status = 'COMMIT_FAILED'; break }
  log(`${tag}: committed ${commit.sha} (deploy: ${commit.deployConclusion})`)
}

return { results, carryNotes }
