// Right-click on a HUD control resets it to its default: the default reaches the action, the browser menu is
// suppressed and the reset toast names the control. Uses a minimal fake DOM keyed by element id.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { bindHud } from '../../src/ui/hud-dom-event-bindings.js';
import { DEFAULT_STATE } from '../../src/ui/settings-schema-defaults.js';

function fakeNode(id, extra = {}) {
  const classes = new Set();
  return {
    id, hidden: false, value: '', textContent: '', innerHTML: '', dataset: {}, listeners: {},
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)), contains: name => classes.has(name) },
    addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); },
    closest(selector) { return this.closestMap?.[selector] ?? null; },
    ...extra,
  };
}

const IDS = ['time-of-day', 'pixel-resolution', 'speed', 'time-scale', 'time-scale-value', 'hud-top', 'hud-controls', 'shortcut-toast',
  'camera-modes', 'display-controls', 'controls-button', 'help', 'hide-help', 'time-scale-control'];
const nodes = Object.fromEntries(IDS.map(id => [id, fakeNode(id)]));
const labels = { speed: fakeNode('speed-label'), pixel: fakeNode('pixel-label') };
nodes.speed.closestMap = { label: labels.speed };
nodes['pixel-resolution'].closestMap = { label: labels.pixel };
const realDocument = globalThis.document;

const calls = [];
const actions = Object.fromEntries(['setTimeOfDay', 'setMode', 'toggle', 'setSpeed', 'setPixelResolution', 'setTimeScale', 'setHelpVisible']
  .map(name => [name, value => calls.push([name, value])]));
// lastPixelResolution starts away from its default so the reset is observable.
const state = { ...DEFAULT_STATE, mode: 'bridge', timeOfDay: 'night', paused: true, spin: true, pixelResolution: 'pixel360', lastPixelResolution: 'pixel720', speed: 2, timeScale: 0.5 };
let lastPixelAtCall = null;
actions.setPixelResolution = value => { lastPixelAtCall = state.lastPixelResolution; calls.push(['setPixelResolution', value]); };

before(() => {
  globalThis.document = { getElementById: id => nodes[id] ?? null, body: fakeNode('body') };
  bindHud(state, actions);
});
after(() => { globalThis.document = realDocument; });

// Fires the first contextmenu listener of `node` with an event whose target resolves `[attribute]` to `picked`.
function rightClick(node, attribute = null, picked = null) {
  let prevented = false;
  const target = { closest: selector => (attribute && selector === `[${attribute}]` ? picked : null) };
  calls.length = 0;
  node.listeners.contextmenu[0]({ target, preventDefault: () => { prevented = true; } });
  return { prevented, calls: [...calls], toast: nodes['shortcut-toast'].textContent };
}

test('right-click resets each control to its default and toasts', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const modeButton = { dataset: { mode: 'bridge' } };
  assert.deepEqual(rightClick(nodes['camera-modes'], 'data-mode', modeButton), { prevented: true, calls: [['setMode', 'overview']], toast: 'Camera · Default' });
  assert.deepEqual(rightClick(nodes['time-of-day']), { prevented: true, calls: [['setTimeOfDay', 'day']], toast: 'Time of day · Day' });
  assert.deepEqual(rightClick(labels.speed), { prevented: true, calls: [['setSpeed', 1]], toast: 'Train speed · Default' });
  assert.deepEqual(rightClick(nodes['time-scale-control']), { prevented: true, calls: [['setTimeScale', 1]], toast: 'Time scale · Default' });
  const pixel = rightClick(labels.pixel);
  assert.deepEqual(pixel, { prevented: true, calls: [['setPixelResolution', 'native']], toast: 'Pixel art · Native' });
  assert.notEqual(DEFAULT_STATE.lastPixelResolution, 'pixel720');
  assert.equal(lastPixelAtCall, DEFAULT_STATE.lastPixelResolution);
  assert.equal(state.lastPixelResolution, DEFAULT_STATE.lastPixelResolution);
  assert.ok(nodes['shortcut-toast'].classList.contains('is-visible'));
});

test('toggle pills flip only when away from their default; the toast uses the pill text', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pausePill = { dataset: { toggle: 'paused' }, textContent: ' ▶ Resume ' };
  assert.deepEqual(rightClick(nodes['display-controls'], 'data-toggle', pausePill), { prevented: true, calls: [['toggle', 'paused']], toast: '▶ Resume · Default' });
  const spinPill = { dataset: { toggle: 'spin' }, textContent: 'Turntable' };
  assert.deepEqual(rightClick(nodes['display-controls'], 'data-toggle', spinPill), { prevented: true, calls: [], toast: 'Turntable · Default' });
  assert.throws(() => rightClick(nodes['display-controls'], 'data-toggle', { dataset: { toggle: 'warp' }, textContent: 'x' }), /Unknown toggle: warp/);
});

test('right-click outside a mode button or pill keeps the browser menu', () => {
  assert.deepEqual(rightClick(nodes['camera-modes']).prevented, false);
  assert.deepEqual(rightClick(nodes['display-controls']).calls, []);
});
