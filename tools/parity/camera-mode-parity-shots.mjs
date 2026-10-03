// Camera-mode shots: each enters overview then the shot's mode and steps the rig at a fixed 1/60 s, so the
// side and bridge glides land identically on both sites. Each comes as a strict shot (smoke and sparks
// hidden) and a `-relaxed` twin with them visible. Systems the clone still lacks are hidden on both sites.
import { shot } from './parity-shot-factory-and-camera-poses.mjs';

export const CAMERA_SHOT_HIDE = Object.freeze(['cloneMissing']);

// [id, mode, time of day, seconds stepped, reference capture]
const CAMERA_SHOT_ROWS = Object.freeze([
  ['train-camera-day', 'side', 'day', 6.5, '05-train-camera-motion-4.png'],
  ['bridge-camera-day', 'bridge', 'day', 6, '06b-bridge-camera-later.png'],
  ['bridge-camera-evening', 'bridge', 'evening', 10.5, '19-evening-bridge-camera.png'],
  ['free-camera-day', 'orbit', 'day', 6, '07-free-camera.png'],
  ['train-camera-night', 'side', 'night', 9, '18-night-train-camera.png'],
]);

/** Strict + relaxed shot records for every camera row, tagged with the given stage. */
export function cameraModeShots(stage) {
  return CAMERA_SHOT_ROWS.flatMap(([id, mode, timeOfDay, seconds, reference]) => {
    const base = { mode, timeOfDay, seconds };
    return [
      shot(id, stage, '3d', reference, { ...base, hide: [...CAMERA_SHOT_HIDE, 'transient'] }),
      shot(`${id}-relaxed`, stage, '3d', reference, { ...base, hide: [...CAMERA_SHOT_HIDE], thresholdClass: 'transient' }),
    ];
  });
}
