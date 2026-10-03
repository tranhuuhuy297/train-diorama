// Per-scenario probe sections beyond renderer.info: collected in the page after the counts, and judged
// pairwise (original vs clone) into PASS/FAIL lines. The village section is judged by the field diff.
import { collectVillageWindmillProbe } from './village-windmill-runtime-probe.mjs';
import { collectForestResidentsProbe, compareForestResidentsProbe } from './forest-residents-runtime-probe.mjs';
import { collectWaterCloudsBalloonProbe, compareWaterCloudsBalloonProbe } from './water-clouds-balloon-runtime-probe.mjs';
import { collectStationTravelersAndBirdsProbe, compareStationTravelersAndBirdsProbe } from './station-travelers-and-birds-runtime-probe.mjs';

export async function collectScenarioSections(page) {
  return {
    village: await page.evaluate(collectVillageWindmillProbe),
    forest: await page.evaluate(collectForestResidentsProbe),
    waterCloudsBalloon: await page.evaluate(collectWaterCloudsBalloonProbe),
    stationTravelersAndBirds: await page.evaluate(collectStationTravelersAndBirdsProbe),
  };
}

/** [{label, pass, detail}] for one scenario; `detail` is printed after the label. */
export function judgeScenarioSections(original, clone) {
  const forest = compareForestResidentsProbe(original.forest, clone.forest);
  const sky = compareWaterCloudsBalloonProbe(original.waterCloudsBalloon, clone.waterCloudsBalloon);
  const life = compareStationTravelersAndBirdsProbe(original.stationTravelersAndBirds, clone.stationTravelersAndBirds);
  return [
    { label: 'forest', pass: forest.pass, detail: forest.pass ? `counts equal, exclusion delta ${forest.exclusionDelta}` : forest.failures.join('; ') },
    { label: 'water/clouds/balloon', pass: sky.pass, detail: sky.failures.join('; ') },
    { label: 'travelers/birds', pass: life.pass, detail: life.failures.join('; ') },
  ];
}
