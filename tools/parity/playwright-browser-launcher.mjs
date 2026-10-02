// Parity browser launch: explicit full-Chromium binary (never the headless shell), viewport profiles,
// target base URLs and an on-demand clone static server.
import { existsSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { ORIGINAL_SITE_URL } from './original-site-route-hooks.mjs';

export const CLONE_PORT = 4317;
const SERVER_POLL_MILLISECONDS = 250;
const SERVER_POLL_ATTEMPTS = 40;
const SERVER_SCRIPT = fileURLToPath(new URL('../static-dev-server.mjs', import.meta.url));

const SWIFTSHADER_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
// sRGB output profile on every launch keeps screenshots comparable within one run.
export const LAUNCH_PROFILES = Object.freeze({
  angle: { options: {}, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] },
  swiftshader: { options: {}, args: SWIFTSHADER_ARGS },
  chrome: { options: { channel: 'chrome' }, args: SWIFTSHADER_ARGS },
  headed: { options: { headless: false }, args: ['--ignore-gpu-blocklist'] },
});

export const PARITY_VIEWPORTS = Object.freeze({
  desktop: { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 },
  mobile: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
});

function newestCachedChromium() {
  const cacheDir = path.join(process.env.HOME ?? '', '.cache', 'ms-playwright');
  if (!existsSync(cacheDir)) return undefined;
  const builds = readdirSync(cacheDir)
    .map(name => /^chromium-(\d+)$/.exec(name))
    .filter(Boolean)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  for (const [buildDir] of builds) {
    for (const platformDir of ['chrome-linux64', 'chrome-linux']) {
      const candidate = path.join(cacheDir, buildDir, platformDir, 'chrome');
      if (existsSync(candidate)) return candidate;
    }
  }
  return undefined;
}

export function resolveChromiumExecutable(profileName) {
  const profile = LAUNCH_PROFILES[profileName];
  if (!profile) throw new Error(`Unknown launch profile: ${profileName}`);
  if (profile.options.channel) return undefined;
  const fromEnv = process.env.CHROMIUM_PATH;
  if (fromEnv) {
    if (!existsSync(fromEnv)) throw new Error(`CHROMIUM_PATH does not exist: ${fromEnv}`);
    return fromEnv;
  }
  const bundled = chromium.executablePath();
  if (bundled && existsSync(bundled)) return bundled;
  const cached = newestCachedChromium();
  if (cached) return cached;
  throw new Error('No Chromium found: run npx playwright install chromium or set CHROMIUM_PATH');
}

export async function launchParityBrowser(profileName = 'angle') {
  const executablePath = resolveChromiumExecutable(profileName);
  const { options, args } = LAUNCH_PROFILES[profileName];
  const browser = await chromium.launch({
    headless: true, ...options, args: [...args, '--force-color-profile=srgb'],
    ...(executablePath ? { executablePath } : {}),
  });
  return { browser, profileName, executablePath };
}

let cloneServer = null;

async function reachable(url) {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

async function startCloneServer(url) {
  cloneServer = spawn(process.execPath, [SERVER_SCRIPT], { env: { ...process.env, PORT: String(CLONE_PORT) }, stdio: 'ignore' });
  process.once('exit', () => cloneServer?.kill());
  for (let attempt = 0; attempt < SERVER_POLL_ATTEMPTS; attempt++) {
    await new Promise(resolve => setTimeout(resolve, SERVER_POLL_MILLISECONDS));
    if (await reachable(url)) return;
  }
  stopCloneServer();
  throw new Error(`Clone server did not answer at ${url}`);
}

export async function resolveTargetBaseUrl(target) {
  if (target === 'original') return ORIGINAL_SITE_URL;
  if (target !== 'clone') throw new Error(`Unknown parity target: ${target}`);
  if (process.env.CLONE_URL) return process.env.CLONE_URL;
  const url = `http://localhost:${CLONE_PORT}/`;
  if (!(await reachable(url))) await startCloneServer(url);
  return url;
}

export async function stopCloneServer() {
  if (!cloneServer) return;
  cloneServer.kill();
  cloneServer = null;
}
