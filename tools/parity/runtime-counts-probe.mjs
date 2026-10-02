// CLI: renderer.info, key world/sim fields and the exact village/windmill state in the identical frozen state on both
// sites, the station section, the post-pass synthetic-input comparison and the hook/debug-menu checks. Usage:
// node tools/parity/runtime-counts-probe.mjs [--target t] [--scenario default|sky-only|both] [--profile p] [--strict] [--skip-checks]
// [--skip-post-probe] [--shot id] (that shot's prepared scene only) [--fields calls,triangles] (renderer fields compared, plus village)
import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchParityBrowser, resolveTargetBaseUrl, stopCloneServer } from './playwright-browser-launcher.mjs';
import { applyShotState, applyHideSets, setRendering, waitFrames } from './page-parity-helpers.mjs';
import { openFrozenSession, prepareShotScene } from './capture-parity-shots.mjs';
import { HIDE_PRESETS, selectShots } from './parity-shot-list.mjs';
import { runDebugMenuChecks, runHookExposureChecks } from './hook-and-debug-menu-browser-checks.mjs';
import { capturePostSyntheticOutputs, comparePostOutputs } from './post-pass-synthetic-input-probe.mjs';
import { probeStationState, compareStationAcrossSites } from './station-runtime-probe.mjs';
import { collectVillageWindmillProbe } from './village-windmill-runtime-probe.mjs';

const DEFAULT_STATE = { mode: 'overview', timeOfDay: 'day', pixelShortSide: null, outline: true };
const consoleText = line => line.slice(line.indexOf(': ') + 2);

// Runs in the page; reads only parity-surface names so both sites answer the same questions.
function collectRuntimeCounts() {
  const d = window.__diorama;
  const round = value => (typeof value === 'number' ? Math.round(value * 1e4) / 1e4 : value);
  const point = vector => (vector ? [vector.x, vector.y, vector.z].map(round) : null);
  const worldPoint = object => (object?.parent ? point(object.getWorldPosition(d.camera.position.clone())) : null);
  const { render, memory, programs } = d.renderer.info;
  const scene = { objects: 0, meshes: 0, visibleMeshes: 0, instanced: 0, instanceCounts: [] };
  d.scene.traverse(object => {
    scene.objects++;
    if (object.isMesh) scene.meshes++;
    if (object.isInstancedMesh) { scene.instanced++; scene.instanceCounts.push(object.count); }
  });
  d.scene.traverseVisible(object => { if (object.isMesh) scene.visibleMeshes++; });
  const w = d.world;
  const rocks = w?.group.children.find(child => child.isInstancedMesh && child.instanceMatrix.count === 80);
  const world = w ? {
    length: round(w.length), stationS: round(w.stationS), bridge: (w.bridge ?? []).map(round),
    houses: (w.houseSmoke?.length ?? 0) / 12, villageHomes: w.villageHomes?.length ?? 0,
    treeInstances: (w.treeLayers ?? []).map(layer => layer.count), rocks: rocks ? rocks.count : null,
    sheep: w.sheepStates?.length ?? 0, trackSheep: w.trackSheep?.length ?? 0, clouds: w.clouds?.length ?? 0,
    windmillRoofHeight: round(w.windmillRoofHeight ?? null), windmill: worldPoint(w.windmillBlades),
    stationClock: worldPoint(w.stationClockMinuteHand), freeCameraStart: point(w.freeCameraStart?.position),
    exclusions: w.exclusions?.length ?? 0, foundations: w.buildingFoundations?.length ?? 0,
    perches: (w.birdPerches ?? []).map(perch => [perch.id, perch.positions.length]),
    heightsSum: round((w.heights ?? []).reduce((sum, value) => sum + value, 0)),
  } : null;
  return {
    renderer: {
      calls: render.calls, triangles: render.triangles, points: render.points, lines: render.lines,
      geometries: memory.geometries, textures: memory.textures, programs: programs ? programs.length : null,
    },
    canvas: [d.renderer.domElement.width, d.renderer.domElement.height], pixelRatio: d.renderer.getPixelRatio(),
    scene, sim: { time: round(d.time), s: round(d.s ?? null), speed: round(d.speed ?? null), mode: d.mode }, world,
    train: d.train ? { cars: d.train.cars.length, totalLength: round(d.train.totalLength) } : null,
    birds: d.birds ? { flocks: d.birds.flocks.length, birds: d.birds.flocks.reduce((sum, flock) => sum + flock.birds.length, 0) } : null,
  };
}

const countScene = async page => ({ ...await page.evaluate(collectRuntimeCounts), village: await page.evaluate(collectVillageWindmillProbe) });

export function diffProbeResults(original, clone, path = '') {
  const comparable = value => value !== null && typeof value === 'object';
  if (!comparable(original) || !comparable(clone) || Array.isArray(original) !== Array.isArray(clone)) {
    const equal = original === clone || (Number.isNaN(original) && Number.isNaN(clone));
    return equal ? [] : [{ path, original, clone }];
  }
  const keys = new Set([...Object.keys(original), ...Object.keys(clone)]);
  return [...keys].flatMap(key => diffProbeResults(original[key], clone[key], path ? `${path}.${key}` : key));
}

const SKY_ONLY_FIELDS = ['calls', 'triangles'];

function diffTargets(original, clone, fields = null) {
  const diff = {};
  for (const scenario of Object.keys(original.scenarios)) {
    const [a, b] = [original.scenarios[scenario], clone.scenarios[scenario]];
    if (!b) continue;
    const compared = fields ?? (scenario === 'sky-only' ? SKY_ONLY_FIELDS : null);
    diff[scenario] = compared
      ? [...compared.flatMap(field => diffProbeResults(a.renderer[field], b.renderer[field], `renderer.${field}`)), ...diffProbeResults(a.village, b.village, 'village')]
      : diffProbeResults(a, b);
  }
  return diff;
}

// One shot's scene exactly as the capture prepares it, rendered twice, then counted.
async function probeShot(browser, target, shot) {
  const { context, page, freeze } = await openFrozenSession(browser, target, await resolveTargetBaseUrl(target), shot.viewport);
  try {
    await prepareShotScene(page, shot);
    await setRendering(page, true);
    await waitFrames(page, 2);
    const counts = await countScene(page);
    return { result: { url: page.url(), webglRenderer: freeze.webglRenderer, pausedAtFreeze: freeze.pausedAtFreeze, scenarios: { [shot.id]: counts }, checks: [] } };
  } finally {
    await context.close();
  }
}

async function probeTarget(browser, target, { scenarios, skipChecks, skipPostProbe }) {
  const baseUrl = await resolveTargetBaseUrl(target);
  const { context, page, freeze } = await openFrozenSession(browser, target, baseUrl, 'desktop');
  const result = { url: page.url(), webglRenderer: freeze.webglRenderer, pausedAtFreeze: freeze.pausedAtFreeze, scenarios: {}, checks: [] };
  let postOutputs = null;
  try {
    await applyShotState(page, DEFAULT_STATE);
    for (const scenario of scenarios) {
      await applyHideSets(page, scenario === 'sky-only' ? HIDE_PRESETS.skyOnly : []);
      await setRendering(page, true);
      await waitFrames(page, 2);
      result.scenarios[scenario] = await countScene(page);
    }
    await applyHideSets(page, []);
    await setRendering(page, false);
    result.station = await probeStationState(page);
    if (!skipPostProbe) postOutputs = await capturePostSyntheticOutputs(page);
    if (!skipChecks) {
      const freezeLines = page.parityConsole.map(consoleText).filter(text => text.startsWith('[PARITY]'));
      result.checks.push({ name: '?parity=freeze pauses at hook time', pass: freeze.pausedAtFreeze === true && freezeLines.includes('[PARITY] Hook installed: freeze'), detail: freezeLines });
      result.checks.push(...await runDebugMenuChecks(page));
    }
  } finally {
    await context.close();
  }
  if (!skipChecks) result.checks.push(...await runHookExposureChecks(browser, target, baseUrl));
  return { result, postOutputs };
}

async function main() {
  const { values } = parseArgs({
    options: {
      target: { type: 'string', default: 'both' }, scenario: { type: 'string', default: 'both' },
      profile: { type: 'string', default: 'angle' }, strict: { type: 'boolean', default: false },
      'skip-checks': { type: 'boolean', default: false }, 'skip-post-probe': { type: 'boolean', default: false },
      shot: { type: 'string' }, fields: { type: 'string' },
    },
  });
  const shot = values.shot ? selectShots({ ids: [values.shot] })[0] : null;
  const fields = values.fields ? values.fields.split(',').map(field => field.trim()).filter(Boolean) : null;
  const targets = values.target === 'both' ? ['original', 'clone'] : [values.target];
  const scenarios = values.scenario === 'both' ? ['default', 'sky-only'] : [values.scenario];
  const { browser, profileName } = await launchParityBrowser(values.profile);
  const output = { generatedAt: new Date().toISOString(), profile: profileName, targets: {}, diff: null, postSynthetic: null, station: null };
  const postOutputs = {};
  try {
    for (const target of targets) {
      const probed = shot ? await probeShot(browser, target, shot)
        : await probeTarget(browser, target, { scenarios, skipChecks: values['skip-checks'], skipPostProbe: values['skip-post-probe'] });
      output.targets[target] = probed.result;
      postOutputs[target] = probed.postOutputs;
    }
    if (!shot) output.station = await compareStationAcrossSites(browser, output.targets);
  } finally {
    await browser.close();
    await stopCloneServer();
  }
  if (output.targets.original && output.targets.clone) output.diff = diffTargets(output.targets.original, output.targets.clone, fields);
  if (postOutputs.original && postOutputs.clone) output.postSynthetic = comparePostOutputs(postOutputs.original, postOutputs.clone);
  const outDir = path.resolve('.parity-output');
  await mkdir(outDir, { recursive: true });
  await writeFile(path.join(outDir, shot ? `probe-${shot.id}.json` : 'probe.json'), `${JSON.stringify(output, null, 2)}\n`);
  let failures = 0;
  for (const [target, result] of Object.entries(output.targets)) {
    for (const [scenario, counts] of Object.entries(result.scenarios)) {
      const r = counts.renderer;
      console.log(`${target} ${scenario}: calls ${r.calls} triangles ${r.triangles} geometries ${r.geometries} textures ${r.textures} programs ${r.programs}`);
    }
    for (const outcome of result.checks) {
      if (!outcome.pass) failures++;
      console.log(`${outcome.pass ? 'PASS' : 'FAIL'} ${target}: ${outcome.name}${outcome.pass ? '' : ` ${JSON.stringify(outcome.detail)}`}`);
    }
  }
  const diffCount = Object.values(output.diff ?? {}).reduce((sum, list) => sum + list.length, 0);
  for (const [scenario, list] of Object.entries(output.diff ?? {})) {
    const village = list.filter(entry => entry.path.startsWith('village')).map(entry => entry.path);
    console.log(`diff ${scenario}: ${list.length} field(s) differ; village ${village.length === 0 ? 'equal' : `differs in ${village.length} (first ${village[0]})`}`);
  }
  if (output.station) {
    const { pass, attempts, differing } = output.station;
    console.log(`${pass ? 'PASS' : 'FAIL'} station probe after ${attempts} attempt(s)${differing.length > 0 ? `: differs in ${differing.join(', ')}` : ''}`);
    if (!pass) failures++;
  }
  if (output.postSynthetic) {
    const worst = Math.max(...Object.values(output.postSynthetic.combinations).map(entry => entry.maxChannelDiff));
    console.log(`${output.postSynthetic.pass ? 'PASS' : 'FAIL'} post pass synthetic inputs: max channel diff ${worst} (limit ${output.postSynthetic.limit})`);
    if (!output.postSynthetic.pass) failures++;
  }
  if (values.strict && (failures > 0 || diffCount > 0)) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
