// Browser checks of the debug menu (structure, toggles, perf refresh, HUD hiding), of the parity
// hook's exposure rules and of the station clock on the live page; identical on both sites.
import { PARITY_VIEWPORTS } from './playwright-browser-launcher.mjs';
import { installOriginalRouteHooks, awaitReadinessOrHookError } from './original-site-route-hooks.mjs';
import { prepareParityContext, openParityPage, waitForDioramaReady, waitFrames } from './page-parity-helpers.mjs';
import { probeLiveStationClock } from './station-runtime-probe.mjs';

const OBSERVE_MILLISECONDS = 1600;
const LOG_WAIT_MILLISECONDS = 5000;
const consoleText = line => line.slice(line.indexOf(': ') + 2);

// [tag, [[attribute, value]...], children]; text nodes are '#text <content>'.
const layerRow = label => ['label', [], [['input', [['type', 'checkbox']], []], `#text ${label}`]];
const EXPECTED_TREE = ['details', [['id', 'debug-menu']], [
  ['summary', [['title', 'Debug menu'], ['aria-label', 'Debug menu']], ['#text ···']],
  ['div', [['class', 'debug-content']], [
    ['strong', [], ['#text Scene debug']],
    ['div', [['id', 'debug-layers']], [layerRow('Trees'), layerRow('Clouds')]],
    ['pre', [['id', 'debug-performance']], []],
  ]],
]];
const EXPECTED_SUMMARY = { summary: '···', title: 'Debug menu', ariaLabel: 'Debug menu', strong: 'Scene debug', labels: ['Trees', 'Clouds'], checked: [true, true], open: false };
const EXPECTED_DEBUG_LOGS = ['[DEBUG] Trees: hidden', '[DEBUG] Trees: shown', '[DEBUG] Clouds: hidden', '[DEBUG] Clouds: shown'];

const check = (name, pass, detail) => ({ name, pass: Boolean(pass), detail });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function readMenu() {
  const menu = document.getElementById('debug-menu');
  const describe = node => (node.nodeType === Node.TEXT_NODE
    ? `#text ${node.textContent}`
    : [node.localName, [...node.attributes].map(({ name, value }) => [name, value]), [...node.childNodes].map(describe)]);
  const summary = menu.querySelector('summary');
  return {
    tree: describe(menu),
    summary: {
      summary: summary.textContent, title: summary.getAttribute('title'), ariaLabel: summary.getAttribute('aria-label'),
      strong: menu.querySelector('strong').textContent,
      labels: [...menu.querySelectorAll('#debug-layers label')].map(label => label.textContent),
      checked: [...menu.querySelectorAll('#debug-layers input')].map(input => input.checked), open: menu.open,
    },
  };
}

function layerVisibility() {
  const world = window.__diorama.world;
  return { trees: (world?.treeLayers ?? []).map(layer => layer.visible), clouds: (world?.clouds ?? []).map(cloud => cloud.group.visible) };
}

function observePerformance(milliseconds) {
  return new Promise(resolve => {
    const readout = document.getElementById('debug-performance');
    let records = 0;
    const observer = new MutationObserver(list => { records += list.length; });
    observer.observe(readout, { childList: true, subtree: true, characterData: true });
    setTimeout(() => { observer.disconnect(); resolve({ records, text: readout.textContent }); }, milliseconds);
  });
}

async function debugLines(page, from, expectedCount) {
  const deadline = Date.now() + LOG_WAIT_MILLISECONDS;
  const read = () => page.parityConsole.slice(from).map(consoleText).filter(text => text.startsWith('[DEBUG] Trees') || text.startsWith('[DEBUG] Clouds'));
  while (read().length < expectedCount && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 100));
  return read();
}

async function clickToggles(page) {
  const consoleStart = page.parityConsole.length;
  const errorStart = page.parityErrors.length;
  const visibility = [];
  await page.click('#debug-menu summary');
  for (const index of [1, 1, 2, 2]) {
    await page.click(`#debug-layers label:nth-child(${index}) input`);
    visibility.push(await page.evaluate(layerVisibility));
  }
  const lines = await debugLines(page, consoleStart, EXPECTED_DEBUG_LOGS.length);
  await page.click('#debug-menu summary');
  await waitFrames(page, 2);
  await page.waitForTimeout(100);
  const allAre = (list, value) => list.every(visible => visible === value);
  const visibilityOk = allAre(visibility[0].trees, false) && allAre(visibility[1].trees, true)
    && allAre(visibility[2].clouds, false) && allAre(visibility[3].clouds, true);
  return [
    check('debug toggles log', same(lines, EXPECTED_DEBUG_LOGS), lines),
    check('debug toggles raise no page error', page.parityErrors.length === errorStart, page.parityErrors.slice(errorStart)),
    check('debug toggles set layer visibility', visibilityOk, visibility),
  ];
}

export async function runDebugMenuChecks(page) {
  const results = [];
  const menu = await page.evaluate(readMenu);
  results.push(check('debug menu structure', same(menu.tree, EXPECTED_TREE) && same(menu.summary, EXPECTED_SUMMARY), menu.summary));
  results.push(...await clickToggles(page));
  const closed = await page.evaluate(observePerformance, OBSERVE_MILLISECONDS);
  results.push(check('perf readout idle while closed', closed.records === 0, closed.records));
  await page.evaluate(() => document.querySelector('#debug-menu summary').click());
  const open = await page.evaluate(observePerformance, OBSERVE_MILLISECONDS);
  results.push(check('perf readout refreshes while open', open.records >= 2 && /^FPS {10}\d/.test(open.text), { records: open.records, text: open.text }));
  await page.evaluate(() => document.querySelector('#debug-menu summary').click());
  const menuDisplay = () => getComputedStyle(document.getElementById('debug-menu')).display;
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('h');
  const hiddenDisplay = await page.evaluate(menuDisplay);
  await page.keyboard.press('h');
  const shownDisplay = await page.evaluate(menuDisplay);
  results.push(check('debug menu hidden with the HUD', hiddenDisplay === 'none' && shownDisplay !== 'none', { hiddenDisplay, shownDisplay }));
  return results;
}

// Loads the page with the given parity param; `inspectPage` runs on the ready page before it closes.
async function loadWithParity(browser, target, baseUrl, parity, inspectPage = null) {
  const context = await browser.newContext(PARITY_VIEWPORTS.desktop);
  try {
    await prepareParityContext(context);
    const hookState = target === 'original' ? await installOriginalRouteHooks(context) : null;
    const page = await openParityPage(context, baseUrl, { parity });
    await awaitReadinessOrHookError(waitForDioramaReady(page, { requireHook: parity !== null }), hookState);
    const state = await page.evaluate(() => ({ exposed: window.__diorama !== undefined, paused: window.__diorama?.paused ?? null }));
    const parityLines = page.parityConsole.map(consoleText).filter(text => text.startsWith('[PARITY]'));
    const inspected = inspectPage ? await inspectPage(page) : null;
    return { state: { ...state, parityLines }, inspected };
  } finally {
    await context.close();
  }
}

export async function runHookExposureChecks(browser, target, baseUrl) {
  const { state: off } = await loadWithParity(browser, target, baseUrl, null);
  const { state: live, inspected: liveClock } = await loadWithParity(browser, target, baseUrl, '', probeLiveStationClock);
  return [
    check('no hook without the parity param', !off.exposed && off.parityLines.length === 0, off),
    check('?parity exposes a live diorama', live.exposed && live.paused === false && same(live.parityLines, ['[PARITY] Hook installed: live']), live),
    check('station clock hands follow live sim time', liveClock?.pass, liveClock),
  ];
}
