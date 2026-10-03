// CLI: smoke check of a served build (localhost or a deployment). In a real page: no console errors or page
// errors (only the SwiftShader ReadPixels warnings allowed), no failed or >= 400 requests, loader hidden,
// '[GAMEPLAY] Started' logged, the 'H · Hide HUD' toast shown, and a synthetic pagehide disposing the canvas.
// Analytics: the insights script must load (200) on *.vercel.app and must never be requested elsewhere.
// Deployed hosts must 404 every development-only path. Writes .parity-output/smoke/<host>.json.
// Usage: node tools/parity/deployment-smoke-check.mjs --url <u> [--profile angle]
import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchParityBrowser } from './playwright-browser-launcher.mjs';

const ALLOWED_WARNING = /GL Driver Message|GPU stall due to ReadPixels/;
const LOADER_TIMEOUT_MS = 180000;
const INSIGHTS_PATH = '/_vercel/insights/script.js';
// Relative to the site root; none of these may ever be served.
export const EXCLUDED_PATHS = Object.freeze([
  '.parity-cache/original/Diorama.js', 'tests/unit/keyboard-shortcut-resolution.test.mjs', 'tools/static-dev-server.mjs',
  'docs/code-standards.md', 'node_modules/three/package.json', '.github/workflows/deploy-pages.yml', 'README.md',
]);

export function classifyHost(url) {
  const { hostname } = new URL(url);
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]') return 'local';
  return hostname.endsWith('.vercel.app') ? 'vercel' : 'other';
}

// The protection-bypass header goes only to the site's own origin, never to the CDNs.
function bypassHeaders() {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  return secret ? { 'x-vercel-protection-bypass': secret } : {};
}

function recordToasts() {
  window.__smokeToasts = [];
  new MutationObserver(() => {
    const text = document.getElementById('shortcut-toast')?.textContent?.trim();
    if (text && window.__smokeToasts.at(-1) !== text) window.__smokeToasts.push(text);
  }).observe(document, { subtree: true, childList: true, characterData: true });
}

async function pageChecks(browser, url) {
  const origin = new URL(url).origin;
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const headers = bypassHeaders();
  if (Object.keys(headers).length > 0) await context.route(`${origin}/**`, route => route.continue({ headers: { ...route.request().headers(), ...headers } }));
  await context.addInitScript(recordToasts);
  const page = await context.newPage();
  const seen = { errors: [], warnings: [], logs: [], failed: [], badResponses: [], insights: [] };
  page.on('console', message => {
    const text = message.text();
    if (message.type() === 'error') seen.errors.push(text);
    else if (message.type() === 'warning' && !ALLOWED_WARNING.test(text)) seen.warnings.push(text);
    else if (message.type() === 'log') seen.logs.push(text);
  });
  page.on('pageerror', error => seen.errors.push(`pageerror: ${error.message}`));
  page.on('requestfailed', request => seen.failed.push(`${request.url()} ${request.failure()?.errorText}`));
  page.on('request', request => { if (request.url().includes('/_vercel/insights')) seen.insights.push(request.url()); });
  page.on('response', response => { if (response.status() >= 400) seen.badResponses.push(`${response.status()} ${response.url()}`); });
  try {
    await page.goto(url, { waitUntil: 'commit' });
    const loaderHidden = await page.waitForFunction(() => document.getElementById('loading')?.hidden === true, null, { timeout: LOADER_TIMEOUT_MS, polling: 250 })
      .then(() => true, () => false);
    await page.waitForTimeout(1000);
    const state = await page.evaluate(() => ({ vaType: typeof window.va, toasts: window.__smokeToasts, canvas: Boolean(document.querySelector('#scene canvas')) }));
    const errorsBeforeDispose = seen.errors.length;
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    await page.waitForTimeout(500);
    const canvasAfterPagehide = await page.evaluate(() => Boolean(document.querySelector('#scene canvas')));
    return { ...seen, loaderHidden, ...state, canvasAfterPagehide, disposeErrors: seen.errors.slice(errorsBeforeDispose) };
  } finally {
    await context.close();
  }
}

async function fetchStatus(url) {
  try {
    return (await fetch(url, { headers: bypassHeaders(), redirect: 'manual' })).status;
  } catch (error) {
    return `error ${error.message}`;
  }
}

/** Every verdict line for one smoke run (pure; `page` from pageChecks, statuses from fetchStatus). */
export function judgeSmoke(kind, page, statuses) {
  const check = (name, pass, detail = '') => ({ name, pass, detail });
  const checks = [
    check('no console errors or page errors', page.errors.length === 0, page.errors.join(' | ')),
    check('only allowed warnings', page.warnings.length === 0, page.warnings.join(' | ')),
    check('no failed requests', page.failed.length === 0, page.failed.join(' | ')),
    check('no responses >= 400', page.badResponses.length === 0, page.badResponses.join(' | ')),
    check('loader hidden within 180 s', page.loaderHidden),
    check('[GAMEPLAY] Started logged', page.logs.includes('[GAMEPLAY] Started')),
    check("'H · Hide HUD' toast shown", (page.toasts ?? []).includes('H · Hide HUD'), JSON.stringify(page.toasts)),
    check('pagehide disposes the canvas without errors', page.canvas && !page.canvasAfterPagehide && page.disposeErrors.length === 0),
  ];
  if (kind === 'vercel') {
    checks.push(check('analytics queue stub defined', page.vaType === 'function'));
    checks.push(check('insights script served (200)', statuses.insights === 200, String(statuses.insights)));
  } else {
    checks.push(check('no analytics request off Vercel', page.insights.length === 0, page.insights.join(' | ')));
  }
  if (kind !== 'local') {
    for (const [excluded, status] of Object.entries(statuses.excluded)) checks.push(check(`404 for /${excluded}`, status === 404, String(status)));
  }
  return checks;
}

async function main() {
  const { values } = parseArgs({ options: { url: { type: 'string' }, profile: { type: 'string', default: 'angle' } } });
  if (!values.url) throw new Error('Usage: deployment-smoke-check.mjs --url <url>');
  const url = new URL(values.url).href;
  const kind = classifyHost(url);
  const { browser } = await launchParityBrowser(values.profile);
  let page;
  try {
    page = await pageChecks(browser, url);
  } finally {
    await browser.close();
  }
  const statuses = { insights: kind === 'vercel' ? await fetchStatus(new URL(INSIGHTS_PATH, url).href) : null, excluded: {} };
  if (kind !== 'local') for (const excluded of EXCLUDED_PATHS) statuses.excluded[excluded] = await fetchStatus(new URL(excluded, url).href);
  const checks = judgeSmoke(kind, page, statuses);
  const outDir = path.resolve('.parity-output', 'smoke');
  await mkdir(outDir, { recursive: true });
  const report = { url, kind, checkedAt: new Date().toISOString(), checks, page: { ...page, logs: page.logs.slice(0, 50) }, statuses };
  await writeFile(path.join(outDir, `${new URL(url).host.replace(/[^a-z0-9.-]/gi, '_')}.json`), `${JSON.stringify(report, null, 2)}\n`);
  for (const outcome of checks) console.log(`${outcome.pass ? 'PASS' : 'FAIL'} ${outcome.name}${outcome.pass || !outcome.detail ? '' : `: ${outcome.detail}`}`);
  if (checks.some(outcome => !outcome.pass)) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
