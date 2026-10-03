// CLI: re-runs the research capture script against the clone and scores its shots (22 main + 6 extras) against the
// research capture by palette overlap (top-10 4-bit colour keys), then writes a contact sheet. The research
// script is staged at runtime into the gitignored .parity-cache/research-recapture/ (never under tools/ and
// never run in place, which would overwrite the research captures); only its playwright require path changes.
// Usage: node tools/parity/research-recapture-and-contact-sheet.mjs [--pass main|extras|both] [--compare-only]
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolveChromiumExecutable, resolveTargetBaseUrl, stopCloneServer } from './playwright-browser-launcher.mjs';
import { resolveResearchDir } from './research-capture-paths.mjs';
import { RESEARCH_EQUIVALENTS, SIGNOFF_IDS } from './signoff-parity-shots.mjs';
import { paletteOverlap, paletteKeyFromHex } from './parity-metrics-math.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const STAGE_DIR = path.join(REPO_ROOT, '.parity-cache', 'research-recapture');
const OUT_DIR = path.join(REPO_ROOT, '.parity-output', 'research-recapture');
const SCRIPT_NAME = 'capture-visual-reference.mjs';
// The research script's only machine-specific line: createRequire('<path>/package.json').
const CREATE_REQUIRE = /createRequire\((['"])([^'"]+)\1\)/;
const LOGS = { main: 'capture-log.json', extras: 'capture-log-extras.json' };
const PASS_OVERLAP = 7;
const EXPECTED_SHOTS = Object.freeze({ main: 22, extras: 6 });

/** Copies the research script into the stage folder with only its playwright require path rewritten. */
export async function stageResearchScript(researchDir = resolveResearchDir()) {
  const source = await readFile(path.join(researchDir, SCRIPT_NAME), 'utf8');
  const match = source.match(CREATE_REQUIRE);
  if (!match) throw new Error(`${SCRIPT_NAME}: no createRequire('<path>') call found`);
  await mkdir(STAGE_DIR, { recursive: true });
  const staged = path.join(STAGE_DIR, SCRIPT_NAME);
  const local = path.join(REPO_ROOT, 'package.json');
  await writeFile(staged, source.replace(CREATE_REQUIRE, () => `createRequire(${JSON.stringify(local)})`));
  return staged;
}

function runPass(staged, pass, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [staged, 'angle', pass], { env: { ...process.env, ...env }, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', code => (code === 0 ? resolve() : reject(new Error(`research ${pass} pass exited with ${code}`))));
  });
}

const readLog = async file => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : { shots: [], console: [] });
const baseName = shot => path.basename(shot.file);

// Shots and console lines of the given passes' logs only.
async function mergedShots(dir, passes = Object.keys(LOGS)) {
  const logs = await Promise.all(passes.map(pass => readLog(path.join(dir, LOGS[pass]))));
  return { shots: new Map(logs.flatMap(log => log.shots.map(shot => [baseName(shot), shot]))), console: logs.flatMap(log => log.console) };
}

/** Per-shot palette overlap (plus advisory luma/bucket deltas) of the clone recapture vs the research capture. */
export function scoreShots(research, clone) {
  return [...research.keys()].sort().map(file => {
    const [a, b] = [research.get(file), clone.get(file)];
    if (!b) return { file, overlap: 0, missing: true, pass: false };
    const overlap = paletteOverlap(a.top, b.top);
    return {
      file, overlap, pass: overlap >= PASS_OVERLAP, deltaMeanLuma: +(b.meanLuma - a.meanLuma).toFixed(1),
      bucketRatio: +(b.colourBuckets / a.colourBuckets).toFixed(3), researchTop: a.top.map(t => t.hex), cloneTop: b.top.map(t => t.hex),
    };
  });
}

const chips = hexes => hexes.map(hex => `<span class="chip" title="${hex} key ${paletteKeyFromHex(hex).toString(16)}" style="background:${hex}"></span>`).join('');

function contactSheetHtml(rows, researchDir) {
  const cards = rows.map(row => `<section class="${row.pass ? 'ok' : row.exception ? 'exc' : 'bad'}"><h2>${row.file} — ${row.overlap}/10${row.exception ? ` (exception: ${row.exception})` : ''}</h2>
<div class="pair"><figure><img src="${pathToFileURL(path.join(researchDir, 'captures', row.file)).href}"><figcaption>research ${chips(row.researchTop ?? [])}</figcaption></figure>
<figure><img src="captures/${row.file}"><figcaption>clone ${chips(row.cloneTop ?? [])}</figcaption></figure></div></section>`).join('\n');
  return `<!doctype html><meta charset="utf-8"><title>Research recapture contact sheet</title>
<style>body{font:14px system-ui;background:#222;color:#eee;margin:16px}.pair{display:flex;gap:12px}img{width:640px;display:block}
.chip{display:inline-block;width:18px;height:18px;margin-right:2px;vertical-align:middle;border:1px solid #0006}section{margin-bottom:20px}
.ok h2{color:#8f8}.bad h2{color:#f88}.exc h2{color:#fd6}h2{font-size:15px}</style>
<h1>Research recapture: clone vs research (palette overlap)</h1>\n${cards}\n`;
}

const SIGNOFF_REPORT = path.join(REPO_ROOT, '.parity-output', 'compare', 'signoff-report.json');

/** The sign-off compare report when it covers every sign-off shot from one capture run, else null. */
export function completeSignoffReport(report) {
  const complete = report?.generatedAt && report.runId && SIGNOFF_IDS.every(id => report.shots?.[id]);
  return complete ? report : null;
}

function equivalentPassed(file, report) {
  const id = RESEARCH_EQUIVALENTS[file];
  return id && report?.shots[id]?.pass === true ? id : null;
}

async function main() {
  const { values } = parseArgs({ options: { pass: { type: 'string', default: 'both' }, 'compare-only': { type: 'boolean', default: false } } });
  const researchDir = resolveResearchDir();
  if (!['main', 'extras', 'both'].includes(values.pass)) throw new Error(`--pass must be main, extras or both (got ${values.pass})`);
  const passes = values.pass === 'both' ? ['main', 'extras'] : [values.pass];
  const expected = passes.reduce((total, pass) => total + EXPECTED_SHOTS[pass], 0);
  const env = { TARGET_URL: await resolveTargetBaseUrl('clone'), CHROMIUM_PATH: resolveChromiumExecutable('angle') };
  // Only the requested passes' shots are scored, retried and counted.
  const research = await mergedShots(path.join(researchDir, 'captures'), passes);
  const stagedCaptures = path.join(STAGE_DIR, 'captures');
  let rows = [];
  try {
    const staged = values['compare-only'] ? null : await stageResearchScript(researchDir);
    if (staged) for (const pass of passes) await runPass(staged, pass, env);
    rows = scoreShots(research.shots, (await mergedShots(stagedCaptures, passes)).shots);
    // A failing shot reruns its whole pass once.
    const mainFiles = new Set((await readLog(path.join(researchDir, 'captures', LOGS.main))).shots.map(baseName));
    const retry = [...new Set(rows.filter(row => !row.pass).map(row => (mainFiles.has(row.file) ? 'main' : 'extras')))];
    if (staged && retry.length > 0) {
      for (const pass of retry) await runPass(staged, pass, env);
      rows = scoreShots(research.shots, (await mergedShots(stagedCaptures, passes)).shots);
    }
  } finally {
    await stopCloneServer();
  }
  const signoff = completeSignoffReport(existsSync(SIGNOFF_REPORT) ? JSON.parse(await readFile(SIGNOFF_REPORT, 'utf8')) : null);
  if (!signoff && rows.some(row => !row.pass)) console.log('no complete sign-off compare report (compare --shots signoff): exceptions disabled');
  for (const row of rows.filter(candidate => !candidate.pass)) row.exception = equivalentPassed(row.file, signoff);
  await mkdir(OUT_DIR, { recursive: true });
  if (existsSync(stagedCaptures)) await cp(stagedCaptures, path.join(OUT_DIR, 'captures'), { recursive: true });
  const cloneConsole = (await mergedShots(stagedCaptures, passes)).console;
  const pageErrors = cloneConsole.filter(line => line.includes('pageerror'));
  const summary = { generatedAt: new Date().toISOString(), researchDir, passes, passOverlap: PASS_OVERLAP, pageErrors, rows };
  await writeFile(path.join(OUT_DIR, 'research-palette-overlap.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await writeFile(path.join(OUT_DIR, 'research-contact-sheet.html'), contactSheetHtml(rows, researchDir));
  for (const row of rows) console.log(`${row.pass ? 'PASS' : row.exception ? 'EXCEPTION' : 'FAIL'} ${row.file} overlap ${row.overlap}/10${row.exception ? ` (equivalent ${row.exception} passed)` : ''}`);
  console.log(`${rows.length} shots, ${rows.filter(row => row.pass).length} pass, ${pageErrors.length} clone page errors`);
  if (rows.length !== expected) console.log(`expected ${expected} research shots for --pass ${values.pass}, found ${rows.length}`);
  if (pageErrors.length > 0 || rows.length !== expected || rows.some(row => !row.pass && !row.exception)) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
