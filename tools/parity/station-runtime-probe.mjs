// Station section of the runtime probe: placement scalars, sim time, clock angles against the clock
// formula evaluated in the page, the sign canvas hash and Fredoka readiness, frozen and live clock checks.
// A difference in the sign alone is a font race, so both sites are reloaded (at most three attempts in all).
import { resolveTargetBaseUrl } from './playwright-browser-launcher.mjs';
import { setRendering, waitFrames } from './page-parity-helpers.mjs';
import { openFrozenSession } from './capture-parity-shots.mjs';

export const STATION_PROBE_ATTEMPTS = 3;
export const FONT_RACE_FIELDS = Object.freeze(['signCanvasHash', 'fredokaBold106']);
const FROZEN_CHECK_FRAMES = 30;
// Sim time after the constructor's single step; a live page must move past it.
const CONSTRUCTOR_STEP_TIME = 0.05;
const LIVE_ADVANCE_TIMEOUT_MILLISECONDS = 120000;

// Runs in the page. Clock direction is -1 on both sites; the formulas keep the clock's operation order.
export function collectStationProbe() {
  const d = window.__diorama;
  const w = d.world;
  const minute = w?.stationClockMinuteHand;
  if (!minute) return null;
  const station = minute.parent.parent;
  const hour = w.stationClockHourHand;
  const time = d.time;
  const sign = station.children.find(child => child.material?.type === 'MeshBasicMaterial');
  const canvas = sign.material.map.image;
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  // 32-bit FNV-1a over the RGBA bytes.
  let hash = 0x811c9dc5;
  for (let index = 0; index < pixels.length; index++) hash = Math.imul(hash ^ pixels[index], 0x01000193) >>> 0;
  const triple = vector => [vector.x, vector.y, vector.z];
  return {
    stationS: w.stationS,
    freeCameraStart: { position: triple(w.freeCameraStart.position), target: triple(w.freeCameraStart.target) },
    groupPosition: triple(station.position), groupRotationY: station.rotation.y, time,
    minute: minute.rotation.x, hour: hour.rotation.x,
    minuteMatchesFormula: Object.is(minute.rotation.x, (((-1 * time) * Math.PI) * 2) / 60),
    hourMatchesFormula: Object.is(hour.rotation.x, -1 * ((Math.PI / 2) + (((time * Math.PI) * 2) / 720))),
    signCanvasHash: hash.toString(16).padStart(8, '0'),
    fredokaBold106: document.fonts.check('bold 106px Fredoka'),
  };
}

/** Station probe on a frozen page, then the hands re-read after 30 frames (rendering off, so frames are cheap). */
export async function probeStationState(page) {
  const station = await page.evaluate(collectStationProbe);
  if (!station) return null;
  await setRendering(page, false);
  await waitFrames(page, FROZEN_CHECK_FRAMES);
  const [minute, hour] = await page.evaluate(() => {
    const w = window.__diorama.world;
    return [w.stationClockMinuteHand.rotation.x, w.stationClockHourHand.rotation.x];
  });
  return { ...station, frozenAfter30Frames: minute === station.minute && hour === station.hour };
}

/** Live page: once the frame loop has advanced sim time, time and both hands are read in one evaluate. */
export async function probeLiveStationClock(page) {
  await page.waitForFunction(after => (window.__diorama?.time ?? 0) > after, CONSTRUCTOR_STEP_TIME,
    { polling: 'raf', timeout: LIVE_ADVANCE_TIMEOUT_MILLISECONDS });
  const probe = await page.evaluate(collectStationProbe);
  if (!probe) return { pass: false, reason: 'no station clock' };
  const { time, minute, hour, minuteMatchesFormula, hourMatchesFormula } = probe;
  return { pass: time > CONSTRUCTOR_STEP_TIME && minuteMatchesFormula && hourMatchesFormula, time, minute, hour };
}

export function stationDifferences(original, clone) {
  return Object.keys({ ...original, ...clone }).filter(key => JSON.stringify(original[key]) !== JSON.stringify(clone[key]));
}

async function reprobeStation(browser, target) {
  const { context, page } = await openFrozenSession(browser, target, await resolveTargetBaseUrl(target), 'desktop');
  try {
    return await probeStationState(page);
  } finally {
    await context.close();
  }
}

const selfConsistent = probe => probe.minuteMatchesFormula && probe.hourMatchesFormula && probe.frozenAfter30Frames;

/** Cross-site station comparison with the font-race reload; null unless both sites report a station. */
export async function compareStationAcrossSites(browser, results) {
  let [original, clone] = [results.original?.station, results.clone?.station];
  if (!original || !clone) return null;
  let attempts = 1;
  let differing = stationDifferences(original, clone);
  const fontRaceOnly = () => differing.length > 0 && differing.every(field => FONT_RACE_FIELDS.includes(field));
  while (fontRaceOnly() && attempts < STATION_PROBE_ATTEMPTS) {
    attempts++;
    original = await reprobeStation(browser, 'original');
    clone = await reprobeStation(browser, 'clone');
    differing = stationDifferences(original, clone);
  }
  const pass = differing.length === 0 && selfConsistent(original) && selfConsistent(clone);
  return { pass, attempts, differing, original, clone };
}
