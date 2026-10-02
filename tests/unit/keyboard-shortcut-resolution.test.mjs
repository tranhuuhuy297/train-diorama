// Scenario tests for the pure resolver table and the window-level binder.
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { resolveKeyAction, isEditableTarget, bindKeyboardShortcuts } from '../../src/ui/keyboard-shortcuts.js';

const key = o => ({ key: '', code: '', repeat: false, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, target: null, ...o });
const overview = { mode: 'overview', flightLocked: false };

test('flight capture wins over filters while orbit and locked', () => {
  const ctx = { mode: 'orbit', flightLocked: true };
  assert.deepEqual(resolveKeyAction(key({ key: 'w', code: 'KeyW' }), ctx), { type: 'flight-key', code: 'KeyW' });
  assert.deepEqual(resolveKeyAction(key({ key: ' ', code: 'Space' }), ctx), { type: 'flight-key', code: 'Space' });
  assert.deepEqual(resolveKeyAction(key({ key: 'l', code: 'KeyL' }), ctx), { type: 'log-camera-pose' });
});

test('orbit unlocked space pauses; overview locked flight key is filtered', () => {
  assert.deepEqual(resolveKeyAction(key({ key: ' ' }), { mode: 'orbit', flightLocked: false }), { type: 'toggle-pause' });
  assert.equal(resolveKeyAction(key({ key: 'w' }), { mode: 'overview', flightLocked: true }), null);
});

test('repeat, modifier keys and editable targets are filtered to null', () => {
  const blockers = [{ repeat: true }, { metaKey: true }, { ctrlKey: true }, { altKey: true },
    { target: { tagName: 'INPUT' } }, { target: { tagName: 'SELECT' } }, { target: { tagName: 'TEXTAREA' } }, { target: { isContentEditable: true } }];
  for (const extra of blockers) assert.equal(resolveKeyAction(key({ key: 'h', ...extra }), overview), null);
});

test('shift held and non-editable targets pass through the filters', () => {
  assert.deepEqual(resolveKeyAction(key({ key: 'h', shiftKey: true }), overview), { type: 'toggle-hud' });
  assert.deepEqual(resolveKeyAction(key({ key: 'h', target: { tagName: 'BUTTON' } }), overview), { type: 'toggle-hud' });
});

test('digit keys resolve to the four mode ids; shifted digit does not match', () => {
  const modes = { 1: 'overview', 2: 'orbit', 3: 'side', 4: 'bridge' };
  for (const [digit, mode] of Object.entries(modes)) {
    assert.deepEqual(resolveKeyAction(key({ key: digit }), overview), { type: 'set-mode', mode });
  }
  assert.equal(resolveKeyAction(key({ key: '!' }), overview), null);
});

test('letter keys map to their actions', () => {
  const cases = [
    ['b', { type: 'bridge-camera' }], ['B', { type: 'bridge-camera' }],
    ['h', { type: 'toggle-hud' }], ['p', { type: 'toggle-pixel-art' }], ['o', { type: 'toggle-outline' }],
    ['x', { type: 'toggle-time-scale' }], ['t', { type: 'cycle-time-of-day', direction: 1 }],
    [' ', { type: 'toggle-pause' }], ['l', { type: 'log-camera-pose' }], ['L', { type: 'log-camera-pose' }],
  ];
  for (const [k, expected] of cases) assert.deepEqual(resolveKeyAction(key({ key: k }), overview), expected);
  assert.deepEqual(resolveKeyAction(key({ key: 'T', shiftKey: true }), overview), { type: 'cycle-time-of-day', direction: -1 });
});

test('unmapped keys resolve to null; undefined key throws (kept parity quirk)', () => {
  assert.equal(resolveKeyAction(key({ key: 'Escape' }), overview), null);
  assert.equal(resolveKeyAction(key({ key: 'z' }), overview), null);
  assert.throws(() => resolveKeyAction(key({ key: undefined }), overview));
});

test('isEditableTarget is null-safe', () => {
  assert.equal(isEditableTarget(null), false);
  assert.equal(isEditableTarget({ tagName: 'DIV' }), false);
  assert.equal(isEditableTarget({ tagName: 'INPUT' }), true);
});

// --- Binder tests: minimal EventTarget fakes standing in for window/document. ---

function makeToastStub() {
  const set = new Set();
  return { textContent: '', classList: { add: n => set.add(n), remove: n => set.delete(n), contains: n => set.has(n) } };
}

before(() => {
  test.mock.timers.enable({ apis: ['setTimeout'] });
});

after(() => {
  test.mock.timers.reset();
});

// A fresh EventTarget per test: reusing one window across tests would stack listeners from
// every earlier binder test, letting a stale listener's side effect mask a broken new one.
beforeEach(() => {
  globalThis.window = new EventTarget();
  globalThis.__toastStub = makeToastStub();
  globalThis.document = Object.assign(new EventTarget(), { hidden: false, getElementById: id => (id === 'shortcut-toast' ? globalThis.__toastStub : null) });
});

after(() => {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.__toastStub;
});

const makeState = o => ({ mode: 'overview', speed: 1, pixelResolution: 'native', lastPixelResolution: 'pixel360', outline: true, timeOfDay: 'day', paused: false, spin: true, timeScale: 1, hudVisible: true, ...o });

// Fakes mutate the same state a real action would touch, so a chained second key press
// (e.g. P then P again) exercises the resolver against genuinely updated state.
function makeActions(calls, state) {
  const record = (name, value) => calls.push(value === undefined ? [name] : [name, value]);
  return {
    setMode: mode => { record('setMode', mode); state.mode = mode; },
    setTimeOfDay: id => { record('setTimeOfDay', id); state.timeOfDay = id; },
    setPixelResolution: id => { record('setPixelResolution', id); state.pixelResolution = id; },
    setSpeed: value => { record('setSpeed', value); state.speed = value; },
    setTimeScale: value => { record('setTimeScale', value); state.timeScale = value; },
    toggle: name => { record('toggle', name); state[name] = !state[name]; },
    toggleHudVisible: () => { record('toggleHudVisible'); state.hudVisible = !state.hudVisible; },
    setHelpVisible: value => record('setHelpVisible', value),
  };
}
function dispatchKeydown(props) {
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, { repeat: false, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, ...props });
  window.dispatchEvent(event);
  return event;
}

test('binder: X toggles spin once then flips time scale, with log and toast', () => {
  const calls = [];
  const state = makeState({ spin: true, timeScale: 1.5 });
  const actions = makeActions(calls, state);
  const logs = [];
  const log = test.mock.method(console, 'log', m => logs.push(m));
  bindKeyboardShortcuts({ state, actions, getDiorama: () => undefined });
  dispatchKeydown({ key: 'x' });
  assert.deepEqual(calls, [['toggle', 'spin'], ['setTimeScale', 0]]);
  assert.equal(logs.at(-1), '[GAMEPLAY] Time scale: 0');
  assert.equal(globalThis.__toastStub.textContent, 'X · Time scale · 0×');
  log.mock.restore();
  calls.length = 0;
  dispatchKeydown({ key: 'x' });
  assert.deepEqual(calls, [['setTimeScale', 1]]);
});

test('binder: T cycles forward, Shift+T cycles backward', () => {
  const forward = []; const state1 = makeState({ timeOfDay: 'night' });
  bindKeyboardShortcuts({ state: state1, actions: makeActions(forward, state1), getDiorama: () => undefined });
  dispatchKeydown({ key: 't' });
  assert.deepEqual(forward.at(-1), ['setTimeOfDay', 'day']);
  assert.equal(state1.timeOfDay, 'day');

  const backward = []; const state2 = makeState({ timeOfDay: 'day' });
  bindKeyboardShortcuts({ state: state2, actions: makeActions(backward, state2), getDiorama: () => undefined });
  dispatchKeydown({ key: 'T', shiftKey: true });
  assert.deepEqual(backward.at(-1), ['setTimeOfDay', 'night']);
});

test('binder: P toggles native <-> last pixel resolution', () => {
  const calls = [];
  const state = makeState({ pixelResolution: 'native', lastPixelResolution: 'pixel360' });
  bindKeyboardShortcuts({ state, actions: makeActions(calls, state), getDiorama: () => undefined });
  dispatchKeydown({ key: 'p' });
  assert.deepEqual(calls.at(-1), ['setPixelResolution', 'pixel360']);
  calls.length = 0;
  dispatchKeydown({ key: 'p' });
  assert.deepEqual(calls.at(-1), ['setPixelResolution', 'native']);
});

test('binder: B sets bridge mode then toasts', () => {
  const calls = [];
  const state = makeState();
  bindKeyboardShortcuts({ state, actions: makeActions(calls, state), getDiorama: () => undefined });
  dispatchKeydown({ key: 'b' });
  assert.deepEqual(calls, [['setMode', 'bridge']]);
  assert.equal(globalThis.__toastStub.textContent, 'B · Bridge camera');
});

test('binder: Space prevents default and toggles paused', () => {
  const calls = [];
  const state = makeState();
  bindKeyboardShortcuts({ state, actions: makeActions(calls, state), getDiorama: () => undefined });
  const event = dispatchKeydown({ key: ' ' });
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(calls, [['toggle', 'paused']]);
  assert.equal(state.paused, true);
});

test('binder: flight key while orbit+locked is captured; keyup/blur/visibilitychange clear it', () => {
  const calls = [];
  const state = makeState({ mode: 'orbit' });
  const movementKeys = new Set();
  const diorama = { firstPersonControls: { isLocked: true }, movementKeys };
  bindKeyboardShortcuts({ state, actions: makeActions(calls, state), getDiorama: () => diorama });
  const event = dispatchKeydown({ key: 'w', code: 'KeyW' });
  assert.equal(event.defaultPrevented, true);
  assert.equal(movementKeys.has('KeyW'), true);
  assert.deepEqual(calls, []);

  window.dispatchEvent(Object.assign(new Event('keyup'), { code: 'KeyW' }));
  assert.equal(movementKeys.has('KeyW'), false);

  movementKeys.add('KeyD');
  window.dispatchEvent(new Event('blur'));
  assert.equal(movementKeys.size, 0);

  movementKeys.add('KeyA');
  document.hidden = true;
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(movementKeys.size, 0);
  document.hidden = false;
});
