// Track-sheep state machine in plain node: danger windows, reaction delay, same-step jumps, the escape
// and return walks with exact arrival, clamps, the flock loop, and a fuzz run against the original.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { TRACK_SHEEP_PRESETS, advanceTrackSheep, advanceTrackSheepFlock } from '../../src/life/sheep/track-sheep-escape-state-machine.js';
import { positiveModulo } from '../../src/core/scalar-math-helpers.js';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { originalSkipReason, importOriginal } from '../helpers/original-module-loader.mjs';

const L = 276.136;
const TRAIN_LENGTH = 25.65;
const ROUTE_FIELDS = ['mode', 'offset', 'along', 'across', 'speed', 'clearTime', 'reactionTime', 'hopAge'];
const STARTLES = id => `[SHEEP] Startles: approaching train, sheep ${id}`;
const JUMPS = id => `[SHEEP] Jumps off track: sheep ${id}`;
const RETURNS = id => `[SHEEP] Returns to track: train clear, sheep ${id}`;

function makeRoute(i, distance = 100, presets = TRACK_SHEEP_PRESETS) {
  const preset = presets[i];
  return {
    id: i + 1, preset, distance, center: { x: 0, y: 0, z: 0 }, tangent: { x: 1, y: 0, z: 0 }, outward: { x: 0, y: 0, z: -1 },
    offset: 0, along: 0, across: preset.lateralBias, mode: 'track', speed: 0, clearTime: 0, reactionTime: 0, hopAge: preset.hopDuration + 0.3,
  };
}

// A train whose nose is `ahead` metres before a sheep standing at distance 100.
const trainAhead = (ahead, speed = 3) => ({ distance: 100 - ahead, speed, length: TRAIN_LENGTH });
const FAR = trainAhead(150);
const step = (route, train, dt = 0.1) => advanceTrackSheep(route, train, L, dt);

describe('track sheep state machine', () => {
  test('danger ahead startles the sheep and starts its reaction delay', () => {
    const route = makeRoute(1);
    assert.equal(step(route, trainAhead(15)), STARTLES(2));
    assert.deepEqual([route.mode, route.reactionTime, route.clearTime, route.offset], ['startled', 0.38 - 0.1, 0, 0]);
  });

  test('the hop starts once the reaction delay runs out, moving in that same step', () => {
    const route = makeRoute(1);
    for (let call = 1; call <= 3; call++) {
      step(route, trainAhead(15));
      assert.equal(route.mode, 'startled', `call ${call}`);
    }
    assert.equal(step(route, trainAhead(15)), JUMPS(2));
    const moved = Math.sign(3.5) * Math.min(3.5, 3.4 * 0.1);
    assert.deepEqual([route.mode, route.hopAge, route.offset, route.speed], ['escaping', 0, moved, Math.abs(moved) / 0.1]);
  });

  test('a reaction delay shorter than the step jumps at once and logs only the jump', () => {
    assert.equal(step(makeRoute(0), trainAhead(15)), JUMPS(1));
    const slow = makeRoute(0);
    assert.equal(step(slow, trainAhead(15), 0.05), STARTLES(1));
    assert.equal(step(slow, trainAhead(15), 0.05), JUMPS(1));
  });

  test('a train right in front, or its tail just past, forces an immediate jump', () => {
    const close = makeRoute(1);
    assert.equal(step(close, trainAhead(4)), JUMPS(2));
    assert.equal(close.mode, 'escaping');
    const tail = makeRoute(1);
    assert.equal(step(tail, trainAhead(-30)), JUMPS(2));
    const clear = makeRoute(1);
    assert.equal(step(clear, trainAhead(-31)), null);
    assert.deepEqual([clear.mode, clear.clearTime], ['track', 0.1]);
  });

  test('the warning reach grows with train speed', () => {
    const fast = makeRoute(2);
    assert.equal(step(fast, trainAhead(30, 10)), STARTLES(3));
    const slow = makeRoute(2);
    assert.equal(step(slow, trainAhead(30, 5)), null);
  });

  test('distances wrap around the loop, also for an unbounded train distance', () => {
    assert.ok(positiveModulo(5 - 270, L) < 18);
    for (const distance of [270, 270 + 3 * L]) {
      const route = makeRoute(1, 5);
      assert.equal(step(route, { distance, speed: 3, length: TRAIN_LENGTH }), STARTLES(2));
    }
  });

  test('a startle cannot be called off, and more danger does not restart the delay', () => {
    const route = makeRoute(2);
    step(route, trainAhead(15));
    assert.equal(step(route, FAR), JUMPS(3));
    const held = makeRoute(1);
    step(held, trainAhead(15));
    assert.equal(step(held, trainAhead(15)), null);
    assert.equal(held.reactionTime, 0.38 - 0.1 - 0.1);
  });

  test('escaping walks at escape speed and lands exactly on the safe spot', () => {
    const route = Object.assign(makeRoute(0), { mode: 'escaping' });
    let calls = 0;
    while (route.mode === 'escaping') {
      const before = route.offset;
      step(route, FAR);
      calls++;
      if (route.mode === 'escaping') assert.equal(route.offset, before + 3.8 * 0.1);
    }
    assert.deepEqual([route.mode, route.offset, calls], ['waiting', 3.5, 10]);
  });

  test('waiting sheep return after the clear delay and stop exactly on the track', () => {
    const route = Object.assign(makeRoute(0), { mode: 'waiting', offset: 3.5, clearTime: 2 });
    assert.equal(step(route, trainAhead(15)), null);
    assert.deepEqual([route.mode, route.clearTime, route.offset], ['waiting', 0, 3.5]);
    const events = [];
    for (let call = 1; call <= 51; call++) events.push(step(route, FAR));
    assert.deepEqual(events.slice(0, 50), new Array(50).fill(null));
    assert.equal(events[50], RETURNS(1));
    assert.deepEqual([route.mode, route.offset], ['returning', 3.5 - 0.65 * 0.1]);
    while (route.mode === 'returning') step(route, FAR);
    assert.deepEqual([route.mode, route.offset], ['track', 0]);
  });

  test('new danger while returning startles again and holds the offset', () => {
    const route = Object.assign(makeRoute(1), { mode: 'returning', offset: 2 });
    assert.equal(step(route, trainAhead(15)), STARTLES(2));
    assert.deepEqual([route.mode, route.offset, route.reactionTime, route.speed], ['startled', 2, 0.38 - 0.1, 0]);
  });

  test('danger while escaping only resets the clear timer', () => {
    const route = Object.assign(makeRoute(2), { mode: 'escaping', clearTime: 3 });
    assert.equal(step(route, trainAhead(15)), null);
    assert.deepEqual([route.mode, route.clearTime], ['escaping', 0]);
  });

  test('hop age is clamped and a zero step reports zero speed', () => {
    const route = makeRoute(0);
    step(route, FAR);
    assert.equal(route.hopAge, 0.64 + 0.3);
    const jumping = Object.assign(makeRoute(0), { mode: 'escaping' });
    assert.equal(step(jumping, FAR, 0), null);
    assert.deepEqual([jumping.speed, jumping.offset], [0, 0]);
  });

  test('the flock loop logs each event once and hands pace and heading to the sheep', t => {
    const log = t.mock.method(console, 'log', () => {});
    const route = makeRoute(1);
    const sheep = { route, speed: -1, direction: -1 };
    const world = { trackSheep: [sheep], length: L };
    const heading = Math.atan2(route.outward.x, route.outward.z);
    advanceTrackSheepFlock(world, trainAhead(15), 0.1);
    assert.deepEqual(log.mock.calls.map(call => call.arguments), [[STARTLES(2)]]);
    assert.deepEqual([sheep.speed, sheep.direction], [route.speed, heading]);
    Object.assign(route, { mode: 'waiting', offset: 3.5, clearTime: 6.3 });
    advanceTrackSheepFlock(world, FAR, 0.1);
    assert.equal(log.mock.callCount(), 2);
    assert.deepEqual([route.mode, sheep.speed, sheep.direction], ['returning', route.speed, heading + Math.PI]);
    advanceTrackSheepFlock(world, FAR, 0.1);
    assert.equal(log.mock.callCount(), 2);
  });
});

const fuzzSkip = originalSkipReason(['TrackSheep.js']);

describe('track sheep state machine against the original', { skip: fuzzSkip }, () => {
  test('presets match and 3 x 20 000 random steps agree exactly', async () => {
    const original = await importOriginal('TrackSheep.js');
    assert.deepStrictEqual(TRACK_SHEEP_PRESETS, original.TRACK_SHEEP_PRESETS);
    const draw = mulberry32(99);
    const modes = new Set();
    for (let index = 0; index < 3; index++) {
      const [mine, theirs] = [makeRoute(index), makeRoute(index, 100, original.TRACK_SHEEP_PRESETS)];
      const train = { distance: 0, speed: 0, length: TRAIN_LENGTH };
      for (let call = 0; call < 20000; call++) {
        const stopped = draw() < 0.15;
        train.distance += stopped ? 0 : draw() * 1.9;
        train.speed = stopped ? 0 : draw() * 18.75;
        const dt = draw() < 0.05 ? 0 : draw() * 0.1;
        const expected = original.advanceTrackSheep(theirs, train, L, dt);
        assert.equal(advanceTrackSheep(mine, train, L, dt), expected, `sheep ${index + 1} call ${call}`);
        for (const field of ROUTE_FIELDS) {
          if (!Object.is(mine[field], theirs[field])) assert.fail(`sheep ${index + 1} call ${call} ${field}: ${mine[field]} vs ${theirs[field]}`);
        }
        modes.add(mine.mode);
      }
    }
    assert.equal(modes.size, 5, `modes visited: ${[...modes]}`);
  });
});
