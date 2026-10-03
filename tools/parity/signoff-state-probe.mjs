// Sign-off runtime probe: each frozen state of SIGNOFF_PROBE_STATES is prepared exactly as its shot, rendered
// for 2 frames, then renderer counts, world summary, ordered lists, instanced counts, the sign-canvas hash and
// the train position are read on both sites and compared with exact equality. Writes probe/<state>.json.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { resolveTargetBaseUrl } from './playwright-browser-launcher.mjs';
import { waitFrames } from './page-parity-helpers.mjs';
import { openSignoffPage, prepareSignoffScene } from './signoff-shot-capture.mjs';
import { SIGNOFF_SHOTS, SIGNOFF_PROBE_STATES, ON_BRIDGE_STATES } from './signoff-parity-shots.mjs';
import { summarizeWorld, summarizeOrderedLists, summarizeInstancedCounts, hashStationSignCanvas } from '../../tests/helpers/world-summary-digest.mjs';

// Reference readout of the original from the research capture (live frame with puffs, informational only).
export const RESEARCH_BUDGET_READOUT = Object.freeze({ calls: 1411, triangles: 1773736, geometries: 419, textures: 6 });

function readStateScript() {
  return `(() => {
    const d = window.__diorama;
    const { render, memory, programs } = d.renderer.info;
    return {
      renderer: { calls: render.calls, triangles: render.triangles, points: render.points, lines: render.lines,
        geometries: memory.geometries, textures: memory.textures, programs: programs ? programs.length : null },
      world: (${summarizeWorld})(d),
      lists: (${summarizeOrderedLists})(d),
      instanced: (${summarizeInstancedCounts})(d.scene),
      signHash: (${hashStationSignCanvas})(d.scene),
      trackPosition: d.s % d.world.length,
    };
  })()`;
}

async function probeState(browser, target, baseUrl, shot, signReference) {
  const { context, page, freeze, attempts } = await openSignoffPage(browser, target, baseUrl, shot, signReference);
  try {
    await prepareSignoffScene(page, shot);
    await waitFrames(page, 2);
    return { ...await page.evaluate(readStateScript()), webglRenderer: freeze.webglRenderer, loadAttempts: attempts };
  } finally {
    await context.close();
  }
}

/** Paths (dot/index form) where two probe readings differ, leaves only. */
export function probeDifferences(a, b, prefix = '') {
  if (isDeepStrictEqual(a, b)) return [];
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') return [prefix || '(root)'];
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].flatMap(key => probeDifferences(a[key], b[key], prefix ? `${prefix}.${key}` : key));
}

const COMPARED = ['renderer', 'world', 'lists', 'instanced', 'signHash', 'trackPosition'];

/** Verdict for one state: exact equality of every compared field, plus the on-bridge window where it applies. */
export function judgeSignoffState(id, original, clone) {
  const differences = COMPARED.flatMap(field => probeDifferences(original[field], clone[field], field));
  const failures = differences.length > 0 ? [`differs in ${differences.slice(0, 8).join(', ')}${differences.length > 8 ? ', ...' : ''}`] : [];
  if (ON_BRIDGE_STATES.ids.includes(id)) {
    const [low, high] = ON_BRIDGE_STATES.range;
    for (const [label, reading] of [['original', original], ['clone', clone]]) {
      if (!(reading.trackPosition >= low && reading.trackPosition <= high)) failures.push(`${label} s mod L ${reading.trackPosition} outside [${low}, ${high}]`);
    }
  }
  return { pass: failures.length === 0, failures, differences };
}

/** Probes every sign-off state on both targets; returns the number of failing states. */
export async function runSignoffProbe(browser, { outDir = path.resolve('.parity-output'), states = SIGNOFF_PROBE_STATES } = {}) {
  const probeDir = path.join(outDir, 'probe');
  await mkdir(probeDir, { recursive: true });
  const bases = { original: await resolveTargetBaseUrl('original'), clone: await resolveTargetBaseUrl('clone') };
  let failures = 0;
  // Every load is held to the first font-ready sign hash (the original's), with the capture's reload budget.
  const signReference = { hash: null };
  for (const id of states) {
    const shot = SIGNOFF_SHOTS.find(candidate => candidate.id === id);
    const readings = {};
    for (const target of ['original', 'clone']) readings[target] = await probeState(browser, target, bases[target], shot, signReference);
    const verdict = judgeSignoffState(id, readings.original, readings.clone);
    await writeFile(path.join(probeDir, `${id}.json`), `${JSON.stringify({ id, ...readings, verdict }, null, 2)}\n`);
    const r = readings.clone.renderer;
    const reference = id === 'ov-day-t0' ? ` (research live readout ${JSON.stringify(RESEARCH_BUDGET_READOUT)})` : '';
    console.log(`${verdict.pass ? 'PASS' : 'FAIL'} probe ${id}: calls ${r.calls} triangles ${r.triangles} points ${r.points} lines ${r.lines} `
      + `geometries ${r.geometries} textures ${r.textures} programs ${r.programs} s mod L ${readings.clone.trackPosition.toFixed(3)}${reference}`
      + `${verdict.pass ? '' : `; ${verdict.failures.join('; ')}`}`);
    if (!verdict.pass) failures++;
  }
  return failures;
}
