// DOM element shots: capture-time CSS, scripted UI actions, transition settling and clip rectangles.

const CAPTURE_STYLE_ID = 'parity-capture-css';
const UI_SELECTORS = ['#hud-top', '#hud-controls', '#shortcut-toast', '#debug-menu', '#loading'];

// Descendants are hidden too and lose their transitions: a running transition outranks !important, so a
// `transition-all` button would otherwise keep rendering until its inherited visibility change finishes.
export function captureCssText({ hideUi = false, hideCanvas = false, hideToast = false } = {}) {
  const hidden = [
    ...(hideUi ? UI_SELECTORS : []),
    ...(hideCanvas ? ['#scene'] : []),
    ...(hideToast ? ['#shortcut-toast'] : []),
  ];
  return [...new Set(hidden)]
    .map(selector => `${selector}, ${selector} * { visibility: hidden !important; transition: none !important; }`)
    .join('\n');
}

export async function setCaptureCss(page, options = {}) {
  const css = captureCssText(options);
  await page.evaluate(({ styleId, text }) => {
    document.getElementById(styleId)?.remove();
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = text;
    document.head.append(style);
  }, { styleId: CAPTURE_STYLE_ID, text: css });
}

// A genuine mid-load loader state (engine loaded, valley build running) without the infinite breathe animation.
async function reshowLoader(page) {
  await page.evaluate(async () => {
    const loader = document.getElementById('loading');
    loader.hidden = false;
    loader.classList.remove('is-gone', 'is-working');
    loader.setAttribute('aria-busy', 'true');
    document.getElementById('load-phase').textContent = 'BUILDING VALLEY AND TRAIN';
    document.getElementById('load-percent').textContent = '30%';
    loader.querySelector('.load-fill').style.width = '30%';
    loader.querySelector('[role=progressbar]').setAttribute('aria-valuenow', '30');
    document.getElementById('load-hint').textContent = 'Drag to orbit the valley. Scroll to zoom.';
    await loader.querySelector('.load-logo').decode();
  });
}

const DOM_SCRIPTS = { reshowLoader };

export async function runDomActions(page, actions) {
  for (const action of actions) {
    if (action.press) await page.keyboard.press(action.press);
    else if (action.click) await page.click(action.click);
    else if (action.blur) await page.evaluate(() => document.activeElement?.blur?.());
    else if (action.mouse) await page.mouse.move(action.mouse[0], action.mouse[1]);
    else if (action.script) {
      const script = DOM_SCRIPTS[action.script];
      if (!script) throw new Error(`Unknown DOM action script: ${action.script}`);
      await script(page);
    } else throw new Error(`Unknown DOM action: ${JSON.stringify(action)}`);
  }
}

export async function waitForCssSettled(page) {
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter(animation => Number.isFinite(animation.effect?.getTiming().iterations));
    await Promise.all(finite.map(animation => animation.finished.catch(() => null)));
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

export async function clipForSelectors(page, selectors, pad = 16) {
  const box = await page.evaluate(list => {
    let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const selector of list) {
      const node = document.querySelector(selector);
      if (!node) throw new Error(`Clip selector not found: ${selector}`);
      const rect = node.getBoundingClientRect();
      [left, top] = [Math.min(left, rect.left), Math.min(top, rect.top)];
      [right, bottom] = [Math.max(right, rect.right), Math.max(bottom, rect.bottom)];
    }
    return { left, top, right, bottom, width: innerWidth, height: innerHeight };
  }, selectors);
  const x = Math.floor(Math.max(0, box.left - pad));
  const y = Math.floor(Math.max(0, box.top - pad));
  const right = Math.min(box.width, box.right + pad);
  const bottom = Math.min(box.height, box.bottom + pad);
  return { x, y, width: Math.ceil(right - x), height: Math.ceil(bottom - y) };
}
