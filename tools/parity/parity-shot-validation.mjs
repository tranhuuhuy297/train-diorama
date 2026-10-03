// Structural checks for shot records: known enum values and hide sets, dom selectors, regions, enough
// stepped time when transients stay visible, reference names, in-page poses and same-site relations.
import { PARITY_STAGES, THRESHOLDS, HIDE_SETS, HIDE_PRESETS, expandHideSets } from './parity-shot-stages-and-hide-sets.mjs';
import { REGION_NAMES } from './shot-region-projection.mjs';
import { IN_PAGE_CAMERA_POSES } from './page-shot-actions.mjs';

const ALLOWED = {
  kind: ['3d', 'dom'], viewport: ['desktop', 'mobile'], mode: ['overview', 'orbit', 'side', 'bridge'],
  timeOfDay: ['day', 'evening', 'night'], pixelShortSide: [null, 720, 540, 360], thresholdClass: Object.keys(THRESHOLDS),
  stage: PARITY_STAGES,
};
const REFERENCE_NAME = /^\d{2}[a-z]?-[a-z0-9-]+\.png$/;
const TRANSIENT_LIFETIME_SECONDS = 3.6;

function shotErrors(candidate) {
  const errors = [];
  for (const [field, allowed] of Object.entries(ALLOWED)) {
    if (!allowed.includes(candidate[field])) errors.push(`${candidate.id}: unknown ${field} ${candidate[field]}`);
  }
  for (const name of candidate.hide) {
    if (!HIDE_SETS.includes(name) && !Object.hasOwn(HIDE_PRESETS, name)) errors.push(`${candidate.id}: unknown hide set ${name}`);
  }
  if (candidate.kind === 'dom' && !(candidate.selectors?.length > 0)) errors.push(`${candidate.id}: dom shot without selectors`);
  for (const name of candidate.regions) if (!REGION_NAMES.includes(name)) errors.push(`${candidate.id}: unknown region ${name}`);
  const hidden = expandHideSets(candidate.hide);
  const transientsHidden = hidden.includes('allButWorldCore') || (hidden.includes('puffs') && hidden.includes('sparks'));
  if (candidate.kind === '3d' && !transientsHidden && !(candidate.seconds > TRANSIENT_LIFETIME_SECONDS)) {
    errors.push(`${candidate.id}: transients visible but only ${candidate.seconds} s stepped`);
  }
  if (candidate.reference !== null && !REFERENCE_NAME.test(candidate.reference)) errors.push(`${candidate.id}: bad reference ${candidate.reference}`);
  if (candidate.inPageCameraPose && !IN_PAGE_CAMERA_POSES.includes(candidate.inPageCameraPose)) errors.push(`${candidate.id}: unknown in-page pose ${candidate.inPageCameraPose}`);
  return errors;
}

// Same-site relations: `to` must be another listed shot and `expect` 'differs' (with a pixel floor) or 'identical'.
function relationErrors(candidate, ids) {
  const { relation } = candidate;
  if (!relation) return [];
  const known = ids.has(relation.to) && relation.to !== candidate.id;
  const shape = relation.expect === 'identical' || (relation.expect === 'differs' && relation.minOverFraction > 0);
  return known && shape ? [] : [`${candidate.id}: bad relation ${JSON.stringify(relation)}`];
}

/** Every problem found in `shots` (empty when the list is valid). */
export function shotListErrors(shots) {
  const errors = [];
  const seen = new Set();
  for (const candidate of shots) {
    if (seen.has(candidate.id)) errors.push(`${candidate.id}: duplicate id`);
    seen.add(candidate.id);
    errors.push(...shotErrors(candidate));
  }
  for (const candidate of shots) errors.push(...relationErrors(candidate, seen));
  return errors;
}
