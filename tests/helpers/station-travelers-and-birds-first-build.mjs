// First-construction setup for the travelers-and-birds parity file: one World plus the bird material and
// bird system per side, with Math.random draws counted inside buildStation, the material request and
// createBirdSystem. npr caches per module, so only the first build in a process gives true counts.
// Also the plain-array readers both sides share (constructed walker, rig tree, flock records).
import '../../src/core/disable-three-color-management.js';
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';
import { ORACLE_MATH_RANDOM_SEED } from './original-simulation-oracle.mjs';
import { importOriginal } from './original-module-loader.mjs';
import { loadOriginalWorldClass } from './original-world-stepper.mjs';
import { createCloneWorld } from './clone-world-factory.mjs';
import { WORLD_BUILD_STEPS } from '../../src/world/world-build-steps.js';
import { npr as cloneNpr } from '../../src/materials/npr-cel-material-factory.js';
import { createBirdSystem as createCloneBirds } from '../../src/life/birds/bird-system.js';

const BIRD_MATERIAL = () => ({ vertexColors: true, stipple: 0.1, stippleScale: 4 });
const xyz = vector => vector.toArray();

// Builds one side under a counting stream; `wrapStation(count)` installs the buildStation counter and
// returns its restore function. console.log is silenced (the world logs nothing, but stay safe).
function countedSide({ wrapStation, buildWorld, npr, createBirdSystem }) {
  const counts = { buildStation: 0, birdMaterial: 0, createBirdSystem: 0 };
  const stream = mulberry32(ORACLE_MATH_RANDOM_SEED);
  const [realRandom, realLog] = [Math.random, console.log];
  let active = null;
  Math.random = () => {
    if (active !== null) counts[active]++;
    return stream();
  };
  console.log = () => {};
  const counted = (name, run) => {
    active = name;
    try { return run(); } finally { active = null; }
  };
  const restore = wrapStation(run => counted('buildStation', run));
  try {
    const world = buildWorld();
    const material = counted('birdMaterial', () => npr(BIRD_MATERIAL()));
    const birds = counted('createBirdSystem', () => createBirdSystem({
      perches: world.birdPerches, trackLength: world.length, heightAt: world.heightAt.bind(world),
      canopyHeightAt: world.treeCanopyHeightAt.bind(world), material,
    }));
    return { world, birds, counts, walker: constructedWalker(world) };
  } finally {
    restore();
    Math.random = realRandom;
    console.log = realLog;
  }
}

export function firstCloneBuild() {
  return countedSide({
    wrapStation: wrap => {
      const step = WORLD_BUILD_STEPS.find(entry => entry.name === 'buildStation');
      const real = step.run;
      step.run = function countedStation(world) { return wrap(() => real(world)); };
      return () => { step.run = real; };
    },
    buildWorld: () => createCloneWorld(), npr: cloneNpr, createBirdSystem: createCloneBirds,
  });
}

export async function firstOriginalBuild() {
  const OriginalWorld = await loadOriginalWorldClass();
  const [{ npr }, { createBirdSystem }] = await Promise.all([importOriginal('Materials.js'), importOriginal('BirdSystem.js')]);
  return countedSide({
    wrapStation: wrap => {
      const real = OriginalWorld.prototype.buildStation;
      OriginalWorld.prototype.buildStation = function countedStation(...args) { return wrap(() => real.apply(this, args)); };
      return () => { OriginalWorld.prototype.buildStation = real; };
    },
    buildWorld: () => new OriginalWorld(), npr, createBirdSystem,
  });
}

const transform = object => [xyz(object.position), object.quaternion.toArray(), xyz(object.scale)];

/** The walker as constructed: figure transform, path points, leg targets and leg mesh transforms. */
export function constructedWalker(world) {
  const walker = world.stationWalker;
  return {
    figure: transform(walker.figure),
    path: [walker.start, walker.end, ...walker.stops].map(xyz),
    legs: walker.legs.map(leg => [leg.side, xyz(leg.target), transform(leg.thigh), transform(leg.shin), transform(leg.shoe)]),
    bodyY: walker.rig.body.position.y,
  };
}

/** Child structure under `root`: type, material colour and local transform per node, depth first. */
export function rigTree(root) {
  const colour = object => object.material?.uniforms?.uColor?.value.getHexString() ?? null;
  return [root.type, colour(root), ...transform(root), root.children.map(rigTree)];
}

/** Flock and per-bird records as plain arrays (every field the system initialises). */
export function flockRecords(birds) {
  return birds.flocks.map(flock => [
    flock.id, flock.mode, flock.changedAt, flock.trackDistance, xyz(flock.outward), xyz(flock.tangent), xyz(flock.center), flock.flightHeight,
    flock.birds.map(bird => [
      ...transform(bird.figure), [bird.home, bird.departure, bird.returnStart, bird.previous].map(xyz),
      [bird.velocity, bird.returnVelocity, bird.departureVelocity].map(xyz), bird.airborneDeparture, bird.delay, bird.phase, bird.heading,
    ]),
  ]);
}
