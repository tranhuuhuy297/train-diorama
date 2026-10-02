// Train model: structure goldens measured on the original Train (always run), then, with the original
// cached, its scene signature, byte-equal merged buffers per car and update(world, s) placement.
import '../../src/core/disable-three-color-management.js';
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import { installMinimalDomShim } from '../helpers/minimal-dom-shim.mjs';
import { originalSkipReason, importOriginal } from '../helpers/original-module-loader.mjs';
import { buildOriginalWorld } from '../helpers/original-world-stepper.mjs';
import { createCloneWorld } from '../helpers/clone-world-factory.mjs';
import { sceneGraphSignature, compareSceneSignatures } from '../helpers/scene-graph-signature.mjs';
import { freshProcessTrainMaterialRows } from '../helpers/fresh-process-train-material-ids.mjs';
import { Train } from '../../src/train/train.js';

installMinimalDomShim();
const skip = originalSkipReason(['Diorama.js', 'Train.js', 'World.js', 'Materials.js', 'LightGlows.js', 'StaticGeometry.js']);

const GLOW = 'night-light-glow';
const OFFSETS = [0, 4.1, 8.2, 13.25, 18.3, 23.35];
const LENGTHS = [4.6, 2.7, 4.6, 4.6, 4.6, 4.6];
const coachBatches = body => [['2b2a33', 180], [body, 288], ['f3dfae', 12], ['4c332b', 1008], ['f0c150', 84], ['5e5864', 120]];
// Per car, merged batches in material-first-seen order: [colour, triangles].
const BATCHES = [
  [['2b2a33', 1084], ['d23a2c', 120], ['f0c150', 1290], ['a92d28', 316], ['3d3a45', 76], ['3f7282', 104],
    ['d6a37d', 276], ['353944', 104], ['bfc4ca', 392], ['171e2b', 180], ['283344', 160], ['ffe9a8', 36]],
  [['2b2a33', 94], ['d23a2c', 12], ['a92d28', 120]],
  coachBatches('7a3b2c'), coachBatches('7a3b2c'), coachBatches('2f6150'), coachBatches('7a3b2c'),
];
const LOCO_WHEELS = [[-0.68, 0.74, 0.95, 0.44], [-0.68, 0.74, -0.05, 0.44], [-0.68, 0.74, -1.05, 0.44], [-0.68, 0.58, 1.85, 0.28],
  [0.68, 0.74, 0.95, 0.44], [0.68, 0.74, -0.05, 0.44], [0.68, 0.74, -1.05, 0.44], [0.68, 0.58, 1.85, 0.28]];
const WHEEL_SIDE = ['Group:4', 'Group:4', 'Group:4', 'Group:2'];
// Glass ×3, empty raven group, uv-less cowcatcher, halos, headlight anchor, 8 wheel groups, chimney.
const LOCO_HEAD = ['glass', 'glass', 'glass', 'Group:0', 'Mesh:d23a2c', GLOW, 'Object3D:1', ...WHEEL_SIDE, ...WHEEL_SIDE, 'Object3D:0'];
const CONE_QUATERNION = [0.039904394895017514, 0, -0, 0.9992035024298416];

const isBatch = object => object.isMesh && object.geometry.hasAttribute('uv') && !object.material.transparent;
const batchesOf = car => car.obj.children.filter(isBatch);
const colourOf = mesh => mesh.material.uniforms.uColor.value.getHexString();
const triangles = geometry => ((geometry.index?.count ?? geometry.attributes.position.count) / 3) * (geometry.isInstancedBufferGeometry ? geometry.instanceCount : 1);
const bytes = array => Buffer.from(array.buffer, array.byteOffset, array.byteLength);

function label(object) {
  if (object.material?.name === GLOW) return GLOW;
  if (object.material?.type === 'MeshBasicMaterial') return 'glass';
  if (object.isMesh) return `Mesh:${colourOf(object)}`;
  return `${object.type}:${object.children.length}`;
}

describe('train structure goldens', () => {
  const train = new Train();

  test('lengths, offsets and total length', () => {
    train.cars.forEach((car, index) => {
      assert.ok(Object.is(car.offset, OFFSETS[index]), `offset ${index}: ${car.offset}`);
      assert.ok(Object.is(car.len, LENGTHS[index]), `len ${index}`);
    });
    assert.equal(train.totalLength, 25.650000000000002);
    assert.equal(train.loco, train.cars[0]);
  });

  test('wheels: spark round-robin order on the locomotive, counts per car', () => {
    assert.deepStrictEqual(train.loco.wheels.map(({ mesh, r }) => [...mesh.position.toArray(), r]), LOCO_WHEELS);
    assert.deepStrictEqual(train.cars.map(car => car.wheels.length), [8, 4, 8, 8, 8, 8]);
  });

  test('children, merged meshes, object/geometry/triangle totals', () => {
    assert.deepStrictEqual(train.cars.map(car => car.obj.children.length), [28, 7, 27, 27, 27, 27]);
    assert.deepStrictEqual(train.cars.map(car => batchesOf(car).length), [12, 3, 6, 6, 6, 6]);
    const totals = { meshes: 0, emptyGroups: 0, emptyObjects: 0, glows: 0, triangles: 0 };
    const geometries = new Set();
    train.group.traverse(object => {
      if (object.isMesh) {
        totals.meshes++;
        totals.triangles += triangles(object.geometry);
        if (object.material.name === GLOW) totals.glows++;
        geometries.add(object.geometry);
      } else if (object.children.length === 0) {
        totals[object.type === 'Group' ? 'emptyGroups' : 'emptyObjects']++;
      }
    });
    assert.deepStrictEqual({ ...totals, geometries: geometries.size },
      { meshes: 149, emptyGroups: 49, emptyObjects: 1, glows: 6, triangles: 20998, geometries: 55 });
  });

  test('locomotive child order and merged batch order per car', () => {
    const children = train.loco.obj.children;
    assert.deepStrictEqual(children.slice(0, LOCO_HEAD.length).map(label), LOCO_HEAD);
    assert.equal(children[3].position.x, 0.31, 'the empty group is the raven');
    train.cars.forEach((car, index) => {
      assert.deepStrictEqual(batchesOf(car).map(mesh => [colourOf(mesh), triangles(mesh.geometry)]), BATCHES[index], `car ${index}`);
    });
  });

  test('noShadow list, glows and the beam cone orientation', () => {
    const kinds = train.noShadow.map(object => `${object.geometry.type}:${object.material.type}`);
    assert.deepStrictEqual(kinds, [
      ...Array(3).fill('PlaneGeometry:MeshBasicMaterial'), 'InstancedBufferGeometry:ShaderMaterial',
      'CylinderGeometry:ShaderMaterial', ...Array(4).fill('InstancedBufferGeometry:ShaderMaterial'),
    ]);
    assert.deepStrictEqual(train.headlight.children[0].quaternion.toArray(), CONE_QUATERNION);
    assert.deepStrictEqual(train.chimney.position.toArray(), [0, 2.9, 1.95]);
    assert.deepStrictEqual(train.headlight.position.toArray(), [0, 2.1, 2.5]);
  });

  test('coach glow material ids step 25, 26 (new green body material), 25 from a cold cache', () => {
    const coachGlows = [...new Set(freshProcessTrainMaterialRows('clone').filter(row => row[2] === GLOW).map(row => row[0]))].slice(-4);
    assert.deepStrictEqual(coachGlows.slice(1).map((id, index) => id - coachGlows[index]), [25, 26, 25]);
  });
});

function carPoses(train) {
  return train.cars.map(car => [...car.obj.position.toArray(), ...car.obj.quaternion.toArray(), ...car.wheels.map(wheel => wheel.mesh.rotation.x)]);
}

describe('train parity with the original', { skip, timeout: 300_000 }, () => {
  const trains = {};
  before(async () => {
    await importOriginal('Diorama.js');
    const { Train: OriginalTrain } = await importOriginal('Train.js');
    trains.original = new OriginalTrain();
    trains.clone = new Train();
  });

  test('scene-graph signatures are equal (multiset and ordered)', () => {
    const [expected, actual] = [sceneGraphSignature(trains.original.group), sceneGraphSignature(trains.clone.group)];
    const multiset = compareSceneSignatures(expected, actual);
    assert.ok(multiset.equal, multiset.report);
    const ordered = compareSceneSignatures(expected, actual, { ordered: true });
    assert.ok(ordered.equal, ordered.report);
  });

  // Material ids are compared in fresh processes below: npr caches are warm here (the goldens built a train).
  test('object and geometry ids follow the original allocation order', () => {
    const relativeIds = train => {
      const rows = [];
      train.group.traverse(object => rows.push([object.id, object.geometry?.id ?? null]));
      const [firstObject, firstGeometry] = [rows[0][0], Math.min(...rows.map(row => row[1] ?? Infinity))];
      return rows.map(([id, geometry]) => [id - firstObject, geometry === null ? null : geometry - firstGeometry]);
    };
    assert.deepStrictEqual(relativeIds(trains.clone), relativeIds(trains.original));
  });

  test('material ids, types and names follow the original creation order (fresh processes)', () => {
    assert.deepStrictEqual(freshProcessTrainMaterialRows('clone'), freshProcessTrainMaterialRows('original'));
  });

  test('merged buffers are byte-equal per car and batch', () => {
    trains.original.cars.forEach((car, carIndex) => {
      const [expected, actual] = [batchesOf(car), batchesOf(trains.clone.cars[carIndex])];
      assert.equal(actual.length, expected.length, `car ${carIndex} batch count`);
      expected.forEach((mesh, batch) => {
        const [a, b] = [mesh.geometry, actual[batch].geometry];
        const where = `car ${carIndex} batch ${batch}`;
        assert.equal(colourOf(actual[batch]), colourOf(mesh), `${where} colour`);
        for (const name of ['position', 'normal', 'uv']) assert.ok(bytes(b.attributes[name].array).equals(bytes(a.attributes[name].array)), `${where} ${name}`);
        assert.equal(b.index.array.constructor, a.index.array.constructor, `${where} index type`);
        assert.ok(bytes(b.index.array).equals(bytes(a.index.array)), `${where} index`);
      });
    });
  });

  test('update(world, s) places cars and rolls wheels bit-identically for 1000 distances', async () => {
    const originalWorld = (await buildOriginalWorld({ stopAfter: 'findBridge' })).world;
    const cloneWorld = createCloneWorld({ stopAfter: 'findBridge' });
    for (let k = 0; k < 1000; k++) {
      const s = -40 + k * 0.3171;
      trains.original.update(originalWorld, s);
      trains.clone.update(originalWorld, s);
      const expected = carPoses(trains.original);
      assert.deepStrictEqual(carPoses(trains.clone), expected, `shared original world, s = ${s}`);
      trains.clone.update(cloneWorld, s);
      assert.deepStrictEqual(carPoses(trains.clone), expected, `clone world, s = ${s}`);
    }
  });
});
