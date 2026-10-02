// Capture-meta asymmetry warnings: capture run/profile/browser mismatches and capability gaps always warn;
// build timing and font readiness only once both sites build a world; displaced clouds at freeze on either site.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareMetas } from '../../tools/parity/compare-parity-shots.mjs';

const capabilities = world => ({ world, worldUpdate: world, train: false, birds: false, puffs: false, sparks: false, cloudCamera: world });
const meta = ({ world = true, time = 0.05, fonts = true, clouds = 0 } = {}) => ({
  capabilities: capabilities(world), timeAtFreeze: time, buildInfo: { fredokaReadyAtBuild: fonts }, cloudOffsetMax: clouds,
});

test('identical metas produce no warnings', () => {
  assert.deepEqual(compareMetas(meta(), meta()), []);
});

test('a world-less clone reports only capability gaps', () => {
  const warnings = compareMetas(meta(), meta({ world: false, time: 0.034, fonts: false }));
  assert.deepEqual(warnings, [
    'capability world: original=true clone=false',
    'capability worldUpdate: original=true clone=false',
    'capability cloudCamera: original=true clone=false',
  ]);
});

test('timing and font readiness warn once both sites have a world', () => {
  assert.deepEqual(compareMetas(meta(), meta({ time: 0.04, fonts: false })), [
    'timeAtFreeze differs: original=0.05 clone=0.04',
    'fredokaReadyAtBuild differs: original=true clone=false',
  ]);
});

test('displaced clouds warn per site', () => {
  assert.deepEqual(compareMetas(meta({ clouds: 0.5 }), meta({ clouds: 0.25 })), [
    'original clouds displaced at freeze (cloudOffsetMax 0.5)',
    'clone clouds displaced at freeze (cloudOffsetMax 0.25)',
  ]);
});

test('captures from another run, profile or browser warn first', () => {
  const environment = (runId, profile, executablePath, webglRenderer) => ({ ...meta(), runId, profile, executablePath, webglRenderer });
  const fresh = environment('2026-10-02T09:00:00.000Z', 'angle', '/chromium-1243/chrome', 'ANGLE (SwiftShader)');
  assert.deepEqual(compareMetas(fresh, { ...fresh }), []);
  const stale = environment('2026-10-01T18:00:00.000Z', 'gl', '/chromium-1200/chrome', 'Mesa llvmpipe');
  assert.deepEqual(compareMetas(fresh, { ...stale, cloudOffsetMax: 0.5 }), [
    'runId differs: original=2026-10-02T09:00:00.000Z clone=2026-10-01T18:00:00.000Z',
    'profile differs: original=angle clone=gl',
    'executablePath differs: original=/chromium-1243/chrome clone=/chromium-1200/chrome',
    'webglRenderer differs: original=ANGLE (SwiftShader) clone=Mesa llvmpipe',
    'clone clouds displaced at freeze (cloudOffsetMax 0.5)',
  ]);
});
