// Pure verdict math for the sign-off tools: EMA inversion, robust statistics, 12-bit palette keys and
// overlap, loader phase timings and heap-sample attribution. No I/O, no browser.

/** Raw samples behind an EMA series c_n = c_(n-1) + alpha * (r_n - c_(n-1)); one fewer than the input. */
export function invertEmaSamples(emaSeries, alpha = 0.1) {
  const raw = [];
  for (let n = 1; n < emaSeries.length; n++) raw.push((emaSeries[n] - (1 - alpha) * emaSeries[n - 1]) / alpha);
  return raw;
}

export function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Population standard deviation over the mean (0 for a constant list, null when empty or zero-mean). */
export function coefficientOfVariation(values) {
  if (values.length === 0) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / Math.abs(mean);
}

/** 4 bits per channel: 256 * floor(r / 16) + 16 * floor(g / 16) + floor(b / 16). */
export function paletteKeyFromHex(hex) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const [r, g, b] = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return 256 * (r >> 4) + 16 * (g >> 4) + (b >> 4);
}

const keysOf = top => new Set(top.map(entry => paletteKeyFromHex(typeof entry === 'string' ? entry : entry.hex)));

/** Shared distinct palette keys between two top-10 lists (hex strings or {hex}), capped to 0..10. */
export function paletteOverlap(topA, topB) {
  const other = keysOf(topB);
  let shared = 0;
  for (const key of keysOf(topA)) if (other.has(key)) shared++;
  return Math.min(10, shared);
}

const LOAD_LABELS = Object.freeze({ engine: 'LOADING ENGINE', build: 'BUILDING VALLEY AND TRAIN', firstFrame: 'PREPARING FIRST FRAME' });

/** BUILD = t(first frame label) - t(build label); LOAD ENGINE = t(build label) - t(engine label); null if any is missing. */
export function buildMillisecondsFromMarks(marks) {
  const at = label => marks.find(mark => mark.label === label)?.t;
  const [engine, build, firstFrame] = [at(LOAD_LABELS.engine), at(LOAD_LABELS.build), at(LOAD_LABELS.firstFrame)];
  if ([engine, build, firstFrame].some(value => typeof value !== 'number')) return null;
  return { build: firstFrame - build, loadEngine: build - engine };
}

/**
 * Sampling heap profile (CDP shape: head {callFrame, selfSize, children}) to byte totals. Each node's
 * selfSize goes to its nearest ancestor-or-self frame whose URL passes `isAppUrl`; others count as total only.
 */
export function attributeHeapSamples(profile, isAppUrl) {
  const sites = new Map();
  let totalBytes = 0;
  let appBytes = 0;
  const stack = [{ node: profile.head, owner: null }];
  while (stack.length > 0) {
    const { node, owner: inherited } = stack.pop();
    const frame = node.callFrame ?? {};
    const owner = frame.url && isAppUrl(frame.url) ? frame : inherited;
    const bytes = node.selfSize ?? 0;
    totalBytes += bytes;
    if (owner && bytes > 0) {
      appBytes += bytes;
      const key = `${owner.functionName}|${owner.url}|${owner.lineNumber}`;
      const site = sites.get(key) ?? { functionName: owner.functionName || '(anonymous)', url: owner.url, line: owner.lineNumber + 1, bytes: 0 };
      site.bytes += bytes;
      sites.set(key, site);
    }
    for (const child of node.children ?? []) stack.push({ node: child, owner });
  }
  return { totalBytes, appBytes, sites: [...sites.values()].sort((a, b) => b.bytes - a.bytes) };
}
