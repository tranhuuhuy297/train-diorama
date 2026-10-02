// Scenario tests for settings load/validate/migrate and the save circuit breaker.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_STATE, STORAGE_KEY } from '../../src/ui/settings-schema-defaults.js';
import { loadSettings, createSettingsSaver } from '../../src/ui/settings-local-storage-persistence.js';

function makeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    map,
  };
}

function validJsonWith(overrides) {
  return JSON.stringify({ ...DEFAULT_STATE, ...overrides });
}

test('absent key returns a fresh defaults clone with no warning', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const result = loadSettings(makeStorage());
  assert.deepEqual(result, DEFAULT_STATE);
  assert.notEqual(result, DEFAULT_STATE);
  assert.equal(warn.mock.callCount(), 0);
});

test('shuffled keys plus an extra key normalise to DEFAULT_STATE order, extra dropped', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  // Non-default values so a wrong implementation that falls back to defaults cannot pass by accident.
  const shuffled = { hudVisible: false, foo: 'bar', speed: 1.5, mode: 'side', timeScale: 1, paused: false, spin: true, pixelResolution: 'native', lastPixelResolution: 'pixel360', outline: true, timeOfDay: 'night' };
  const storage = makeStorage({ [STORAGE_KEY]: JSON.stringify(shuffled) });
  const result = loadSettings(storage);
  assert.deepEqual(Object.keys(result), Object.keys(DEFAULT_STATE));
  assert.equal('foo' in result, false);
  assert.equal(warn.mock.callCount(), 0);
  assert.deepEqual(result, { ...DEFAULT_STATE, hudVisible: false, speed: 1.5, mode: 'side', timeOfDay: 'night' });
  assert.equal(
    JSON.stringify(result),
    '{"mode":"side","speed":1.5,"pixelResolution":"native","lastPixelResolution":"pixel360","outline":true,"timeOfDay":"night","paused":false,"spin":true,"timeScale":1,"hudVisible":false}',
  );
});

test('legacy golden time of day migrates to evening', () => {
  const storage = makeStorage({ [STORAGE_KEY]: validJsonWith({ timeOfDay: 'golden' }) });
  assert.equal(loadSettings(storage).timeOfDay, 'evening');
});

test('invalid saved settings discard to defaults with one warning', t => {
  const cases = [
    '{', '[]', 'null', '42', '"x"',
    JSON.stringify({ ...DEFAULT_STATE, hudVisible: undefined }),
    validJsonWith({ speed: -0.01 }), validJsonWith({ speed: 2.51 }), validJsonWith({ speed: '1' }),
    validJsonWith({ speed: 1 }).replace('"speed":1', '"speed":NaN'),
    validJsonWith({ timeScale: 2.05 }),
    validJsonWith({ pixelResolution: 'toString' }), validJsonWith({ pixelResolution: '__proto__' }),
    validJsonWith({ lastPixelResolution: 'native' }),
    validJsonWith({ mode: 'free' }),
    validJsonWith({ timeOfDay: 'dusk' }),
    validJsonWith({ outline: 'true' }),
  ];
  for (const raw of cases) {
    const warn = t.mock.method(console, 'warn', () => {});
    const storage = makeStorage({ [STORAGE_KEY]: raw });
    const result = loadSettings(storage);
    assert.deepEqual(result, DEFAULT_STATE, raw);
    assert.equal(warn.mock.callCount(), 1, raw);
    assert.equal(warn.mock.calls[0].arguments[0], '[SETTINGS] Saved settings discarded', raw);
    warn.mock.restore();
  }
});

test('boundary values are accepted', () => {
  assert.equal(loadSettings(makeStorage({ [STORAGE_KEY]: validJsonWith({ speed: 0 }) })).speed, 0);
  assert.equal(loadSettings(makeStorage({ [STORAGE_KEY]: validJsonWith({ speed: 2.5 }) })).speed, 2.5);
  assert.equal(loadSettings(makeStorage({ [STORAGE_KEY]: validJsonWith({ timeScale: 0 }) })).timeScale, 0);
  assert.equal(loadSettings(makeStorage({ [STORAGE_KEY]: validJsonWith({ timeScale: 2 }) })).timeScale, 2);
});

test('a throwing getItem discards to defaults with a warning', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const storage = { getItem() { throw new Error('denied'); } };
  assert.deepEqual(loadSettings(storage), DEFAULT_STATE);
  assert.equal(warn.mock.callCount(), 1);
});

test('serializing defaults matches the exact expected JSON string', () => {
  const result = loadSettings(makeStorage());
  assert.equal(
    JSON.stringify(result),
    '{"mode":"overview","speed":1,"pixelResolution":"native","lastPixelResolution":"pixel360","outline":true,"timeOfDay":"day","paused":false,"spin":true,"timeScale":1,"hudVisible":true}',
  );
});

test('saver writes JSON of the live state and reflects later mutations', () => {
  const state = { ...DEFAULT_STATE };
  const storage = makeStorage();
  const save = createSettingsSaver(state, storage);
  save();
  assert.equal(storage.map.get(STORAGE_KEY), JSON.stringify(state));
  state.speed = 1.5;
  save();
  assert.equal(storage.map.get(STORAGE_KEY), JSON.stringify(state));
});

test('saver trips a circuit breaker after the first setItem failure', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const state = { ...DEFAULT_STATE };
  let calls = 0;
  const storage = { setItem() { calls += 1; throw new Error('quota'); } };
  const save = createSettingsSaver(state, storage);
  save();
  save();
  assert.equal(calls, 1);
  assert.equal(warn.mock.callCount(), 1);
  assert.equal(warn.mock.calls[0].arguments[0], '[SETTINGS] Could not save settings');
});

// A sandboxed/blocked-cookie browser throws SecurityError just reading `localStorage`,
// so the default must be resolved inside the guarded block, not in a default parameter.
test('loadSettings falls back to defaults when the ambient localStorage getter throws', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const descriptor = { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } };
  Object.defineProperty(globalThis, 'localStorage', descriptor);
  try {
    assert.deepEqual(loadSettings(), DEFAULT_STATE);
  } finally {
    delete globalThis.localStorage;
  }
  assert.equal(warn.mock.callCount(), 1);
  assert.equal(warn.mock.calls[0].arguments[0], '[SETTINGS] Saved settings discarded');
});

test('createSettingsSaver warns once and stops writing when the ambient localStorage getter throws', t => {
  const warn = t.mock.method(console, 'warn', () => {});
  const descriptor = { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } };
  Object.defineProperty(globalThis, 'localStorage', descriptor);
  try {
    const save = createSettingsSaver({ ...DEFAULT_STATE });
    save();
    save();
  } finally {
    delete globalThis.localStorage;
  }
  assert.equal(warn.mock.callCount(), 1);
  assert.equal(warn.mock.calls[0].arguments[0], '[SETTINGS] Could not save settings');
});
