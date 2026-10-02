// Station-stop motion, brake strength and smoke interval: pure functions checked against exact goldens
// measured on the original track (length and stop distance below).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initTrainMotion, stepTrainStationMotion, computeBrakeStrength } from '../../src/train/train-station-motion-controller.js';
import { puffEmissionInterval } from '../../src/train/locomotive-smoke-puff-pool.js';

const L = 276.13647750761754;
const S = 236.45464110639873;
const DT = 1 / 60;

// `a` units before the stop; expectations always use the same double-remainder distance as the code.
const stateBefore = (a, fields = {}) => ({ s: S - a, speed: 0, stopTimer: 0, justLeft: false, speedMul: 1, ...fields });
const aheadOf = state => (((S - state.s) % L) + L) % L;
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-12, `${label}: ${actual} vs ${expected}`);

test('cruise: accelerates toward 7.5 x speedMul without braking', () => {
  const state = stateBefore(200);
  const s0 = state.s;
  const result = stepTrainStationMotion(state, 0.1, L, S);
  assert.equal(state.speed, 0.675);
  assert.equal(state.s, s0 + 0.675 * 0.1);
  assert.deepEqual(result, { stationBraking: false, previousSpeed: 0 });
});

test('justLeft clears only strictly inside (30, L - 30)', () => {
  for (const [a, expected] of [[20, true], [31, false], [L - 29, true], [30, true]]) {
    const state = stateBefore(a, { justLeft: true, speed: 5 });
    const { stationBraking } = stepTrainStationMotion(state, DT, L, S);
    assert.equal(state.justLeft, expected, `a = ${a}`);
    assert.equal(stationBraking, false, `a = ${a}`);
  }
});

test('braking follows the square-root profile', () => {
  const state = stateBefore(13, { speed: 7.5 });
  const ahead = aheadOf(state);
  const { stationBraking } = stepTrainStationMotion(state, DT, L, S);
  assert.equal(stationBraking, true);
  assert.equal(state.speed, 7.5 * Math.sqrt(ahead / 26));
  near(state.speed, 5.303300858899107, 'profile speed');
});

test('creep floor 0.35 without a snap while the step is shorter than the gap', () => {
  const state = stateBefore(0.01, { speed: 1 });
  const s0 = state.s;
  stepTrainStationMotion(state, DT, L, S);
  assert.equal(state.speed, 0.35);
  assert.equal(state.stopTimer, 0);
  assert.equal(state.s, s0 + 0.35 * DT);
});

test('snap lands exactly on the stop and starts the 4 s dwell', () => {
  const state = stateBefore(0.004, { speed: 0.35 });
  const ahead = aheadOf(state);
  const s0 = state.s;
  stepTrainStationMotion(state, DT, L, S);
  assert.equal(state.s, s0 + ahead);
  assert.equal(state.stopTimer, 4);
  assert.equal(state.speed, 0);
});

function dwellFrames(dt) {
  const state = stateBefore(0.004, { speed: 0.35 });
  stepTrainStationMotion(state, dt, L, S);
  const parkedAt = state.s;
  let frames = 0;
  while (state.stopTimer > 0) {
    frames++;
    const { stationBraking } = stepTrainStationMotion(state, dt, L, S);
    assert.equal(stationBraking, false);
    assert.equal(state.speed, 0);
    assert.equal(state.s, parkedAt);
    assert.equal(state.justLeft, state.stopTimer <= 0, `justLeft only on the last dwell frame (${frames})`);
  }
  stepTrainStationMotion(state, dt, L, S);
  assert.ok(state.speed > 0 && state.s > parkedAt, 'the next frame departs');
  return frames;
}

test('dwell lasts 241 frames at 1/60, 81 at 0.05 and 121 at 1/30', () => {
  assert.equal(dwellFrames(DT), 241);
  assert.equal(dwellFrames(0.05), 81);
  assert.equal(dwellFrames(1 / 30), 121);
});

test('speedMul 0 coasts down and never brakes or snaps', () => {
  const state = stateBefore(10, { speed: 3, speedMul: 0 });
  for (let frame = 0; frame < 600; frame++) {
    const previous = state.speed;
    const { stationBraking } = stepTrainStationMotion(state, DT, L, S);
    assert.equal(stationBraking, false);
    assert.equal(state.speed, previous + (0 - previous) * (DT * 0.9));
    near(state.speed, previous * (1 - 0.015), `frame ${frame}`);
    assert.equal(state.stopTimer, 0);
  }
});

test('lowering the slider mid-brake clamps speed and saturates the strength', () => {
  const state = stateBefore(20, { speed: 7.5, speedMul: 0.5 });
  const ahead = aheadOf(state);
  const { stationBraking, previousSpeed } = stepTrainStationMotion(state, DT, L, S);
  assert.equal(state.speed, 3.75 * Math.sqrt(ahead / 26));
  assert.equal(computeBrakeStrength(stationBraking, state.speed, previousSpeed, DT), 1);
});

test('computeBrakeStrength gates and caps', () => {
  assert.equal(computeBrakeStrength(true, 5, 5.1, DT), 1);
  near(computeBrakeStrength(true, 5, 5.01, DT), 0.2, 'mild deceleration');
  assert.equal(computeBrakeStrength(false, 5, 5.1, DT), 0);
  assert.equal(computeBrakeStrength(true, 0.1, 0.5, DT), 0);
  assert.equal(computeBrakeStrength(true, 5, 5, DT), 0);
  assert.equal(computeBrakeStrength(true, 5.2, 5, DT), 0);
  assert.equal(computeBrakeStrength(true, 1, 2, 0), 1, 'dt 0 divides to Infinity, then caps');
});

// Runs from the initial state (no warm-up step); frame numbers are 1-based.
function runLaps(frames, speedMulAt) {
  const state = { stopTimer: 0, speedMul: 1 };
  initTrainMotion(state, S);
  const log = { brakeStarts: [], snaps: [], departures: [], maxStrength: 0 };
  let wasBraking = false;
  for (let frame = 1; frame <= frames; frame++) {
    state.speedMul = speedMulAt(frame);
    const before = { justLeft: state.justLeft, stopTimer: state.stopTimer };
    const { stationBraking, previousSpeed } = stepTrainStationMotion(state, DT, L, S);
    log.maxStrength = Math.max(log.maxStrength, computeBrakeStrength(stationBraking, state.speed, previousSpeed, DT));
    if (stationBraking && !wasBraking) log.brakeStarts.push(frame);
    wasBraking = stationBraking;
    if (state.stopTimer > 0 && before.stopTimer <= 0) log.snaps.push(frame);
    if (state.justLeft && !before.justLeft) log.departures.push(frame);
  }
  return { state, log };
}

test('lap goldens at speedMul 1, 2.5 and 0.5', () => {
  const cases = [
    [1, 2043, 2447, 2688, 2713, 0.3697119847898378],
    [2.5, 857, 1019, 1260, 1270, 1],
    [0.5, 4018, 4809, 5050, 5101, 0.09072454929807905],
  ];
  for (const [speedMul, brake, snap, departure, period, strength] of cases) {
    const { log } = runLaps(11000, () => speedMul);
    assert.equal(log.brakeStarts[0], brake, `brake start at x${speedMul}`);
    assert.equal(log.snaps[0], snap, `first snap at x${speedMul}`);
    assert.equal(log.departures[0], departure, `departure at x${speedMul}`);
    assert.equal(log.snaps[1] - log.snaps[0], period, `snap period at x${speedMul}`);
    near(log.maxStrength, strength, `max strength at x${speedMul}`);
  }
});

test('slider schedule 1 -> 2.5 -> 0 -> 0.5 -> 1 over 18000 frames', () => {
  const schedule = frame => (frame >= 14401 ? 1 : frame >= 10801 ? 0.5 : frame >= 7201 ? 0 : frame >= 3601 ? 2.5 : 1);
  const { state, log } = runLaps(18000, schedule);
  assert.deepEqual(log.snaps, [2447, 4265, 5535, 6805, 14673, 17386]);
  assert.deepEqual(log.brakeStarts, [2043, 4103, 5374, 6644, 14099, 16982]);
  assert.equal(state.s, 1931.719412252672);
  assert.equal(state.speed, 7.473283765979822);
  assert.equal(state.stopTimer, -0.01666666666665746);
  assert.equal(state.justLeft, false);
});

test('puff emission interval', () => {
  assert.equal(puffEmissionInterval(0, 1), 0.55 / 1.2);
  assert.equal(puffEmissionInterval(7.5, 0), Math.max(0.07, 0.3 - 7.5 * 0.03) / 1.2);
  near(puffEmissionInterval(7.5, 0), 0.0625, 'cruise interval');
  assert.equal(puffEmissionInterval(18.75, 0), 0.07 / 1.2);
  assert.equal(puffEmissionInterval(0, 0), 0.3 / 1.2);
});
