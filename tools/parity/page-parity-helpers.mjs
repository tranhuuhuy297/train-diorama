// In-page parity driving, identical on both sites: seeded Math.random, freeze, shot state, fixed-dt
// stepping through parity-surface names only, camera override, train parking, hide sets and render gating.
import { STORAGE_KEY } from '../../src/ui/settings-schema-defaults.js';

export { applyHideSets } from './page-hide-set-application.mjs';

export const PARITY_SEED = 20260930;
const READY_POLL_MILLISECONDS = 250;

// Runs inside the page before any site script: clears saved settings once per context, then seeds Math.random.
function seedPageRandom({ seed, storageKey }) {
  if (!sessionStorage.getItem('__parity_cleared')) {
    localStorage.removeItem(storageKey);
    sessionStorage.setItem('__parity_cleared', '1');
  }
  let state = seed >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) | 0;
    let word = Math.imul(state ^ (state >>> 15), state | 1);
    word = (word + Math.imul(word ^ (word >>> 7), word | 61)) ^ word;
    return ((word ^ (word >>> 14)) >>> 0) / 4294967296;
  };
  window.__parityReseed = next => { state = next >>> 0; };
}

export async function prepareParityContext(context, { seed = PARITY_SEED } = {}) {
  await context.addInitScript(seedPageRandom, { seed, storageKey: STORAGE_KEY });
  await context.route('**/_vercel/insights/**', route => route.abort());
}

export async function openParityPage(context, url, { parity = 'freeze' } = {}) {
  const target = new URL(url);
  if (parity !== null) target.searchParams.set('parity', parity);
  const page = await context.newPage();
  page.parityConsole = [];
  page.parityErrors = [];
  page.on('console', message => page.parityConsole.push(`${message.type()}: ${message.text()}`));
  page.on('pageerror', error => page.parityErrors.push(error.message));
  await page.goto(target.href, { waitUntil: 'commit' });
  return page;
}

export async function waitForDioramaReady(page, { requireHook = true, timeout = 180000 } = {}) {
  await page.waitForFunction(hookNeeded => {
    if (hookNeeded && !window.__diorama) return false;
    const loader = document.getElementById('loading');
    return Boolean(loader?.hidden && document.getElementById('debug-menu'));
  }, requireHook, { polling: READY_POLL_MILLISECONDS, timeout });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([400, 500, 600, 700].map(weight => document.fonts.load(`${weight} 16px Fredoka`)));
  });
}

export async function freezeForParity(page) {
  return page.evaluate(() => {
    const d = window.__diorama;
    if (!d) throw new Error('window.__diorama is missing; load the page with ?parity');
    const pausedAtFreeze = d.paused;
    d.paused = true;
    d.overviewIntro = null;
    d.setAutoRotate(false);
    // Stash once per page so a second freeze never captures the no-ops.
    const stash = window.__parityOriginals ??= { updateCamera: d.updateCamera, updateCloudCamera: d.world?.updateCloudCamera, render: d.render };
    d.updateCamera = () => {};
    if (stash.updateCloudCamera) d.world.updateCloudCamera = () => {};
    window.__parityHidden = [];
    const gl = d.renderer.getContext();
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    const clouds = d.world?.clouds ?? [];
    return {
      pausedAtFreeze, timeAtFreeze: d.time, s: d.s ?? null, timeScale: d.timeScale,
      buildInfo: window.__parityBuildInfo ?? null,
      cloudOffsetMax: clouds.reduce((max, cloud) => Math.max(max, cloud.offset?.length() ?? 0), 0),
      capabilities: {
        world: Boolean(d.world), worldUpdate: typeof d.world?.update === 'function', train: Boolean(d.train),
        birds: Boolean(d.birds), puffs: (d.puffs?.length ?? 0) > 0, sparks: Boolean(d.brakeSparks),
        cloudCamera: Boolean(stash.updateCloudCamera),
      },
      webglRenderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'n/a',
    };
  });
}

export async function applyShotState(page, { mode, timeOfDay, pixelShortSide, outline }) {
  await page.evaluate(state => {
    const d = window.__diorama;
    d.overviewIntro = null;
    d.setAutoRotate(false);
    // Overview first: its double controls reset lands camPos/camTarget on the home pose before any other rig blends.
    d.setMode('overview');
    if (state.mode !== 'overview') d.setMode(state.mode);
    d.setTimeOfDay(state.timeOfDay, true);
    d.setPixelResolution(state.pixelShortSide);
    d.setOutline(state.outline);
  }, { mode, timeOfDay, pixelShortSide, outline });
}

export async function stepFrames(page, count, { dt = 1 / 60, seed = PARITY_SEED } = {}) {
  return page.evaluate(({ frames, step, reseed }) => {
    const d = window.__diorama;
    const stash = window.__parityOriginals;
    window.__parityReseed(reseed);
    const wasPaused = d.paused;
    d.paused = false;
    try {
      for (let frame = 0; frame < frames; frame++) {
        d.updateTimeOfDay(step);
        if (d.world) d.world.nightAmount = d.lightingUniforms.uNight.value;
        d.time += step;
        d.lightingUniforms.uTime.value = d.time;
        if (d.train && typeof d.updateTrain === 'function') d.updateTrain(step);
        if (typeof d.world?.update === 'function') {
          const motion = d.train ? { distance: d.s, speed: d.speed, length: d.train.totalLength } : undefined;
          d.world.update(d.time, step, d.train?.loco.obj.position, motion);
        }
        if (d.birds) d.birds.update(d.time, d.s, d.speed, d.train?.cars);
        stash.updateCamera.call(d, step);
        if (stash.updateCloudCamera) stash.updateCloudCamera.call(d.world, d.camera.position, step);
      }
    } finally {
      d.paused = wasPaused;
    }
    return { time: d.time, s: d.s ?? null };
  }, { frames: count, step: dt, reseed: seed });
}

export async function applyCameraPose(page, pose) {
  if (!pose) return null;
  return page.evaluate(request => {
    const d = window.__diorama;
    const start = request.relativeTo === 'freeCameraStart' ? d.world.freeCameraStart : null;
    const position = start ? start.position.clone() : d.camera.position.clone().fromArray(request.position ?? request.offset);
    const target = start ? start.target.clone() : d.camera.position.clone().fromArray(request.target ?? request.lookAt);
    // Station group = parent of the clock building, the same lookup on both sites.
    const frame = { loco: () => d.train.loco.obj, station: () => d.world.stationClockMinuteHand.parent.parent }[request.relativeTo]?.();
    if (frame) {
      frame.updateWorldMatrix(true, false);
      frame.localToWorld(position);
      frame.localToWorld(target);
    }
    if (request.fov !== undefined) d.camera.fov = request.fov;
    d.camera.updateProjectionMatrix();
    d.camera.position.copy(position);
    d.camera.lookAt(target);
    d.camPos.copy(position);
    d.camTarget.copy(target);
    d.controls.target.copy(target);
    return { position: position.toArray(), target: target.toArray() };
  }, pose);
}

// Moves a hidden train (and so its headlight uniform) half a loop away from the station; no-op without one.
export async function parkTrainAway(page) {
  return page.evaluate(() => {
    const d = window.__diorama;
    if (!d.train || !d.world) return null;
    const loop = d.world.length;
    const parkedAt = (d.s + loop / 2) % loop;
    d.train.update(d.world, parkedAt);
    return parkedAt;
  });
}

export async function setRendering(page, enabled) {
  await page.evaluate(on => {
    const d = window.__diorama;
    d.render = on ? window.__parityOriginals.render : () => {};
  }, enabled);
}

export async function waitFrames(page, count = 2) {
  await page.evaluate(frames => new Promise(resolve => {
    let left = frames;
    const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick));
    requestAnimationFrame(tick);
  }), count);
}
