// Named hide sets applied in the page, identically on both sites (a family a site lacks hides nothing).
// The in-page function is exported so node tests can run it against a fake window.__diorama.

// "uColor hex|uStipple" signatures of the flat-coloured world-core materials (ballast, rail, sleeper,
// plinth wood and trim, bridge red, dark red and stone); each pair is unique in the scene.
export const WORLD_CORE_MATERIAL_KEYS = Object.freeze([
  'a39a8c|0.5', '8f8f9e|0.05', '6e4a32|0.25', '6b4630|0.12', '3f2a1f|0.1', 'b8432f|0.12', '8a2f24|0.1', 'b9ae98|0.35',
]);

// Runs inside the page: undoes the previous hide set, then hides every requested family.
export function applyHideSetsInPage({ requested, worldCoreKeys }) {
  const d = window.__diorama;
  const previous = window.__parityHidden;
  // Reverse order, so an object hidden by two families gets its original visibility back.
  for (let index = previous.length - 1; index >= 0; index--) previous[index].object.visible = previous[index].visible;
  window.__parityHidden = [];
  const worldCore = new Set(worldCoreKeys);
  // Terrain (FLOWERS) and skirt (STRATA) by define, everything else by colour and stipple.
  const isWorldCoreMaterial = material => {
    const defines = material?.defines;
    if (defines && (Object.hasOwn(defines, 'FLOWERS') || Object.hasOwn(defines, 'STRATA'))) return true;
    const color = material?.uniforms?.uColor?.value;
    const stipple = material?.uniforms?.uStipple?.value;
    return Boolean(color?.isColor) && stipple !== undefined && worldCore.has(`${color.getHexString()}|${stipple}`);
  };
  const resolvers = {
    world: () => [d.world?.group],
    train: () => [d.train?.group],
    birds: () => [d.birds?.group],
    puffs: () => (d.puffs ?? []).map(puff => puff.mesh),
    sparks: () => [d.brakeSparks?.mesh],
    clouds: () => (d.world?.clouds ?? []).map(cloud => cloud.group),
    trees: () => d.world?.treeLayers ?? [],
    stationFigures: () => (d.world?.stationTravelers ?? []).map(traveler => traveler.figure),
    sheep: () => [d.world?.sheep, d.world?.sheepLegs, d.world?.sheepEars],
    balloon: () => [d.world?.balloon],
    villageResidents: () => {
      const residents = d.world?.villageResidents;
      return [...(residents?.residents ?? []).map(resident => resident.figure), residents?.dog];
    },
    houseSmoke: () => (d.world?.houseSmoke ?? []).map(puff => puff.mesh),
    // Water surface and waterfall: the only direct world.group meshes whose shader has no flat-colour uniform.
    water: () => (d.world?.group.children ?? []).filter(child => child.isMesh && child.material?.uniforms && !child.material.uniforms.uColor),
    // What a world built only up to the windmill (plus its terrain) lacks: every world.group child after
    // the windmill and the 4 terrain meshes that follow it, the station figures and the bird flocks.
    unbuiltAfterWindmill: () => {
      const children = d.world?.group.children ?? [];
      const windmillAt = children.indexOf(d.world?.windmillBlades?.parent);
      const later = windmillAt < 0 ? [] : children.slice(windmillAt + 5);
      return [...later, ...(d.world?.stationTravelers ?? []).map(traveler => traveler.figure), d.birds?.group];
    },
    allButWorldCore: () => {
      const meshes = [];
      d.scene.traverse(object => {
        if (object.isMesh && object !== d.sky && !isWorldCoreMaterial(object.material)) meshes.push(object);
      });
      return meshes;
    },
  };
  const counts = {};
  for (const name of requested) {
    if (!resolvers[name]) throw new Error(`Unknown hide set: ${name}`);
    const objects = resolvers[name]().filter(Boolean);
    for (const object of objects) {
      window.__parityHidden.push({ object, visible: object.visible });
      object.visible = false;
    }
    counts[name] = objects.length;
  }
  return counts;
}

export async function applyHideSets(page, names) {
  return page.evaluate(applyHideSetsInPage, { requested: names, worldCoreKeys: WORLD_CORE_MATERIAL_KEYS });
}
