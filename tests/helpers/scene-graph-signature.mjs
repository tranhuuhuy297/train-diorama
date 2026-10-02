// Scene-graph signatures: one canonical key per object in depth-first order (transform, material,
// geometry and instance hashes), compared as a multiset or index by index. Shader text is never hashed.
import '../../src/core/disable-three-color-management.js';
import { hashNumbers } from './quantised-number-hashing.mjs';
import { FINE_SCALE, materialKey, geometryKey, instancesKey } from './scene-signature-key-builders.mjs';

export { hashNumbers } from './quantised-number-hashing.mjs';
export { SHARED_UNIFORM_NAMES } from './scene-signature-key-builders.mjs';

const REPORT_VALUE_LIMIT = 160;

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

// Stable JSON: object keys sorted at every depth.
function canonicalJson(value) {
  return JSON.stringify(value, (name, inner) => (isPlainObject(inner)
    ? Object.fromEntries(Object.keys(inner).sort().map(key => [key, inner[key]]))
    : inner));
}

function memoised(cache, owner, build) {
  if (!cache.has(owner)) cache.set(owner, build(owner));
  return cache.get(owner);
}

// three reports InstancedMesh as type 'Mesh'; the label keeps instanced and plain meshes apart in paths.
const typeLabel = object => (object.isInstancedMesh ? 'InstancedMesh' : object.type);

export function sceneGraphSignature(root, { exclude = new Set(), geometry = true } = {}) {
  root.updateMatrixWorld(true);
  const materialCache = new Map();
  const geometryCache = new Map();
  const entries = [];
  const visit = (object, path, typePath) => {
    if (exclude.has(object)) return;
    entries.push({ path, key: canonicalJson({
      typePath, type: typeLabel(object), name: object.name, visible: object.visible,
      frustumCulled: object.frustumCulled, renderOrder: object.renderOrder,
      matrixWorld: hashNumbers(object.matrixWorld.elements, FINE_SCALE),
      material: object.material ? memoised(materialCache, object.material, materialKey) : null,
      geometry: geometry && object.geometry ? memoised(geometryCache, object.geometry, geometryKey) : null,
      instances: object.isInstancedMesh ? instancesKey(object) : null,
    }) });
    object.children.forEach((child, index) => visit(child, `${path}/${index}:${typeLabel(child)}`, `${typePath}>${typeLabel(child)}`));
  };
  visit(root, typeLabel(root), typeLabel(root));
  return entries;
}

function unmatched(side, other) {
  const available = new Map();
  for (const { key } of other) available.set(key, (available.get(key) ?? 0) + 1);
  return side.filter(({ key }) => {
    const left = available.get(key) ?? 0;
    if (left > 0) available.set(key, left - 1);
    return left === 0;
  });
}

function fieldDifferences(expectedEntry, actualEntry) {
  if (!expectedEntry || !actualEntry) return [{ field: 'entry', expected: expectedEntry ? 'present' : null, actual: actualEntry ? 'present' : null }];
  const expected = JSON.parse(expectedEntry.key);
  const actual = JSON.parse(actualEntry.key);
  const differences = [];
  const differs = (a, b) => JSON.stringify(a) !== JSON.stringify(b);
  for (const field of new Set([...Object.keys(expected), ...Object.keys(actual)])) {
    const [a, b] = [expected[field], actual[field]];
    if (!differs(a, b)) continue;
    if (!isPlainObject(a) || !isPlainObject(b)) { differences.push({ field, expected: a, actual: b }); continue; }
    for (const inner of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (differs(a[inner], b[inner])) differences.push({ field: `${field}.${inner}`, expected: a[inner], actual: b[inner] });
    }
  }
  // Identical keys can still be unmatched when one side holds more copies of them.
  return differences.length > 0 ? differences : [{ field: 'copies', expected: 'more', actual: 'fewer' }];
}

const typePathOf = entry => JSON.parse(entry.key).typePath;

function firstMultisetPair(expected, actual, missing, extra) {
  if (missing.length > 0) {
    const lost = missing[0];
    const partner = actual.find(entry => entry.path === lost.path)
      ?? extra.find(entry => typePathOf(entry) === typePathOf(lost));
    return [lost, partner ?? null];
  }
  return [null, extra[0]];
}

function shorten(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text && text.length > REPORT_VALUE_LIMIT ? `${text.slice(0, REPORT_VALUE_LIMIT - 3)}...` : text;
}

export function compareSceneSignatures(expected, actual, { labels = ['original', 'clone'], ordered = false } = {}) {
  let missingCount = 0;
  let extraCount = 0;
  let pair = null;
  if (ordered) {
    for (let index = 0; index < Math.max(expected.length, actual.length); index++) {
      const [a, b] = [expected[index], actual[index]];
      if (a && b && a.key === b.key) continue;
      if (a) missingCount++;
      if (b) extraCount++;
      pair ??= [a ?? null, b ?? null];
    }
  } else {
    const missing = unmatched(expected, actual);
    const extra = unmatched(actual, expected);
    [missingCount, extraCount] = [missing.length, extra.length];
    if (missingCount + extraCount > 0) pair = firstMultisetPair(expected, actual, missing, extra);
  }
  if (!pair) return { equal: true, missingCount: 0, extraCount: 0, firstMismatch: null, report: `Scene signatures equal (${expected.length} entries)` };
  const firstMismatch = { path: (pair[0] ?? pair[1]).path, differingFields: fieldDifferences(pair[0], pair[1]) };
  const lead = firstMismatch.differingFields[0];
  const report = `Scene signature mismatch: ${missingCount} missing / ${extraCount} extra (${labels[0]}/${labels[1]}). `
    + `First at ${firstMismatch.path}: ${lead.field} ${labels[0]}=${shorten(lead.expected)} ${labels[1]}=${shorten(lead.actual)}`;
  return { equal: false, missingCount, extraCount, firstMismatch, report };
}
