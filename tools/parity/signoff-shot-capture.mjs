// Sign-off capture: one browser context per shot, loader phase marks with a retry when the station-sign
// fonts were not ready at build or the sign-canvas hash differs from the run's reference, the frozen recipe (state, reseeded fixed-dt steps, pose + cloud settle,
// transients), then a full-page 3D shot or a DOM shot (rendering frozen, canvas hidden, prelude, masks,
// boxes). Writes <id>.png, <id>.json (meta, masked rects), <id>.console.json (tagged log sequence + errors), <id>.boxes.json.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveTargetBaseUrl } from './playwright-browser-launcher.mjs';
import { installOriginalRouteHooks, awaitReadinessOrHookError } from './original-site-route-hooks.mjs';
import {
  PARITY_SEED, prepareParityContext, openParityPage, waitForDioramaReady, freezeForParity, applyShotState, stepFrames,
  applyCameraPose, applyHideSets, waitFrames,
} from './page-parity-helpers.mjs';
import {
  freezeRendering, hideSceneCanvas, forceLoadingCardState, waitForToastSettled, settleCloudAvoidance, installLoadPhaseMarks,
  readLoadPhaseMarks, measureBoxes,
} from './signoff-page-helpers.mjs';
import { clipForSelectors } from './dom-shot-page-helpers.mjs';
import { signoffShotState } from './signoff-parity-shots.mjs';
import { hashStationSignCanvas } from '../../tests/helpers/world-summary-digest.mjs';

export const TAGGED_LOG = /^\[(GAMEPLAY|CAMERA|BIRDS|SHEEP|STATION|VILLAGE|HUD|PAUSE|DEBUG|SETTINGS)\]/;
const MASK_COLOR = '#ff00ff';
const SIGN_RETRIES = 2;
const STEP_TIMEOUT_MS = 120000;
const SCRIPTS = { forceLoadingCardState };

/** Tagged console.log lines and the errors (page errors + console.error) of one page, in order. */
export function consoleRecord(page) {
  const tagged = [];
  const errors = [...page.parityErrors.map(message => `pageerror: ${message}`)];
  for (const line of page.parityConsole) {
    const split = line.indexOf(': ');
    const [type, text] = [line.slice(0, split), line.slice(split + 2)];
    if (type === 'log' && TAGGED_LOG.test(text)) tagged.push(text);
    if (type === 'error') errors.push(`console.error: ${text}`);
  }
  return { tagged, errors };
}

/** Bounds one in-page step so a hung page fails the shot by name instead of blocking the whole run. */
export function boundedStep(label, work, limit = STEP_TIMEOUT_MS) {
  let timer;
  const expiry = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${limit / 1000} s`)), limit);
  });
  return Promise.race([work, expiry]).finally(() => clearTimeout(timer));
}

async function runPrelude(page, prelude) {
  for (const action of prelude) {
    if (action.press) await page.keyboard.press(action.press);
    else if (action.click) await page.click(action.click);
    else if (action.wait) await page.waitForTimeout(action.wait);
    else if (action.script) await SCRIPTS[action.script](page);
    else throw new Error(`Unknown prelude action: ${JSON.stringify(action)}`);
  }
}

const readSignHash = page => page.evaluate(`(${hashStationSignCanvas})(window.__diorama.scene)`);

// Loads a frozen page; reloads (fresh context, <= 2 retries) while the sign fonts were not ready when the build ran
// (the flag comes from the hook, which runs in the build's own task; the label-time mark is earlier), or while the
// station-sign canvas hash differs from `signReference.hash`. The first font-ready load sets that reference when it
// is empty; a hash still different after the retries is returned as is, so the compare/probe reports it.
export async function openSignoffPage(browser, target, baseUrl, shot, signReference = { hash: null }) {
  for (let attempt = 0; ; attempt++) {
    const { width, height, ...device } = shot.viewport;
    const context = await browser.newContext({ viewport: { width, height }, ...device });
    await prepareParityContext(context);
    await installLoadPhaseMarks(context);
    const hookState = target === 'original' ? await installOriginalRouteHooks(context) : null;
    const page = await openParityPage(context, baseUrl, { parity: 'freeze' });
    page.setDefaultTimeout(STEP_TIMEOUT_MS);
    const step = (name, work) => boundedStep(`${target}/${shot.id}: ${name}`, work);
    try {
      await awaitReadinessOrHookError(waitForDioramaReady(page), hookState);
      const freeze = await step('freeze', freezeForParity(page));
      const load = await step('load marks', readLoadPhaseMarks(page));
      if (freeze.buildInfo?.fredokaReadyAtBuild === true) {
        const signHash = await step('sign hash', readSignHash(page));
        signReference.hash ??= signHash;
        if (signHash === signReference.hash || attempt >= SIGN_RETRIES) return { context, page, freeze, load, signHash, attempts: attempt + 1 };
      } else if (attempt >= SIGN_RETRIES) {
        throw new Error(`${target}/${shot.id}: sign fonts not ready at build after ${attempt + 1} loads`);
      }
    } catch (error) {
      await context.close();
      throw error;
    }
    await context.close();
  }
}

export async function prepareSignoffScene(page, shot) {
  const step = (name, work) => boundedStep(`${shot.id}: ${name}`, work);
  await step('state', applyShotState(page, signoffShotState(shot)));
  // stepFrames reseeds Math.random with the seed before its first step.
  const simulation = await step('step frames', stepFrames(page, shot.frames, { dt: 1 / 60, seed: PARITY_SEED }));
  const camera = await step('camera pose', applyCameraPose(page, shot.cameraPose));
  const cloudSettleCalls = shot.cameraPose ? await step('cloud settle', settleCloudAvoidance(page, 180)) : 0;
  const hidden = await step('hide sets', applyHideSets(page, shot.transient === 'hidden' ? ['puffs', 'sparks'] : []));
  return { simulation, camera, cloudSettleCalls, hidden };
}

// Masked elements as CSS-pixel rects relative to the screenshot's top-left corner (compare excludes them).
async function maskRectsFor(page, mask, origin) {
  if (mask.length === 0) return [];
  const rects = await measureBoxes(page, mask);
  return mask.filter(selector => rects[selector]).map(selector => {
    const rect = rects[selector];
    return { name: selector, x: rect.x - origin.x, y: rect.y - origin.y, w: rect.width, h: rect.height };
  });
}

async function shoot(page, shot) {
  const screenshot = { animations: 'disabled', maskColor: MASK_COLOR };
  if (shot.group === '3d') {
    await runPrelude(page, shot.prelude);
    await waitFrames(page, 2);
    await waitForToastSettled(page);
    return { png: await page.screenshot(screenshot), boxes: null, maskRects: [] };
  }
  await waitForToastSettled(page);
  await freezeRendering(page);
  await hideSceneCanvas(page);
  await runPrelude(page, shot.prelude);
  const { target, mask, boxes } = shot.dom;
  const options = { ...screenshot, mask: mask.map(selector => page.locator(selector)) };
  const measured = boxes.length > 0 ? await measureBoxes(page, boxes) : null;
  if (target === 'page') return { png: await page.screenshot(options), boxes: measured, maskRects: await maskRectsFor(page, mask, { x: 0, y: 0 }) };
  if (target.clipUnion) {
    const clip = await clipForSelectors(page, target.clipUnion, 0);
    return { png: await page.screenshot({ ...options, clip }), boxes: measured, maskRects: await maskRectsFor(page, mask, clip) };
  }
  const element = page.locator(target);
  await element.scrollIntoViewIfNeeded();
  const origin = (await measureBoxes(page, [target]))[target];
  return { png: await element.screenshot(options), boxes: measured, maskRects: await maskRectsFor(page, mask, origin) };
}

async function captureOne(browser, target, baseUrl, shot, session) {
  const started = Date.now();
  const { context, page, freeze, load, signHash: loadSignHash, attempts } = await openSignoffPage(browser, target, baseUrl, shot, session.signReference);
  try {
    const prepared = await prepareSignoffScene(page, shot);
    const { png, boxes, maskRects } = await boundedStep(`${target}/${shot.id}: shoot`, shoot(page, shot));
    const signHash = await boundedStep(`${target}/${shot.id}: sign hash`, readSignHash(page));
    const meta = {
      id: shot.id, target, runId: session.runId, url: page.url(), profile: session.profile, executablePath: session.executablePath,
      viewport: shot.viewport, webglRenderer: freeze.webglRenderer, capabilities: freeze.capabilities, pausedAtFreeze: freeze.pausedAtFreeze,
      timeAtFreeze: freeze.timeAtFreeze, buildInfo: freeze.buildInfo, cloudOffsetMax: freeze.cloudOffsetMax, loadMarks: load.marks,
      loadAttempts: attempts, loadSignHash, steps: shot.frames, ...prepared, signHash, maskRects, pageErrors: [...page.parityErrors],
      capturedAt: new Date().toISOString(), durationMs: Date.now() - started,
    };
    return { png, meta, boxes, console: consoleRecord(page) };
  } finally {
    await context.close();
  }
}

/** Captures `shots` on one target into <outDir>/shots/<target>/; returns the metas. Pass one `signReference` to
 * every target of a run so all loads are held to the first font-ready load's sign hash. */
export async function captureSignoffTarget(browser, target, shots, {
  outDir, runId, profile = 'angle', executablePath = null, dirName = target, signReference = { hash: null },
}) {
  const baseUrl = await resolveTargetBaseUrl(target);
  const targetDir = path.join(outDir, 'shots', dirName);
  await mkdir(targetDir, { recursive: true });
  const metas = [];
  for (const shot of shots) {
    const result = await captureOne(browser, target, baseUrl, shot, { runId, profile, executablePath, signReference });
    const file = name => path.join(targetDir, `${shot.id}${name}`);
    await writeFile(file('.png'), result.png);
    await writeFile(file('.json'), `${JSON.stringify(result.meta, null, 2)}\n`);
    await writeFile(file('.console.json'), `${JSON.stringify(result.console, null, 2)}\n`);
    if (result.boxes) await writeFile(file('.boxes.json'), `${JSON.stringify(result.boxes, null, 2)}\n`);
    metas.push(result.meta);
    console.log(`captured ${dirName}/${shot.id} (${result.meta.durationMs} ms, ${result.console.tagged.length} tagged lines, ${result.console.errors.length} errors)`);
  }
  return metas;
}
