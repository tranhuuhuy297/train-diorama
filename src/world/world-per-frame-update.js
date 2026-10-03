// Per-frame world systems in a fixed order: station clock, (track sheep, flock, station walker),
// village residents, their log line (then the traveler's), (idle travelers), chimney smoke,
// windmill rotor, (clouds, balloon). Bracketed systems slot in at those positions as they are built.
import { updateStationClock } from './station/station-wall-clock.js';
import { updateChimneySmoke } from './village/village-chimney-smoke.js';
import { updateWindmillRotor } from './windmill/windmill-rotor.js';

/** Runs every world system for one simulation step; train arguments are read by later slots. */
export function updateWorld(world, elapsed, dt, trainPosition, trainMotion) {
  updateStationClock(world, elapsed);
  const residentEvent = world.villageResidents?.update(elapsed, dt) ?? null;
  if (residentEvent !== null) console.log(residentEvent);
  updateChimneySmoke(world.houseSmoke, elapsed, dt);
  updateWindmillRotor(world, dt);
}
