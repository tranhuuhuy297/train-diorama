// Sign-off verdict math: EMA inversion, median and CV, palette keys and overlap, loader phase timings
// and heap-sample attribution to the nearest app frame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  invertEmaSamples, median, coefficientOfVariation, paletteKeyFromHex, paletteOverlap, buildMillisecondsFromMarks, attributeHeapSamples,
} from '../../tools/parity/parity-metrics-math.mjs';

// Top-10 colours of research shots 02 (overview, day) and 04 (overview, night).
const DAY_TOP = ['#d9e4eb', '#e2ecf4', '#cad7da', '#d3dce4', '#6a9c73', '#dee9f1', '#7ba884', '#a9c7b7', '#64966c', '#8bb496'];
const NIGHT_TOP = ['#174a93', '#0b3559', '#152748', '#16478d', '#132954', '#144a75', '#0d3b64', '#17537b', '#12456b', '#4694f8'];

test('invertEmaSamples recovers the raw series behind an alpha 0.1 EMA', () => {
  const raw = [16.2, 15.1, 17.9, 16.6, 30.4, 16.0, 15.5, 16.8];
  const series = [1000 / 60];
  for (const sample of raw) series.push(series.at(-1) + 0.1 * (sample - series.at(-1)));
  const recovered = invertEmaSamples(series);
  assert.equal(recovered.length, raw.length);
  recovered.forEach((value, index) => assert.ok(Math.abs(value - raw[index]) < 1e-9, `${index}: ${value} vs ${raw[index]}`));
  assert.deepEqual(invertEmaSamples([5]), []);
  const halfAlpha = invertEmaSamples([0, 1], 0.5);
  assert.deepEqual(halfAlpha, [2]);
});

test('median and coefficient of variation on odd, even and degenerate lists', () => {
  assert.equal(median([5, 1, 3]), 3);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  const input = [4, 1, 3, 2];
  median(input);
  assert.deepEqual(input, [4, 1, 3, 2], 'input untouched');
  assert.equal(coefficientOfVariation([2, 2, 2]), 0);
  assert.ok(Math.abs(coefficientOfVariation([2, 4, 4, 4, 5, 5, 7, 9]) - 0.4) < 1e-12);
  assert.ok(Math.abs(coefficientOfVariation([1, 3]) - 0.5) < 1e-12);
  assert.equal(coefficientOfVariation([]), null);
});

test('paletteKeyFromHex quantises each channel to 4 bits', () => {
  assert.equal(paletteKeyFromHex('#d9e4eb'), 0xdee);
  assert.equal(paletteKeyFromHex('#d9e4eb'), 13 * 256 + 14 * 16 + 14);
  assert.equal(paletteKeyFromHex('#000000'), 0);
  assert.equal(paletteKeyFromHex('#ffffff'), 0xfff);
  assert.equal(paletteKeyFromHex('d0e0ef'), 0xdee, 'leading # optional; same bucket');
});

test('paletteOverlap: research 02 with itself is 10, with 04 is 0; {hex} entries accepted', () => {
  assert.equal(paletteOverlap(DAY_TOP, DAY_TOP), 10);
  assert.equal(paletteOverlap(DAY_TOP, NIGHT_TOP), 0);
  assert.equal(paletteOverlap(DAY_TOP.map(hex => ({ hex, pct: 1 })), DAY_TOP.slice(0, 4)), 4);
  assert.equal(paletteOverlap(['#000000', '#010101'], ['#000000']), 1, 'same key counts once');
});

test('buildMillisecondsFromMarks reads the three loader labels; any missing label gives null', () => {
  const marks = [
    { label: 'LOADING ENGINE', t: 100, signFontsReady: false },
    { label: 'BUILDING VALLEY AND TRAIN', t: 1350.5, signFontsReady: true },
    { label: 'PREPARING FIRST FRAME', t: 2100.5, signFontsReady: true },
    { label: 'READY', t: 2400 },
  ];
  assert.deepEqual(buildMillisecondsFromMarks(marks), { build: 750, loadEngine: 1250.5 });
  assert.equal(buildMillisecondsFromMarks(marks.filter(mark => mark.label !== 'PREPARING FIRST FRAME')), null);
  assert.equal(buildMillisecondsFromMarks([]), null);
});

test('attributeHeapSamples gives unpkg leaf bytes to the nearest app ancestor', () => {
  const app = 'http://localhost:4317/src/world/world.js';
  const cdn = 'https://unpkg.com/three@0.186.0/build/three.module.js';
  const frame = (functionName, url, lineNumber = 0) => ({ functionName, url, lineNumber, columnNumber: 0 });
  const profile = {
    head: {
      callFrame: frame('(root)', ''), selfSize: 0, children: [
        {
          callFrame: frame('updateWorld', app, 41), selfSize: 100, children: [
            { callFrame: frame('Vector3', cdn, 900), selfSize: 2048, children: [] },
            { callFrame: frame('clone', cdn, 950), selfSize: 32, children: [] },
          ],
        },
        { callFrame: frame('gc', cdn, 10), selfSize: 500, children: [] },
      ],
    },
  };
  const isAppUrl = url => url.startsWith('http://localhost:4317/');
  const result = attributeHeapSamples(profile, isAppUrl);
  assert.equal(result.totalBytes, 2680);
  assert.equal(result.appBytes, 2180);
  assert.deepEqual(result.sites, [{ functionName: 'updateWorld', url: app, line: 42, bytes: 2180 }]);
});

test('performance gate fails when a median has no samples', async () => {
  const { judgePerformance } = await import('../../tools/parity/performance-budget-probe.mjs');
  const site = build => ({ build: { median: build }, cpuFrozen: { median: 2 }, cpuRunning: { median: 3 } });
  const checks = judgePerformance({ original: site(null), clone: site(null) }, null);
  assert.equal(checks.find(c => c.name === 'build median').pass, false);
  assert.equal(checks.find(c => c.name === 'cpuFrozen median').pass, true);
});
