// Final sign-off set: 21 full-page 3D shots and 7 DOM shots, each on its own page load, the frozen
// states the runtime probe compares exactly, and the research capture each sign-off shot stands in for.
// `frames` = fixed 1/60 s steps after the mode switch; transients (puffs, sparks) hidden unless 'visible'.

const DESKTOP = Object.freeze({ width: 1600, height: 900, deviceScaleFactor: 1, isMobile: false, hasTouch: false });
const MOBILE = Object.freeze({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const ZOOM_POSE = Object.freeze({ position: [-13.648, 32.079, 66.377], target: [0, 4, 0] });
// 10.85 s after leaving the station the whole train is on the bridge (s mod L within [32.6, 40.9]).
const ON_BRIDGE_FRAMES = Math.round(10.85 * 60);
const HALF_MINUTE_FRAMES = 30 * 60;

const BASE = Object.freeze({
  viewport: DESKTOP, mode: 'overview', timeOfDay: 'day', frames: 0, pixel: 'native', outline: true,
  cameraPose: null, transient: 'hidden', prelude: [], dom: null,
});

function signoffShot(id, group, reference, settings = {}) {
  const merged = { ...BASE, ...settings };
  const thresholds = settings.thresholds ?? (group === 'dom' ? 'dom' : merged.transient === 'visible' ? 'transient' : 'deterministic');
  return Object.freeze({ id, group, ...merged, seconds: merged.frames / 60, thresholds, reference });
}

const threeD = (id, reference, settings) => signoffShot(id, '3d', reference, settings);
const dom = (id, reference, target, settings = {}) => signoffShot(id, 'dom', reference, {
  ...settings, dom: Object.freeze({ target, mask: settings.mask ?? [], boxes: settings.boxes ?? [] }),
});

export const SIGNOFF_SHOTS = Object.freeze([
  threeD('ov-day-t0', '14-overview-day-settled.png'),
  threeD('ov-day-t30', '02-overview-day.png', { frames: HALF_MINUTE_FRAMES }),
  threeD('ov-day-t30-fx', '02-overview-day.png', { frames: HALF_MINUTE_FRAMES, transient: 'visible' }),
  threeD('ov-evening-t0', '03-overview-evening.png', { timeOfDay: 'evening' }),
  threeD('ov-evening-t30', '03-overview-evening.png', { timeOfDay: 'evening', frames: HALF_MINUTE_FRAMES }),
  threeD('ov-night-t0', '04-overview-night.png', { timeOfDay: 'night' }),
  threeD('ov-night-t30', '04-overview-night.png', { timeOfDay: 'night', frames: HALF_MINUTE_FRAMES }),
  threeD('ov-zoom-day', '12-overview-zoomed-in.png', { cameraPose: ZOOM_POSE }),
  threeD('ov-zoom-night', '17-night-overview-zoomed.png', { cameraPose: ZOOM_POSE, timeOfDay: 'night' }),
  threeD('pixel-360', '08-overview-pixel-art.png', { pixel: 'pixel360' }),
  threeD('pixel-720', '08b-overview-pixel-720p.png', { pixel: 'pixel720' }),
  threeD('ink-off', '09-overview-ink-off.png', { outline: false }),
  threeD('train-day', '05-train-camera-motion-4.png', { mode: 'side', frames: ON_BRIDGE_FRAMES }),
  threeD('train-day-fx', '05-train-camera.png', { mode: 'side', frames: ON_BRIDGE_FRAMES, transient: 'visible' }),
  threeD('train-night', '18-night-train-camera.png', { mode: 'side', frames: ON_BRIDGE_FRAMES, timeOfDay: 'night' }),
  threeD('bridge-day', '06b-bridge-camera-later.png', { mode: 'bridge', frames: ON_BRIDGE_FRAMES }),
  threeD('bridge-evening', '19-evening-bridge-camera.png', { mode: 'bridge', frames: ON_BRIDGE_FRAMES, timeOfDay: 'evening' }),
  threeD('bridge-evening-fx', '19-evening-bridge-camera.png', { mode: 'bridge', frames: ON_BRIDGE_FRAMES, timeOfDay: 'evening', transient: 'visible' }),
  threeD('free-day', '07-free-camera.png', { mode: 'orbit' }),
  threeD('hud-hidden', '11b-hud-hidden-no-toast.png', { prelude: [{ press: 'h' }] }),
  threeD('mobile-ov-day', '13-mobile-overview.png', { viewport: MOBILE }),
  dom('dom-hud-day', '14-overview-day-settled.png', '#hud-controls'),
  dom('dom-hud-night', '04-overview-night.png', '#hud-controls', { prelude: [{ press: 't' }, { press: 't' }, { wait: 700 }] }),
  dom('dom-help', '10-shortcuts-panel.png', { clipUnion: ['#controls-button', '#help'] }, { prelude: [{ click: '#controls-button' }] }),
  dom('dom-toast-bridge', '16-toast-bridge-shortcut.png', '#shortcut-toast', { prelude: [{ press: 'b' }, { wait: 250 }] }),
  dom('dom-debug', '15-debug-menu.png', '#debug-menu', { prelude: [{ click: '#debug-menu summary' }], mask: ['#debug-performance'] }),
  dom('dom-loading', '01-loading-screen.png', 'page', {
    prelude: [{ script: 'forceLoadingCardState' }, { wait: 500 }], mask: ['.load-logo'], boxes: ['.load-card', '.load-logo'],
  }),
  dom('dom-mobile-hud', '13-mobile-overview.png', '#hud-controls', { viewport: MOBILE }),
]);

export const SIGNOFF_IDS = Object.freeze(SIGNOFF_SHOTS.map(shot => shot.id));

export const SIGNOFF_PROBE_STATES = Object.freeze(['ov-day-t0', 'ov-night-t0', 'ov-day-t30', 'train-day', 'bridge-evening', 'free-day', 'pixel-360', 'mobile-ov-day']);

// Shots whose train must sit fully on the bridge; the probe checks s mod L on both sites.
export const ON_BRIDGE_STATES = Object.freeze({ ids: ['train-day', 'bridge-evening'], range: [32.6, 40.9] });

const equivalents = (ids, files) => files.map(file => [file, ids]);

/** Research capture file -> the sign-off shot that judges the same view deterministically. */
export const RESEARCH_EQUIVALENTS = Object.freeze(Object.fromEntries([
  ...equivalents('dom-loading', ['01-loading-screen.png']),
  ...equivalents('ov-day-t0', ['02-overview-day.png', '02a-overview-intro-dolly.png', '14-overview-day-settled.png']),
  ...equivalents('ov-evening-t0', ['03-overview-evening.png']),
  ...equivalents('ov-night-t0', ['04-overview-night.png']),
  ...equivalents('train-day', ['05-train-camera.png', ...[1, 2, 3, 4].map(n => `05-train-camera-motion-${n}.png`)]),
  ...equivalents('bridge-day', ['06-bridge-camera.png', '06b-bridge-camera-later.png']),
  ...equivalents('free-day', ['07-free-camera.png']),
  ...equivalents('pixel-360', ['08-overview-pixel-art.png']),
  ...equivalents('pixel-720', ['08b-overview-pixel-720p.png']),
  ...equivalents('ink-off', ['09-overview-ink-off.png']),
  ...equivalents('dom-help', ['10-shortcuts-panel.png']),
  ...equivalents('hud-hidden', ['11-hud-hidden.png', '11b-hud-hidden-no-toast.png']),
  ...equivalents('ov-zoom-day', ['12-overview-zoomed-in.png', '12b-overview-zoomed-orbited.png']),
  ...equivalents('mobile-ov-day', ['13-mobile-overview.png']),
  ...equivalents('dom-debug', ['15-debug-menu.png']),
  ...equivalents('dom-toast-bridge', ['16-toast-bridge-shortcut.png']),
  ...equivalents('ov-zoom-night', ['17-night-overview-zoomed.png']),
  ...equivalents('train-night', ['18-night-train-camera.png']),
  ...equivalents('bridge-evening', ['19-evening-bridge-camera.png']),
]));

const PIXEL_SHORT_SIDES = Object.freeze({ native: null, pixel720: 720, pixel360: 360 });

/** The engine state a sign-off shot asks for, in the shape applyShotState expects. */
export function signoffShotState(shot) {
  return { mode: shot.mode, timeOfDay: shot.timeOfDay, pixelShortSide: PIXEL_SHORT_SIDES[shot.pixel], outline: shot.outline };
}

/** Sign-off ids for a `--shots` value: 'signoff' expands to the whole set, otherwise a comma list. */
export function resolveSignoffIds(value) {
  if (value === 'signoff') return [...SIGNOFF_IDS];
  const ids = value.split(',').map(id => id.trim()).filter(Boolean);
  const unknown = ids.filter(id => !SIGNOFF_IDS.includes(id));
  if (unknown.length > 0) throw new Error(`Unknown sign-off shot(s): ${unknown.join(', ')}`);
  return ids;
}

/** True when every id of a `--shots` value names a sign-off shot (or the value is 'signoff'). */
export function isSignoffSelection(value) {
  if (!value) return false;
  return value === 'signoff' || value.split(',').map(id => id.trim()).filter(Boolean).every(id => SIGNOFF_IDS.includes(id));
}
