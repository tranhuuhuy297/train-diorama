// Camera UI probe (`parity:probe -- --camera-ui`): one live page per site with saved settings cleared. Drives the
// mode keys and buttons, the glide/snap entries, click-to-lock (with a spy on lock), the unlock key clearing and
// flight-key capture, then checks the expectations on each site and that both sites answered identically.
import { PARITY_VIEWPORTS, resolveTargetBaseUrl } from './playwright-browser-launcher.mjs';
import { installOriginalRouteHooks, awaitReadinessOrHookError } from './original-site-route-hooks.mjs';
import { prepareParityContext, openParityPage, waitForDioramaReady } from './page-parity-helpers.mjs';

export const FREE_TOAST = 'Free · Click scene to fly · WASD move · Space rise · C descend · Shift sprint · Esc releases mouse';
const KEY_FLOW = ['2', '3', '4', '1', 'b'];
const consoleText = line => line.slice(line.indexOf(': ') + 2);
// Intro lines depend on load timing, so only mode/pause traffic is compared.
const isProbeLog = text => (text.startsWith('[CAMERA]') && !text.startsWith('[CAMERA] Overview intro')) || text.startsWith('[PAUSE]');

function readUi() {
  const d = window.__diorama;
  return {
    mode: d.mode, fov: d.camera.fov,
    pressed: document.querySelector('#camera-modes [aria-pressed="true"]')?.dataset.mode ?? null,
    toast: document.getElementById('shortcut-toast').textContent,
  };
}

// A canvas point not covered by HUD chrome, scanning from the upper middle of the viewport.
function findCanvasPoint() {
  const canvas = window.__diorama.renderer.domElement;
  for (let fy = 0.3; fy < 0.8; fy += 0.05) {
    for (let fx = 0.3; fx < 0.8; fx += 0.05) {
      const [x, y] = [Math.round(innerWidth * fx), Math.round(innerHeight * fy)];
      if (document.elementFromPoint(x, y) === canvas) return [x, y];
    }
  }
  return null;
}

// Mode entries driven synchronously in one task, so no animation frame can interleave with the steps.
function glideAndSnap() {
  const d = window.__diorama;
  const tripod = d.camPos.clone().set(-3, 5.5, 60);
  d.setMode('overview');
  d.setMode('bridge');
  const bridge = [];
  for (let step = 0; step < 5; step++) { d.updateCamera(1 / 60); bridge.push(d.camPos.distanceTo(tripod)); }
  d.setMode('overview');
  d.setMode('side');
  d.updateCamera(1 / 60);
  const sideGap = d.camPos.distanceTo(d.tmpA);
  d.setMode('orbit');
  return {
    bridgeFirstOver50: bridge[0] > 50, bridgeDecreasing: bridge.every((value, i) => i === 0 || value < bridge[i - 1]),
    sideNotSnapped: sideGap > 1, orbitSnapped: d.camera.position.equals(d.freeCameraPose.position),
  };
}

const setLocked = (page, locked) => page.evaluate(on => { window.__diorama.firstPersonControls.isLocked = on; }, locked);
const lockCalls = page => page.evaluate(() => window.__lockCalls.map(args => [...args]));
const keySet = page => page.evaluate(() => [...window.__diorama.movementKeys].sort());

async function driveSite(page) {
  const point = await page.evaluate(findCanvasPoint);
  if (!point) throw new Error('no canvas point clear of the HUD');
  const logStart = page.parityConsole.length;
  const keys = [];
  for (const key of KEY_FLOW) {
    await page.keyboard.press(key);
    keys.push({ key, ...await page.evaluate(readUi) });
  }
  await page.click('#camera-modes [data-mode="side"]', { button: 'right' });
  const rightClick = await page.evaluate(readUi);
  const glide = await page.evaluate(glideAndSnap);

  // Lock spy: orbit + unlocked locks once, orbit + locked and overview never do.
  await page.keyboard.press('2');
  await page.evaluate(() => {
    window.__lockCalls = [];
    window.__diorama.firstPersonControls.lock = (...args) => window.__lockCalls.push(args);
  });
  await page.mouse.click(...point);
  const lockOrbit = await lockCalls(page);
  await setLocked(page, true);
  await page.mouse.click(...point);
  const lockWhileLocked = await lockCalls(page);
  await setLocked(page, false);
  await page.keyboard.press('1');
  await page.mouse.click(...point);
  const lockOverview = await lockCalls(page);

  const unlockClears = await page.evaluate(() => {
    const d = window.__diorama;
    d.movementKeys.add('KeyW');
    d.firstPersonControls.dispatchEvent({ type: 'unlock' });
    return d.movementKeys.size;
  });

  // Flight capture only while orbit + locked: W lands in the key set, Space does not pause.
  await page.keyboard.press('2');
  await setLocked(page, true);
  await page.keyboard.down('w');
  const keysWhileHeld = await keySet(page);
  await page.keyboard.up('w');
  const keysAfterRelease = await keySet(page);
  const pauseLogsBefore = page.parityConsole.length;
  await page.keyboard.press('Space');
  const lockedSpace = {
    pauseLogs: page.parityConsole.slice(pauseLogsBefore).map(consoleText).filter(text => text.startsWith('[PAUSE]')),
    paused: await page.evaluate(() => window.__diorama.paused),
  };
  await page.evaluate(() => window.__diorama.movementKeys.clear());
  await setLocked(page, false);
  await page.keyboard.press('Space');
  const pausePressed = await page.getAttribute('[data-toggle="paused"]', 'aria-pressed');
  await page.keyboard.press('Space');
  await page.waitForTimeout(100);
  const logs = page.parityConsole.slice(logStart).map(consoleText).filter(isProbeLog);
  return {
    keys, rightClick, glide, lock: { orbit: lockOrbit, whileLocked: lockWhileLocked, overview: lockOverview },
    unlockClears, keysWhileHeld, keysAfterRelease, lockedSpace, pausePressed, logs, pageErrors: [...page.parityErrors],
  };
}

const EXPECTED_KEYS = [['2', 'orbit', 65], ['3', 'side', 48], ['4', 'bridge', 42], ['1', 'overview', 42], ['b', 'bridge', 42]];

/** Expectation misses for one site's result (empty when everything held). */
export function cameraUiExpectationMisses(result) {
  const misses = [];
  const expect = (name, pass) => { if (!pass) misses.push(name); };
  EXPECTED_KEYS.forEach(([key, mode, fov], index) => {
    const row = result.keys[index];
    expect(`key ${key} -> ${mode}/${fov}`, row?.mode === mode && row.fov === fov && row.pressed === mode);
  });
  expect('Free toast on 2', result.keys[0]?.toast === FREE_TOAST);
  expect('Bridge toast on b', result.keys[4]?.toast === 'B · Bridge camera');
  expect('right click resets', result.rightClick.mode === 'overview' && result.rightClick.toast === 'Camera · Default');
  for (const [name, pass] of Object.entries(result.glide)) expect(`glide ${name}`, pass);
  expect('click locks in orbit', JSON.stringify(result.lock.orbit) === '[[true]]');
  expect('no lock while locked', result.lock.whileLocked.length === 1);
  expect('no lock in overview', result.lock.overview.length === 1);
  expect('unlock clears keys', result.unlockClears === 0);
  expect('W captured while locked', result.keysWhileHeld.includes('KeyW') && !result.keysAfterRelease.includes('KeyW'));
  expect('Space does not pause while locked', result.lockedSpace.pauseLogs.length === 0 && result.lockedSpace.paused === false);
  expect('Space pauses when unlocked', result.pausePressed === 'true' && result.logs.includes('[PAUSE] Paused') && result.logs.includes('[PAUSE] Resumed'));
  expect('no page errors', result.pageErrors.length === 0);
  return misses;
}

async function probeSite(browser, target) {
  const context = await browser.newContext(PARITY_VIEWPORTS.desktop);
  try {
    await prepareParityContext(context);
    const hookState = target === 'original' ? await installOriginalRouteHooks(context) : null;
    const page = await openParityPage(context, await resolveTargetBaseUrl(target), { parity: 'live' });
    await awaitReadinessOrHookError(waitForDioramaReady(page), hookState);
    return await driveSite(page);
  } finally {
    await context.close();
  }
}

/** Runs the probe on every target; returns per-site results, misses and the cross-site differences. */
export async function runCameraUiProbe(browser, targets) {
  const sites = {};
  for (const target of targets) {
    const result = await probeSite(browser, target);
    sites[target] = { result, misses: cameraUiExpectationMisses(result) };
  }
  const differing = [];
  if (sites.original && sites.clone) {
    const { pageErrors: _o, ...original } = sites.original.result;
    const { pageErrors: _c, ...clone } = sites.clone.result;
    for (const field of Object.keys(original)) {
      if (JSON.stringify(original[field]) !== JSON.stringify(clone[field])) differing.push(field);
    }
  }
  const pass = Object.values(sites).every(site => site.misses.length === 0) && differing.length === 0;
  return { generatedAt: new Date().toISOString(), sites, differing, pass };
}

/** CLI tail: writes the combined camera-ui-probe.json plus one camera-ui-probe-<target>.json per site,
 * prints one line per site and fails the run on any miss. */
export async function writeCameraUiReport(report, outDir) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const asJson = value => `${JSON.stringify(value, null, 2)}\n`;
  await mkdir(outDir, { recursive: true });
  await writeFile(`${outDir}/camera-ui-probe.json`, asJson(report));
  for (const [target, site] of Object.entries(report.sites)) {
    await writeFile(`${outDir}/camera-ui-probe-${target}.json`, asJson({ generatedAt: report.generatedAt, target, ...site }));
  }
  for (const [target, { misses }] of Object.entries(report.sites)) {
    console.log(`${misses.length === 0 ? 'PASS' : 'FAIL'} ${target} camera UI${misses.length === 0 ? '' : `: ${misses.join('; ')}`}`);
  }
  if (report.sites.original && report.sites.clone) {
    console.log(`${report.differing.length === 0 ? 'PASS' : 'FAIL'} camera UI clone vs original${report.differing.length === 0 ? '' : `: differs in ${report.differing.join(', ')}`}`);
  }
  if (!report.pass) process.exitCode = 1;
}
