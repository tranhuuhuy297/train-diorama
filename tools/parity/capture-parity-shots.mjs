// CLI: captures the selected parity shots on the original and/or the clone into <out>/shots/<target>/.
// Usage: node tools/parity/capture-parity-shots.mjs [--target clone|original|both] [--shots a,b] [--stage s] [--profile p] [--out dir]
import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PARITY_VIEWPORTS, launchParityBrowser, resolveTargetBaseUrl, stopCloneServer } from './playwright-browser-launcher.mjs';
import { installOriginalRouteHooks, awaitReadinessOrHookError } from './original-site-route-hooks.mjs';
import {
  PARITY_SEED, prepareParityContext, openParityPage, waitForDioramaReady, freezeForParity, applyShotState,
  stepFrames, applyCameraPose, applyHideSets, setRendering, waitFrames, parkTrainAway,
} from './page-parity-helpers.mjs';
import { setCaptureCss, runDomActions, waitForCssSettled, clipForSelectors } from './dom-shot-page-helpers.mjs';
import { ACTIVE_PARITY_STAGE, selectShots, expandHideSets } from './parity-shot-list.mjs';
import { computeShotRegions } from './shot-region-projection.mjs';
import { applyShotActions } from './page-shot-actions.mjs';

const STEP_SECONDS = 1 / 60;
const MASK_COLOR = '#ff00ff';
const consoleText = line => line.slice(line.indexOf(': ') + 2);

// Consecutive non-fresh shots on one viewport share a page load; list order keeps both targets in step.
export function groupSessions(shots) {
  const sessions = [];
  for (const shot of shots) {
    const last = sessions.at(-1);
    if (!shot.fresh && last && !last.fresh && last.viewport === shot.viewport) last.shots.push(shot);
    else sessions.push({ fresh: shot.fresh, viewport: shot.viewport, shots: [shot] });
  }
  return sessions;
}

export async function openFrozenSession(browser, target, baseUrl, viewport) {
  const context = await browser.newContext(PARITY_VIEWPORTS[viewport]);
  await prepareParityContext(context);
  const hookState = target === 'original' ? await installOriginalRouteHooks(context) : null;
  const page = await openParityPage(context, baseUrl, { parity: 'freeze' });
  await awaitReadinessOrHookError(waitForDioramaReady(page), hookState);
  const freeze = await freezeForParity(page);
  if (freeze.timeScale !== 1) throw new Error(`${target}: timeScale ${freeze.timeScale} at freeze (expected 1)`);
  if (freeze.pausedAtFreeze !== true) throw new Error(`${target}: ?parity=freeze did not pause the diorama`);
  return { context, page, freeze };
}

async function shootPng(page, shot) {
  if (shot.kind === '3d') {
    await setCaptureCss(page, { hideUi: true });
    await setRendering(page, true);
    await waitFrames(page, 2);
    const { width, height } = page.viewportSize();
    return page.screenshot({ clip: { x: 0, y: 0, width, height } });
  }
  await setCaptureCss(page, { hideCanvas: true, hideToast: !shot.keepToast });
  await setRendering(page, false);
  await runDomActions(page, shot.actions);
  await waitForCssSettled(page);
  const clip = await clipForSelectors(page, shot.selectors, shot.pad);
  const mask = shot.mask.map(selector => page.locator(selector));
  return page.screenshot({ clip, mask, maskColor: MASK_COLOR, animations: 'disabled' });
}

// Shot state, reseeded fixed-dt stepping, optional parking, camera pose, hide sets and shot actions (shared with the probe).
export async function prepareShotScene(page, shot) {
  await applyShotState(page, shot);
  const steps = Math.round(shot.seconds * 60);
  const simulation = await stepFrames(page, steps, { dt: STEP_SECONDS, seed: PARITY_SEED });
  const parkedAt = shot.parkTrain ? await parkTrainAway(page) : null;
  const camera = await applyCameraPose(page, shot.camera);
  const hidden = await applyHideSets(page, expandHideSets(shot.hide));
  const shotActions = await applyShotActions(page, shot);
  return { steps, simulation, parkedAt, camera, hidden, shotActions };
}

async function captureShot(page, shot, session) {
  const started = Date.now();
  const { steps, simulation, parkedAt, camera, hidden, shotActions } = await prepareShotScene(page, shot);
  // Regions in CSS px, from the settled camera (its updater is already a no-op).
  const { regions, devicePixelRatio } = shot.regions.length > 0 ? await computeShotRegions(page, shot.regions) : { regions: [], devicePixelRatio: null };
  const png = await shootPng(page, shot);
  const { freeze } = session;
  const meta = {
    id: shot.id, target: session.target, runId: session.runId, url: page.url(), profile: session.profile, executablePath: session.executablePath ?? null,
    viewport: shot.viewport, webglRenderer: freeze.webglRenderer, capabilities: freeze.capabilities,
    pausedAtFreeze: freeze.pausedAtFreeze, timeAtFreeze: freeze.timeAtFreeze, buildInfo: freeze.buildInfo,
    cloudOffsetMax: freeze.cloudOffsetMax, steps, simulationTime: simulation.time, parkedAt, camera, hidden, shotActions, regions, devicePixelRatio,
    pageErrors: [...page.parityErrors], parityLogs: page.parityConsole.filter(line => consoleText(line).startsWith('[PARITY]')),
    capturedAt: new Date().toISOString(), durationMs: Date.now() - started,
  };
  return { png, meta };
}

export async function captureTarget(browser, target, shots, { profile = 'angle', executablePath = null, outDir = '.parity-output', runId = null } = {}) {
  const baseUrl = await resolveTargetBaseUrl(target);
  const targetDir = path.join(outDir, 'shots', target);
  await mkdir(targetDir, { recursive: true });
  const metas = [];
  for (const { viewport, shots: sessionShots } of groupSessions(shots)) {
    const { context, page, freeze } = await openFrozenSession(browser, target, baseUrl, viewport);
    try {
      for (const shot of sessionShots) {
        const { png, meta } = await captureShot(page, shot, { target, runId, profile, executablePath, freeze });
        await writeFile(path.join(targetDir, `${shot.id}.png`), png);
        await writeFile(path.join(targetDir, `${shot.id}.json`), `${JSON.stringify(meta, null, 2)}\n`);
        metas.push(meta);
        console.log(`captured ${target}/${shot.id} (${meta.durationMs} ms)`);
      }
    } finally {
      await context.close();
    }
  }
  return metas;
}

async function main() {
  const { values } = parseArgs({
    options: {
      target: { type: 'string', default: 'both' }, shots: { type: 'string' },
      stage: { type: 'string', default: ACTIVE_PARITY_STAGE }, profile: { type: 'string', default: 'angle' },
      out: { type: 'string', default: '.parity-output' },
    },
  });
  const targets = values.target === 'both' ? ['original', 'clone'] : [values.target];
  const ids = values.shots ? values.shots.split(',').map(id => id.trim()).filter(Boolean) : null;
  const shots = selectShots({ ids, stage: values.stage });
  const outDir = path.resolve(values.out);
  // Shared by every meta of this invocation, so compare can flag stale shots left by another run.
  const runId = new Date().toISOString();
  let browser = null;
  try {
    const launched = await launchParityBrowser(values.profile);
    browser = launched.browser;
    const metas = [];
    for (const target of targets) {
      metas.push(...await captureTarget(browser, target, shots, { profile: values.profile, executablePath: launched.executablePath, outDir, runId }));
    }
    await writeFile(path.join(outDir, 'capture-log.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), runId, metas }, null, 2)}\n`);
  } finally {
    await browser?.close();
    await stopCloneServer();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
