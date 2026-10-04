export const meta = {
  name: 'train-diorama-plan',
  description: 'Architect + per-phase write/adversarial-verify + cross-phase integration check for a faithful train-diorama clone plan',
  phases: [
    { title: 'Architect', detail: 'unified architecture, contracts, RNG order, phase breakdown + coverage repair' },
    { title: 'Write', detail: 'one writer per phase file' },
    { title: 'Verify', detail: 'adversarial critic per phase vs original source; returns corrected file' },
    { title: 'Integrate', detail: 'cross-phase contract/ownership/dependency check, then targeted revisions' },
  ],
}

const ROOT = '<workspace>/plans/260930-train-diorama-clone'
const R = ROOT + '/research'
const SRC = R + '/source'
const COUNTS = { '01': 13, '02': 16, '03': 17, '04': 14, '05': 20, '06': 18, '07': 14, '08': 18, '09': 17 }
const ALL_IDS = Object.entries(COUNTS).flatMap(([s, n]) => Array.from({ length: n }, (_, i) => 'F' + s + '.' + String(i + 1).padStart(2, '0')))

const CONTEXT = `
PROJECT: a faithful from-scratch re-implementation of https://train-diorama.vercel.app/ (cozy stylized low-poly Three.js train diorama). "Y như" = must look and behave the same as the original.
Research material (READ what your task needs; these are authoritative):
- ${SRC}/ : the original downloaded source (index.html, Styles.css, TrainScene.js, LoadingScreen.js, Diorama.js, Materials.js, Noise.js, StaticGeometry.js, LightGlows.js, World.js [2150 lines], Train.js, BrakeSparks.js, BirdSystem.js, TrackSheep.js, StationWalker.js, VillageResidents.js, TrainDiorama_Logo.svg, ClockFavicon.svg).
- ${R}/analysis-01-ui-shell-state.md, analysis-02-diorama-renderer-cameras-post.md, analysis-03-materials-noise-glows.md, analysis-04-world-terrain-track.md (World.js 1-547), analysis-05-world-bridge-station.md (World.js 548-1165), analysis-06-world-village-windmill-trees-rocks.md (World.js 1166-1638), analysis-07-world-water-clouds-balloon-update.md (World.js 1639-2150), analysis-08-train-brake-sparks.md, analysis-09-life-birds-sheep-walkers-villagers.md : reimplementation specs per subsystem (features, algorithms, constants, interfaces, suggested splits, risks).
- ${R}/features-inventory.md : 147 feature IDs (F01.01 .. F09.17). Some IDs describe the same underlying feature from different scopes (e.g. sheep, station travelers, smoke) — they must land in the same phase.
- ${R}/visual-reference.md + ${R}/captures/*.png : screenshots of the live original (day/evening/night overview, train/bridge/free cams, pixel art, ink off, HUD, mobile, debug menu) + style bible. ${R}/capture-visual-reference.mjs : working Playwright capture script (SwiftShader headless ~1.9 FPS; sim runs ~0.1x real time).

FIXED DECISIONS (already made — do not re-litigate; record in plan):
D1 Fidelity: visual + behavioural parity with the original, including procedural layout (same seeds, same PRNG algorithm, SAME ORDER of random draws so houses/trees/rocks/sheep land in identical spots). Internal refactors only when output-identical (module split, caching, singleton uniform bag, baking the station platform-extension loop to final coords, removing per-frame allocations). User-visible quirks of the original are KEPT for parity; list them in an appendix "Post-parity optional fixes" (out of scope).
D2 Stack: vanilla ES modules, three@0.186.0 + three/addons via importmap from unpkg (same pin), NO bundler/build step, static hosting on Vercel. Fredoka from Google Fonts. Hand-written CSS replaces the precompiled Tailwind v4 bundle (only utilities actually used).
D3 Code organisation: kebab-case self-descriptive filenames, every code file < 200 lines, domain folders under src/. Short dense comments; code comments must NOT reference plan phases/finding IDs.
D4 Location: new git repo at <workspace>/train-diorama ; commits as tranhuuhuy297 <tranhuuhuy297@gmail.com> (repo-local git config), conventional commits.
D5 Tooling: package.json with devDependencies only (playwright for parity captures, a tiny static server script), unit tests with node --test for pure logic (PRNG/noise, spline/queries, settings validation, state machines, loading step runner). Runtime stays build-free.
D6 Parity harness: capture the same shot list from the clone as the original (reuse capture-visual-reference.mjs approach), side-by-side compare; runtime probes via page.evaluate on BOTH sites (counts: houses, tree instances per species, rocks, sheep, clouds, draw calls ~1.4k, triangles ~1.77M, key positions like windmill/station). A read-only test hook (e.g. window.__diorama) is allowed if it does not change visuals.
D7 Keep: debug menu (··· + perf stats), L-key camera pose log, console gameplay logs, Vercel analytics stub (optional, only when deployed on Vercel). Logo: default = reuse the original SVG for a private/learning build; flag as open question whether to redraw before any public release (it is the original author's asset). Storage key: keep 'train-scene-settings-v2'.
D8 Env gotchas: local Claude hooks block shell commands whose paths contain node_modules/build/vendor patterns — run node probes via scripts outside those paths or via Playwright page.evaluate. Headless WebGL = SwiftShader (slow) — parity captures must wait on state, not wall time; a deterministic fixed-dt stepping hook for captures is acceptable if gated behind a query param.

PHASE FILE TEMPLATE (markdown, sections in this order): # Phase NN — Title ; ## Context Links ; ## Overview (Priority, Status: Pending, Est. effort, Brief description) ; ## Key Insights ; ## Requirements (Functional / Non-functional) ; ## Architecture (design, component interactions, data flow; public interfaces with exact signatures) ; ## Related Code Files (Create / Modify / Delete — full repo-relative paths, each with est. lines, all < 200) ; ## Implementation Steps (detailed numbered steps with exact constants, formulas, RNG draw order, per-frame order) ; ## Todo List (checkboxes) ; ## Success Criteria (definition of done + validation: unit tests, parity captures/probes to compare against which reference PNG) ; ## Risk Assessment ; ## Security Considerations ; ## Next Steps.
Concise wording (sacrifice grammar for concision), but NEVER drop a constant, sub-part, or behaviour needed for parity.`

const ARCH_SCHEMA = {
  type: 'object',
  properties: {
    folderTree: { type: 'string', description: 'full repo tree (text) of the clone with every file' },
    contracts: { type: 'string', description: 'markdown: cross-module contracts — module public APIs with signatures, shared uniform bag, PRNG streams + exact global draw order across build steps, World/Train/Diorama per-frame update order, DOM ids, events' },
    phases: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string', description: 'two digits, e.g. 01' },
      slug: { type: 'string', description: 'kebab-case' },
      title: { type: 'string' },
      priority: { type: 'string' },
      goal: { type: 'string' },
      dependsOn: { type: 'array', items: { type: 'string' } },
      featureIds: { type: 'array', items: { type: 'string' } },
      analysisRefs: { type: 'array', items: { type: 'string' } },
      sourceRefs: { type: 'array', items: { type: 'string' }, description: 'original file:line ranges this phase must mirror' },
      filesToCreate: { type: 'array', items: { type: 'string' } },
      acceptance: { type: 'array', items: { type: 'string' } },
      estLines: { type: 'number' },
    }, required: ['id', 'slug', 'title', 'priority', 'goal', 'dependsOn', 'featureIds', 'analysisRefs', 'sourceRefs', 'filesToCreate', 'acceptance', 'estLines'] } },
    planMd: { type: 'string', description: 'plan.md overview, <= 80 lines: goal, decisions summary, phase table with links phase-NN-slug.md + status Pending + deps, key dependencies, open questions' },
    postParityFixes: { type: 'array', items: { type: 'string' } },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['folderTree', 'contracts', 'phases', 'planMd', 'postParityFixes', 'openQuestions'],
}

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

phase('Architect')
let arch = await agent(`${CONTEXT}

TASK (Architect): design the unified architecture and phase breakdown for the clone. Read ALL nine analysis files, features-inventory.md, visual-reference.md, and skim the original source structure (grep exports/imports, World constructor build order, Diorama constructor/update, where Math.random vs seeded PRNG is used).
Deliver:
1. folderTree — reconcile the conflicting per-analysis split suggestions into ONE consistent kebab-case layout (e.g. src/core, src/materials, src/engine, src/engine/cameras, src/world/{terrain,track,bridge,station,village,windmill,trees,water,sky,balloon}, src/train, src/life/{birds,sheep,station,village}, src/ui, styles/, assets/, tests/, tools/). Every file < 200 lines. No duplicated responsibilities (e.g. vents helper, extrude helper, sheep code, station travelers idle, smoke puffs must each live in exactly one place).
2. contracts — the backbone every phase writer will code against: exact module APIs; shared lighting uniform bag; PRNG: seeds + the complete global order of random draws across World build steps (this is what makes layout identical — be precise); construction order; per-frame update order (Diorama → World → Train → birds → sparks...); DOM ids; what TrainScene-equivalent calls on Diorama-equivalent.
3. phases — 10-14 phases, dependency-ordered so each phase ends in a runnable/visually checkable state (e.g. early: scaffold+shell+HUD with stub scene; core utils+materials; renderer/palettes/post/pixel; cameras; terrain+track; bridge; station; village/windmill/trees/rocks; water/clouds/balloon; train+motion+smoke+sparks+headlight; life (birds, sheep, walkers, villagers); loading integration+debug+perf budget+parity harness+docs+deploy). Also include project docs (docs/ folder: system-architecture, code-standards, codebase-summary, project-changelog, development-roadmap) somewhere sensible. Assign EVERY feature ID F01.01..F09.17 to exactly one phase (IDs describing the same thing go to the same phase). Each file in folderTree must be created by exactly one phase. acceptance = concrete checks (which reference PNG to match, probe counts, tests).
4. planMd (<= 80 lines), postParityFixes (known user-visible quirks kept for parity), openQuestions (only real ones needing the user; include the logo-reuse question).`, { label: 'architect', phase: 'Architect', schema: ARCH_SCHEMA })

let cov = coverage(arch.phases)
let attempts = 0
while ((cov.missing.length || cov.unknown.length || cov.multi.length || cov.dupFiles.length) && attempts < 3) {
  attempts++
  log(`Coverage repair #${attempts}: missing=${cov.missing.length} unknown=${cov.unknown.length} multi=${cov.multi.length} dupFiles=${cov.dupFiles.length}`)
  arch = await agent(`${CONTEXT}

TASK (Architect repair): the architecture below fails the deterministic coverage check. Fix ONLY what is needed and return the full corrected object (same schema).
Problems:
- Feature IDs not assigned to any phase: ${JSON.stringify(cov.missing)}
- Unknown feature IDs (not in inventory, remove or correct): ${JSON.stringify(cov.unknown)}
- Feature IDs assigned to more than one phase (pick exactly one): ${JSON.stringify(cov.multi)}
- Files created by more than one phase (pick exactly one owner; others list it as modify in their prose later): ${JSON.stringify(cov.dupFiles)}
Look up IDs in ${R}/features-inventory.md.

CURRENT ARCHITECTURE JSON:
${JSON.stringify(arch)}`, { label: `architect-repair-${attempts}`, phase: 'Architect', schema: ARCH_SCHEMA })
  cov = coverage(arch.phases)
}
if (cov.missing.length || cov.unknown.length || cov.multi.length || cov.dupFiles.length) log('Coverage still imperfect after repairs: ' + JSON.stringify(cov))
else log(`Coverage OK: ${ALL_IDS.length} features over ${arch.phases.length} phases`)

const PHASE_INDEX = arch.phases.map(p => `- ${p.id} ${p.title} (deps ${p.dependsOn.join(',') || '-'}) creates: ${p.filesToCreate.join(', ')}`).join('\n')
const SHARED = `${CONTEXT}

UNIFIED FOLDER TREE:
${arch.folderTree}

CROSS-MODULE CONTRACTS (authoritative; code against these exactly):
${arch.contracts}

ALL PHASES (for context; do not write other phases):
${PHASE_INDEX}`

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'object', properties: {
      severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
      kind: { type: 'string', description: 'omission | wrong-value | rng-order | contract-mismatch | file-size | vague-step | missing-test | other' },
      detail: { type: 'string' },
      evidence: { type: 'string', description: 'original file:line or analysis section' },
    }, required: ['severity', 'kind', 'detail', 'evidence'] } },
    revisedMarkdown: { type: 'string', description: 'the COMPLETE corrected phase file with every issue fixed' },
    filesCreated: { type: 'array', items: { type: 'string' } },
    filesModified: { type: 'array', items: { type: 'string' } },
    exportsProvided: { type: 'array', items: { type: 'string' }, description: 'module path :: exported symbol/signature' },
    importsConsumed: { type: 'array', items: { type: 'string' }, description: 'module path :: symbol consumed from OTHER phases' },
  },
  required: ['issues', 'revisedMarkdown', 'filesCreated', 'filesModified', 'exportsProvided', 'importsConsumed'],
}

const phaseResults = await pipeline(arch.phases,
  (p) => agent(`${SHARED}

TASK (Phase writer): write the COMPLETE markdown for phase file phase-${p.id}-${p.slug}.md following the PHASE FILE TEMPLATE.
This phase:
${JSON.stringify(p, null, 2)}
Method: read the analysisRefs files fully AND the original source ranges in sourceRefs (the source is the ground truth — pull exact constants, dimensions, colors, counts, seeds, timings, formulas, draw order from it). Cover every assigned feature ID (cite IDs in Overview), every file to create (with est. lines < 200 and responsibility), unit tests for pure logic, and parity validation against specific reference captures/probes. Implementation Steps must be precise enough to implement without opening the original.
Return ONLY the markdown file content.`, { label: `write:${p.id}-${p.slug}`, phase: 'Write' }),
  (draft, p) => agent(`${SHARED}

TASK (Adversarial verifier): you are a skeptical reviewer. The phase file below was drafted for phase ${p.id} (${p.title}). Assume it has errors until proven otherwise.
Phase spec: ${JSON.stringify(p)}
Verify against the ORIGINAL source ranges (${p.sourceRefs.join('; ')}) and the analyses (${p.analysisRefs.join(', ')}). Hunt for:
- omissions: any sub-part, behaviour, animation, night variant, interaction, edge case, or assigned feature ID missing;
- wrong values: constants/colors/dimensions/counts/timings/formulas that differ from the source;
- rng-order: anything that would change the order or number of PRNG draws vs the original (breaks identical layout);
- contract-mismatch: APIs that disagree with CROSS-MODULE CONTRACTS or other phases' files;
- file-size: any file likely >= 200 lines; vague-step: steps an implementer could not follow without the original; missing-test: pure logic without unit tests, visuals without a parity check.
Then produce revisedMarkdown = the complete corrected file with ALL issues fixed (keep the template). Also list filesCreated/filesModified/exportsProvided/importsConsumed of the revised phase.

DRAFT:
${draft}`, { label: `verify:${p.id}-${p.slug}`, phase: 'Verify', schema: CRITIC_SCHEMA }),
)

const phases = arch.phases.map((p, i) => ({ ...p, result: phaseResults[i] }))
const failed = phases.filter(p => !p.result).map(p => p.id)
if (failed.length) log('Phases with no verified result: ' + failed.join(', '))

phase('Integrate')
const ownership = {}
for (const p of phases) for (const f of (p.result ? p.result.filesCreated : [])) (ownership[f] = ownership[f] || []).push(p.id)
const dupOwners = Object.entries(ownership).filter(([, v]) => v.length > 1).map(([k, v]) => k + '→' + v.join('/'))
if (dupOwners.length) log('Duplicate file creators after verify: ' + dupOwners.join('; '))

const INTEG_SCHEMA = {
  type: 'object',
  properties: {
    issues: { type: 'array', items: { type: 'object', properties: {
      phaseId: { type: 'string' }, severity: { type: 'string', enum: ['critical', 'major', 'minor'] }, fix: { type: 'string' },
    }, required: ['phaseId', 'severity', 'fix'] } },
    summary: { type: 'string' },
  },
  required: ['issues', 'summary'],
}
const integ = await agent(`${SHARED}

TASK (Integration critic): check the phases fit together. For each phase you get dependsOn, files created/modified, exports provided and imports consumed (from the verified files). Find:
- imports consumed that no phase provides, or provided with a different name/signature;
- a phase consuming something provided only by a LATER phase or a phase not in its dependsOn chain;
- files created by more than one phase (deterministic check found: ${JSON.stringify(dupOwners)}), files in the folder tree created by no phase, files modified before they are created;
- per-frame update order or PRNG draw order inconsistencies between phases vs CONTRACTS;
- missing cross-cutting work: docs/, tests wiring, parity harness, deploy, git setup.
You may Read full phase markdown if needed — it is not on disk, so rely on the summaries below; be concrete. Output one issue per needed change with the target phaseId and an exact fix instruction.

PHASE SUMMARIES:
${JSON.stringify(phases.map(p => ({ id: p.id, title: p.title, dependsOn: p.dependsOn, filesCreated: p.result && p.result.filesCreated, filesModified: p.result && p.result.filesModified, exportsProvided: p.result && p.result.exportsProvided, importsConsumed: p.result && p.result.importsConsumed })), null, 1)}`, { label: 'integration-critic', phase: 'Integrate', schema: INTEG_SCHEMA })

const byPhase = {}
for (const iss of (integ ? integ.issues : [])) (byPhase[iss.phaseId] = byPhase[iss.phaseId] || []).push(iss)
const toRevise = phases.filter(p => p.result && byPhase[p.id] && byPhase[p.id].some(i => i.severity !== 'minor' || byPhase[p.id].length > 0))
log(`Integration issues: ${integ ? integ.issues.length : 'n/a'}; revising ${toRevise.length} phase files`)

const revised = await parallel(toRevise.map(p => () => agent(`${SHARED}

TASK (Reviser): apply these cross-phase integration fixes to phase ${p.id} (${p.title}) and return the COMPLETE corrected markdown only. Change nothing else. Verify any new detail against the original source if it involves values.
FIXES:
${byPhase[p.id].map(i => `- [${i.severity}] ${i.fix}`).join('\n')}

CURRENT FILE:
${p.result.revisedMarkdown}`, { label: `revise:${p.id}`, phase: 'Integrate' })))
toRevise.forEach((p, i) => { if (revised[i]) p.result.revisedMarkdown = revised[i] })

return {
  coverage: cov,
  planMd: arch.planMd,
  folderTree: arch.folderTree,
  contracts: arch.contracts,
  postParityFixes: arch.postParityFixes,
  openQuestions: arch.openQuestions,
  integration: integ,
  dupOwners,
  phases: phases.map(p => ({
    id: p.id, slug: p.slug, title: p.title, dependsOn: p.dependsOn, estLines: p.estLines,
    featureIds: p.featureIds,
    issuesFound: p.result ? p.result.issues.map(i => `${i.severity}/${i.kind}: ${i.detail}`) : null,
    markdown: p.result ? p.result.revisedMarkdown : null,
  })),
}
