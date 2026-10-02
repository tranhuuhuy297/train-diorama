// Shared fake DOM + manual rAF/microtask plumbing for the loading-screen runner test files.
import { before, after, beforeEach } from 'node:test';

// `log`, when given, records every add/remove of 'is-working' in order — point-in-time reads
// can't catch a flag that flips off then straight back on within the same microtask drain.
export class FakeElement {
  constructor(id, log) {
    this.id = id;
    this.hidden = false;
    this.textContent = '';
    this.style = { width: '' };
    this.attributes = new Map();
    const set = new Set();
    const track = (name, present) => { if (name === 'is-working' && log) log.push(present ? 'add' : 'remove'); };
    this.classList = {
      add: (...names) => names.forEach(n => { set.add(n); track(n, true); }),
      remove: (...names) => names.forEach(n => { set.delete(n); track(n, false); }),
      toggle: (name, force) => { force ? set.add(name) : set.delete(name); track(name, force); },
      contains: n => set.has(n),
    };
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  querySelector(selector) {
    if (selector === '[role="progressbar"]') return this.bar;
    if (selector === '.load-fill') return this.fill;
    return null;
  }
}

export function flushMicrotasks() {
  return new Promise(resolve => setImmediate(resolve));
}

export function makeSteps(run = () => {}) {
  return [
    { label: 'LOADING ENGINE', weight: 30, run },
    { label: 'BUILDING VALLEY AND TRAIN', weight: 60, run },
    { label: 'PREPARING FIRST FRAME', weight: 10, run },
  ];
}

// Registers before/beforeEach/after on the importing test file; call once at module top level.
export function installLoadingScreenFixture() {
  const state = { elements: null, workingLog: null, rafQueue: [] };

  before(() => {
    globalThis.requestAnimationFrame = cb => state.rafQueue.push(cb);
  });
  after(() => {
    delete globalThis.requestAnimationFrame;
  });

  // Every fixture starts "dirty" (mid-previous-run state) so a reset assertion actually
  // proves the runner resets it, rather than coincidentally matching a fresh object's defaults.
  beforeEach(() => {
    state.rafQueue = [];
    const workingLog = [];
    const screen = new FakeElement('loading', workingLog);
    screen.hidden = true;
    screen.classList.add('is-gone', 'is-working');
    screen.setAttribute('aria-busy', 'false');
    const phase = new FakeElement('load-phase');
    phase.textContent = 'STALE';
    const percent = new FakeElement('load-percent');
    percent.textContent = '77%';
    const hint = new FakeElement('load-hint');
    hint.textContent = 'stale hint';
    screen.bar = new FakeElement('bar');
    screen.bar.fill = new FakeElement('fill');
    screen.bar.fill.style.width = '77%';
    screen.bar.setAttribute('aria-valuenow', '77');
    screen.fill = screen.bar.fill;
    workingLog.length = 0; // drop the dirty-fixture 'is-working' add recorded just above
    state.elements = { loading: screen, 'load-phase': phase, 'load-percent': percent, 'load-hint': hint };
    state.workingLog = workingLog;
    globalThis.document = { getElementById: id => state.elements[id] ?? null };
  });

  function flushFrame() {
    const callbacks = state.rafQueue.splice(0, state.rafQueue.length);
    for (const cb of callbacks) cb();
    return flushMicrotasks();
  }

  return { elements: () => state.elements, workingLog: () => state.workingLog, flushFrame };
}

// Drives a 3-step run through completion (2 rAF pairs per step); returns the settled promise.
export async function runToCompletion(runLoadingSteps, flushFrame, run) {
  const promise = runLoadingSteps(makeSteps(run));
  await flushMicrotasks();
  for (let i = 0; i < 3; i += 1) {
    await flushFrame();
    await flushFrame();
    await flushMicrotasks();
  }
  return { promise };
}
