// Partial builds of the original World for node parity: build-step methods are swapped on the
// prototype for one construction (skip → no-op, stop target → run then bail out with a sentinel).
import { importOriginal } from './original-module-loader.mjs';
import { installMinimalDomShim } from './minimal-dom-shim.mjs';

// Build-step methods in the order the original World constructor calls them.
export const ORIGINAL_BUILD_STEPS = Object.freeze([
  'findBridge', 'buildHeightmap', 'buildTrack', 'buildBridge', 'buildStation', 'buildVillage', 'buildWindmill',
  'buildTerrain', 'buildTrees', 'buildRocksAndSheep', 'buildWater', 'buildClouds', 'buildBalloon',
  'buildTracksideBirdPerches',
]);

export const CLONE_TO_ORIGINAL_STEP = Object.freeze({ buildBirdPerches: 'buildTracksideBirdPerches' });

// Constructor-inline work in the original: no method exists to intercept.
export const INLINE_ORIGINAL_STEPS = Object.freeze(['buildTrackFrames', 'createVillageResidents']);

const STOP_SENTINEL = Symbol('original-world-stop-after');

export function toOriginalStep(name) {
  if (INLINE_ORIGINAL_STEPS.includes(name)) {
    throw new Error(`${name} is inline in the original World constructor; it cannot be stopped at or skipped`);
  }
  const mapped = Object.hasOwn(CLONE_TO_ORIGINAL_STEP, name) ? CLONE_TO_ORIGINAL_STEP[name] : name;
  if (!ORIGINAL_BUILD_STEPS.includes(mapped)) throw new Error(`Unknown original build step: ${name}`);
  return mapped;
}

export async function loadOriginalWorldClass() {
  installMinimalDomShim();
  // Diorama first: it pulls Materials in before World, matching the browser's evaluation order.
  await importOriginal('Diorama.js');
  const { World } = await importOriginal('World.js');
  return World;
}

export async function buildOriginalWorld({ stopAfter = null, skip = [] } = {}) {
  const stopTarget = stopAfter === null ? null : toOriginalStep(stopAfter);
  const skipped = new Set(skip.map(toOriginalStep));
  if (stopTarget !== null && skipped.has(stopTarget)) {
    throw new Error(`Build step ${stopAfter} cannot be both skipped and the stop target`);
  }
  const World = await loadOriginalWorldClass();
  const prototype = World.prototype;
  const savedMethods = new Map();
  let capturedWorld = null;
  const started = performance.now();
  // Everything from the first patch to the restore is synchronous, so concurrent callers never interleave.
  try {
    for (const name of skipped) {
      savedMethods.set(name, prototype[name]);
      prototype[name] = function skippedBuildStep() {};
    }
    if (stopTarget !== null) {
      const realStep = prototype[stopTarget];
      savedMethods.set(stopTarget, realStep);
      prototype[stopTarget] = function stopAfterBuildStep(...args) {
        realStep.apply(this, args);
        capturedWorld = this;
        throw STOP_SENTINEL;
      };
    }
    const world = new World();
    return { world, stoppedAfter: null, milliseconds: performance.now() - started };
  } catch (error) {
    if (error !== STOP_SENTINEL) throw error;
    return { world: capturedWorld, stoppedAfter: stopAfter, milliseconds: performance.now() - started };
  } finally {
    for (const [name, method] of savedMethods) prototype[name] = method;
  }
}
