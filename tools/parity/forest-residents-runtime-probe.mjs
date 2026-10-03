// Residents, forest and rocks section of the runtime probe: raw counts read in the identical frozen state
// on both sites, and the expected relation between them (only a missing sheep flock may shift the exclusions).

// Runs in the page; parity-surface names only. Null when the site has no forest yet.
export function collectForestResidentsProbe() {
  const world = window.__diorama.world;
  const layers = world?.treeLayers ?? [];
  if (layers.length === 0) return null;
  const children = world.group.children;
  const rocks = children[children.indexOf(layers.at(-1)) + 1] ?? null;
  let residentMeshCount = 0;
  for (const { home } of world.villageResidents?.residents ?? []) home.traverse(node => { residentMeshCount += node.isMesh ? 1 : 0; });
  return {
    treeCounts: layers.map(layer => layer.count),
    rockCount: rocks?.isInstancedMesh ? rocks.count : null,
    residentMeshCount,
    exclusionCount: world.exclusions.length,
    // The flock adds three trackside clearings to the exclusions.
    hasSheepFlock: Boolean(world.sheep),
  };
}

/** Counts must match; exclusions may differ only by the three clearings of a flock one site lacks. */
export function compareForestResidentsProbe(original, clone) {
  if (!original || !clone) return { pass: false, failures: [`forest section missing (original ${Boolean(original)}, clone ${Boolean(clone)})`] };
  const failures = [];
  for (const field of ['treeCounts', 'rockCount', 'residentMeshCount']) {
    if (JSON.stringify(original[field]) !== JSON.stringify(clone[field])) failures.push(`${field}: original ${JSON.stringify(original[field])} clone ${JSON.stringify(clone[field])}`);
  }
  const expectedDelta = 3 * (Number(clone.hasSheepFlock) - Number(original.hasSheepFlock));
  const delta = clone.exclusionCount - original.exclusionCount;
  if (delta !== expectedDelta) failures.push(`exclusionCount delta ${delta} (expected ${expectedDelta})`);
  return { pass: failures.length === 0, failures, exclusionDelta: delta };
}
