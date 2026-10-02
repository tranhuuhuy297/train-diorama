// Post-pass output parity on synthetic inputs: the same colour/depth textures are fed to each site's post
// material, rendered offscreen for 18 uniform combinations, read back and diffed between the sites.

export const POST_PROBE_SIZE = 64;
export const POST_PROBE_MAX_CHANNEL_DIFF = 1;

const NIGHT_AND_SATURATION = [[0, 1], [1, 2.5], [0.5, 1.75]];
const PIXEL_AND_THICKNESS = [[0, 1], [0, 1.8], [1, 1]];

export const POST_PROBE_COMBINATIONS = Object.freeze([1, 0].flatMap(outline => NIGHT_AND_SATURATION.flatMap(([night, saturation]) =>
  PIXEL_AND_THICKNESS.map(([pixel, thickness]) => ({
    id: `outline${outline}-night${night}-saturation${saturation}-pixel${pixel}-thickness${thickness}`,
    outline, night, saturation, pixel, thickness,
  })))));

// Runs in the page against the site's own three module; every touched uniform/texture is restored.
async function renderPostOutputs({ size, combinations }) {
  const THREE = await import('three');
  const d = window.__diorama;
  const colour = new Uint8Array(size * size * 4);
  const depth = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = y * size + x;
      colour.set([4 * x, 4 * y, 128, 255], index * 4);
      depth[index] = x < size / 2 && y < size / 2 ? 0.98 : 0.995;
    }
  }
  const nearest = texture => Object.assign(texture, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, needsUpdate: true });
  const colourTexture = nearest(new THREE.DataTexture(colour, size, size));
  const depthTexture = nearest(new THREE.DataTexture(depth, size, size, THREE.RedFormat, THREE.FloatType));
  const post = d.postMat.uniforms;
  const lighting = d.lightingUniforms;
  const saved = {
    tColor: post.tColor.value, tDepth: post.tDepth.value, uRes: post.uRes.value.clone(), uOutline: post.uOutline.value,
    uThick: post.uThick.value, uPixel: post.uPixel.value, uNight: lighting.uNight.value, uSaturation: lighting.uSaturation.value,
  };
  const target = new THREE.WebGLRenderTarget(size, size);
  const outputs = {};
  try {
    post.tColor.value = colourTexture;
    post.tDepth.value = depthTexture;
    post.uRes.value.set(size, size);
    for (const combination of combinations) {
      post.uOutline.value = combination.outline;
      lighting.uNight.value = combination.night;
      lighting.uSaturation.value = combination.saturation;
      post.uPixel.value = combination.pixel;
      post.uThick.value = combination.thickness;
      d.renderer.setRenderTarget(target);
      d.renderer.render(d.postScene, d.postCam);
      const pixels = new Uint8Array(size * size * 4);
      d.renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
      let binary = '';
      for (let start = 0; start < pixels.length; start += 0x8000) binary += String.fromCharCode(...pixels.subarray(start, start + 0x8000));
      outputs[combination.id] = btoa(binary);
    }
  } finally {
    post.tColor.value = saved.tColor;
    post.tDepth.value = saved.tDepth;
    post.uRes.value.copy(saved.uRes);
    post.uOutline.value = saved.uOutline;
    post.uThick.value = saved.uThick;
    post.uPixel.value = saved.uPixel;
    lighting.uNight.value = saved.uNight;
    lighting.uSaturation.value = saved.uSaturation;
    d.renderer.setRenderTarget(null);
    for (const disposable of [target, colourTexture, depthTexture]) disposable.dispose();
  }
  return outputs;
}

export async function capturePostSyntheticOutputs(page) {
  return page.evaluate(renderPostOutputs, { size: POST_PROBE_SIZE, combinations: POST_PROBE_COMBINATIONS });
}

function maxColourDiff(a, b) {
  let largest = 0;
  for (let offset = 0; offset < a.length; offset += 4) {
    for (let channel = 0; channel < 3; channel++) largest = Math.max(largest, Math.abs(a[offset + channel] - b[offset + channel]));
  }
  return largest;
}

// Cross-site max channel diff per combination, plus how far each original output sits from the first one (probe sensitivity).
export function comparePostOutputs(original, clone) {
  const decode = text => Buffer.from(text, 'base64');
  const baseline = decode(original[POST_PROBE_COMBINATIONS[0].id]);
  const combinations = {};
  for (const { id } of POST_PROBE_COMBINATIONS) {
    const [a, b] = [decode(original[id]), decode(clone[id])];
    combinations[id] = { maxChannelDiff: maxColourDiff(a, b), spreadFromFirst: maxColourDiff(a, baseline) };
  }
  const pass = Object.values(combinations).every(({ maxChannelDiff }) => maxChannelDiff <= POST_PROBE_MAX_CHANNEL_DIFF);
  return { pass, limit: POST_PROBE_MAX_CHANNEL_DIFF, combinations };
}
