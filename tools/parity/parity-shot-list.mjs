// Stage-gated browser parity shots and their selection, plus the single resolver for the research
// captures that live outside the repo; stages, thresholds and hide sets are re-exported for the tools.
import { existsSync } from 'node:fs';
import { PALETTES } from '../../src/engine/time-of-day-palettes-and-transition.js';
import { shot, ZOOMED, ZOOMED_ORBITED, LOCO_CHASE, BRIDGE_VIEW, lookFromTarget, locoView } from './parity-shot-factory-and-camera-poses.mjs';
import { PARITY_STAGES, ACTIVE_PARITY_STAGE } from './parity-shot-stages-and-hide-sets.mjs';
import { shotListErrors } from './parity-shot-validation.mjs';
import { cameraModeShots } from './camera-mode-parity-shots.mjs';
import { sheepFlockShots } from './sheep-flock-parity-shots.mjs';
import { waterCloudsBalloonShots } from './water-clouds-balloon-parity-shots.mjs';
import { stationTravelersAndBirdsShots } from './station-travelers-and-birds-parity-shots.mjs';
import { resolveResearchDir, researchCapturePath } from './research-capture-paths.mjs';

export { resolveResearchDir, researchCapturePath, researchSkipReason } from './research-capture-paths.mjs';
export {
  PARITY_STAGES, ACTIVE_PARITY_STAGE, CHANNEL_DIFF_THRESHOLD, THRESHOLDS, HIDE_SETS, HIDE_PRESETS, expandHideSets,
} from './parity-shot-stages-and-hide-sets.mjs';

export function findMissingReferences(shots = PARITY_SHOTS, researchDir = resolveResearchDir()) {
  return shots
    .filter(shot => shot.reference && !existsSync(researchCapturePath(shot.reference, researchDir)))
    .map(shot => `${shot.id}: missing reference ${shot.reference}`);
}

const SKY = { hide: ['skyOnly'] };
const DISMISS = [{ blur: true }, { mouse: [800, 450] }];
const SETTLED = { seconds: 3, hide: ['transient'] };
const MOVING = { seconds: 6, thresholdClass: 'transient' };
const CHASE = { camera: LOCO_CHASE, hide: ['world', 'birds', 'transient'], fresh: true };
// Terrain, track and bridge only, over every building pad.
const WORLD_CORE = { hide: ['allButWorldCore'] };
const [SHELL, TRAIN, VILLAGE, FOREST, FULL] = PARITY_STAGES;
// Station views (local frame of the station group; the train parked half a loop away on both sites).
const STATION_CLOSEUP = { camera: { relativeTo: 'station', position: [8, 3.5, -6], target: [-3, 1.5, 0.5] }, hide: ['allFamilies'], parkTrain: true };
// Train-only views in the locomotive's frame (world and birds hidden; Math.random reseeded right before stepping).
// Steps: 2160 = braking with sparks live, 2520 = dwelling at the station, 540 = crossing the bridge.
const TRAIN_ONLY = ['world', 'birds'];
const BRAKING_FRONT = { seconds: 36, camera: locoView([4.5, 2.6, 6.5], [0, 1.2, 0.5]) };
// Village and windmill vs an original with every later build step hidden; judged inside both regions.
const VILLAGE_VIEW = { seconds: 3, hide: ['unbuiltAfterWindmill', 'transient'], regions: ['village', 'windmill'] };
// Residents, forest and rocks over the full scene (ids keep their historical -masked suffix).
const MASKED = { seconds: 3, hide: ['transient'] };
// Fresh page each, so the t0 baseline never inherits a parked train from a shared session.
const SWAY = { hide: MASKED.hide, camera: ZOOMED_ORBITED, uniformTimeOffset: 5, fresh: true };
// Free-camera start over the station, train parked away.
const STATION_FREE_START = { camera: { relativeTo: 'freeCameraStart', fov: 65 }, hide: ['train', 'transient'], parkTrain: true };

export const PARITY_SHOTS = Object.freeze([
  shot('sky-day', SHELL, '3d', '14-overview-day-settled.png', SKY),
  shot('sky-evening', SHELL, '3d', '03-overview-evening.png', { ...SKY, timeOfDay: 'evening' }),
  shot('sky-night', SHELL, '3d', '04-overview-night.png', { ...SKY, timeOfDay: 'night' }),
  shot('sky-day-pixel360', SHELL, '3d', '08-overview-pixel-art.png', { ...SKY, pixelShortSide: 360 }),
  shot('sky-day-ink-off', SHELL, '3d', '09-overview-ink-off.png', { ...SKY, outline: false }),
  shot('sky-sun-day', SHELL, '3d', null, { ...SKY, camera: lookFromTarget(PALETTES.day.uLightDir.toArray()) }),
  shot('sky-moon-night', SHELL, '3d', null, { ...SKY, timeOfDay: 'night', camera: lookFromTarget(PALETTES.night.uLightDir.toArray()) }),
  shot('sky-stars-night', SHELL, '3d', null, { ...SKY, timeOfDay: 'night', camera: lookFromTarget([0, 0.8, -0.6]) }),
  shot('sky-hills-evening', SHELL, '3d', null, { ...SKY, timeOfDay: 'evening', camera: lookFromTarget([1, 0, 0]) }),
  shot('hud-day', SHELL, 'dom', '14-overview-day-settled.png', { selectors: ['#hud-controls'], pad: 24 }),
  shot('hud-night', SHELL, 'dom', '04-overview-night.png', { actions: [{ press: 't' }, { press: 't' }], selectors: ['#hud-controls'], pad: 24 }),
  shot('help-panel', SHELL, 'dom', '10-shortcuts-panel.png', { actions: [{ click: '#controls-button' }, ...DISMISS], selectors: ['#controls-button', '#help'] }),
  shot('toast-bridge', SHELL, 'dom', '16-toast-bridge-shortcut.png', { keepToast: true, actions: [{ press: 'b' }], selectors: ['#shortcut-toast'], pad: 32 }),
  shot('loader-card', SHELL, 'dom', '01-loading-screen.png', { actions: [{ script: 'reshowLoader' }], selectors: ['#loading .load-card'], pad: 48, mask: ['.load-logo'] }),
  shot('debug-menu', SHELL, 'dom', '15-debug-menu.png', { actions: [{ click: '#debug-menu summary' }, ...DISMISS], selectors: ['#debug-menu'], pad: 24, mask: ['#debug-performance'] }),
  shot('sky-mobile', SHELL, '3d', '13-mobile-overview.png', { ...SKY, viewport: 'mobile' }),
  shot('hud-mobile', SHELL, 'dom', '13-mobile-overview.png', { viewport: 'mobile', selectors: ['#hud-controls'], pad: 12 }),
  shot('world-core-overview', SHELL, '3d', '14-overview-day-settled.png', WORLD_CORE),
  shot('world-core-bridge', SHELL, '3d', '06b-bridge-camera-later.png', { ...WORLD_CORE, camera: BRIDGE_VIEW }),
  shot('station-trackside-closeup-day', SHELL, '3d', null, STATION_CLOSEUP),
  shot('station-trackside-closeup-night', SHELL, '3d', null, { ...STATION_CLOSEUP, timeOfDay: 'night' }),
  shot('train-only-day', TRAIN, '3d', '05-train-camera.png', CHASE),
  shot('train-only-night', TRAIN, '3d', '18-night-train-camera.png', { ...CHASE, timeOfDay: 'night' }),
  shot('train-smoke-day', TRAIN, '3d', '05-train-camera-motion-1.png', { camera: LOCO_CHASE, hide: ['world', 'birds'], seconds: 4, thresholdClass: 'transient' }),
  // Deterministic with effects: both sites are reseeded and the heights the sparks bounce on (near the stop) are equal.
  shot('train-only-braking-front-day', TRAIN, '3d', '05-train-camera.png', { ...BRAKING_FRONT, hide: TRAIN_ONLY }),
  shot('train-only-braking-front-day-no-effects', TRAIN, '3d', '05-train-camera.png', { ...BRAKING_FRONT, hide: [...TRAIN_ONLY, 'transient'] }),
  shot('train-only-dwell-side-day', TRAIN, '3d', null, { seconds: 42, camera: locoView([-11, 3.2, -9.5], [0, 1.4, -9.5]), hide: [...TRAIN_ONLY, 'transient'] }),
  shot('train-only-night-headlight', TRAIN, '3d', '18-night-train-camera.png', {
    timeOfDay: 'night', seconds: 9, camera: locoView([-14, 5.5, -3], [0, 1.6, 7]), hide: [...TRAIN_ONLY, 'transient'],
  }),
  shot('village-windmill-overview-day', VILLAGE, '3d', '14-overview-day-settled.png', VILLAGE_VIEW),
  shot('village-windmill-zoomed-day', VILLAGE, '3d', '12-overview-zoomed-in.png', { ...VILLAGE_VIEW, camera: ZOOMED }),
  shot('village-windmill-evening', VILLAGE, '3d', '03-overview-evening.png', { ...VILLAGE_VIEW, timeOfDay: 'evening' }),
  shot('village-windmill-zoomed-night', VILLAGE, '3d', '17-night-overview-zoomed.png', { ...VILLAGE_VIEW, camera: ZOOMED, timeOfDay: 'night' }),
  shot('overview-day-settled-masked', FOREST, '3d', '14-overview-day-settled.png', MASKED),
  shot('overview-zoomed-orbited-masked', FOREST, '3d', '12b-overview-zoomed-orbited.png', { ...MASKED, camera: ZOOMED_ORBITED }),
  shot('overview-night-masked', FOREST, '3d', '04-overview-night.png', { ...MASKED, timeOfDay: 'night' }),
  // 8 s in: the woman is mid-way across her yard.
  shot('village-residents-yard', FOREST, '3d', null, { ...MASKED, seconds: 8, inPageCameraPose: 'villageResidentYard' }),
  shot('trees-sway-t0', FOREST, '3d', '12b-overview-zoomed-orbited.png', { ...SWAY, uniformTimeOffset: 0 }),
  shot('trees-sway-t1', FOREST, '3d', '12b-overview-zoomed-orbited.png', { ...SWAY, relation: { to: 'trees-sway-t0', expect: 'differs', minOverFraction: 0.0005 } }),
  shot('trees-sway-hold', FOREST, '3d', null, { ...SWAY, holdPausedFrames: 20, relation: { to: 'trees-sway-t1', expect: 'identical' } }),
  shot('trees-debug-hidden', FOREST, '3d', '14-overview-day-settled.png', { ...MASKED, debugLayerOff: 'Trees' }),
  shot('station-free-start-day', FOREST, '3d', '07-free-camera.png', STATION_FREE_START),
  shot('station-free-start-night', FOREST, '3d', '17-night-overview-zoomed.png', { ...STATION_FREE_START, timeOfDay: 'night' }),
  ...cameraModeShots(FOREST),
  ...sheepFlockShots(FOREST),
  ...waterCloudsBalloonShots(FOREST),
  shot('overview-day', FULL, '3d', '14-overview-day-settled.png', SETTLED),
  shot('overview-evening', FULL, '3d', '03-overview-evening.png', { ...SETTLED, timeOfDay: 'evening' }),
  shot('overview-night', FULL, '3d', '04-overview-night.png', { ...SETTLED, timeOfDay: 'night' }),
  shot('overview-pixel360', FULL, '3d', '08-overview-pixel-art.png', { ...SETTLED, pixelShortSide: 360 }),
  shot('overview-pixel720', FULL, '3d', '08b-overview-pixel-720p.png', { ...SETTLED, pixelShortSide: 720 }),
  shot('overview-ink-off', FULL, '3d', '09-overview-ink-off.png', { ...SETTLED, outline: false }),
  shot('overview-zoomed-day', FULL, '3d', '12-overview-zoomed-in.png', { ...SETTLED, camera: ZOOMED }),
  shot('overview-zoomed-night', FULL, '3d', '17-night-overview-zoomed.png', { ...SETTLED, camera: ZOOMED, timeOfDay: 'night' }),
  shot('free-cam-day', FULL, '3d', '07-free-camera.png', { ...SETTLED, mode: 'orbit' }),
  shot('train-cam-day', FULL, '3d', '05-train-camera-motion-4.png', { ...MOVING, mode: 'side' }),
  shot('train-cam-night', FULL, '3d', '18-night-train-camera.png', { ...MOVING, mode: 'side', timeOfDay: 'night' }),
  shot('bridge-cam-day', FULL, '3d', '06b-bridge-camera-later.png', { ...MOVING, mode: 'bridge' }),
  shot('bridge-cam-evening', FULL, '3d', '19-evening-bridge-camera.png', { ...MOVING, mode: 'bridge', timeOfDay: 'evening' }),
  shot('mobile-overview', FULL, '3d', '13-mobile-overview.png', { ...SETTLED, viewport: 'mobile' }),
  ...stationTravelersAndBirdsShots(FULL),
]);

export function selectShots({ ids = null, stage = ACTIVE_PARITY_STAGE } = {}) {
  if (ids && ids.length > 0) {
    return ids.map(id => {
      const found = PARITY_SHOTS.find(candidate => candidate.id === id);
      if (!found) throw new Error(`Unknown parity shot: ${id}`);
      return found;
    });
  }
  const limit = PARITY_STAGES.indexOf(stage);
  if (limit < 0) throw new Error(`Unknown parity stage: ${stage}`);
  // Report-only shots run only when requested by id.
  return PARITY_SHOTS.filter(candidate => !candidate.reportOnly && PARITY_STAGES.indexOf(candidate.stage) <= limit);
}

export function validateShotList(shots = PARITY_SHOTS) {
  return shotListErrors(shots);
}
