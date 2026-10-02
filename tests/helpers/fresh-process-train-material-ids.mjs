// Train material ids from a child node process, where no npr cache is warm yet: material id is the
// opaque sort key, so its creation order decides depth-tie winners and must match the original.
import { execFileSync } from 'node:child_process';

/** Per mesh in traverse order: [material id − smallest id, material type, material name]. */
export async function buildTrainMaterialRows(side) {
  await import('../../src/core/disable-three-color-management.js');
  (await import('./minimal-dom-shim.mjs')).installMinimalDomShim();
  let Train;
  if (side === 'original') {
    const { importOriginal } = await import('./original-module-loader.mjs');
    await importOriginal('Diorama.js');
    ({ Train } = await importOriginal('Train.js'));
  } else {
    ({ Train } = await import('../../src/train/train.js'));
  }
  const materials = [];
  new Train().group.traverse(object => { if (object.isMesh) materials.push(object.material); });
  const first = Math.min(...materials.map(material => material.id));
  return materials.map(material => [material.id - first, material.type, material.name]);
}

/** Runs buildTrainMaterialRows('clone' | 'original') in a new node process; its JSON is the last stdout line. */
export function freshProcessTrainMaterialRows(side) {
  const script = `import { buildTrainMaterialRows } from ${JSON.stringify(import.meta.url)};
console.log(JSON.stringify(await buildTrainMaterialRows(${JSON.stringify(side)})));`;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
  return JSON.parse(output.trim().split('\n').at(-1));
}
