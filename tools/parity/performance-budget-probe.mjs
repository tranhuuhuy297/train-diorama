// CLI: performance budget, clone vs original on one profile. Cold loads alternate original/clone, each in a new
// context: BUILD and LOAD ENGINE from the loader phase marks, navigation -> loader hidden, then CPU-submit medians
// (EMA inverted) frozen and running. One heap run per site: retained growth and sampled allocation per step.
// Usage: node tools/parity/performance-budget-probe.mjs [--runs 5] [--skip-heap] [--profile angle]
import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchParityBrowser, resolveTargetBaseUrl, stopCloneServer } from './playwright-browser-launcher.mjs';
import { installOriginalRouteHooks, awaitReadinessOrHookError } from './original-site-route-hooks.mjs';
import { prepareParityContext, openParityPage, waitForDioramaReady, freezeForParity, applyShotState, stepFrames, waitFrames } from './page-parity-helpers.mjs';
import { installLoadPhaseMarks, readLoadPhaseMarks, sampleCpuSubmitMilliseconds } from './signoff-page-helpers.mjs';
import { invertEmaSamples, median, coefficientOfVariation, buildMillisecondsFromMarks, attributeHeapSamples } from './parity-metrics-math.mjs';

const TARGETS = ['original', 'clone'];
const OV_DAY = { mode: 'overview', timeOfDay: 'day', pixelShortSide: null, outline: true };
const RATIO_LIMIT = 1.1;
const RETAINED_SLACK_BYTES = 64 * 1024;
const HEAP_STEPS = 1200;
const HEAP_NATURAL_FRAMES = 60;
const CV_RERUN_LIMIT = 0.05;

async function openPage(browser, target, baseUrl) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await prepareParityContext(context);
  await installLoadPhaseMarks(context);
  const hookState = target === 'original' ? await installOriginalRouteHooks(context) : null;
  const page = await openParityPage(context, baseUrl, { parity: 'freeze' });
  await awaitReadinessOrHookError(waitForDioramaReady(page), hookState);
  await freezeForParity(page);
  await applyShotState(page, OV_DAY);
  return { context, page };
}

const setPaused = (page, paused) => page.evaluate(value => { window.__diorama.paused = value; }, paused);
const cpuMedian = async page => median(invertEmaSamples(await sampleCpuSubmitMilliseconds(page, { warmup: 20, frames: 60 })));

async function coldLoad(browser, target, baseUrl) {
  const { context, page } = await openPage(browser, target, baseUrl);
  try {
    const { marks, loaderHiddenAt } = await readLoadPhaseMarks(page);
    const phases = buildMillisecondsFromMarks(marks);
    const cpuFrozen = await cpuMedian(page);
    await setPaused(page, false);
    const cpuRunning = await cpuMedian(page);
    return { build: phases?.build ?? null, loadEngine: phases?.loadEngine ?? null, loaderHidden: loaderHiddenAt, cpuFrozen, cpuRunning };
  } finally {
    await context.close();
  }
}

async function heapRun(browser, target, baseUrl) {
  const { context, page } = await openPage(browser, target, baseUrl);
  const origin = new URL(baseUrl).origin;
  const isAppUrl = url => url.startsWith(origin) && !/unpkg\.com|fonts\.(googleapis|gstatic)\.com/.test(url);
  try {
    const cdp = await context.newCDPSession(page);
    await cdp.send('HeapProfiler.enable');
    const collect = async () => { await cdp.send('HeapProfiler.collectGarbage'); await cdp.send('HeapProfiler.collectGarbage'); };
    const natural = async frames => { await setPaused(page, false); await waitFrames(page, frames); await setPaused(page, true); };
    await stepFrames(page, 120);
    await natural(30);
    await collect();
    const u0 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
    await cdp.send('HeapProfiler.startSampling', { samplingInterval: 1024, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
    await stepFrames(page, HEAP_STEPS);
    await natural(HEAP_NATURAL_FRAMES);
    const { profile } = await cdp.send('HeapProfiler.stopSampling');
    await collect();
    const u1 = (await cdp.send('Runtime.getHeapUsage')).usedSize;
    const steps = HEAP_STEPS + HEAP_NATURAL_FRAMES;
    const attributed = attributeHeapSamples(profile, isAppUrl);
    return {
      u0, u1, retainedDelta: u1 - u0, totalBytesPerStep: attributed.totalBytes / steps, appBytesPerStep: attributed.appBytes / steps,
      topAppSites: attributed.sites.slice(0, 10).map(site => ({ ...site, bytesPerStep: site.bytes / steps, label: `${site.functionName} ${site.url}:${site.line}` })),
    };
  } finally {
    await context.close();
  }
}

function summarise(samples) {
  const fields = ['build', 'loadEngine', 'loaderHidden', 'cpuFrozen', 'cpuRunning'];
  return Object.fromEntries(fields.map(field => {
    const values = samples.map(sample => sample[field]).filter(value => typeof value === 'number');
    return [field, { median: median(values), cv: coefficientOfVariation(values), values }];
  }));
}

/** Pass/fail lines for the budget: medians within 1.10x, heap growth and allocation per step. */
export function judgePerformance(loads, heap) {
  const checks = [];
  // A missing sample set must fail: null <= 1.1 * null is true in JS.
  const within = (c, o) => Number.isFinite(c) && Number.isFinite(o) && c <= RATIO_LIMIT * o;
  for (const field of ['build', 'cpuFrozen', 'cpuRunning']) {
    const [o, c] = [loads.original[field].median, loads.clone[field].median];
    checks.push({ name: `${field} median`, pass: within(c, o), detail: `clone ${c?.toFixed(2)} ms vs original ${o?.toFixed(2)} ms (ratio ${(c / o).toFixed(3)})` });
  }
  if (heap) {
    const [o, c] = [heap.original, heap.clone];
    checks.push({ name: 'retained heap growth', pass: Number.isFinite(c.retainedDelta) && Number.isFinite(o.retainedDelta) && c.retainedDelta <= o.retainedDelta + RETAINED_SLACK_BYTES, detail: `clone ${c.retainedDelta} B vs original ${o.retainedDelta} B` });
    for (const field of ['totalBytesPerStep', 'appBytesPerStep']) {
      checks.push({ name: field, pass: within(c[field], o[field]), detail: `clone ${c[field]?.toFixed(1)} vs original ${o[field]?.toFixed(1)}` });
    }
    // Heavy clone sites need scratch reuse or a mirrored original allocation: listed next to the original's for review.
    const heavy = c.topAppSites.filter(site => site.bytesPerStep >= 1024);
    const label = sites => sites.map(site => `${site.label} ${Math.round(site.bytesPerStep)} B`).join('; ') || 'none';
    checks.push({ name: 'clone app sites >= 1 KB/step (review against the original top sites)', info: true, pass: true, detail: `clone: ${label(heavy)} | original: ${label(o.topAppSites.filter(site => site.bytesPerStep >= 1024))}` });
  }
  return checks;
}

async function main() {
  const { values } = parseArgs({ options: {
    runs: { type: 'string', default: '5' }, 'skip-heap': { type: 'boolean', default: false }, profile: { type: 'string', default: 'angle' },
  } });
  const runs = Number(values.runs);
  const { browser, profileName, executablePath } = await launchParityBrowser(values.profile);
  const bases = {};
  const samples = { original: [], clone: [] };
  let heap = null;
  try {
    for (const target of TARGETS) bases[target] = await resolveTargetBaseUrl(target);
    for (let run = 0; run < runs; run++) {
      for (const target of TARGETS) {
        samples[target].push(await coldLoad(browser, target, bases[target]));
        console.log(`load ${run + 1}/${runs} ${target}: ${JSON.stringify(samples[target].at(-1))}`);
      }
    }
    if (!values['skip-heap']) {
      heap = {};
      for (const target of TARGETS) heap[target] = await heapRun(browser, target, bases[target]);
    }
  } finally {
    await browser.close();
    await stopCloneServer();
  }
  const loads = { original: summarise(samples.original), clone: summarise(samples.clone) };
  const checks = judgePerformance(loads, heap);
  const noisy = TARGETS.some(target => ['build', 'cpuFrozen', 'cpuRunning'].some(field => loads[target][field].cv > CV_RERUN_LIMIT));
  const report = { generatedAt: new Date().toISOString(), profile: profileName, executablePath, runs, loads, heap, checks, noisy };
  const outDir = path.resolve('.parity-output', 'perf');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, 'perf.json'), `${JSON.stringify(report, null, 2)}\n`);
  for (const check of checks) console.log(`${check.info ? 'NOTE' : check.pass ? 'PASS' : 'FAIL'} ${check.name}: ${check.detail}`);
  if (noisy && runs < 10) console.log(`NOTE coefficient of variation above ${CV_RERUN_LIMIT * 100} % on some median: rerun with --runs 10`);
  if (checks.some(check => !check.pass)) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
