// Whole-scene digests shared by node tests and page probes. Every export is self-contained (no imports,
// no outer names) so tools can hand it to page.evaluate; each reads parity-surface names only and never
// refreshes matrices (matrixWorld is read as the last render or step left it).

/** Layout facts of the built world: scalars as-is, lists as counts, typed arrays as FNV-1a hex. */
export function summarizeWorld(d) {
  const w = d.world;
  const fnv = array => {
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    let hash = 0x811c9dc5;
    for (let i = 0; i < bytes.length; i++) hash = Math.imul(hash ^ bytes[i], 0x01000193) >>> 0;
    return hash.toString(16).padStart(8, '0');
  };
  const translation = object => (object ? Array.from(object.matrixWorld.elements.slice(12, 15)) : null);
  const fine = value => Math.round(value * 1e6) / 1e6;
  return {
    length: w.length,
    bridge: Array.from(w.bridge),
    stationS: w.stationS,
    stationFrameIndex: Math.round(((w.stationS - 4.5) / w.length) * 1200),
    freeCameraStart: { position: w.freeCameraStart.position.toArray(), target: w.freeCameraStart.target.toArray() },
    stationClockPosition: translation(w.stationClockMinuteHand),
    exclusions: w.exclusions.length,
    buildingFoundations: w.buildingFoundations.length,
    villageHomes: w.villageHomes.length,
    houses: w.houseSmoke.length / 12,
    windmillRoofHeight: w.windmillRoofHeight,
    windmillPosition: translation(w.windmillBlades),
    treeLayerCounts: w.treeLayers.map(layer => layer.count),
    sheepStates: w.sheepStates.map(sheep => [sheep.x, sheep.z, sheep.direction, sheep.size].map(fine)),
    trackSheep: w.trackSheep.map(sheep => [sheep.route.id, sheep.route.mode]),
    clouds: w.clouds.length,
    birdPerches: w.birdPerches.map(perch => [perch.id, perch.positions.length]),
    noShadow: w.noShadow.length,
    stationTravelers: w.stationTravelers.length,
    heightsFnv: fnv(w.heights),
    canopyFnv: fnv(w.treeCanopyHeights),
  };
}

/** Ordered lists: scene children, glows re-derived by traversal, and the shadow-hidden list. */
export function summarizeOrderedLists(d) {
  const derived = [];
  d.scene.traverse(object => {
    const material = object.material;
    if (object.isMesh && material && material.isShaderMaterial && material.name === 'night-light-glow') derived.push(object);
  });
  const own = d.nightGlows ?? [];
  return {
    sceneChildren: d.scene.children.map(child => `${child.type}:${child.name}:${child.children.length}`),
    derivedGlows: {
      count: derived.length,
      positions: derived.map(glow => glow.position.toArray().map(value => Math.round(value * 1e3) / 1e3)),
    },
    ctxGlowsMatch: own.length === derived.length && derived.every((glow, index) => own[index] === glow),
    shadowHidden: (d.shadowHiddenObjects ?? []).map(object => `${object.type}:${object.name}`),
  };
}

/** [name, instance count, vertex count] per InstancedMesh in traversal order. */
export function summarizeInstancedCounts(root) {
  const rows = [];
  root.traverse(object => {
    if (object.isInstancedMesh) rows.push([object.name, object.count, object.geometry.attributes.position.count]);
  });
  return rows;
}

/** Browser only: FNV-1a over the pixels of the first CanvasTexture found on a material map. */
export function hashStationSignCanvas(scene) {
  let canvas = null;
  scene.traverse(object => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!canvas && material && material.map && material.map.isCanvasTexture) canvas = material.map.image;
    }
  });
  if (!canvas) return null;
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let hash = 0x811c9dc5;
  for (let i = 0; i < pixels.length; i++) hash = Math.imul(hash ^ pixels[i], 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
