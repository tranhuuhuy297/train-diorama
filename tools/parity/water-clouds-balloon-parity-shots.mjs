// Water, cloud and balloon shots: the zoomed overview, a waterfall crop of the settled overview, and
// close-ups of the balloon, the pond/river surface and the waterfall, each by day and night. Stepped
// 600 frames (sim time 10.05 s) with the transients hidden.
// Id aliases: overview-zoomed-night/-day -> the *-masked rows below (unmasked ids stay FULL-stage);
// overview-day-default/overview-night-default -> overview-day-settled-masked/overview-night-masked.
import { shot, ZOOMED } from './parity-shot-factory-and-camera-poses.mjs';

const STEPPED_SECONDS = 10;
// Balloon close-up: a few metres off its envelope where it flies at t = 10.05 s.
export const BALLOON_VIEW = Object.freeze({ position: [26.92, 26.36, 10.96], target: [31.92, 25.06, 4.96] });
// Pond and upper river, looking down from the south-east of the pond.
export const WATER_VIEW = Object.freeze({ position: [-4, 24, 18], target: [-2, 0, 2] });
// In front of the curtain below the board's front edge (the low cloud bank is hidden for this view).
export const WATERFALL_VIEW = Object.freeze({ position: [0.3, -4, 96], target: [0.3, -9, 64] });

const MASK = ['transient'];

// [id, time of day, reference capture, extra settings]
const ROWS = Object.freeze([
  ['overview-zoomed-day-masked', 'day', '12-overview-zoomed-in.png', { camera: ZOOMED }],
  ['overview-zoomed-night-masked', 'night', '17-night-overview-zoomed.png', { camera: ZOOMED }],
  ['overview-day-waterfall-roi', 'day', '11b-hud-hidden-no-toast.png', { regions: ['waterfall'] }],
  ['balloon-closeup-day', 'day', '12-overview-zoomed-in.png', { camera: BALLOON_VIEW }],
  ['balloon-closeup-night', 'night', '17-night-overview-zoomed.png', { camera: BALLOON_VIEW }],
  ['water-closeup-day', 'day', '12-overview-zoomed-in.png', { camera: WATER_VIEW }],
  ['water-closeup-night', 'night', '17-night-overview-zoomed.png', { camera: WATER_VIEW }],
  ['waterfall-closeup-day', 'day', '11b-hud-hidden-no-toast.png', { camera: WATERFALL_VIEW, hide: [...MASK, 'clouds'] }],
  ['waterfall-closeup-night', 'night', '17-night-overview-zoomed.png', { camera: WATERFALL_VIEW, hide: [...MASK, 'clouds'] }],
  // Debug menu Clouds switch off: every cloud group hidden on both sites.
  ['clouds-debug-hidden', 'day', '14-overview-day-settled.png', { debugLayerOff: 'Clouds' }],
]);

/** Deterministic water/cloud/balloon shot records, tagged with the given stage. */
export function waterCloudsBalloonShots(stage) {
  return ROWS.map(([id, timeOfDay, reference, extra]) => shot(id, stage, '3d', reference, { hide: MASK, seconds: STEPPED_SECONDS, timeOfDay, ...extra }));
}
