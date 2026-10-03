// Per-frame world systems in a fixed order: station clock, track sheep, flock, (station walker),
// village residents, their log line (then the traveler's), (idle travelers), chimney smoke,
// windmill rotor, (clouds, balloon). Bracketed systems slot in at those positions as they are built.
import { updateStationClock } from './station/station-wall-clock.js';
import { updateChimneySmoke } from './village/village-chimney-smoke.js';
import { updateWindmillRotor } from './windmill/windmill-rotor.js';
import { advanceTrackSheepFlock } from '../life/sheep/track-sheep-escape-state-machine.js';
import { updateSheepFlock } from '../life/sheep/sheep-locomotion-and-route-motion.js';

/** Runs every world system for one simulation step; the sheep read the train's {distance, speed, length}. */
export function updateWorld(world, elapsed, dt, trainPosition, trainMotion) {
  updateStationClock(world, elapsed);
  // Partial test builds have no flock.
  if (world.sheep !== null) {
    advanceTrackSheepFlock(world, trainMotion, dt);
    updateSheepFlock(world, elapsed, dt);
  }
  const residentEvent = world.villageResidents?.update(elapsed, dt) ?? null;
  if (residentEvent !== null) console.log(residentEvent);
  updateChimneySmoke(world.houseSmoke, elapsed, dt);
  updateWindmillRotor(world, dt);
}
