// Golden-value fingerprint for typed arrays: standard 32-bit FNV-1a over the array's own bytes, as 8 hex digits.

export function fnv1aHex(typedArray) {
  const bytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
  let hash = 0x811c9dc5;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 0x01000193) >>> 0;
  return hash.toString(16).padStart(8, '0');
}
