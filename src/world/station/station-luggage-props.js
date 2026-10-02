// Luggage on the widened platform: the traveler's two upright cases and the grandmother's
// three-case stack. Every case is a body plus trim boxes standing on the platform top (y 0.4).
import { npr } from '../../materials/npr-cel-material-factory.js';
import {
  SUITCASE_LEATHER_OPTIONS, SUITCASE_TRIM_OPTIONS, GRANDMOTHER_SUITCASES, grandmotherSuitcaseLeather,
} from './station-palette-materials.js';
import { addShiftedBox } from './station-site-placement.js';

const PLATFORM_TOP = 0.4;
// Upright cases: outward coefficient, z, width, height (all 0.24 deep).
const TRAVELER_CASES = [
  { coefficient: 0.2, z: 1.67, width: 0.42, height: 0.54 },
  { coefficient: 0.42, z: 2.18, width: 0.34, height: 0.42 },
];
const STACK_COEFFICIENT = -0.48;
const STACK_Z = -4.05;

/** Body, belly band and top handle for each upright case. */
export function buildTravelerSuitcases(site) {
  const leather = npr(SUITCASE_LEATHER_OPTIONS);
  const trim = npr(SUITCASE_TRIM_OPTIONS);
  for (const { coefficient, z, width, height } of TRAVELER_CASES) {
    addShiftedBox(site, [width, height, 0.24], leather, coefficient, PLATFORM_TOP + height / 2, z);
    addShiftedBox(site, [width + 0.02, 0.06, 0.27], trim, coefficient, 0.48, z);
    addShiftedBox(site, [0.16, 0.06, 0.05], trim, coefficient, PLATFORM_TOP + height + 0.04, z);
  }
}

/** Cases lying flat, each on the previous one with a small gap: body, two straps, handle. */
export function buildGrandmotherSuitcaseStack(site) {
  const trim = npr(SUITCASE_TRIM_OPTIONS);
  let base = PLATFORM_TOP;
  for (const { width, depth, height, color } of GRANDMOTHER_SUITCASES) {
    const middleY = base + height / 2;
    const leather = grandmotherSuitcaseLeather(color);
    addShiftedBox(site, [depth, height, width], leather, STACK_COEFFICIENT, middleY, STACK_Z);
    for (const strapSide of [-1, 1]) {
      const strapZ = STACK_Z + strapSide * width * 0.35;
      addShiftedBox(site, [depth + 0.015, height + 0.015, 0.045], trim, STACK_COEFFICIENT, middleY, strapZ);
    }
    addShiftedBox(site, [0.08, 0.045, 0.17], trim, STACK_COEFFICIENT, base + height + 0.025, STACK_Z);
    base += height + 0.015;
  }
}
