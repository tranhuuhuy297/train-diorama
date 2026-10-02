// Behaviour checks for the chimney smoke pool, driven from the spec formulas (restated here, not imported)
// so a drift in the pool's interval, gate or lifetime fails even when the oracle comparison is skipped.
import assert from 'node:assert/strict';

const specPuffInterval = (speed, stopTimer) => (stopTimer > 0 ? 0.55 : Math.max(0.07, 0.3 - speed * 0.03)) / 1.2;
const [PUFF_LIFE_MIN, PUFF_LIFE_MAX] = [2.4, 3.6];
const CRUISE_SPEED_FLOOR = 7.4;

/** Call `record(frame)` after each fixed-dt step: logs spawns (with the state the pool saw), live count, gate, speed. */
export function trackPuffs(ctx, dt) {
  const log = { dt, spawns: [], live: [], gate: [], speed: [] };
  let lives = ctx.puffs.map(puff => puff.life);
  log.record = frame => {
    if (ctx.puffs.some((puff, index) => lives[index] <= 0 && puff.life > 0)) {
      log.spawns.push({ frame, interval: specPuffInterval(ctx.speed, ctx.stopTimer), dwelling: ctx.stopTimer > 0 });
    }
    lives = ctx.puffs.map(puff => puff.life);
    log.live.push(lives.filter(life => life > 0).length);
    log.gate.push(ctx.speed > 0.1 || ctx.stopTimer > 0);
    log.speed.push(ctx.speed);
  };
  return log;
}

// Each gap between spawns with the gate held throughout is the interval rounded up to whole frames.
function assertEmissionGaps({ dt, spawns, gate }, expectedDwellGaps) {
  let dwellGaps = 0;
  for (let index = 1; index < spawns.length; index++) {
    const [from, to] = [spawns[index - 1], spawns[index]];
    if (!gate.slice(from.frame, to.frame).every(Boolean)) continue;
    const gap = (to.frame - from.frame) * dt;
    assert.ok(gap >= from.interval - 1e-9 && gap < from.interval + dt, `puff gap ${gap} s vs ${from.interval} s at frame ${to.frame}`);
    if (from.dwelling) dwellGaps++;
  }
  assert.equal(dwellGaps, expectedDwellGaps, 'dwell gaps of 0.55/1.2 s checked');
}

// Live count lies between the spawns of the last 2.4 s (all still alive) and of the last 3.6 s (one frame slack).
function assertLifetimeWindow({ dt, spawns, live }) {
  const frames = seconds => Math.round(seconds / dt);
  const spawnedWithin = (frame, count) => spawns.filter(spawn => spawn.frame > frame - count && spawn.frame <= frame).length;
  live.forEach((count, index) => {
    const atLeast = spawnedWithin(index + 1, frames(PUFF_LIFE_MIN) - 1);
    const atMost = spawnedWithin(index + 1, frames(PUFF_LIFE_MAX));
    if (count < atLeast || count > atMost) assert.fail(`${count} live puffs at frame ${index + 1}, expected ${atLeast}..${atMost}`);
  });
}

// After 3.6 s at cruise speed the pool holds about mean lifetime ÷ emission gap puffs.
function assertCruiseSteadyState({ dt, live, speed }) {
  const cruiseGap = Math.ceil(specPuffInterval(CRUISE_SPEED_FLOOR, 0) / dt) * dt;
  const expected = (PUFF_LIFE_MIN + PUFF_LIFE_MAX) / 2 / cruiseGap;
  const steady = [];
  let fastFrames = 0;
  speed.forEach((value, index) => {
    fastFrames = value >= CRUISE_SPEED_FLOOR ? fastFrames + 1 : 0;
    if (fastFrames * dt > PUFF_LIFE_MAX) steady.push(live[index]);
  });
  const mean = steady.reduce((sum, count) => sum + count, 0) / steady.length;
  assert.ok(steady.length > 1000 && Math.abs(mean - expected) < 2, `steady cruise: ${mean} live puffs over ${steady.length} frames vs ${expected}`);
}

/** Smoke never stops, gaps follow the interval, lifetimes stay in range, cruise reaches its steady state. */
export function assertPuffBehaviour(log, { expectedDwellGaps }) {
  assert.ok(log.live.every(count => count > 0), 'a live puff on every frame');
  assertEmissionGaps(log, expectedDwellGaps);
  assertLifetimeWindow(log);
  assertCruiseSteadyState(log);
}
