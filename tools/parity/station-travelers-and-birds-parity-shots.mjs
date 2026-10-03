// Station travelers and bird flocks, free mode with a fixed pose, transients hidden: both travelers
// near the platform end (the only view of the grandmother, who stands behind the free-camera start), the
// station-roof flock crouching into its take-off at load, and the bridge flocks circling above the deck.
import { shot } from './parity-shot-factory-and-camera-poses.mjs';

export const STATION_TRAVELERS_VIEW = Object.freeze({ position: [-45.479, 10.8, -10.431], target: [-47.944, 9.9, -3.52] });
export const STATION_ROOF_VIEW = Object.freeze({ position: [-44.5, 12.5, -8.5], target: [-49.465, 11.9, -2.46] });
export const BRIDGE_FLOCKS_VIEW = Object.freeze({ position: [-11.686, 11.96, 53.896], target: [-4.75, 15.5, 36.5] });

// [id, seconds stepped, camera, reference capture]; no capture shows the grandmother, so the close-up has none.
const ROWS = Object.freeze([
  ['station-travelers-closeup', 6, STATION_TRAVELERS_VIEW, null],
  ['station-roof-birds-takeoff', 0.6, STATION_ROOF_VIEW, null],
  ['bridge-birds-in-flight', 9, BRIDGE_FLOCKS_VIEW, '06b-bridge-camera-later.png'],
]);

/** Deterministic traveler and bird shot records, tagged with the given stage. */
export function stationTravelersAndBirdsShots(stage) {
  return ROWS.map(([id, seconds, camera, reference]) => shot(id, stage, '3d', reference, { mode: 'orbit', seconds, camera, hide: ['transient'] }));
}
