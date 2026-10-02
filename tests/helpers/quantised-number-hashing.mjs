// Quantised numeric hashing for parity signatures: values are rounded to integer grid steps first, so
// float noise below 1/scale never flips a hash, then folded into two 32-bit FNV-1a style lanes.

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 16777619;
const TWO_POW_32 = 4294967296;
const NON_FINITE_MARKER = 0x7fffffff;

export function quantise(value, scale) {
  if (!Number.isFinite(value)) return null;
  const step = Math.round(value * scale);
  return step === 0 ? 0 : step; // folds −0 into 0
}

const fold = (lane, word) => Math.imul(lane ^ word, FNV_PRIME) >>> 0;
const hex8 = word => word.toString(16).padStart(8, '0');

function nonFiniteCode(value) {
  if (Number.isNaN(value)) return 1;
  return value > 0 ? 2 : 3;
}

export function hashNumbers(values, scale = 1e5) {
  let laneA = (FNV_OFFSET ^ values.length) >>> 0;
  let laneB = (FNV_PRIME ^ values.length) >>> 0;
  for (let index = 0; index < values.length; index++) {
    const step = quantise(values[index], scale);
    let low;
    let high;
    if (step === null) {
      low = NON_FINITE_MARKER;
      high = nonFiniteCode(values[index]);
    } else {
      low = step >>> 0; // ToUint32 keeps the low word, two's complement for negatives
      high = Math.floor(step / TWO_POW_32) | 0;
    }
    // Lane B folds the words in the opposite order so the lanes decorrelate.
    laneA = fold(fold(laneA, low), high);
    laneB = fold(fold(laneB, high), low);
  }
  return hex8(laneA) + hex8(laneB);
}

export function hashString(text) {
  let lane = FNV_OFFSET;
  for (let index = 0; index < text.length; index++) lane = fold(lane, text.charCodeAt(index));
  return hex8(lane);
}
