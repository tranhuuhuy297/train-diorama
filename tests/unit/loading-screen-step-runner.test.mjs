// Fake-DOM scenario tests for the weighted loading runner's core reset/step/ready/fail paths.
// Hint-rotation cases live in loading-screen-hint-rotation.test.mjs (same shared fixture).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLoadingSteps, LOADING_HINTS } from '../../src/ui/loading-screen-step-runner.js';
import { installLoadingScreenFixture, makeSteps, flushMicrotasks, runToCompletion } from './loading-screen-test-fixtures.mjs';

const fixture = installLoadingScreenFixture();

test('initial reset state overwrites whatever was left from a previous run', async () => {
  test.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const promise = runLoadingSteps(makeSteps());
  await flushMicrotasks();
  const { loading, 'load-phase': phase, 'load-percent': percent, 'load-hint': hint } = fixture.elements();
  assert.equal(loading.hidden, false);
  assert.equal(loading.classList.contains('is-gone'), false);
  assert.equal(loading.getAttribute('aria-busy'), 'true');
  assert.equal(hint.textContent, LOADING_HINTS[0]);
  assert.equal(percent.textContent, '0%');
  assert.equal(loading.bar.fill.style.width, '0%');
  assert.equal(loading.bar.getAttribute('aria-valuenow'), '0');
  assert.equal(phase.textContent, 'LOADING ENGINE');
  assert.equal(loading.classList.contains('is-working'), true);
  void promise;
  test.mock.timers.reset();
});

test('step.run is awaited only after two animation frames', async () => {
  test.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let ran = false;
  const promise = runLoadingSteps(makeSteps(() => { ran = true; }));
  await flushMicrotasks();
  await fixture.flushFrame();
  assert.equal(ran, false);
  await fixture.flushFrame();
  assert.equal(ran, true);
  void promise;
  test.mock.timers.reset();
});

test('weights accumulate to 30, 90, 100 and is-working clears after every step', async () => {
  test.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const seenPercents = [];
  const promise = runLoadingSteps(makeSteps(() => { seenPercents.push(fixture.elements()['load-percent'].textContent); }));
  await flushMicrotasks();
  const expectedTotals = [30, 90, 100];
  for (let i = 0; i < 3; i += 1) {
    await fixture.flushFrame();
    await fixture.flushFrame();
    assert.equal(fixture.elements()['load-percent'].textContent, `${expectedTotals[i]}%`);
    assert.equal(fixture.elements().loading.bar.fill.style.width, `${expectedTotals[i]}%`);
    assert.equal(fixture.elements().loading.bar.getAttribute('aria-valuenow'), String(expectedTotals[i]));
  }
  assert.deepEqual(seenPercents, ['0%', '30%', '90%']);
  // The next step's is-working re-add can land in the same microtask drain as the previous
  // step's remove, so a point-in-time read can't see the dip; the full op log proves it happened:
  // reset() clears the dirty fixture first, then one add/remove pair per step.
  assert.deepEqual(fixture.workingLog(), ['remove', 'add', 'remove', 'add', 'remove', 'add', 'remove']);
  void promise;
  test.mock.timers.reset();
});

test('READY then is-gone after 260ms then hidden+aria-busy false after a further 420ms', async () => {
  test.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { promise } = await runToCompletion(runLoadingSteps, fixture.flushFrame);
  const elements = fixture.elements();
  assert.equal(elements['load-phase'].textContent, 'READY');
  test.mock.timers.tick(259);
  await flushMicrotasks();
  assert.equal(elements.loading.classList.contains('is-gone'), false);
  test.mock.timers.tick(1);
  await flushMicrotasks();
  assert.equal(elements.loading.classList.contains('is-gone'), true);
  test.mock.timers.tick(419);
  await flushMicrotasks();
  assert.equal(elements.loading.hidden, false);
  test.mock.timers.tick(1);
  await flushMicrotasks();
  assert.equal(elements.loading.hidden, true);
  assert.equal(elements.loading.getAttribute('aria-busy'), 'false');
  test.mock.timers.reset();
  await promise;
});

test('a failing step reports LOADING FAILED, keeps aria-busy true, and rethrows', async () => {
  test.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const promise = runLoadingSteps(makeSteps(() => { throw new Error('boom'); }));
  const rejection = assert.rejects(promise, /boom/); // attached before any await, so there is no unhandled-rejection window
  await flushMicrotasks();
  await fixture.flushFrame();
  await fixture.flushFrame();
  await flushMicrotasks();
  const elements = fixture.elements();
  assert.equal(elements['load-phase'].textContent, 'LOADING FAILED: boom');
  assert.equal(elements['load-hint'].textContent, 'Reload the page to try again.');
  assert.equal(elements.loading.classList.contains('is-working'), false);
  assert.equal(elements.loading.classList.contains('is-gone'), false);
  assert.equal(elements.loading.getAttribute('aria-busy'), 'true');
  await rejection;
  test.mock.timers.tick(2600);
  await flushMicrotasks();
  assert.equal(elements['load-hint'].textContent, 'Reload the page to try again.');
  test.mock.timers.reset();
});
