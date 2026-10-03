// Water, cloud and balloon section of the runtime probe, read in the identical frozen state on both sites:
// sim time, the 33-cloud layout (clouds are the last world.rand consumer, so equal layouts prove the whole
// placement stream), the windmill roof height, the balloon position, and water/waterfall presence.

export const EXPECTED_CLOUD_COUNT = 33;
export const EXPECTED_CLOUD_INSTANCES = 464;
export const EXPECTED_ROOF_HEIGHT = 22.266444503377606;
const BALLOON_TOLERANCE = 1e-6;

// Runs in the page; parity-surface names only, full float precision. Null when the site has no balloon yet.
export function collectWaterCloudsBalloonProbe() {
  const d = window.__diorama;
  const world = d.world;
  if (!world?.balloonFlame) return null;
  const triple = vector => [vector.x, vector.y, vector.z];
  const children = world.group.children;
  const waterAt = children.findIndex(child => child.isMesh && child.material?.uniforms?.uHeight);
  const water = children[waterAt] ?? null;
  const waterfall = waterAt < 0 ? null : children[waterAt + 1] ?? null;
  const clouds = world.clouds.map(cloud => ({
    position: triple(cloud.position), speed: cloud.speed, travelWidth: cloud.travelWidth,
    instanceCount: cloud.group.children.length === 1 && cloud.group.children[0].isInstancedMesh ? cloud.group.children[0].count : null,
  }));
  return {
    time: d.time,
    cloudCount: world.clouds.length,
    clouds,
    instanceTotal: clouds.reduce((sum, cloud) => sum + (cloud.instanceCount ?? 0), 0),
    windmillRoofHeight: world.windmillRoofHeight,
    balloon: triple(world.balloon.position),
    water: water && {
      heightTexBound: water.material.uniforms.uHeight.value === world.heightTex,
      size: water.material.uniforms.uSize.value, inNoShadow: world.noShadow.includes(water),
    },
    waterfall: waterfall?.isMesh ? {
      side: waterfall.material.side, vertices: waterfall.geometry.attributes.position.count,
      indices: waterfall.geometry.index?.count ?? null, inNoShadow: world.noShadow.includes(waterfall),
    } : null,
  };
}

// The balloon's closed-form flight position at sim time t.
export function balloonPositionAt(t) {
  const heading = t * 0.035;
  return [Math.cos(heading) * 34, 27 + Math.sin(t * 0.5) * 1.2, Math.sin(heading) * 26 - 4];
}

function expectations(section, label) {
  const failures = [];
  const expect = (ok, message) => { if (!ok) failures.push(`${label} ${message}`); };
  expect(section.cloudCount === EXPECTED_CLOUD_COUNT, `cloud count ${section.cloudCount}`);
  expect(section.instanceTotal === EXPECTED_CLOUD_INSTANCES, `cloud instances ${section.instanceTotal}`);
  expect(section.windmillRoofHeight === EXPECTED_ROOF_HEIGHT, `roof height ${section.windmillRoofHeight}`);
  const flight = balloonPositionAt(section.time);
  expect(section.balloon.every((value, axis) => Math.abs(value - flight[axis]) < BALLOON_TOLERANCE), `balloon ${section.balloon} off its flight path`);
  const { water, waterfall } = section;
  expect(Boolean(water?.heightTexBound) && water.size === 124 && water.inNoShadow, `water ${JSON.stringify(water)}`);
  expect(waterfall?.side === 2 && waterfall.vertices === 225 && waterfall.indices === 1152 && waterfall.inNoShadow, `waterfall ${JSON.stringify(waterfall)}`);
  return failures;
}

/** Both sites must carry the section, meet the fixed expectations, and agree on every value exactly. */
export function compareWaterCloudsBalloonProbe(original, clone) {
  if (!original || !clone) return { pass: false, failures: [`water/clouds/balloon section missing (original ${Boolean(original)}, clone ${Boolean(clone)})`] };
  const failures = [...expectations(original, 'original'), ...expectations(clone, 'clone')];
  if (JSON.stringify(original) !== JSON.stringify(clone)) {
    const field = Object.keys(original).find(key => JSON.stringify(original[key]) !== JSON.stringify(clone[key]));
    failures.push(`sites differ in ${field}`);
  }
  return { pass: failures.length === 0, failures };
}
