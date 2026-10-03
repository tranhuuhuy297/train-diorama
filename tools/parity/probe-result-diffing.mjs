// Leaf-by-leaf diff of runtime probe results between the original and the clone, per scenario.

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

// With a field list (explicit, or the sky-only default) only those renderer fields plus the village section are compared.
export function diffTargets(original, clone, fields = null) {
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
