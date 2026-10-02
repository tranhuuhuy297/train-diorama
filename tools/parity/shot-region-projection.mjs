// Named screen regions for regional compares: the world-space bounds of a scene part, projected with
// the shot camera to CSS pixels in the page, padded and clamped to the viewport. Compare crops both
// PNGs to each region (scaled by devicePixelRatio) and judges the shot on those crops.

export const REGION_NAMES = Object.freeze(['village', 'windmill']);
export const REGION_PADDING_PX = 12;

// Runs in the page; parity-surface names only, so both sites resolve the same parts.
export function computeRegionsInPage({ names, padding }) {
  const d = window.__diorama;
  const world = d.world;
  const houses = [...new Set((world?.houseSmoke ?? []).map(puff => puff.mesh.parent))];
  const children = world?.group.children ?? [];
  const roots = {
    // Houses plus the shrub mesh added right after the last house.
    village: () => (houses.length > 0 ? [...houses, children[children.indexOf(houses.at(-1)) + 1]] : []),
    windmill: () => [world?.windmillBlades?.parent].filter(Boolean),
  };
  const camera = d.camera;
  camera.updateMatrixWorld();
  const canvas = d.renderer.domElement.getBoundingClientRect();
  const clamp = (value, limit) => Math.min(limit, Math.max(0, value));
  const regions = [];
  for (const name of names) {
    if (!roots[name]) throw new Error(`Unknown region: ${name}`);
    const parts = roots[name]();
    if (parts.length === 0) continue;
    // A geometry's own bounding box hands us three's Box3 without importing three into the page.
    let bounds = null;
    parts[0].traverse(object => {
      if (bounds || !object.geometry) return;
      if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
      bounds = new object.geometry.boundingBox.constructor();
    });
    for (const part of parts) bounds.expandByObject(part);
    const corner = camera.position.clone();
    let [left, top, right, bottom] = [Infinity, Infinity, -Infinity, -Infinity];
    for (let index = 0; index < 8; index++) {
      corner.set(
        index & 1 ? bounds.max.x : bounds.min.x, index & 2 ? bounds.max.y : bounds.min.y, index & 4 ? bounds.max.z : bounds.min.z,
      ).project(camera);
      const x = canvas.left + ((corner.x + 1) / 2) * canvas.width;
      const y = canvas.top + ((1 - corner.y) / 2) * canvas.height;
      [left, top, right, bottom] = [Math.min(left, x), Math.min(top, y), Math.max(right, x), Math.max(bottom, y)];
    }
    const x0 = clamp(Math.floor(left - padding), window.innerWidth);
    const y0 = clamp(Math.floor(top - padding), window.innerHeight);
    const x1 = clamp(Math.ceil(right + padding), window.innerWidth);
    const y1 = clamp(Math.ceil(bottom + padding), window.innerHeight);
    if (x1 > x0 && y1 > y0) regions.push({ name, x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
  }
  return { devicePixelRatio: window.devicePixelRatio, regions };
}

export async function computeShotRegions(page, names) {
  return page.evaluate(computeRegionsInPage, { names: [...names], padding: REGION_PADDING_PX });
}

/** CSS-pixel region → whole device pixels inside a width × height image (null when nothing is left). */
export function toDeviceRegion({ name, x, y, w, h }, devicePixelRatio, width, height) {
  const scale = devicePixelRatio ?? 1;
  const left = Math.max(0, Math.floor(x * scale));
  const top = Math.max(0, Math.floor(y * scale));
  const right = Math.min(width, Math.ceil((x + w) * scale));
  const bottom = Math.min(height, Math.ceil((y + h) * scale));
  return right > left && bottom > top ? { name, x: left, y: top, w: right - left, h: bottom - top } : null;
}

/** Regions a compare run judges: `all` (default), `none`, or a comma list of names. */
export function selectRegions(regions, request = 'all') {
  if (!regions || request === 'none') return [];
  if (request === 'all') return regions;
  const wanted = new Set(request.split(',').map(name => name.trim()));
  return regions.filter(region => wanted.has(region.name));
}
