// Sign-off shot list (21 3D + 7 DOM, probe states, research equivalents), the non-pixel verdicts (log
// sequences, loader boxes, noise floor, summary), the probe state judge and the smoke-check judge.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SIGNOFF_SHOTS, SIGNOFF_IDS, SIGNOFF_PROBE_STATES, RESEARCH_EQUIVALENTS, signoffShotState, resolveSignoffIds, isSignoffSelection,
} from '../../tools/parity/signoff-parity-shots.mjs';
import { PARITY_SHOTS, THRESHOLDS, findShot } from '../../tools/parity/parity-shot-list.mjs';
import { compareConsoleRecords, compareBoxes, noiseFloorShare, signoffSummaryMarkdown } from '../../tools/parity/signoff-shot-verdicts.mjs';
import { judgeSignoffState, probeDifferences } from '../../tools/parity/signoff-state-probe.mjs';
import { judgeSmoke, classifyHost, EXCLUDED_PATHS } from '../../tools/parity/deployment-smoke-check.mjs';
import { TAGGED_LOG, consoleRecord, boundedStep } from '../../tools/parity/signoff-shot-capture.mjs';
import { completeSignoffReport } from '../../tools/parity/research-recapture-and-contact-sheet.mjs';
import { computeDiffMetrics } from '../../tools/parity/png-diff-in-page.mjs';

const RESEARCH_FILES = ['01-loading-screen', '02a-overview-intro-dolly', '02-overview-day', '03-overview-evening', '04-overview-night',
  '05-train-camera', '05-train-camera-motion-1', '05-train-camera-motion-2', '05-train-camera-motion-3', '05-train-camera-motion-4',
  '06-bridge-camera', '06b-bridge-camera-later', '07-free-camera', '08-overview-pixel-art', '08b-overview-pixel-720p', '09-overview-ink-off',
  '10-shortcuts-panel', '11-hud-hidden', '11b-hud-hidden-no-toast', '12-overview-zoomed-in', '12b-overview-zoomed-orbited',
  '13-mobile-overview', '14-overview-day-settled', '15-debug-menu', '16-toast-bridge-shortcut', '17-night-overview-zoomed',
  '18-night-train-camera', '19-evening-bridge-camera'].map(name => `${name}.png`);

test('sign-off set: 21 3D and 7 DOM shots, unique ids, valid fields and frame counts', () => {
  assert.equal(SIGNOFF_SHOTS.filter(shot => shot.group === '3d').length, 21);
  assert.equal(SIGNOFF_SHOTS.filter(shot => shot.group === 'dom').length, 7);
  assert.equal(new Set(SIGNOFF_IDS).size, 28);
  for (const shot of SIGNOFF_SHOTS) {
    assert.ok(Object.hasOwn(THRESHOLDS, shot.thresholds), shot.id);
    assert.ok(RESEARCH_FILES.includes(shot.reference), `${shot.id} reference ${shot.reference}`);
    assert.ok(!PARITY_SHOTS.some(other => other.id === shot.id), `${shot.id} collides with a stage shot`);
    assert.equal(findShot(shot.id), shot);
    assert.equal(shot.thresholds === 'transient', shot.transient === 'visible' && shot.group === '3d', shot.id);
  }
  const byId = Object.fromEntries(SIGNOFF_SHOTS.map(shot => [shot.id, shot]));
  assert.equal(byId['train-day'].frames, 651);
  assert.equal(byId['ov-day-t30'].frames, 1800);
  assert.deepEqual(byId['ov-zoom-night'].cameraPose, { position: [-13.648, 32.079, 66.377], target: [0, 4, 0] });
  assert.deepEqual(byId['mobile-ov-day'].viewport, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  assert.deepEqual(byId['dom-loading'].dom, { target: 'page', mask: ['.load-logo'], boxes: ['.load-card', '.load-logo'] });
  assert.deepEqual(byId['dom-help'].dom.target, { clipUnion: ['#controls-button', '#help'] });
  assert.deepEqual(signoffShotState(byId['pixel-360']), { mode: 'overview', timeOfDay: 'day', pixelShortSide: 360, outline: true });
  assert.equal(signoffShotState(byId['free-day']).mode, 'orbit');
});

test('probe states and research equivalents cover the sign-off set and all 28 research captures', () => {
  assert.equal(SIGNOFF_PROBE_STATES.length, 8);
  assert.ok(SIGNOFF_PROBE_STATES.every(id => SIGNOFF_IDS.includes(id)));
  assert.deepEqual(Object.keys(RESEARCH_EQUIVALENTS).sort(), [...RESEARCH_FILES].sort());
  assert.ok(Object.values(RESEARCH_EQUIVALENTS).every(id => SIGNOFF_IDS.includes(id)));
  assert.equal(RESEARCH_EQUIVALENTS['05-train-camera-motion-3.png'], 'train-day');
  assert.equal(RESEARCH_EQUIVALENTS['11b-hud-hidden-no-toast.png'], 'hud-hidden');
});

test('--shots selection: signoff expands, ids validate, stage ids are not a sign-off selection', () => {
  assert.deepEqual(resolveSignoffIds('signoff'), SIGNOFF_IDS);
  assert.deepEqual(resolveSignoffIds('ov-day-t0, dom-hud-day'), ['ov-day-t0', 'dom-hud-day']);
  assert.throws(() => resolveSignoffIds('ov-day-t0,overview-day'), /overview-day/);
  assert.equal(isSignoffSelection('signoff'), true);
  assert.equal(isSignoffSelection('ov-day-t0,ink-off'), true);
  assert.equal(isSignoffSelection('overview-day'), false);
  assert.equal(isSignoffSelection(undefined), false);
});

test('console records: tagged lines only, errors collected; sequences compared in order', () => {
  const page = {
    parityErrors: ['boom'],
    parityConsole: ['log: [BIRDS] Take off: station-roof, train approaches', 'log: [PARITY] Hook installed: freeze', 'warning: [SETTINGS] x',
      'error: Failed to load resource', 'log: [HUD] Hidden', 'log: plain text'],
  };
  assert.deepEqual(consoleRecord(page), {
    tagged: ['[BIRDS] Take off: station-roof, train approaches', '[HUD] Hidden'],
    errors: ['pageerror: boom', 'console.error: Failed to load resource'],
  });
  assert.ok(TAGGED_LOG.test('[SETTINGS] Saved settings discarded') && !TAGGED_LOG.test('[PARITY] Hook installed: live'));
  const a = { tagged: ['[GAMEPLAY] Started', '[HUD] Hidden'], errors: ['console.error: x'] };
  assert.equal(compareConsoleRecords(a, { tagged: [...a.tagged], errors: [] }).pass, true, 'original errors do not fail');
  const reordered = compareConsoleRecords(a, { tagged: ['[HUD] Hidden', '[GAMEPLAY] Started'], errors: [] });
  assert.deepEqual([reordered.pass, reordered.firstDifference.index], [false, 0]);
  assert.equal(compareConsoleRecords(a, { tagged: a.tagged, errors: ['pageerror: y'] }).pass, false);
  assert.equal(compareConsoleRecords(a, null).pass, false);
});

test('loader boxes: equal within half a pixel, missing boxes fail', () => {
  const card = { x: 530, y: 261.078125, width: 540, height: 377.84375 };
  const logo = { x: 585, y: 261.078125, width: 430, height: 186.84375 };
  assert.equal(compareBoxes({ '.load-card': card, '.load-logo': logo }, { '.load-card': { ...card, y: card.y + 0.5 }, '.load-logo': logo }).pass, true);
  const off = compareBoxes({ '.load-card': card, '.load-logo': logo }, { '.load-card': card, '.load-logo': { ...logo, height: 187.5 } });
  assert.deepEqual(off.differences.map(entry => [entry.selector, entry.field]), [['.load-logo', 'height']]);
  assert.equal(compareBoxes({ '.load-card': card }, {}).pass, false);
  assert.equal(compareBoxes({}, {}).pass, false);
});

test('noise floor share and the summary table', () => {
  assert.equal(noiseFloorShare({ meanAbsDiff: 0, overThresholdFraction: 0 }, 'deterministic'), 0);
  assert.equal(noiseFloorShare({ meanAbsDiff: 0.5, overThresholdFraction: 0.001 }, 'deterministic'), 0.5);
  const markdown = signoffSummaryMarkdown({
    'ov-day-t0': { pass: true, thresholdClass: 'deterministic', metrics: { meanAbsDiff: 0.01, overThresholdFraction: 0, maxChannelDiff: 3 }, console: { pass: true } },
    'dom-loading': { pass: false, reason: 'boxes differ', thresholdClass: 'dom', metrics: null, boxes: { pass: false } },
  }, { generatedAt: 'T' });
  assert.match(markdown, /1\/2 shots pass/);
  assert.match(markdown, /\| ov-day-t0 \| deterministic \| 0\.010 \| 0\.000 % \| 3 \| equal \| n\/a \| PASS \|/);
  assert.match(markdown, /\| dom-loading \| dom \| – \| – \| – \| n\/a \| DIFF \| FAIL \(boxes differ\) \|/);
});

test('probe state judge: exact equality and the on-bridge window', () => {
  const reading = { renderer: { calls: 1371 }, world: { clouds: 33 }, lists: {}, instanced: [['', 27, 162]], signHash: 'ab', trackPosition: 37.05 };
  assert.equal(judgeSignoffState('train-day', reading, structuredClone(reading)).pass, true);
  const moved = { ...structuredClone(reading), trackPosition: 30 };
  assert.match(judgeSignoffState('train-day', moved, moved).failures.join(), /outside \[32\.6, 40\.9\]/);
  assert.equal(judgeSignoffState('ov-day-t0', moved, moved).pass, true);
  const fewer = { ...structuredClone(reading), renderer: { calls: 1370 } };
  assert.deepEqual(judgeSignoffState('ov-day-t0', reading, fewer).differences, ['renderer.calls']);
  assert.deepEqual(probeDifferences({ a: [1, 2] }, { a: [1, 3] }), ['a.1']);
});

test('smoke judge: analytics only on Vercel, excluded paths only when deployed', () => {
  const page = {
    errors: [], warnings: [], failed: [], badResponses: [], insights: [], logs: ['[GAMEPLAY] Started'], loaderHidden: true,
    toasts: ['H · Hide HUD'], canvas: true, canvasAfterPagehide: false, disposeErrors: [], vaType: 'function',
  };
  const excluded = Object.fromEntries(EXCLUDED_PATHS.map(entry => [entry, 404]));
  assert.deepEqual([classifyHost('http://localhost:4317/'), classifyHost('https://x.vercel.app/'), classifyHost('https://a.github.io/b/')], ['local', 'vercel', 'other']);
  const local = judgeSmoke('local', page, { insights: null, excluded: {} });
  assert.ok(local.every(check => check.pass) && !local.some(check => check.name.startsWith('404')));
  const vercel = judgeSmoke('vercel', page, { insights: 200, excluded });
  assert.ok(vercel.every(check => check.pass) && vercel.filter(check => check.name.startsWith('404')).length === EXCLUDED_PATHS.length);
  assert.ok(!judgeSmoke('vercel', page, { insights: 404, excluded }).every(check => check.pass));
  assert.ok(!judgeSmoke('other', { ...page, insights: ['/_vercel/insights/script.js'] }, { insights: null, excluded }).every(check => check.pass));
  assert.ok(!judgeSmoke('other', page, { insights: null, excluded: { ...excluded, 'docs/code-standards.md': 200 } }).every(check => check.pass));
  assert.ok(['.parity-cache/original/Diorama.js', '.github/workflows/deploy-pages.yml', 'README.md'].every(entry => EXCLUDED_PATHS.includes(entry)));
  assert.ok(!judgeSmoke('local', { ...page, canvasAfterPagehide: true }, { insights: null, excluded: {} }).every(check => check.pass));
});

test('masked pixels leave both the numerator and the denominator of the diff metrics', () => {
  const [width, height] = [10, 4];
  const a = new Uint8ClampedArray(width * height * 4).fill(100);
  const b = new Uint8ClampedArray(a);
  // The mask colour is identical on both sides; a real difference sits outside the mask at pixel (9, 3).
  for (let y = 0; y < 2; y++) for (let x = 0; x < 5; x++) for (const [i, v] of [[0, 255], [1, 0], [2, 255]]) a[(y * width + x) * 4 + i] = b[(y * width + x) * 4 + i] = v;
  b[(3 * width + 9) * 4] = 160;
  const whole = computeDiffMetrics(a, b, width, height);
  assert.deepEqual(whole, { meanAbsDiff: 60 / (40 * 3), overThresholdFraction: 1 / 40, maxChannelDiff: 60 });
  const masked = computeDiffMetrics(a, b, width, height, 16, [{ x: 0, y: 0, w: 5, h: 2 }]);
  assert.deepEqual(masked, { meanAbsDiff: 60 / (30 * 3), overThresholdFraction: 1 / 30, maxChannelDiff: 60 });
  // Fractional rects cover every touched pixel; out-of-image parts are clipped; a fully masked frame reads 0.
  assert.deepEqual(computeDiffMetrics(a, b, width, height, 16, [{ x: -2, y: 0.5, w: 6.2, h: 1 }]), masked);
  assert.equal(computeDiffMetrics(a, b, width, height, 16, [{ x: 8.5, y: 2.5, w: 4, h: 4 }]).maxChannelDiff, 0);
  assert.deepEqual(computeDiffMetrics(a, b, width, height, 16, [{ x: 0, y: 0, w: width, h: height }]), { meanAbsDiff: 0, overThresholdFraction: 0, maxChannelDiff: 0 });
});

test('boundedStep names the hung step and passes results through', async () => {
  assert.equal(await boundedStep('fast', Promise.resolve(7), 50), 7);
  await assert.rejects(boundedStep('clone/dom-debug: step frames', new Promise(() => {}), 20), /clone\/dom-debug: step frames timed out/);
});

test('research exceptions only trust a complete sign-off report from one capture run', () => {
  const shots = Object.fromEntries(SIGNOFF_IDS.map(id => [id, { pass: true }]));
  const report = { generatedAt: '2026-10-03T00:00:00.000Z', runId: '2026-10-02T23:00:00.000Z', shots };
  assert.equal(completeSignoffReport(report), report);
  assert.equal(completeSignoffReport({ ...report, runId: null }), null);
  const { [SIGNOFF_IDS[0]]: _dropped, ...partial } = shots;
  assert.equal(completeSignoffReport({ ...report, shots: partial }), null);
  assert.equal(completeSignoffReport(null), null);
});
