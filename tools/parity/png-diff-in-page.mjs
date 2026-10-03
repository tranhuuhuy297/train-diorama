// PNG diffing inside a blank Chromium page: the per-pixel metrics (also used by node tests) and the
// in-page decode, whole-frame and per-region measurement and the original | clone | heat composition.

// Self-contained on purpose: its source is injected into the page so node and page share one implementation.
// `excluded` = masked {x, y, w, h} rects in image pixels; those pixels leave both numerator and denominator.
export function computeDiffMetrics(a, b, width, height, channelThreshold = 16, excluded = []) {
  const masked = new Uint8Array(width * height);
  for (const rect of excluded) {
    const [x0, y0] = [Math.max(0, Math.floor(rect.x)), Math.max(0, Math.floor(rect.y))];
    const [x1, y1] = [Math.min(width, Math.ceil(rect.x + rect.w)), Math.min(height, Math.ceil(rect.y + rect.h))];
    for (let y = y0; y < y1; y++) if (x1 > x0) masked.fill(1, y * width + x0, y * width + x1);
  }
  let counted = 0;
  let sum = 0;
  let over = 0;
  let maxChannelDiff = 0;
  for (let pixel = 0; pixel < masked.length; pixel++) {
    if (masked[pixel]) continue;
    const offset = pixel * 4;
    const red = Math.abs(a[offset] - b[offset]);
    const green = Math.abs(a[offset + 1] - b[offset + 1]);
    const blue = Math.abs(a[offset + 2] - b[offset + 2]);
    counted++;
    sum += red + green + blue;
    const largest = Math.max(red, green, blue);
    if (largest > channelThreshold) over++;
    if (largest > maxChannelDiff) maxChannelDiff = largest;
  }
  if (counted === 0) return { meanAbsDiff: 0, overThresholdFraction: 0, maxChannelDiff: 0 };
  return { meanAbsDiff: sum / (counted * 3), overThresholdFraction: over / counted, maxChannelDiff };
}

// Runs in the page: decode both PNGs, measure (whole frame and each region, masks excluded), compose
// original | clone | heat. `masks` are CSS-pixel rects relative to the screenshot's top-left corner.
export async function diffInPage({ originalUrl, cloneUrl, threshold, regions, devicePixelRatio, masks = [] }) {
  const decode = async url => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: image.naturalWidth, height: image.naturalHeight });
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    return { image, context, width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
  };
  const [a, b] = await Promise.all([decode(originalUrl), decode(cloneUrl)]);
  if (a.width !== b.width || a.height !== b.height) return { sizeMismatch: [a.width, a.height, b.width, b.height] };
  const { width, height } = a;
  const excluded = masks.map(mask => window.toDeviceRegion(mask, devicePixelRatio, width, height)).filter(Boolean);
  const metrics = window.computeDiffMetrics(a.data, b.data, width, height, threshold, excluded);
  const crops = regions.map(region => window.toDeviceRegion(region, devicePixelRatio, width, height)).filter(Boolean);
  const regionMetrics = crops.map(crop => {
    const [cropA, cropB] = [a, b].map(side => side.context.getImageData(crop.x, crop.y, crop.w, crop.h).data);
    const local = excluded.map(rect => ({ ...rect, x: rect.x - crop.x, y: rect.y - crop.y }));
    return { ...crop, metrics: window.computeDiffMetrics(cropA, cropB, crop.w, crop.h, threshold, local) };
  });
  const sheet = Object.assign(document.createElement('canvas'), { width: width * 3, height });
  const context = sheet.getContext('2d');
  context.drawImage(a.image, 0, 0);
  context.drawImage(b.image, width, 0);
  const heat = context.createImageData(width, height);
  for (let offset = 0; offset < heat.data.length; offset += 4) {
    const largest = Math.max(...[0, 1, 2].map(channel => Math.abs(a.data[offset + channel] - b.data[offset + channel])));
    const grey = 0.35 * (0.2126 * a.data[offset] + 0.7152 * a.data[offset + 1] + 0.0722 * a.data[offset + 2]);
    const blend = largest > threshold ? 1 : 0.6 * largest / threshold;
    const tint = largest > threshold ? [255, 0, 0] : [255, 200, 0];
    for (let channel = 0; channel < 3; channel++) heat.data[offset + channel] = grey + (tint[channel] - grey) * blend;
    heat.data[offset + 3] = 255;
  }
  context.putImageData(heat, width * 2, 0);
  context.strokeStyle = '#00e5ff';
  for (const crop of crops) context.strokeRect(width * 2 + crop.x + 0.5, crop.y + 0.5, crop.w - 1, crop.h - 1);
  context.strokeStyle = '#ff00ff';
  for (const rect of excluded) context.strokeRect(width * 2 + rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
  return { metrics, regionMetrics, excluded, heatmap: sheet.toDataURL('image/png') };
}
