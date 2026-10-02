// CLI: compares original vs clone captures (side-by-side + heatmap PNGs, metrics vs thresholds, meta warnings).
// Usage: node tools/parity/compare-parity-shots.mjs [--shots a,b] [--in dir] [--region all|none|name,name]
// Shots whose metas carry regions are judged on those crops; whole-frame metrics are then informational.
import { parseArgs } from 'node:util';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchParityBrowser } from './playwright-browser-launcher.mjs';
import { CHANNEL_DIFF_THRESHOLD, THRESHOLDS, PARITY_SHOTS, researchSkipReason, researchCapturePath } from './parity-shot-list.mjs';
import { toDeviceRegion, selectRegions } from './shot-region-projection.mjs';

// Self-contained on purpose: its source is injected into the page so node and page share one implementation.
export function computeDiffMetrics(a, b, width, height, channelThreshold = 16) {
  const pixelCount = width * height;
  let sum = 0;
  let over = 0;
  let maxChannelDiff = 0;
  for (let pixel = 0; pixel < pixelCount; pixel++) {
    const offset = pixel * 4;
    const red = Math.abs(a[offset] - b[offset]);
    const green = Math.abs(a[offset + 1] - b[offset + 1]);
    const blue = Math.abs(a[offset + 2] - b[offset + 2]);
    sum += red + green + blue;
    const largest = Math.max(red, green, blue);
    if (largest > channelThreshold) over++;
    if (largest > maxChannelDiff) maxChannelDiff = largest;
  }
  return { meanAbsDiff: sum / (pixelCount * 3), overThresholdFraction: over / pixelCount, maxChannelDiff };
}

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

// Runs in the page: decode both PNGs, measure (whole frame and each region), compose original | clone | heat.
async function diffInPage({ originalUrl, cloneUrl, threshold, regions, devicePixelRatio }) {
  const decode = async url => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: image.naturalWidth, height: image.naturalHeight });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    return { image, context, width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
  };
  const [a, b] = await Promise.all([decode(originalUrl), decode(cloneUrl)]);
  if (a.width !== b.width || a.height !== b.height) return { sizeMismatch: [a.width, a.height, b.width, b.height] };
  const { width, height } = a;
  const metrics = window.computeDiffMetrics(a.data, b.data, width, height, threshold);
  const crops = regions.map(region => window.toDeviceRegion(region, devicePixelRatio, width, height)).filter(Boolean);
  const regionMetrics = crops.map(crop => {
    const [cropA, cropB] = [a, b].map(side => side.context.getImageData(crop.x, crop.y, crop.w, crop.h).data);
    return { ...crop, metrics: window.computeDiffMetrics(cropA, cropB, crop.w, crop.h, threshold) };
  });
  const sheet = Object.assign(document.createElement('canvas'), { width: width * 3, height });
  const context = sheet.getContext('2d');
  context.drawImage(a.image, 0, 0);
  context.drawImage(b.image, width, 0);
  const heat = context.createImageData(width, height);
  for (let offset = 0; offset < heat.data.length; offset += 4) {
    const largest = Math.max(...[0, 1, 2].map(channel => Math.abs(a.data[offset + channel] - b.data[offset + channel])));
    const grey = 0.35 * (0.2126 * a.data[offset] + 0.7152 * a.data[offset + 1] + 0.0722 * a.data[offset + 2]);
    const blend = largest > threshold ? 1 : 0.6 * largest / threshold;
    const tint = largest > threshold ? [255, 0, 0] : [255, 200, 0];
    for (let channel = 0; channel < 3; channel++) heat.data[offset + channel] = grey + (tint[channel] - grey) * blend;
    heat.data[offset + 3] = 255;
  }
  context.putImageData(heat, width * 2, 0);
  context.strokeStyle = '#00e5ff';
  for (const crop of crops) context.strokeRect(width * 2 + crop.x + 0.5, crop.y + 0.5, crop.w - 1, crop.h - 1);
  return { metrics, regionMetrics, heatmap: sheet.toDataURL('image/png') };
}

const describeMetrics = m => (m ? `mean=${m.meanAbsDiff.toFixed(3)} over=${(m.overThresholdFraction * 100).toFixed(3)}% max=${m.maxChannelDiff}` : '');
const pngNames = async dir => (existsSync(dir) ? (await readdir(dir)).filter(name => name.endsWith('.png')).map(name => name.slice(0, -4)) : []);
const dataUrl = bytes => `data:image/png;base64,${bytes.toString('base64')}`;
const readMeta = async file => (existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : {});

async function compareOne(page, inDir, id, regionRequest = 'all') {
  const shot = PARITY_SHOTS.find(candidate => candidate.id === id);
  const thresholdClass = shot?.thresholdClass ?? null;
  const reference = shot?.reference ?? null;
  const referencePath = reference && !researchSkipReason() ? researchCapturePath(reference) : null;
  const result = {
    pass: false, reportOnly: shot?.reportOnly ?? false, metrics: null, limits: thresholdClass ? THRESHOLDS[thresholdClass] : null,
    thresholdClass, reference, referencePath, warnings: [], reason: null,
  };
  const files = ['original', 'clone'].map(target => path.join(inDir, 'shots', target, `${id}.png`));
  if (!files.every(existsSync)) return { ...result, reason: 'missing counterpart' };
  if (!shot) return { ...result, reason: 'unknown shot id' };
  const [metaA, metaB] = await Promise.all(files.map(file => readMeta(file.replace(/\.png$/, '.json'))));
  result.warnings = compareMetas(metaA, metaB);
  if (JSON.stringify(metaA.regions ?? []) !== JSON.stringify(metaB.regions ?? [])) result.warnings.push('regions differ between sites (original used)');
  const regions = selectRegions(metaA.regions?.length ? metaA.regions : metaB.regions, regionRequest);
  const [originalUrl, cloneUrl] = (await Promise.all(files.map(file => readFile(file)))).map(dataUrl);
  const devicePixelRatio = metaA.devicePixelRatio ?? metaB.devicePixelRatio ?? 1;
  const outcome = await page.evaluate(diffInPage, { originalUrl, cloneUrl, threshold: CHANNEL_DIFF_THRESHOLD, regions, devicePixelRatio });
  if (outcome.sizeMismatch) return { ...result, reason: `size mismatch ${outcome.sizeMismatch.join('x')}` };
  await writeFile(path.join(inDir, 'compare', `${id}.png`), Buffer.from(outcome.heatmap.split(',')[1], 'base64'));
  result.metrics = outcome.metrics;
  result.regions = outcome.regionMetrics.map(crop => ({ ...crop, pass: evaluateThresholds(crop.metrics, thresholdClass).pass }));
  const errors = [...(metaA.pageErrors ?? []), ...(metaB.pageErrors ?? [])];
  const pass = result.regions.length > 0 ? result.regions.every(crop => crop.pass) : evaluateThresholds(outcome.metrics, thresholdClass).pass;
  result.pass = pass && errors.length === 0;
  if (errors.length > 0) result.reason = `page errors: ${errors.join(' | ')}`;
  else if (!pass) result.reason = 'over threshold';
  return result;
}

async function main() {
  const { values } = parseArgs({
    options: { shots: { type: 'string' }, in: { type: 'string', default: '.parity-output' }, region: { type: 'string', default: 'all' } },
  });
  const inDir = path.resolve(values.in);
  const ids = values.shots
    ? values.shots.split(',').map(id => id.trim()).filter(Boolean)
    : [...new Set([...await pngNames(path.join(inDir, 'shots', 'original')), ...await pngNames(path.join(inDir, 'shots', 'clone'))])].sort();
  await mkdir(path.join(inDir, 'compare'), { recursive: true });
  const { browser } = await launchParityBrowser('angle');
  const report = { generatedAt: new Date().toISOString(), shots: {} };
  try {
    const page = await browser.newPage();
    await page.goto('about:blank');
    await page.addScriptTag({ content: `window.computeDiffMetrics = ${computeDiffMetrics}; window.toDeviceRegion = ${toDeviceRegion};` });
    for (const id of ids) {
      const result = await compareOne(page, inDir, id, values.region);
      report.shots[id] = result;
      const numbers = describeMetrics(result.metrics) + (result.regions ?? []).map(crop => ` [${crop.name} ${describeMetrics(crop.metrics)}]`).join('');
      const verdict = result.pass ? 'PASS' : 'FAIL';
      console.log(`${result.reportOnly ? `REPORT(${verdict})` : verdict} ${id} ${numbers}${result.reason ? ` (${result.reason})` : ''}${result.warnings.length ? ` warnings: ${result.warnings.join('; ')}` : ''}`);
    }
  } finally {
    await browser.close();
  }
  await writeFile(path.join(inDir, 'compare-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  // Report-only shots never fail the run; their metrics are kept for review.
  if (Object.values(report.shots).some(result => !result.pass && !result.reportOnly)) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
