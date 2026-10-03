// Sheep parity tooling in node: the five sheep shots, the in-page close-up pose, the probe section read
// from a clone world, the hop-frame watcher and the cross-site comparison rules.
import '../../src/core/disable-three-color-management.js';
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { PARITY_SHOTS, expandHideSets, validateShotList } from '../../tools/parity/parity-shot-list.mjs';
import { SHEEP_HOP_K2 } from '../../tools/parity/sheep-flock-parity-shots.mjs';
import { resolveInPageCameraPose } from '../../tools/parity/page-shot-actions.mjs';
import { collectSheepFlockProbe, compareSheepFlockProbes } from '../../tools/parity/sheep-flock-runtime-probe.mjs';

const world = createCloneWorld();
const byId = id => PARITY_SHOTS.find(shot => shot.id === id);
const inPage = (d, run, argument) => {
  globalThis.window = { __diorama: d };
  return run(argument);
};
after(() => { delete globalThis.window; });

describe('sheep shots', () => {
  test('stage, frames, masks and pose', () => {
    assert.deepEqual(validateShotList(), []);
    const rows = [
      ['sheep-flock-day-closeup', 'day', 120], ['sheep-flock-night-closeup', 'night', 600],
      ['sheep-track-hop-1', 'day', SHEEP_HOP_K2 - 12], ['sheep-track-hop-2', 'day', SHEEP_HOP_K2 + 20], ['sheep-track-hop-3', 'day', SHEEP_HOP_K2 + 90],
    ];
    for (const [id, timeOfDay, frames] of rows) {
      const shot = byId(id);
      assert.deepEqual([shot.stage, shot.timeOfDay, Math.round(shot.seconds * 60), shot.thresholdClass, shot.fresh, shot.reportOnly],
        ['residents-and-forest', timeOfDay, frames, 'deterministic', true, false], id);
      assert.deepEqual(expandHideSets(shot.hide), ['birds', 'stationFigures', 'puffs', 'sparks']);
      assert.equal(shot.inPageCameraPose, 'sheepFlockCloseup');
    }
  });

  test('close-up pose: back from rail sheep 2, up and along the track, looking at its spot', () => {
    const { center, outward, tangent } = world.trackSheep[1].route;
    const pose = inPage({ world }, resolveInPageCameraPose, 'sheepFlockCloseup');
    const expected = center.clone().addScaledVector(outward, -9).add(new THREE.Vector3(0, 5, 0)).addScaledVector(tangent, 3);
    assert.deepEqual(pose.position, expected.toArray());
    assert.deepEqual(pose.target, [center.x, center.y + 0.5, center.z]);
    // Away from the safe spot, so the hop moves toward the camera's far side.
    assert.ok(new THREE.Vector3(...pose.position).sub(center).dot(outward) < 0);
  });
});

describe('sheep probe section', () => {
  test('flock facts from parity-surface names', () => {
    const probe = inPage({ world }, collectSheepFlockProbe);
    assert.deepEqual(probe.counts, [27, 108, 54]);
    assert.deepEqual(probe.routes.map(route => route.id), [1, 2, 3]);
    assert.equal(probe.routes[1].distance, world.trackSheep[1].route.distance);
    assert.deepEqual(probe.firstPasture[0], [world.sheepStates[0].x, world.sheepStates[0].z]);
    assert.equal(probe.strandingCandidates, 0);
    assert.equal(inPage({ world: { sheep: null } }, collectSheepFlockProbe), null);
  });

  test('comparison: every field equal, all three hops found, K2 as pinned', () => {
    const base = { ...inPage({ world }, collectSheepFlockProbe), hopFrames: [785, SHEEP_HOP_K2, 840] };
    assert.deepEqual(compareSheepFlockProbes(base, base), { pass: true, failures: [], hopFrames: base.hopFrames });
    assert.match(compareSheepFlockProbes(base, { ...base, strandingCandidates: 1 }).failures[0], /^strandingCandidates/);
    assert.match(compareSheepFlockProbes(base, { ...base, hopFrames: [785, 825, 840] }).failures[0], /^hopFrames/);
    const missing = { ...base, hopFrames: [785, SHEEP_HOP_K2, null] };
    assert.match(compareSheepFlockProbes(missing, missing).failures.join(), /no hop found/);
    const shifted = { ...base, hopFrames: [785, SHEEP_HOP_K2 + 1, 840] };
    assert.match(compareSheepFlockProbes(shifted, shifted).failures.join(), /differs from the shot list/);
    assert.equal(compareSheepFlockProbes(null, base).pass, false);
  });
});
