// Route-hook failures on the original must surface as their own error, not as the readiness timeout
// that follows from the aborted entry module.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ORIGINAL_HOOK_ANCHOR, installOriginalRouteHooks, awaitReadinessOrHookError } from '../../tools/parity/original-site-route-hooks.mjs';

const NEVER = () => new Promise(() => {});

// Records the single route handler the hook registers, like a Playwright BrowserContext.
async function hookedContext() {
  const context = { pattern: null, handler: null, async route(pattern, handler) { Object.assign(context, { pattern, handler }); } };
  const state = await installOriginalRouteHooks(context);
  return { context, state };
}

// One intercepted request: either fetch() rejects with fetchError or it serves source.
function interceptedRequest({ source = '', fetchError = null } = {}) {
  const request = { fulfilled: null, aborted: null };
  const response = {
    text: async () => source, status: () => 200,
    headers: () => ({ 'content-length': '1', 'Content-Encoding': 'br', 'cache-control': 'no-store' }),
  };
  request.route = {
    fetch: async () => { if (fetchError) throw fetchError; return response; },
    fulfill: async options => { request.fulfilled = options; },
    abort: async reason => { request.aborted = reason; },
  };
  return request;
}

test('a patched entry module lets readiness through', async () => {
  const { context, state } = await hookedContext();
  assert.equal(context.pattern, '**/TrainScene.js');
  const request = interceptedRequest({ source: `boot();\n${ORIGINAL_HOOK_ANCHOR}\nrun();` });
  await context.handler(request.route);
  await awaitReadinessOrHookError(Promise.resolve(), state);
  assert.equal(state.patched, true);
  assert.equal(request.fulfilled.status, 200);
  assert.deepEqual(request.fulfilled.headers, { 'cache-control': 'no-store', 'content-type': 'text/javascript' });
  assert.match(request.fulfilled.body, /\[PARITY\] Hook installed: /);
});

test('an anchor mismatch rejects at once although readiness never settles', async () => {
  const { context, state } = await hookedContext();
  const waiting = awaitReadinessOrHookError(NEVER(), state);
  const request = interceptedRequest({ source: 'boot();' });
  await context.handler(request.route);
  await assert.rejects(waiting, /expected exactly one "diorama\.prepareOverviewIntro\(\);", found 0/);
  assert.equal(request.aborted, 'failed');
  assert.equal(state.patched, false);
});

test('a fetch failure is the error reported', async () => {
  const { context, state } = await hookedContext();
  const fetchError = new Error('net::ERR_CONNECTION_RESET');
  await context.handler(interceptedRequest({ fetchError }).route);
  await assert.rejects(awaitReadinessOrHookError(NEVER(), state), error => error === fetchError);
});

test('a readiness timeout without any intercepted request reports the missing patch', async () => {
  const { state } = await hookedContext();
  await assert.rejects(awaitReadinessOrHookError(Promise.reject(new Error('Timeout 180000ms exceeded')), state), /was never patched/);
});

test('a readiness timeout after a clean patch keeps the timeout error', async () => {
  const { context, state } = await hookedContext();
  await context.handler(interceptedRequest({ source: ORIGINAL_HOOK_ANCHOR }).route);
  await assert.rejects(awaitReadinessOrHookError(Promise.reject(new Error('Timeout 180000ms exceeded')), state), /Timeout 180000ms/);
});

test('the clone (no hook state) passes readiness through unchanged', async () => {
  assert.equal(await awaitReadinessOrHookError(Promise.resolve('ready'), null), 'ready');
  await assert.rejects(awaitReadinessOrHookError(Promise.reject(new Error('clone timeout')), null), /clone timeout/);
});
