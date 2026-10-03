// Parity shot list: validation, stage gating, id selection, hide-set expansion, the research-captures
// directory resolver and the reference PNGs it must contain.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PARITY_SHOTS, validateShotList, selectShots, expandHideSets, resolveResearchDir, researchSkipReason, findMissingReferences,
} from '../../tools/parity/parity-shot-list.mjs';

const SKY_DIRECTION_IDS = ['sky-sun-day', 'sky-moon-night', 'sky-stars-night', 'sky-hills-evening'];
const STATION_CLOSEUP_IDS = ['station-trackside-closeup-day', 'station-trackside-closeup-night'];
const TRAIN_ONLY_IDS = ['train-only-braking-front-day', 'train-only-braking-front-day-no-effects', 'train-only-dwell-side-day', 'train-only-night-headlight'];
const WORLD_CORE_IDS = ['world-core-overview', 'world-core-bridge'];
const VILLAGE_IDS = ['village-windmill-overview-day', 'village-windmill-zoomed-day', 'village-windmill-evening', 'village-windmill-zoomed-night'];
const FOREST_IDS = ['overview-day-settled-masked', 'overview-zoomed-orbited-masked', 'overview-night-masked', 'village-residents-yard',
  'trees-sway-t0', 'trees-sway-t1', 'trees-sway-hold', 'trees-debug-hidden', 'station-free-start-day', 'station-free-start-night'];
const CAMERA_IDS = ['train-camera-day', 'bridge-camera-day', 'bridge-camera-evening', 'free-camera-day', 'train-camera-night']
  .flatMap(id => [id, `${id}-relaxed`]);
const SHEEP_IDS = ['sheep-flock-day-closeup', 'sheep-flock-night-closeup', 'sheep-track-hop-1', 'sheep-track-hop-2', 'sheep-track-hop-3'];
// Shell-and-sky stage, in shot-list order.
const SHELL_IDS = [
  'sky-day', 'sky-evening', 'sky-night', 'sky-day-pixel360', 'sky-day-ink-off', ...SKY_DIRECTION_IDS,
  'hud-day', 'hud-night', 'help-panel', 'toast-bridge', 'loader-card', 'debug-menu', 'sky-mobile', 'hud-mobile',
  ...WORLD_CORE_IDS, ...STATION_CLOSEUP_IDS,
];

describe('shot list and research captures', () => {
  test('validation, stage gating and hide expansion', () => {
    assert.deepEqual(validateShotList(), []);
    assert.deepEqual(selectShots({ stage: 'shell-and-sky' }).map(shot => shot.id), SHELL_IDS);
    assert.equal(selectShots({ stage: 'train' }).length, SHELL_IDS.length + 3 + TRAIN_ONLY_IDS.length);
    assert.deepEqual(selectShots({ stage: 'train' }).map(shot => shot.id).slice(-TRAIN_ONLY_IDS.length), TRAIN_ONLY_IDS);
    assert.deepEqual(selectShots({ stage: 'village-and-windmill' }).map(shot => shot.id).slice(SHELL_IDS.length + 3 + TRAIN_ONLY_IDS.length), VILLAGE_IDS);
    const forestStage = selectShots({ stage: 'residents-and-forest' }).map(shot => shot.id);
    const forestTail = [...FOREST_IDS, ...CAMERA_IDS, ...SHEEP_IDS];
    assert.deepEqual(forestStage.slice(-forestTail.length), forestTail);
    const strictCount = 30 + SKY_DIRECTION_IDS.length + WORLD_CORE_IDS.length + STATION_CLOSEUP_IDS.length + TRAIN_ONLY_IDS.length
      + VILLAGE_IDS.length + forestTail.length;
    assert.equal(selectShots({ stage: 'full-scene' }).length, strictCount);
    assert.deepEqual(selectShots({ ids: ['hud-day', 'sky-day'] }).map(shot => shot.id), ['hud-day', 'sky-day']);
    assert.throws(() => selectShots({ ids: ['nope'] }), /Unknown parity shot/);
    assert.deepEqual(expandHideSets(['skyOnly', 'trees']), ['world', 'train', 'birds', 'puffs', 'sparks', 'trees']);
    assert.ok(validateShotList([{ ...PARITY_SHOTS[0], hide: ['nope'] }]).some(error => error.includes('nope')));
    const zoomed = PARITY_SHOTS.find(shot => shot.id === 'overview-zoomed-day').camera.position;
    [-26.527, 32.079, 62.358].forEach((value, axis) => assert.ok(Math.abs(zoomed[axis] - value) < 1e-3));
  });
  test('research directory resolution', () => {
    const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
    assert.equal(resolveResearchDir({}), path.resolve(repoRoot, '..', 'plans', '260930-train-diorama-clone', 'research'));
    assert.equal(resolveResearchDir({ PARITY_RESEARCH_DIR: '' }), resolveResearchDir({}));
    assert.equal(resolveResearchDir({ PARITY_RESEARCH_DIR: '/tmp/research' }), '/tmp/research');
    assert.match(researchSkipReason('/nonexistent-research'), /PARITY_RESEARCH_DIR/);
  });
  test('every reference PNG exists in the research captures', { skip: researchSkipReason() }, () => {
    assert.deepEqual(findMissingReferences(), []);
    assert.equal(new Set(PARITY_SHOTS.map(shot => shot.reference).filter(Boolean)).size, 21);
  });
});
