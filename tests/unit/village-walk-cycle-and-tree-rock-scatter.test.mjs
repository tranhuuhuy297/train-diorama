// Pure checks for the village walk cycle, the canopy height grid and the draw accounting of the tree
// and rock scatters against scripted stub worlds (no terrain or track needed).
import '../../src/core/disable-three-color-management.js';
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { resolveVillageWalkCycle, VILLAGE_WALK_CYCLE_SECONDS } from '../../src/life/village/village-residents.js';
import {
  CANOPY_CELL_SIZE, CANOPY_HALF, CANOPY_GRID_SIZE, createCanopyHeightGrid, stampCanopyHeights, treeCanopyHeightAt,
} from '../../src/world/trees/tree-canopy-height-grid.js';
import { scatterTrees, TREE_TINTS, AUTUMN_TREE_TINT, BLOSSOM_TREE_TINT, TREE_SCATTER_ATTEMPTS } from '../../src/world/trees/tree-scatter-rules.js';
import { buildRiversideRocks, ROCK_CAPACITY, ROCK_ATTEMPTS } from '../../src/world/rocks/riverside-rock-scatter.js';
import { npr } from '../../src/materials/npr-cel-material-factory.js';

describe('village walk cycle', () => {
  test('walking windows and yard progress across one and a bit cycles', () => {
    assert.equal(VILLAGE_WALK_CYCLE_SECONDS, 28);
    // [elapsed, walking, progress, cycle]
    const table = [
      [0, false, 0, 0], [3.99, false, 0, 3.99], [4, true, 0, 4], [8, true, 0.5, 8], [12, false, 1, 12],
      [17.99, false, 1, 17.99], [18, true, 1, 18], [22, true, 0.5, 22], [26, false, 0, 26], [28, false, 0, 0],
      [32, true, 0, 4], [36, true, 0.5, 8],
    ];
    const scratch = { cycle: 0, walking: false, progress: 0 };
    for (const [elapsed, walking, progress, cycle] of table) {
      const fresh = resolveVillageWalkCycle(elapsed);
      assert.deepEqual([fresh.walking, fresh.progress, fresh.cycle], [walking, progress, cycle], `elapsed ${elapsed}`);
      assert.equal(resolveVillageWalkCycle(elapsed, scratch), scratch);
      assert.deepEqual([scratch.walking, scratch.progress, scratch.cycle], [walking, progress, cycle], `scratch ${elapsed}`);
    }
  });
});

describe('canopy height grid', () => {
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  unitBox.computeBoundingBox();
  const raised = (grid, from, to) => [...grid.keys()].filter(index => grid[index] !== 0).sort((a, b) => a - b).join() === [
    from * CANOPY_GRID_SIZE + from, from * CANOPY_GRID_SIZE + to, to * CANOPY_GRID_SIZE + from, to * CANOPY_GRID_SIZE + to,
  ].join();

  test('constants, stamping, square queries and empty off-grid ranges', () => {
    assert.deepEqual([CANOPY_CELL_SIZE, CANOPY_HALF, CANOPY_GRID_SIZE], [2, 70, 70]);
    const world = { treeCanopyHeights: createCanopyHeightGrid() };
    assert.equal(world.treeCanopyHeights.length, 4900);
    stampCanopyHeights(world, unitBox, new THREE.Matrix4());
    assert.ok(raised(world.treeCanopyHeights, 34, 35));
    for (const cell of [34, 35]) assert.equal(world.treeCanopyHeights[cell * 70 + 34], Math.fround(1.1));
    assert.equal(treeCanopyHeightAt(world, 0, 0, 0), Math.fround(1.1));
    assert.equal(treeCanopyHeightAt(world, 60, 60, 1), 0);
    world.treeCanopyHeights[35 * 70] = 9;
    assert.equal(treeCanopyHeightAt(world, -500, 0, 0), 0);
    assert.equal(treeCanopyHeightAt(world, -69, 0, 0), 9);
    stampCanopyHeights(world, unitBox, new THREE.Matrix4().makeScale(0.5, 0.5, 0.5));
    assert.equal(world.treeCanopyHeights[35 * 70 + 35], Math.fround(1.1));
  });
});

// Scripted world: `draws` are consumed in order (running out throws); the rest is per case.
function stubWorld({ draws, height = () => 5, d = 10, bridge = false, excluded = false }) {
  const world = {
    used: 0,
    rand() {
      if (world.used >= draws.length) throw new Error(`draw ${world.used} not scripted`);
      return draws[world.used++];
    },
    heightAt: (x, z) => height(x, z),
    nearest: () => ({ i: 0, d }),
    inBridge: () => bridge,
    excluded: () => excluded,
  };
  return world;
}

const speciesWith = ({ matrices }) => matrices.flatMap((list, species) => list.map(() => species));

describe('tree scatter draw accounting', () => {
  const cases = [
    ['low ground', { height: () => 0.5 }, [0.5, 0.5], 2, []],
    ['near track', { d: 3.5 }, [0.5, 0.5], 2, []],
    ['bridge span', { d: 3.5, bridge: true }, [0.5, 0.5, 0.99], 3, []],
    ['excluded', { excluded: true }, [0.5, 0.5], 2, []],
    ['steep', { height: x => 5 + 2 * x }, [0.5, 0.5], 2, []],
    ['roll reject', {}, [0.5, 0.5, 0.99], 3, []],
    ['conifer', {}, [0.5, 0.5, 0, 0.1, 0.5, 0, 0.5, 0], 8, [0]],
    ['forced conifer', { height: () => 13 }, [0.5, 0.5, 0, 0.9, 0.5, 0, 0.5, 0], 8, [0]],
    ['autumn', {}, [0.5, 0.5, 0, 0.3, 0.5, 0, 0.5, 0, 0.01, 0.5], 10, [1]],
    ['blossom', {}, [0.5, 0.5, 0, 0.3, 0.5, 0, 0.5, 0, 0.01, 0.01], 10, [1]],
    ['cluster', {}, [0.5, 0.5, 0, 0.6, 0.5, 0, 0.5, 0, 0.5, 0.5], 10, [2]],
    ['bush', {}, [0.5, 0.5, 0, 0.9, 0.5, 0, 0.5, 0, 0.5, 0.5], 10, [3]],
  ];
  for (const [name, setup, draws, used, species] of cases) {
    test(name, () => {
      const world = stubWorld({ draws, ...setup });
      const result = scatterTrees(world, 1);
      assert.equal(world.used, used);
      assert.deepEqual(speciesWith(result), species);
    });
  }

  test('placement matrix and tints', () => {
    assert.equal(TREE_SCATTER_ATTEMPTS, 14000);
    const conifer = scatterTrees(stubWorld({ draws: [0.5, 0.5, 0, 0.1, 0.5, 0, 0.5, 0] }), 1);
    const matrix = conifer.matrices[0][0];
    assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), [0, 4.85, 0]);
    assert.equal(matrix.elements[0], 1.125);
    assert.equal(matrix.elements[5], 1.125 * 1.05);
    assert.deepEqual(conifer.colors[0][0].toArray(), TREE_TINTS[0]);
    const tintOf = draws => scatterTrees(stubWorld({ draws }), 1).colors[1][0].toArray();
    assert.deepEqual(tintOf([0.5, 0.5, 0, 0.3, 0.5, 0, 0.5, 0.2, 0.01, 0.5]), AUTUMN_TREE_TINT);
    assert.deepEqual(tintOf([0.5, 0.5, 0, 0.3, 0.5, 0, 0.5, 0.2, 0.01, 0.01]), BLOSSOM_TREE_TINT);
    assert.deepEqual(tintOf([0.5, 0.5, 0, 0.3, 0.5, 0, 0.5, 0.2, 0.5, 0.5]), TREE_TINTS[1]);
    // Shared tint tables are read-only, outer list and every triple.
    for (const table of [TREE_TINTS, ...TREE_TINTS, AUTUMN_TREE_TINT, BLOSSOM_TREE_TINT]) assert.ok(Object.isFrozen(table));
  });
});

describe('riverside rock draw accounting', () => {
  function rockWorld(height, excluded = false) {
    const world = { used: 0, group: new THREE.Group(), heightAt: () => height, excluded: () => excluded };
    world.rand = () => { world.used++; return 0.5; };
    return world;
  }

  test('fills all 80 slots with no draw after the last rock', () => {
    const world = rockWorld(0.5);
    const rocks = buildRiversideRocks(world);
    assert.deepEqual([ROCK_CAPACITY, ROCK_ATTEMPTS], [80, 3000]);
    assert.deepEqual([rocks.count, world.used], [80, 480]);
    const last = new THREE.Matrix4().fromArray(rocks.instanceMatrix.array, 79 * 16);
    assert.deepEqual(new THREE.Vector3().setFromMatrixPosition(last).toArray(), [0, 0.5, 0]);
    assert.equal(rocks.instanceColor, null);
    assert.equal(rocks.material, npr({ vertexColors: true, stipple: 0.3, stippleScale: 3 }));
    assert.equal(rocks.parent, world.group);
  });

  test('high ground and keep-outs consume two draws per attempt and place nothing', () => {
    for (const world of [rockWorld(5), rockWorld(0.5, true)]) {
      const rocks = buildRiversideRocks(world);
      assert.deepEqual([rocks.count, world.used], [0, 6000]);
    }
  });
});
