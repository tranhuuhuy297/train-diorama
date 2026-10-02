// Hint-rotation cases for the loading runner, split out to keep each file under the line budget.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runLoadingSteps, LOADING_HINTS } from '../../src/ui/loading-screen-step-runner.js';
import { installLoadingScreenFixture, makeSteps, flushMicrotasks, runToCompletion } from './loading-screen-test-fixtures.mjs';

const fixture = installLoadingScreenFixture();

test('hints rotate every 2600ms while a step is still pending, and wrap at the end', async () => {
  test.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  // A never-resolving run() holds the loop on this step indefinitely, so the rotation
  // is proven to advance independently of step completion (not just between steps).
  const promise = runLoadingSteps(makeSteps(() => new Promise(() => {})));
  await flushMicrotasks();
  await fixture.flushFrame();
  await fixture.flushFrame();

  test.mock.timers.tick(2600);
  await flushMicrotasks();
  assert.equal(fixture.elements()['load-hint'].textContent, LOADING_HINTS[1]);
  test.mock.timers.tick(2600 * 4);
  await flushMicrotasks();
  assert.equal(fixture.elements()['load-hint'].textContent, LOADING_HINTS[0]);

  void promise; // intentionally never settles in this case
  test.mock.timers.reset();
});

test('hint rotation stops once the runner completes', async () => {
  test.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  const { promise } = await runToCompletion(runLoadingSteps, fixture.flushFrame);
  // Two separate ticks: the 420ms wait is only scheduled once the 260ms wait resolves.
  test.mock.timers.tick(260);
  await flushMicrotasks();
  test.mock.timers.tick(420);
  await flushMicrotasks();
  await promise;
  const settled = fixture.elements()['load-hint'].textContent;
  test.mock.timers.tick(2600);
  await flushMicrotasks();
  assert.equal(fixture.elements()['load-hint'].textContent, settled);
  test.mock.timers.reset();
});
