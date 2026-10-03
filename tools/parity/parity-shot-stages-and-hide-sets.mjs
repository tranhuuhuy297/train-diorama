// Parity stages, pass thresholds and the named hide sets/presets a shot may request; shared by the
// shot list, its validator and the capture/probe tools.

export const PARITY_STAGES = Object.freeze(['shell-and-sky', 'train', 'village-and-windmill', 'residents-and-forest', 'full-scene']);
export const ACTIVE_PARITY_STAGE = 'full-scene';
export const CHANNEL_DIFF_THRESHOLD = 16;

export const THRESHOLDS = Object.freeze({
  deterministic: Object.freeze({ meanAbsDiff: 1.0, overThresholdFraction: 0.005 }),
  transient: Object.freeze({ meanAbsDiff: 3.0, overThresholdFraction: 0.03 }),
  dom: Object.freeze({ meanAbsDiff: 0.5, overThresholdFraction: 0.002 }),
});

// allButWorldCore keeps only the sky and terrain/track/bridge meshes (selected by material in the page).
export const HIDE_SETS = Object.freeze(['world', 'train', 'birds', 'puffs', 'sparks', 'clouds', 'trees', 'allButWorldCore',
  'stationFigures', 'sheep', 'balloon', 'villageResidents', 'houseSmoke', 'unbuiltAfterWindmill', 'water']);
// Everything that moves or that other build steps add around the station, plus the transients.
const MOVING_FAMILIES = ['stationFigures', 'train', 'birds', 'trees', 'sheep', 'clouds', 'balloon', 'villageResidents', 'houseSmoke'];
export const HIDE_PRESETS = Object.freeze({
  skyOnly: Object.freeze(['world', 'train', 'birds', 'puffs', 'sparks']),
  transient: Object.freeze(['puffs', 'sparks']),
  allFamilies: Object.freeze([...MOVING_FAMILIES, 'puffs', 'sparks']),
});

export function expandHideSets(hide) {
  return [...new Set(hide.flatMap(name => HIDE_PRESETS[name] ?? [name]))];
}
