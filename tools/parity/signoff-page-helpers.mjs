// Sign-off page helpers, identical on both sites and driven through parity-surface names only: render
// gating, canvas hiding, the static loader card, toast settling, cloud settling at a new pose, loader
// phase marks, CPU-submit sampling and element boxes. (Reseeding happens inside stepFrames.)

/** Replaces the instance's render with a no-op (the loop resolves it on the instance every frame). */
export async function freezeRendering(page) {
  await page.evaluate(() => { window.__diorama.render = () => {}; });
}

export async function hideSceneCanvas(page) {
  await page.addStyleTag({ content: '#scene canvas { visibility: hidden !important; }' });
}

/** The static loader state of the first research capture: engine phase at 0 %, nothing animating. */
export async function forceLoadingCardState(page) {
  await page.evaluate(async () => {
    const loader = document.getElementById('loading');
    loader.hidden = false;
    loader.classList.remove('is-gone', 'is-working');
    loader.setAttribute('aria-busy', 'true');
    document.getElementById('load-phase').textContent = 'LOADING ENGINE';
    document.getElementById('load-percent').textContent = '0%';
    loader.querySelector('.load-fill').style.width = '0%';
    loader.querySelector('.load-bar').setAttribute('aria-valuenow', '0');
    document.getElementById('load-hint').textContent = 'Drag to orbit the valley.';
    await loader.querySelector('.load-logo').decode();
  });
}

/** Waits until #shortcut-toast has lost is-visible, then a further 250 ms for its fade. */
export async function waitForToastSettled(page, { timeout = 30000 } = {}) {
  await page.waitForFunction(() => !document.getElementById('shortcut-toast')?.classList.contains('is-visible'), null, { timeout, polling: 100 });
  await page.waitForTimeout(250);
}

/** Lets the clouds part around the current camera pose with the real cloud updater (1/60 s per call). */
export async function settleCloudAvoidance(page, calls = 180) {
  return page.evaluate(count => {
    const d = window.__diorama;
    const update = window.__parityOriginals?.updateCloudCamera;
    if (!update) return 0;
    for (let i = 0; i < count; i++) update.call(d.world, d.camera.position, 1 / 60);
    return count;
  }, calls);
}

// Init script: timestamps every #load-phase label change plus whether both station-sign font faces were ready.
function recordLoadPhaseMarks() {
  window.__loadPhaseMarks = [];
  window.__loaderHiddenAt = null;
  const fontsReady = () => (document.fonts ? document.fonts.check('700 106px Fredoka') && document.fonts.check('400 24px Fredoka') : null);
  const observer = new MutationObserver(() => {
    const label = document.getElementById('load-phase')?.textContent ?? null;
    const marks = window.__loadPhaseMarks;
    if (label && marks.at(-1)?.label !== label) marks.push({ label, t: performance.now(), signFontsReady: fontsReady() });
    if (window.__loaderHiddenAt === null && document.getElementById('loading')?.hidden) {
      window.__loaderHiddenAt = performance.now();
      observer.disconnect();
    }
  });
  observer.observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['hidden'] });
}

export async function installLoadPhaseMarks(context) {
  await context.addInitScript(recordLoadPhaseMarks);
}

export async function readLoadPhaseMarks(page) {
  return page.evaluate(() => ({ marks: window.__loadPhaseMarks ?? [], loaderHiddenAt: window.__loaderHiddenAt ?? null }));
}

/** EMA readings of the CPU-submit stat on frames the loop actually processed (d.last changed). */
export async function sampleCpuSubmitMilliseconds(page, { warmup = 20, frames = 60, timeout = 600000 } = {}) {
  return page.evaluate(({ skip, wanted, limit }) => new Promise((resolve, reject) => {
    const d = window.__diorama;
    const series = [];
    let lastSeen = d.last;
    let processed = 0;
    const timer = setTimeout(() => reject(new Error(`CPU sampler timed out after ${series.length} samples`)), limit);
    const tick = () => {
      if (d.last !== lastSeen) {
        lastSeen = d.last;
        processed++;
        if (processed > skip) series.push(d.performanceStats.cpuMilliseconds);
      }
      if (series.length > wanted) {
        clearTimeout(timer);
        resolve(series);
      } else requestAnimationFrame(tick);
    };
    // Registered after the loop's own callback for the coming frame, so each read sees that frame's update.
    requestAnimationFrame(tick);
  }), { skip: warmup, wanted: frames, limit: timeout });
}

export async function measureBoxes(page, selectors) {
  return page.evaluate(list => Object.fromEntries(list.map(selector => {
    const rect = document.querySelector(selector)?.getBoundingClientRect();
    return [selector, rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null];
  })), selectors);
}
