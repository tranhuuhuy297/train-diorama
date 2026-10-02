// mulberry32 PRNG (public-domain, Tommy Ettinger) plus a 2D gradient-noise stack; float64 operand order is bit-exact and must stay as written.

/** Returns a closure that draws uniform doubles in [0, 1); each closure owns its state. */
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function draw() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

// Seed-1337 table stream, drawn once at module evaluation; independent of the world/bird
// PRNGs. Order of the 255 shuffle draws then 256 angle draws is normative.
const shuffledIndices = Array.from({ length: 256 }, (_, slot) => slot);
const drawTableSeed = mulberry32(1337);
for (let remaining = 255; remaining > 0; remaining--) {
  const pick = Math.floor(drawTableSeed() * (remaining + 1));
  const held = shuffledIndices[remaining];
  shuffledIndices[remaining] = shuffledIndices[pick];
  shuffledIndices[pick] = held;
}

export const NOISE_PERMUTATION_TABLE = new Uint8Array(512);
for (let slot = 0; slot < 512; slot++) NOISE_PERMUTATION_TABLE[slot] = shuffledIndices[slot & 255];

export const NOISE_GRADIENT_TABLE = [];
for (let slot = 0; slot < 256; slot++) {
  const angle = drawTableSeed() * Math.PI * 2;
  NOISE_GRADIENT_TABLE.push([Math.cos(angle), Math.sin(angle)]);
}

function quinticFade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function gradientDot(cellX, cellY, offsetX, offsetY) {
  const index = NOISE_PERMUTATION_TABLE[NOISE_PERMUTATION_TABLE[cellX] + cellY];
  const gradient = NOISE_GRADIENT_TABLE[index];
  return gradient[0] * offsetX + gradient[1] * offsetY;
}

/** 2D Perlin-style gradient noise with a quintic fade, roughly within +/-0.7. */
export function noise2(x, y) {
  const latticeX = Math.floor(x);
  const latticeY = Math.floor(y);
  const fracX = x - latticeX;
  const fracY = y - latticeY;
  const cellX = latticeX & 255;
  const cellY = latticeY & 255;

  const n00 = gradientDot(cellX, cellY, fracX, fracY);
  const n10 = gradientDot(cellX + 1, cellY, fracX - 1, fracY);
  const n01 = gradientDot(cellX, cellY + 1, fracX, fracY - 1);
  const n11 = gradientDot(cellX + 1, cellY + 1, fracX - 1, fracY - 1);

  const u = quinticFade(fracX);
  const v = quinticFade(fracY);
  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v;
}

/** Fractal sum of noise2 octaves; lacunarity 2.03, amplitude halves each step. */
export function fbm(x, y, oct = 4) {
  let sum = 0;
  let amplitude = 1;
  let frequency = 1;
  let norm = 0;
  for (let octave = 0; octave < oct; octave++) {
    sum += noise2(x * frequency, y * frequency) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.03;
  }
  return (sum / norm) * 1.6;
}

/** Clamped Hermite smoothstep; reversed edges (a > b) are valid, a === b yields NaN. */
export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
