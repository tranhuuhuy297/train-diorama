// Station travelers and bird flocks section of the runtime probe, read in the identical frozen state on
// both sites: flock and bird counts, perch ids in order, flock modes, traveler count and walker pose.

export const EXPECTED_PERCH_IDS = Object.freeze(['bridge-1', 'bridge-2', 'bridge-3', 'station-roof', 'trackside-2', 'trackside-3', 'trackside-4']);
export const EXPECTED_BIRDS = 18;
export const EXPECTED_STATION_TRAVELERS = 2;

// Runs in the page; parity-surface names only, full float precision. Null without birds or a walker.
export function collectStationTravelersAndBirdsProbe() {
  const d = window.__diorama;
  const world = d.world;
  if (!d.birds || !world?.stationWalker) return null;
  const triple = vector => [vector.x, vector.y, vector.z];
  const walker = world.stationWalker;
  return {
    birdFlocks: d.birds.flocks.length,
    birds: d.birds.flocks.reduce((sum, flock) => sum + flock.birds.length, 0),
    perchIds: world.birdPerches.map(perch => perch.id),
    flockModes: d.birds.flocks.map(flock => flock.mode),
    stationTravelers: world.stationTravelers.length,
    walker: { position: triple(walker.figure.position), yaw: walker.figure.rotation.y, stopIndex: walker.stopIndex, wait: walker.wait },
  };
}

/** Both sites must carry the section, meet the fixed counts and ids, and agree on every value exactly. */
export function compareStationTravelersAndBirdsProbe(original, clone) {
  if (!original || !clone) return { pass: false, failures: [`travelers/birds section missing (original ${Boolean(original)}, clone ${Boolean(clone)})`] };
  const failures = [];
  for (const [label, section] of [['original', original], ['clone', clone]]) {
    if (section.birdFlocks !== EXPECTED_PERCH_IDS.length || section.birds !== EXPECTED_BIRDS) failures.push(`${label} flocks ${section.birdFlocks} birds ${section.birds}`);
    if (JSON.stringify(section.perchIds) !== JSON.stringify(EXPECTED_PERCH_IDS)) failures.push(`${label} perch ids ${section.perchIds.join(',')}`);
    if (section.stationTravelers !== EXPECTED_STATION_TRAVELERS) failures.push(`${label} station travelers ${section.stationTravelers}`);
  }
  const field = Object.keys(original).find(key => JSON.stringify(original[key]) !== JSON.stringify(clone[key]));
  if (field !== undefined) failures.push(`sites differ in ${field}`);
  return { pass: failures.length === 0, failures };
}
