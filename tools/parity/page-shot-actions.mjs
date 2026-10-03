// Optional per-shot page actions, run after the fixed-dt stepping (and any parking or camera pose) on
// both sites alike: a raw shader-clock offset, a debug-menu layer switch, a named in-page camera pose
// and a paused hold. Every in-page function reads parity-surface names only.
import { applyCameraPose, waitFrames } from './page-parity-helpers.mjs';

// Names validated in the shot list; each must have a builder in resolveInPageCameraPose (unit-tested).
export const IN_PAGE_CAMERA_POSES = Object.freeze(['villageResidentYard']);

// Runs in the page (serialised alone, so the registry lives inside); returns world-space {position, target}.
// villageResidentYard: woman's home frame, a few metres in front of her yard, looking at her walk line.
export function resolveInPageCameraPose(name) {
  const d = window.__diorama;
  const poses = {
    villageResidentYard: () => {
      const { home, depth } = d.world.villageResidents.residents[0];
      const local = (x, y, z) => home.localToWorld(d.camera.position.clone().set(x, y, z)).toArray();
      return { position: local(-1.5, 2.4, depth / 2 + 5.5), target: local(0, 0.7, depth / 2 + 0.65) };
    },
  };
  if (!poses[name]) throw new Error(`Unknown in-page camera pose: ${name}`);
  return poses[name]();
}

// Runs in the page: clicks the debug-menu checkbox of `label` (works with the panel closed) and
// returns its new state plus the console lines the change handler printed.
export function toggleDebugLayerInPage(label) {
  const row = [...document.querySelectorAll('#debug-layers label')].find(candidate => candidate.textContent.trim() === label);
  const checkbox = row?.querySelector('input[type=checkbox]');
  if (!checkbox) throw new Error(`Debug layer not found: ${label}`);
  const logs = [];
  const realLog = console.log;
  console.log = (...args) => {
    logs.push(args.map(String).join(' '));
    realLog.apply(console, args);
  };
  try {
    checkbox.click();
  } finally {
    console.log = realLog;
  }
  return { label, checked: checkbox.checked, logs };
}

/** Applies the shot's optional actions in a fixed order; returns what each one reported (null if unused). */
export async function applyShotActions(page, shot) {
  const results = { uniformTimeOffset: null, debugLayerOff: null, inPageCameraPose: null, holdPausedFrames: null };
  if (shot.uniformTimeOffset) {
    results.uniformTimeOffset = await page.evaluate(offset => {
      const uTime = window.__diorama.lightingUniforms.uTime;
      uTime.value += offset;
      return uTime.value;
    }, shot.uniformTimeOffset);
  }
  if (shot.debugLayerOff) results.debugLayerOff = await page.evaluate(toggleDebugLayerInPage, shot.debugLayerOff);
  if (shot.inPageCameraPose) {
    const pose = await page.evaluate(resolveInPageCameraPose, shot.inPageCameraPose);
    results.inPageCameraPose = await applyCameraPose(page, pose);
  }
  if (shot.holdPausedFrames) {
    const readClock = () => page.evaluate(() => ({ paused: window.__diorama.paused, uTime: window.__diorama.lightingUniforms.uTime.value }));
    const before = await readClock();
    await waitFrames(page, shot.holdPausedFrames);
    const after = await readClock();
    results.holdPausedFrames = { frames: shot.holdPausedFrames, paused: before.paused && after.paused, uTimeBefore: before.uTime, uTimeAfter: after.uTime };
  }
  return results;
}
