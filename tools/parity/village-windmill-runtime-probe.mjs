// Village and windmill section of the runtime probe: exact (unrounded) placement and animation state,
// so equal values on both sites prove the layout and the smoke/rotor wiring through world.update.

// Runs in the page; parity-surface names only. Null when the site has no village yet.
export function collectVillageWindmillProbe() {
  const d = window.__diorama;
  const world = d.world;
  if (!world?.houseSmoke?.length) return null;
  const triple = vector => [vector.x, vector.y, vector.z];
  const windmill = world.windmillBlades?.parent ?? null;
  const worldPosition = windmill ? windmill.getWorldPosition(d.camera.position.clone()) : null;
  // world.group is the identity, so the windmill's own quaternion is its world rotation, without decomposition noise.
  const rotation = windmill?.quaternion;
  return {
    houseCount: world.houseSmoke.length / 12,
    villageHomePositions: (world.villageHomes ?? []).map(home => triple(home.house.position)),
    windmillPosition: worldPosition && triple(worldPosition),
    windmillQuaternion: rotation ? [rotation.x, rotation.y, rotation.z, rotation.w] : null,
    windmillRoofHeight: world.windmillRoofHeight ?? null,
    bladeChildCount: world.windmillBlades?.children.length ?? null,
    bladeRotationZ: world.windmillBlades?.rotation.z ?? null,
    smokeTransforms: world.houseSmoke.map(({ mesh }) => [...triple(mesh.position), ...triple(mesh.scale), mesh.rotation.y]),
  };
}
