// Full original and clone World builds with Math.random draws counted per named build step (UUID
// allocation parity). The original's steps are prototype methods, the clone's are registry entries;
// both are wrapped for the build only and always restored. console.log is silenced meanwhile.
import { loadOriginalWorldClass } from './original-world-stepper.mjs';
import { createCloneWorld } from './clone-world-factory.mjs';
import { WORLD_BUILD_STEPS } from '../../src/world/world-build-steps.js';

// Wraps each named step through `install(name, wrap)` while `build` runs; returns per-step draw counts.
function countDraws(names, install, build) {
  const counts = Object.fromEntries(names.map(name => [name, 0]));
  const realRandom = Math.random;
  const realLog = console.log;
  let active = null;
  Math.random = () => {
    if (active !== null) counts[active]++;
    return realRandom();
  };
  console.log = () => {};
  const restores = names.map(name => install(name, run => function countedStep(...args) {
    active = name;
    try {
      return run.apply(this, args);
    } finally {
      active = null;
    }
  }));
  try {
    return { world: build(), counts };
  } finally {
    restores.forEach(restore => restore());
    Math.random = realRandom;
    console.log = realLog;
  }
}

/** Original World (full build) with draws counted inside the named prototype methods. */
export async function buildCountedOriginalWorld(names) {
  const OriginalWorld = await loadOriginalWorldClass();
  const prototype = OriginalWorld.prototype;
  return countDraws(names, (name, wrap) => {
    const real = prototype[name];
    prototype[name] = wrap(real);
    return () => { prototype[name] = real; };
  }, () => new OriginalWorld());
}

/** Clone World (full build) with draws counted inside the named registry steps. */
export function buildCountedCloneWorld(names) {
  return countDraws(names, (name, wrap) => {
    const step = WORLD_BUILD_STEPS.find(entry => entry.name === name);
    const real = step.run;
    step.run = wrap(real);
    return () => { step.run = real; };
  }, () => createCloneWorld());
}
