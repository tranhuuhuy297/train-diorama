// Per-frame world systems in a fixed order: station clock, track sheep, flock, station walker,
// village residents, their log lines (resident first, then traveler), idle travelers and head-look,
// chimney smoke, windmill rotor, cloud drift, balloon flight.
import { updateStationClock } from './station/station-wall-clock.js';
import { updateChimneySmoke } from './village/village-chimney-smoke.js';
import { updateWindmillRotor } from './windmill/windmill-rotor.js';
import { advanceTrackSheepFlock } from '../life/sheep/track-sheep-escape-state-machine.js';
import { updateSheepFlock } from '../life/sheep/sheep-locomotion-and-route-motion.js';
import { updateCloudDrift } from './sky/cloud-drift-fade-and-camera-avoidance.js';
import { updateBalloonFlight } from './balloon/hot-air-balloon-burner-flame-and-flight.js';
import { updateStationTravelers } from '../life/station/station-travelers-idle-and-head-look.js';

/** Runs every world system for one simulation step; the sheep read the train's {distance, speed, length}. */
export function updateWorld(world, elapsed, dt, trainPosition, trainMotion) {
  updateStationClock(world, elapsed);
  // Partial test builds have no flock.
  if (world.sheep !== null) {
    advanceTrackSheepFlock(world, trainMotion, dt);
    updateSheepFlock(world, elapsed, dt);
  }
  const travelerEvent = world.stationWalker.update(dt);
  const residentEvent = world.villageResidents?.update(elapsed, dt) ?? null;
  if (residentEvent !== null) console.log(residentEvent);
  if (travelerEvent !== undefined) console.log(travelerEvent);
  updateStationTravelers(world, elapsed, dt, trainPosition);
  updateChimneySmoke(world.houseSmoke, elapsed, dt);
  updateWindmillRotor(world, dt);
  updateCloudDrift(world.clouds, dt);
  updateBalloonFlight(world, elapsed);
}
