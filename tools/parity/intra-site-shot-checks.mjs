// Same-site checks a cross-site diff cannot make: a shot that must differ from (animation ran) or exactly
// match (frozen while paused) another capture of the same target, and the results its page actions logged.

const TARGETS = ['original', 'clone'];

/** Failures recorded by the shot's page actions in one target's capture meta. */
export function shotActionFailures(meta, label) {
  const failures = [];
  const { holdPausedFrames: hold, debugLayerOff: layer } = meta.shotActions ?? {};
  if (hold && !(hold.paused && hold.uTimeBefore === hold.uTimeAfter)) {
    failures.push(`${label}: clock moved during the paused hold (${hold.uTimeBefore} -> ${hold.uTimeAfter}, paused ${hold.paused})`);
  }
  if (layer && (layer.checked || !layer.logs.includes(`[DEBUG] ${layer.label}: hidden`))) {
    failures.push(`${label}: layer switch ${layer.label} did not hide and log (${JSON.stringify(layer)})`);
  }
  return failures;
}

function relationVerdict({ expect, minOverFraction }, metrics) {
  if (expect === 'identical') return metrics.maxChannelDiff === 0;
  return metrics.overThresholdFraction >= minOverFraction;
}

/** True when both captures carry the same run id (a missing id never counts as the same run). */
const sameRun = (own, other) => Boolean(own.meta?.runId) && other.meta?.runId === own.meta.runId;

/**
 * Runs the relation (when the shot declares one) on each target and the action checks on each meta.
 * `readPng(target, id)` returns `{png, meta}` or null; `measure(pngA, pngB)` returns diff metrics.
 * The relation capture must come from the shot's own capture run, else it is reported stale.
 */
export async function runIntraSiteChecks({ shot, metas, readPng, measure }) {
  const failures = TARGETS.flatMap(target => shotActionFailures(metas[target] ?? {}, target));
  const relation = {};
  if (shot.relation) {
    const { to, expect } = shot.relation;
    for (const target of TARGETS) {
      const [own, other] = await Promise.all([readPng(target, shot.id), readPng(target, to)]);
      if (!own || !other) {
        failures.push(`${target}: capture ${!own ? shot.id : to} missing`);
        continue;
      }
      if (!sameRun(own, other)) {
        failures.push(`${target}: stale relation capture ${to}`);
        continue;
      }
      const metrics = await measure(own.png, other.png);
      relation[target] = { ...shot.relation, metrics, pass: relationVerdict(shot.relation, metrics) };
      if (!relation[target].pass) failures.push(`${target}: expected ${expect} vs ${to}`);
    }
  }
  return { pass: failures.length === 0, failures, relation };
}
