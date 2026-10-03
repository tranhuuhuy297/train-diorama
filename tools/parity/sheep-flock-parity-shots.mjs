// Sheep shots: a close view across the rail sheep from beside the track (in-page pose built from route 2 on
// each site; the probe proves the routes equal), by day, asleep at night, and around sheep 2's first hop.
// Transients and the systems the clone still lacks are hidden on both sites.
import { shot } from './parity-shot-factory-and-camera-poses.mjs';

// First frame sheep 2 enters 'escaping' after the default preamble (probe value K2, equal on both sites).
export const SHEEP_HOP_K2 = 824;
const SHEEP_VIEW = { inPageCameraPose: 'sheepFlockCloseup', hide: ['cloneMissing', 'transient'] };

// [id, time of day, frames stepped at 1/60 s, reference capture]
const SHEEP_SHOT_ROWS = Object.freeze([
  ['sheep-flock-day-closeup', 'day', 120, '12-overview-zoomed-in.png'],
  // Ten seconds of full night: the flock has settled into sleep.
  ['sheep-flock-night-closeup', 'night', 600, '17-night-overview-zoomed.png'],
  // Crouching before the hop, mid-air, and waiting on the safe spot.
  ['sheep-track-hop-1', 'day', SHEEP_HOP_K2 - 12, null],
  ['sheep-track-hop-2', 'day', SHEEP_HOP_K2 + 20, null],
  ['sheep-track-hop-3', 'day', SHEEP_HOP_K2 + 90, null],
]);

/** Deterministic sheep shot records, tagged with the given stage. */
export function sheepFlockShots(stage) {
  return SHEEP_SHOT_ROWS.map(([id, timeOfDay, frames, reference]) => shot(id, stage, '3d', reference, { ...SHEEP_VIEW, timeOfDay, seconds: frames / 60 }));
}
