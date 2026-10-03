// CLI: compares original vs clone captures (side-by-side + heatmap PNGs, metrics vs thresholds, meta warnings,
// sign-off log sequences and loader boxes, summary.md).
// Usage: node tools/parity/compare-parity-shots.mjs [--shots a,b|signoff] [--in dir] [--region all|none|name,name]
// [--a dir --b dir] (any two shot folders, e.g. a site and its repeat, for the noise floor)
// Shots whose metas carry regions are judged on those crops; whole-frame metrics are then informational.
import { parseArgs } from 'node:util';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchParityBrowser } from './playwright-browser-launcher.mjs';
import { CHANNEL_DIFF_THRESHOLD, THRESHOLDS, findShot, researchSkipReason, researchCapturePath } from './parity-shot-list.mjs';
import { SIGNOFF_IDS, resolveSignoffIds } from './signoff-parity-shots.mjs';
import { toDeviceRegion, selectRegions } from './shot-region-projection.mjs';
import { runIntraSiteChecks } from './intra-site-shot-checks.mjs';
import { computeDiffMetrics, diffInPage } from './png-diff-in-page.mjs';
import { compareConsoleRecords, compareBoxes, noiseFloorShare, signoffSummaryMarkdown } from './signoff-shot-verdicts.mjs';

export { computeDiffMetrics } from './png-diff-in-page.mjs';

export function evaluateThresholds(metrics, thresholdClass) {
  const limits = THRESHOLDS[thresholdClass];
  if (!limits) throw new Error(`Unknown threshold class: ${thresholdClass}`);
  const pass = metrics.meanAbsDiff <= limits.meanAbsDiff && metrics.overThresholdFraction <= limits.overThresholdFraction;
  return { pass, limits };
}

// Captures are only comparable from one capture run on one browser and profile (folders are never cleared).
const CAPTURE_ENVIRONMENT_FIELDS = ['runId', 'profile', 'executablePath', 'webglRenderer'];

export function compareMetas(originalMeta, cloneMeta) {
  const warnings = [];
  for (const field of CAPTURE_ENVIRONMENT_FIELDS) {
    if (originalMeta[field] !== cloneMeta[field]) warnings.push(`${field} differs: original=${originalMeta[field]} clone=${cloneMeta[field]}`);
  }
  const [a, b] = [originalMeta.capabilities ?? {}, cloneMeta.capabilities ?? {}];
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (a[key] !== b[key]) warnings.push(`capability ${key}: original=${a[key]} clone=${b[key]}`);
  }
  // Both only matter once each site builds a world: build time and the station sign's font both come from it.
  const bothWorlds = a.world && b.world;
  if (bothWorlds && originalMeta.timeAtFreeze !== cloneMeta.timeAtFreeze) {
    warnings.push(`timeAtFreeze differs: original=${originalMeta.timeAtFreeze} clone=${cloneMeta.timeAtFreeze}`);
  }
  const [fontsA, fontsB] = [originalMeta.buildInfo?.fredokaReadyAtBuild, cloneMeta.buildInfo?.fredokaReadyAtBuild];
  if (bothWorlds && fontsA !== fontsB) warnings.push(`fredokaReadyAtBuild differs: original=${fontsA} clone=${fontsB}`);
  for (const [label, meta] of [['original', originalMeta], ['clone', cloneMeta]]) {
    if (meta.cloudOffsetMax > 0) warnings.push(`${label} clouds displaced at freeze (cloudOffsetMax ${meta.cloudOffsetMax})`);
  }
  return warnings;
}

const describeMetrics = m => (m ? `mean=${m.meanAbsDiff.toFixed(3)} over=${(m.overThresholdFraction * 100).toFixed(3)}% max=${m.maxChannelDiff}` : '');
const pngNames = async dir => (existsSync(dir) ? (await readdir(dir)).filter(name => name.endsWith('.png')).map(name => name.slice(0, -4)) : []);
const dataUrl = bytes => `data:image/png;base64,${bytes.toString('base64')}`;
const readJson = async (file, fallback) => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : fallback);
const readMeta = file => readJson(file, {});
const sidecar = (dir, id, suffix) => readJson(path.join(dir, `${id}${suffix}`), null);

// `dirs` = [original-like, clone-like] shot folders; heatmaps go to <outDir>/compare.
async function compareOne(page, { dirs, outDir, floor = false }, id, regionRequest = 'all') {
  const shot = findShot(id);
  const thresholdClass = shot?.thresholdClass ?? shot?.thresholds ?? null;
  const reference = shot?.reference ?? null;
  const referencePath = reference && !researchSkipReason() ? researchCapturePath(reference) : null;
  const result = {
    pass: false, reportOnly: shot?.reportOnly ?? false, metrics: null, limits: thresholdClass ? THRESHOLDS[thresholdClass] : null,
    thresholdClass, reference, referencePath, warnings: [], reason: null,
  };
  const files = dirs.map(dir => path.join(dir, `${id}.png`));
  if (!files.every(existsSync)) return { ...result, reason: 'missing counterpart' };
  if (!shot) return { ...result, reason: 'unknown shot id' };
  const [metaA, metaB] = await Promise.all(files.map(file => readMeta(file.replace(/\.png$/, '.json'))));
  result.runIds = [metaA.runId ?? null, metaB.runId ?? null];
  result.warnings = compareMetas(metaA, metaB);
  if (JSON.stringify(metaA.regions ?? []) !== JSON.stringify(metaB.regions ?? [])) result.warnings.push('regions differ between sites (original used)');
  const regions = selectRegions(metaA.regions?.length ? metaA.regions : metaB.regions, regionRequest);
  const [originalUrl, cloneUrl] = (await Promise.all(files.map(file => readFile(file)))).map(dataUrl);
  const devicePixelRatio = metaA.devicePixelRatio ?? metaB.devicePixelRatio ?? metaA.viewport?.deviceScaleFactor ?? 1;
  // Masked pixels (same colour on both sites) are excluded on both sides: the union of both sites' rects.
  const masks = [...(metaA.maskRects ?? []), ...(metaB.maskRects ?? [])];
  // A masked shot without measured rects would count the mask as agreement: fail instead of judging loosely.
  const masksMissing = shot.dom?.mask?.length > 0 && !(metaA.maskRects?.length && metaB.maskRects?.length);
  const outcome = await page.evaluate(diffInPage, { originalUrl, cloneUrl, threshold: CHANNEL_DIFF_THRESHOLD, regions, devicePixelRatio, masks });
  if (outcome.sizeMismatch) return { ...result, reason: `size mismatch ${outcome.sizeMismatch.join('x')}` };
  await writeFile(path.join(outDir, 'compare', `${id}.png`), Buffer.from(outcome.heatmap.split(',')[1], 'base64'));
  result.metrics = outcome.metrics;
  result.regions = outcome.regionMetrics.map(crop => ({ ...crop, pass: evaluateThresholds(crop.metrics, thresholdClass).pass }));
  const errors = [...(metaA.pageErrors ?? []), ...(metaB.pageErrors ?? [])];
  const pass = result.regions.length > 0 ? result.regions.every(crop => crop.pass) : evaluateThresholds(outcome.metrics, thresholdClass).pass;
  const readPng = async (target, shotId) => {
    const file = path.join(dirs[target === 'original' ? 0 : 1], `${shotId}.png`);
    return existsSync(file) ? { png: await readFile(file), meta: await readMeta(file.replace(/\.png$/, '.json')) } : null;
  };
  const measure = async (a, b) => (await page.evaluate(diffInPage, { originalUrl: dataUrl(a), cloneUrl: dataUrl(b), threshold: CHANNEL_DIFF_THRESHOLD, regions: [], devicePixelRatio: 1 })).metrics;
  result.intraSite = await runIntraSiteChecks({ shot, metas: { original: metaA, clone: metaB }, readPng, measure });
  const [consoleA, consoleB, boxesA, boxesB] = await Promise.all([
    ...dirs.map(dir => sidecar(dir, id, '.console.json')), ...dirs.map(dir => sidecar(dir, id, '.boxes.json'))]);
  // A same-site repeat (noise floor) compares pixels and log order only; errors are judged per site elsewhere.
  if (consoleA || consoleB || SIGNOFF_IDS.includes(id)) result.console = compareConsoleRecords(consoleA, floor && consoleB ? { ...consoleB, errors: [] } : consoleB);
  if (shot.dom?.boxes?.length > 0) result.boxes = compareBoxes(boxesA, boxesB);
  const sideChecks = [result.console, result.boxes].filter(Boolean);
  result.pass = pass && !masksMissing && errors.length === 0 && result.intraSite.pass && sideChecks.every(check => check.pass);
  if (masksMissing) result.reason = 'mask rects missing from a meta (recapture)';
  else if (errors.length > 0) result.reason = `page errors: ${errors.join(' | ')}`;
  else if (!pass) result.reason = 'over threshold';
  else if (!result.intraSite.pass) result.reason = result.intraSite.failures.join('; ');
  else if (result.console && !result.console.pass) result.reason = result.console.reason;
  else if (result.boxes && !result.boxes.pass) result.reason = `boxes differ: ${JSON.stringify(result.boxes.differences)}`;
  return result;
}

async function main() {
  const { values } = parseArgs({
    options: {
      shots: { type: 'string' }, in: { type: 'string', default: '.parity-output' }, region: { type: 'string', default: 'all' },
      a: { type: 'string' }, b: { type: 'string' },
    },
  });
  const inDir = path.resolve(values.in);
  const floor = Boolean(values.a && values.b);
  const dirs = floor ? [path.resolve(values.a), path.resolve(values.b)] : ['original', 'clone'].map(target => path.join(inDir, 'shots', target));
  const outDir = floor ? path.join(inDir, 'noise-floor') : inDir;
  const ids = values.shots === 'signoff' ? resolveSignoffIds('signoff')
    : values.shots ? values.shots.split(',').map(id => id.trim()).filter(Boolean)
      : [...new Set([...await pngNames(dirs[0]), ...await pngNames(dirs[1])])].sort();
  await mkdir(path.join(outDir, 'compare'), { recursive: true });
  const { browser } = await launchParityBrowser('angle');
  const report = { generatedAt: new Date().toISOString(), shots: {} };
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.addScriptTag({ content: `window.computeDiffMetrics = ${computeDiffMetrics}; window.toDeviceRegion = ${toDeviceRegion};` });
    for (const id of ids) {
      const result = await compareOne(page, { dirs, outDir, floor }, id, values.region);
      if (floor && result.metrics && result.thresholdClass) result.floorShare = noiseFloorShare(result.metrics, result.thresholdClass);
      report.shots[id] = result;
      const numbers = describeMetrics(result.metrics) + (result.regions ?? []).map(crop => ` [${crop.name} ${describeMetrics(crop.metrics)}]`).join('');
      const verdict = result.pass ? 'PASS' : 'FAIL';
      const share = result.floorShare === undefined ? '' : ` floor ${(result.floorShare * 100).toFixed(1)} % of limit`;
      console.log(`${result.reportOnly ? `REPORT(${verdict})` : verdict} ${id} ${numbers}${share}${result.reason ? ` (${result.reason})` : ''}${result.warnings.length ? ` warnings: ${result.warnings.join('; ')}` : ''}`);
    }
  } finally {
    await browser.close();
  }
  await writeFile(path.join(outDir, 'compare-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  // Full sign-off sets only get their own report, so later subset runs cannot change the research exceptions.
  if (values.shots === 'signoff' && !floor) {
    const runIds = new Set(Object.values(report.shots).flatMap(result => result.runIds ?? [null]));
    const runId = runIds.size === 1 ? [...runIds][0] : null;
    await writeFile(path.join(outDir, 'compare', 'signoff-report.json'), `${JSON.stringify({ ...report, runId, ids }, null, 2)}\n`);
  }
  await writeFile(path.join(outDir, 'compare', 'summary.md'), signoffSummaryMarkdown(report.shots, { generatedAt: report.generatedAt }));
  // Report-only shots never fail the run; their metrics are kept for review.
  if (Object.values(report.shots).some(result => !result.pass && !result.reportOnly)) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
