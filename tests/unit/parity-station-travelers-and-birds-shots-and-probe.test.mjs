// Travelers and birds parity tooling in node: the three full-scene shots and their poses, the probe
// section read from a real clone world with its bird system, and the pairwise verdicts.
import '../../src/core/disable-three-color-management.js';
import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { createWorldBirdSystem } from '../../src/engine/diorama-scene-composition.js';
import { PARITY_SHOTS, ACTIVE_PARITY_STAGE, expandHideSets, validateShotList } from '../../tools/parity/parity-shot-list.mjs';
import {
  STATION_TRAVELERS_VIEW, STATION_ROOF_VIEW, BRIDGE_FLOCKS_VIEW,
} from '../../tools/parity/station-travelers-and-birds-parity-shots.mjs';
import {
  EXPECTED_PERCH_IDS, collectStationTravelersAndBirdsProbe, compareStationTravelersAndBirdsProbe,
} from '../../tools/parity/station-travelers-and-birds-runtime-probe.mjs';
import { judgeScenarioSections } from '../../tools/parity/scenario-probe-sections.mjs';

const world = createCloneWorld();
const birds = createWorldBirdSystem(world);
const byId = id => PARITY_SHOTS.find(shot => shot.id === id);
const inPage = (d, run) => {
  globalThis.window = { __diorama: d };
  return run();
};
after(() => { delete globalThis.window; });

describe('travelers and birds shots', () => {
  test('three strict full-scene free-mode shots with their poses and step counts', () => {
    assert.deepEqual(validateShotList(), []);
    assert.equal(ACTIVE_PARITY_STAGE, 'full-scene');
    const rows = [
      ['station-travelers-closeup', 6, STATION_TRAVELERS_VIEW], ['station-roof-birds-takeoff', 0.6, STATION_ROOF_VIEW],
      ['bridge-birds-in-flight', 9, BRIDGE_FLOCKS_VIEW],
    ];
    for (const [id, seconds, camera] of rows) {
      const shot = byId(id);
      assert.deepEqual([shot.stage, shot.mode, shot.timeOfDay, shot.seconds, shot.camera, shot.thresholdClass, shot.fresh, shot.outline],
        ['full-scene', 'orbit', 'day', seconds, camera, 'deterministic', true, true], id);
      assert.deepEqual(expandHideSets(shot.hide), ['puffs', 'sparks'], id);
    }
    assert.deepEqual(STATION_ROOF_VIEW.target, [-49.465, 11.9, -2.46]);
  });

  test('the travelers close-up frames both figures; the roof view looks at the roof flock', () => {
    const toward = (view, point) => {
      const [p, t] = [view.position, view.target];
      const forward = t.map((value, axis) => value - p[axis]);
      const offset = point.map((value, axis) => value - p[axis]);
      const dot = forward.reduce((sum, value, axis) => sum + value * offset[axis], 0);
      return dot / (Math.hypot(...forward) * Math.hypot(...offset));
    };
    for (const { figure } of world.stationTravelers) {
      const position = figure.getWorldPosition(figure.position.clone()).toArray();
      assert.ok(toward(STATION_TRAVELERS_VIEW, position) > 0.9, position.join(', '));
    }
    assert.ok(toward(STATION_ROOF_VIEW, birds.flocks[3].center.toArray()) > 0.99);
    const bridgeCentre = birds.flocks[1].center.toArray();
    assert.ok(toward(BRIDGE_FLOCKS_VIEW, bridgeCentre) > 0.9);
  });
});

describe('travelers and birds probe section', () => {
  test('raw values from parity-surface names', () => {
    const section = inPage({ world, birds }, collectStationTravelersAndBirdsProbe);
    assert.deepEqual([section.birdFlocks, section.birds, section.perchIds, section.stationTravelers], [7, 18, [...EXPECTED_PERCH_IDS], 2]);
    assert.deepEqual(section.flockModes, Array(7).fill('perched'));
    assert.deepEqual(section.walker, { position: [0.20999999999999985, 0.4, 1.1], yaw: world.stationWalker.figure.rotation.y, stopIndex: 0, wait: 5 });
    assert.equal(inPage({ world, birds: null }, collectStationTravelersAndBirdsProbe), null);
  });

  test('verdicts: equal sites pass; a missing site, wrong counts or a differing value fail', () => {
    const section = inPage({ world, birds }, collectStationTravelersAndBirdsProbe);
    assert.deepEqual(compareStationTravelersAndBirdsProbe(section, structuredClone(section)), { pass: true, failures: [] });
    assert.match(compareStationTravelersAndBirdsProbe(null, section).failures[0], /section missing/);
    const fewer = { ...structuredClone(section), birds: 17 };
    assert.deepEqual(compareStationTravelersAndBirdsProbe(section, fewer).failures, ['clone flocks 7 birds 17', 'sites differ in birds']);
    const walked = { ...structuredClone(section), walker: { ...section.walker, wait: 4.9 } };
    assert.deepEqual(compareStationTravelersAndBirdsProbe(section, walked).failures, ['sites differ in walker']);
    const scenario = { forest: null, waterCloudsBalloon: null, stationTravelersAndBirds: section };
    const verdicts = judgeScenarioSections(scenario, structuredClone(scenario));
    assert.deepEqual(verdicts.map(({ label, pass }) => [label, pass]), [['forest', false], ['water/clouds/balloon', false], ['travelers/birds', true]]);
  });
});
