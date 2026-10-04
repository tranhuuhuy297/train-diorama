export const meta = {
  name: 'train-diorama-plan-independent-rewrite',
  description: 'Rewrite plan phase files + contracts from verbatim-copy instructions to independent behavioral specs, verify no lost detail and no verbatim source',
  phases: [
    { title: 'Rewrite', detail: 'one agent per plan file' },
    { title: 'Verify', detail: 'overlap script + lost-detail audit, returns corrected file' },
  ],
}

const PLAN = '<workspace>/plans/260930-train-diorama-clone'
const OLD = PLAN + '/archive-v1-verbatim'
const RES = PLAN + '/research'
const CHECK = `python3 ${RES}/verbatim-overlap-check.py ${PLAN} <file>`
const ITEMS = [
  'cross-module-contracts.md', 'folder-tree.md',
  'phase-01-scaffold-shell-hud.md', 'phase-02-core-noise-materials-effects.md', 'phase-03-engine-renderer-sky-post-overview.md',
  'phase-04-debug-menu-and-parity-harness.md', 'phase-05-world-terrain-track-bridge.md', 'phase-06-world-station.md',
  'phase-07-train-model-motion-effects.md', 'phase-08-world-village-windmill.md', 'phase-09-world-residents-trees-rocks.md',
  'phase-10-camera-modes-free-train-bridge.md', 'phase-11-life-sheep-flock.md', 'phase-12-world-water-clouds-balloon.md',
  'phase-13-life-station-travelers-and-birds.md', 'phase-14-parity-perf-docs-deploy.md',
]

const POLICY = `
CONTEXT: This is an implementation plan for re-creating the look and behaviour of https://train-diorama.vercel.app/ (stylized Three.js train diorama). The original has NO license (all rights reserved). The previous plan version told implementers to transcribe the original CSS/JS/GLSL/SVG verbatim and embedded transcribed code. An implementer correctly refused. New policy (fixed decision; do not re-litigate):

INDEPENDENT IMPLEMENTATION POLICY
- Goal unchanged: same visual result and behaviour (output parity): same geometry dimensions, colors, counts, timings, camera framing, UI layout/labels, interactions, and same procedural layout (same seeds + same PRNG algorithm + same sequence of random draws). Output-level parity tests stay (screenshots vs reference captures, runtime probes vs live site, equal numeric outputs vs the original run as a black-box oracle from the local gitignored .parity-cache). Running the original locally as a test oracle is fine; copying its text is not.
- The plan must specify WHAT to build and the exact parameters, NOT reproduce the original's code text. Remove every instruction like "verbatim", "copy the original", "byte-identical source/CSS/shader", "transcribe", "port line-by-line". Remove every embedded code block/line copied or lightly edited from the original JS/CSS/GLSL/HTML/SVG.
- Replace them with: parameter/constant TABLES (values are facts — keep every one), formulas in math notation or neutral pseudocode written fresh, algorithm steps in prose (including exact order of random draws as a list of draws, not code), interface signatures (names/args/returns as API contracts), and acceptance criteria. Implementers will write their own code structure.
- Allowed to keep as-is: DOM ids, CSS class names that are Tailwind's open-source vocabulary, short UI labels/strings (button text, shortcut descriptions, toast texts, station name), storage key, public-domain/standard algorithms written in your own words (mulberry32, sin-hash, value noise, smoothstep, Bayer matrix), standard three.js API idioms (e.g. gl_Position = projectionMatrix * viewMatrix * modelMatrix * position), Vercel's official analytics snippet.
- Logo + favicon: do NOT reuse or trace the original artwork. Specify an ORIGINAL design: a wordmark "Train Diorama" in Fredoka 700 with a chunky warm outline/shadow style matching the HUD palette (#3f2a1f / #ca4e36 / #fbf4e2) plus a simple original motif (e.g. small steam-train or clock glyph built from basic shapes), hand-authored SVG; favicon = simple original clock/train glyph. Parity checks for the loading screen compare layout/position/size, not artwork.
- Keep everything else: structure, sections (template), file list and ownership, contracts, dependencies, tests, parity harness, decisions D2-D8, risks, todo lists. Fidelity detail must NOT be lost — only its form changes (code → table/prose/math).
- Code comments in the future implementation must not cite the original's file:line; the PLAN may still cite original file:line ranges as research references for implementers to understand behaviour (reading the original to understand behaviour is allowed; copying text is not).`

const REWRITE_SCHEMA = {
  type: 'object',
  properties: {
    markdown: { type: 'string', description: 'COMPLETE rewritten file' },
    changes: { type: 'array', items: { type: 'string' } },
  },
  required: ['markdown', 'changes'],
}
const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    markdown: { type: 'string', description: 'COMPLETE final file with all problems fixed' },
    overlapBefore: { type: 'number' },
    overlapAfter: { type: 'number', description: 'overlap checker TOTAL on your final markdown' },
    keptChunks: { type: 'array', items: { type: 'object', properties: { chunk: { type: 'string' }, reason: { type: 'string' } }, required: ['chunk', 'reason'] } },
    lostDetailRestored: { type: 'array', items: { type: 'string' } },
    remainingVerbatimDirectives: { type: 'number', description: 'count of remaining verbatim/copy/transcribe instructions (should be 0)' },
  },
  required: ['markdown', 'overlapBefore', 'overlapAfter', 'keptChunks', 'lostDetailRestored', 'remainingVerbatimDirectives'],
}

const out = await pipeline(ITEMS,
  (name) => agent(`${POLICY}

TASK: rewrite ${PLAN}/${name} under the policy. Read it fully. Run the overlap checker on it first to see the verbatim chunks: ${CHECK.replace('<file>', PLAN + '/' + name)} (lists every line chunk matching the original source). Also grep it for verbatim|byte|copy|transcri|line-by-line. Rewrite every offending part into tables/prose/fresh math/pseudocode/signatures without dropping any fact. Return the complete rewritten markdown (do not write files; the orchestrator writes it).`,
    { label: `rewrite:${name}`, phase: 'Rewrite', schema: REWRITE_SCHEMA }),
  (rw, name) => {
    if (!rw) return null
    const draft = `/tmp/td-plan-drafts/${name.replace(/\.md$/, '.txt')}`
    return agent(`${POLICY}

TASK (verifier): a rewrite of ${name} is below. Do all of:
1. Save it to ${draft} (mkdir -p /tmp/td-plan-drafts; .txt is intentional) and run: ${CHECK.replace('<file>', draft)} . Every remaining chunk must be either removed/rephrased or justified under the "Allowed to keep" list (report it in keptChunks with reason). Also report overlapBefore by running the checker on the old version ${OLD}/${name}.
2. Lost-detail audit: compare against the old version ${OLD}/${name}. Every fact there (constant, dimension, color, count, timing, formula, draw-order item, file, test, acceptance check, risk) must still be present in some form. Restore anything missing (in table/prose form, never as copied code).
3. Ensure zero remaining instructions to copy/transcribe/port verbatim; logo/favicon = original design per policy; template sections intact.
Return the COMPLETE final markdown with fixes applied (re-run the checker on your final text before returning).

REWRITE:
${rw.markdown}`, { label: `verify:${name}`, phase: 'Verify', schema: VERIFY_SCHEMA })
  },
)

return ITEMS.map((name, i) => out[i] ? {
  name, markdown: out[i].markdown, overlapBefore: out[i].overlapBefore, overlapAfter: out[i].overlapAfter,
  keptChunks: out[i].keptChunks, lostDetailRestored: out[i].lostDetailRestored, remainingVerbatimDirectives: out[i].remainingVerbatimDirectives,
} : { name, markdown: null })
