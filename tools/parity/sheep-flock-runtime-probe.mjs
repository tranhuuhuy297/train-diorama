// Sheep section of the runtime probe, on a fresh frozen page per site with the default shot state: layer
// counts, the three rail-sheep routes, the first pasture spots, the stranding candidates, and the hop
// frames K1..K3 found by fixed-dt stepping. Equal values on both sites prove the flock layout and timing.
import { applyShotState, stepFrames, PARITY_SEED } from './page-parity-helpers.mjs';
import { openFrozenSession } from './capture-parity-shots.mjs';
import { SHEEP_HOP_K2 } from './sheep-flock-parity-shots.mjs';

const DEFAULT_STATE = { mode: 'overview', timeOfDay: 'day', pixelShortSide: null, outline: true };
// Hops are counted only for startles that begin after this many frames, and searched for this long.
export const HOP_STARTLE_AFTER_FRAME = 60;
export const HOP_SEARCH_FRAMES = 4000;

// Runs in the page; parity-surface names only. Null when the site has no flock yet.
export function collectSheepFlockProbe() {
  const world = window.__diorama.world;
  if (!world?.sheep) return null;
  const triple = vector => [vector.x, vector.y, vector.z];
  const states = world.sheepStates;
  const pasture = states.filter(sheep => !sheep.route);
  const clearings = world.exclusions.slice(-3);
  const nearClearing = sheep => clearings.some(spot => Math.hypot(spot.x - sheep.x, spot.z - sheep.z) < 2.2);
  return {
    counts: [world.sheep.count, world.sheepLegs.count, world.sheepEars.count],
    routes: world.trackSheep.map(({ route }) => ({
      id: route.id, distance: route.distance, center: triple(route.center), outward: triple(route.outward), tangent: triple(route.tangent),
    })),
    firstPasture: pasture.slice(0, 3).map(sheep => [sheep.x, sheep.z]),
    strandingCandidates: pasture.filter(nearClearing).length,
  };
}

// Runs in the page: wraps this world's update so every stepped frame records rail-sheep mode changes.
function watchSheepHops(startleAfter) {
  const world = window.__diorama.world;
  const update = world.update;
  const watch = { frame: 0, previous: world.trackSheep.map(({ route }) => route.mode), startedAt: [0, 0, 0], hops: [null, null, null] };
  window.__parityHopWatch = watch;
  world.update = function watchedUpdate(...args) {
    update.apply(this, args);
    watch.frame += 1;
    this.trackSheep.forEach(({ route }, index) => {
      const was = watch.previous[index];
      watch.previous[index] = route.mode;
      if (route.mode === was) return;
      // A startle and a jump inside one step start their episode on that same frame.
      if (route.mode === 'startled' || (route.mode === 'escaping' && was !== 'startled')) watch.startedAt[index] = watch.frame;
      if (route.mode === 'escaping' && watch.hops[index] === null && watch.startedAt[index] > startleAfter) watch.hops[index] = watch.frame;
    });
  };
}

function stopWatchingSheepHops() {
  // The wrapper is an own property over the class method.
  delete window.__diorama.world.update;
  return window.__parityHopWatch.hops;
}

/** Fresh frozen page, default state, flock facts, then K1..K3 from the first frame after the preamble. */
export async function probeSheepFlock(browser, target, baseUrl) {
  const { context, page } = await openFrozenSession(browser, target, baseUrl, 'desktop');
  try {
    await applyShotState(page, DEFAULT_STATE);
    const flock = await page.evaluate(collectSheepFlockProbe);
    if (!flock) return null;
    await page.evaluate(watchSheepHops, HOP_STARTLE_AFTER_FRAME);
    await stepFrames(page, HOP_SEARCH_FRAMES, { dt: 1 / 60, seed: PARITY_SEED });
    return { ...flock, hopFrames: await page.evaluate(stopWatchingSheepHops) };
  } finally {
    await context.close();
  }
}

/** Every field must be equal on both sites, and each rail sheep must have hopped within the search. */
export function compareSheepFlockProbes(original, clone) {
  if (!original || !clone) return { pass: false, failures: [`sheep section missing (original ${Boolean(original)}, clone ${Boolean(clone)})`], hopFrames: null };
  const failures = [];
  for (const field of ['counts', 'routes', 'firstPasture', 'strandingCandidates', 'hopFrames']) {
    if (JSON.stringify(original[field]) !== JSON.stringify(clone[field])) failures.push(`${field}: original ${JSON.stringify(original[field])} clone ${JSON.stringify(clone[field])}`);
  }
  if (original.hopFrames.includes(null)) failures.push(`no hop found for every rail sheep: ${JSON.stringify(original.hopFrames)}`);
  // The hop shots step to fixed frames around K2.
  if (original.hopFrames[1] !== SHEEP_HOP_K2) failures.push(`K2 ${original.hopFrames[1]} differs from the shot list's ${SHEEP_HOP_K2}`);
  return { pass: failures.length === 0, failures, hopFrames: original.hopFrames };
}

/** Probes every target, then compares when both sites ran; per-site values stay in the result. */
export async function probeSheepAcrossSites(browser, targets, resolveBaseUrl) {
  const sites = {};
  for (const target of targets) sites[target] = await probeSheepFlock(browser, target, await resolveBaseUrl(target));
  const comparison = sites.original !== undefined && sites.clone !== undefined ? compareSheepFlockProbes(sites.original, sites.clone) : null;
  return { sites, comparison };
}
