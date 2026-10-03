// Pure sign-off verdicts beyond pixels: equal tagged console sequences with zero clone errors, loader
// boxes within half a pixel, the noise-floor ratio, and the summary.md table.
import { THRESHOLDS } from './parity-shot-stages-and-hide-sets.mjs';

export const BOX_TOLERANCE = 0.5;
const BOX_FIELDS = ['x', 'y', 'width', 'height'];

/** Tagged log sequences must be equal; the clone side must report no page or console errors. */
export function compareConsoleRecords(original, clone) {
  const [a, b] = [original?.tagged ?? null, clone?.tagged ?? null];
  if (!a || !b) return { pass: false, reason: 'console record missing', firstDifference: null, cloneErrors: clone?.errors ?? [] };
  let firstDifference = null;
  for (let index = 0; index < Math.max(a.length, b.length) && !firstDifference; index++) {
    if (a[index] !== b[index]) firstDifference = { index, original: a[index] ?? null, clone: b[index] ?? null };
  }
  const cloneErrors = clone.errors ?? [];
  const reason = firstDifference ? `log ${firstDifference.index}: original ${JSON.stringify(firstDifference.original)} clone ${JSON.stringify(firstDifference.clone)}`
    : cloneErrors.length > 0 ? `clone errors: ${cloneErrors.join(' | ')}` : null;
  return { pass: reason === null, reason, firstDifference, cloneErrors };
}

/** Every listed selector present on both sides with x, y, width and height within `tolerance` px. */
export function compareBoxes(original, clone, tolerance = BOX_TOLERANCE) {
  const differences = [];
  for (const selector of new Set([...Object.keys(original ?? {}), ...Object.keys(clone ?? {})])) {
    const [a, b] = [original?.[selector], clone?.[selector]];
    if (!a || !b) { differences.push({ selector, field: 'box', original: a ?? null, clone: b ?? null }); continue; }
    for (const field of BOX_FIELDS) {
      if (!(Math.abs(a[field] - b[field]) <= tolerance)) differences.push({ selector, field, original: a[field], clone: b[field] });
    }
  }
  return { pass: differences.length === 0 && Object.keys(original ?? {}).length > 0, differences };
}

/** Largest share of either limit that a same-site repeat capture already uses (0 = perfectly repeatable). */
export function noiseFloorShare(metrics, thresholdClass) {
  const limits = THRESHOLDS[thresholdClass];
  return Math.max(metrics.meanAbsDiff / limits.meanAbsDiff, metrics.overThresholdFraction / limits.overThresholdFraction);
}

const percent = value => `${(value * 100).toFixed(3)} %`;

/** Markdown table of one compare run: one row per shot plus a pass count line. */
export function signoffSummaryMarkdown(results, { title = 'Parity compare summary', generatedAt = new Date().toISOString() } = {}) {
  const rows = Object.entries(results).map(([id, result]) => {
    const m = result.metrics;
    const pixels = m ? `${m.meanAbsDiff.toFixed(3)} | ${percent(m.overThresholdFraction)} | ${m.maxChannelDiff}` : '– | – | –';
    const logs = result.console ? (result.console.pass ? 'equal' : 'DIFF') : 'n/a';
    const boxes = result.boxes ? (result.boxes.pass ? 'equal' : 'DIFF') : 'n/a';
    return `| ${id} | ${result.thresholdClass ?? '–'} | ${pixels} | ${logs} | ${boxes} | ${result.pass ? 'PASS' : `FAIL${result.reason ? ` (${result.reason})` : ''}`} |`;
  });
  const passed = Object.values(results).filter(result => result.pass).length;
  return [
    `# ${title}`, '', `Generated ${generatedAt}. ${passed}/${rows.length} shots pass.`, '',
    '| shot | class | meanAbsDiff | > 16 | max | log sequence | boxes | verdict |',
    '|---|---|---|---|---|---|---|---|',
    ...rows, '',
  ].join('\n');
}
