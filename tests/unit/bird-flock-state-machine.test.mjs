// Bird flock decisions as plain data: the transition table with its time boundaries and capture flags,
// and the train-proximity snapshot (moving threshold, reach scaling with speed, loop wrap, x/z-only cars).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { decideBirdFlock, computeFlockSnapshot } from '../../src/life/birds/bird-flock-state-machine.js';
import { positiveModulo } from '../../src/core/scalar-math-helpers.js';

const state = (mode, changedAt = 0) => ({ id: 'bridge-2', mode, changedAt });
const snap = (approaching, clear) => ({ approaching, clear });
const car = (x, y, z) => ({ obj: { position: { x, y, z } } });
const flock = (trackDistance, center = { x: 0, y: 0, z: 0 }) => ({ trackDistance, center });
const LOOP = 276.13647750761754;

describe('decideBirdFlock', () => {
  test('perched takes off only when the train approaches', () => {
    const resting = state('perched', 3);
    assert.equal(decideBirdFlock(snap(false, true), 10, resting), null);
    assert.deepEqual(resting, state('perched', 3), 'null keeps the state');
    const intent = decideBirdFlock(snap(true, false), 10, resting);
    assert.deepEqual(intent, { owner: 'bridge-2', log: '[BIRDS] Take off: bridge-2, train approaches' });
    assert.deepEqual(resting, state('flying', 10));
  });

  test('flying returns strictly after 7 s once the track is clear, capturing the return start', () => {
    assert.equal(decideBirdFlock(snap(false, true), 7, state('flying', 0)), null, 'exactly 7 s is not enough');
    assert.equal(decideBirdFlock(snap(false, false), 30, state('flying', 0)), null, 'not clear');
    assert.equal(decideBirdFlock(snap(true, false), 30, state('flying', 0)), null, 'approaching does not restart a flight');
    const flying = state('flying', 0);
    const intent = decideBirdFlock(snap(false, true), 7.000001, flying);
    assert.deepEqual(intent, { owner: 'bridge-2', log: '[BIRDS] Return: bridge-2, track clear', captureReturn: true });
    assert.deepEqual(flying, state('returning', 7.000001));
  });

  test('returning lands at 3.6 s unless the track stops being clear', () => {
    assert.equal(decideBirdFlock(snap(false, true), 3.59, state('returning', 0)), null);
    const landing = state('returning', 0);
    assert.deepEqual(decideBirdFlock(snap(false, true), 3.6, landing), { owner: 'bridge-2', log: '[BIRDS] Perch: bridge-2' });
    assert.deepEqual(landing, state('perched', 3.6));
    const interrupted = state('returning', 10);
    const intent = decideBirdFlock(snap(false, false), 20, interrupted);
    assert.deepEqual(intent, { owner: 'bridge-2', log: '[BIRDS] Take off: bridge-2, train interrupts landing', captureDeparture: true });
    assert.deepEqual(interrupted, state('flying', 20), 'the interrupt wins over the landing rule');
  });

  test('one transition per call, with the owner taken from the state id', () => {
    const resting = { id: 'trackside-4', mode: 'perched', changedAt: 0 };
    assert.equal(decideBirdFlock(snap(true, true), 50, resting).owner, 'trackside-4');
    assert.equal(resting.mode, 'flying');
    assert.equal(decideBirdFlock(snap(true, true), 50, resting), null, 'no second hop in the same frame');
    assert.equal(decideBirdFlock(snap(true, true), 50, { id: 'x', mode: 'asleep', changedAt: 0 }), null);
  });
});

describe('computeFlockSnapshot', () => {
  test('a train at or below 0.2 never alarms; just above it does within 19 m', () => {
    assert.equal(computeFlockSnapshot(flock(100), 100 - 1, 0.2, [], LOOP).approaching, false);
    assert.equal(computeFlockSnapshot(flock(100), 100 - 18.99, 0.21, [], LOOP).approaching, true);
    assert.equal(computeFlockSnapshot(flock(100), 100 - 19, 0.21, [], LOOP).approaching, false);
  });

  test('reach grows with speed: 25 m to alarm and 30 m to clear at 10 m/s', () => {
    const at = ahead => computeFlockSnapshot(flock(100), 100 - ahead, 10, [], LOOP);
    assert.deepEqual([at(24.9).approaching, at(25.1).approaching], [true, false]);
    assert.deepEqual([at(29.9).clear, at(30.1).clear], [false, true]);
  });

  test('ahead wraps around the loop', () => {
    // Perch at 5, train at 270: 11.14 m ahead after wrapping.
    const near = computeFlockSnapshot(flock(5), 270, 1, [], LOOP);
    assert.equal(near.approaching, true);
    assert.equal(computeFlockSnapshot(flock(5), 270 - 8, 1, [], LOOP).approaching, false, '19.14 m is out of reach');
    assert.ok(Math.abs(positiveModulo(5 - 270, LOOP) - 11.1365) < 1e-4);
    // The clear limit (26) seen across the seam: 25.9965 m ahead is not clear, 26.1365 m is.
    assert.equal(computeFlockSnapshot(flock(5), 270 - 14.86, 1, [], LOOP).clear, false);
    assert.equal(computeFlockSnapshot(flock(5), 270 - 15, 1, [], LOOP).clear, true);
  });

  test('cars count by x/z distance only; no cars means nothing is near', () => {
    const lofty = [car(0, 500, 11)];
    const result = computeFlockSnapshot(flock(200), 0, 0, lofty, LOOP);
    assert.deepEqual(result, { approaching: false, clear: false }, 'standing train: no alarm, but a car within 24 m');
    assert.equal(computeFlockSnapshot(flock(200), 0, 1, lofty, LOOP).approaching, true, 'moving: a car within 12 m alarms');
    assert.deepEqual(computeFlockSnapshot(flock(200), 0, 0, [], LOOP), { approaching: false, clear: true });
    assert.equal(computeFlockSnapshot(flock(200), 0, 0, [car(30, 0, 0), car(0, 0, 24.5)], LOOP).clear, true);
  });

  test('clear needs no moving train within max(26, 3v) ahead', () => {
    const cars = [car(100, 0, 100)];
    assert.equal(computeFlockSnapshot(flock(100), 100 - 25, 0.5, cars, LOOP).clear, false);
    assert.equal(computeFlockSnapshot(flock(100), 100 - 27, 0.5, cars, LOOP).clear, true);
    assert.equal(computeFlockSnapshot(flock(100), 100 - 1, 0, cars, LOOP).clear, true, 'a standing train ahead is clear');
  });

  test('writes into and returns the given target', () => {
    const target = { approaching: true, clear: true };
    const result = computeFlockSnapshot(flock(100), 99, 5, [], LOOP, target);
    assert.equal(result, target);
    assert.deepEqual(target, { approaching: true, clear: false });
    computeFlockSnapshot(flock(100), 0, 0, [], LOOP, target);
    assert.deepEqual(target, { approaching: false, clear: true });
  });
});
