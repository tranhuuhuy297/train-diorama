// Golden values + oracle parity for the seeded PRNG and gradient-noise stack.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mulberry32, noise2, fbm, smoothstep, lerp,
  NOISE_PERMUTATION_TABLE, NOISE_GRADIENT_TABLE,
} from '../../src/core/seeded-prng-and-gradient-noise.js';
import { wrapAngle, positiveModulo, exponentialResponse } from '../../src/core/scalar-math-helpers.js';
import { originalSkipReason, importOriginal } from '../helpers/original-module-loader.mjs';

const skip = originalSkipReason(['Noise.js']);
const original = skip ? null : await importOriginal('Noise.js');

function drawN(generator, n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = generator();
  return out;
}

test('mulberry32 golden draws match the pinned reference values', () => {
  const d42 = mulberry32(42);
  assert.equal(d42(), 0.6011037519201636);
  assert.equal(d42(), 0.44829055899754167);
  assert.equal(d42(), 0.8524657934904099);

  const d1337 = mulberry32(1337);
  assert.equal(d1337(), 0.1844118325971067);
  assert.equal(d1337(), 0.18998925131745636);
  assert.equal(d1337(), 0.8104719922412187);

  const d7821 = mulberry32(7821);
  assert.equal(d7821(), 0.18584501137956977);
  assert.equal(d7821(), 0.2725160541012883);
  assert.equal(d7821(), 0.192987754708156);

  const draw10k = seed => { const d = mulberry32(seed); for (let i = 0; i < 9999; i++) d(); return d(); };
  assert.equal(draw10k(42), 0.6580179932061583);
  assert.equal(draw10k(1337), 0.8249000932555646);
  assert.equal(draw10k(7821), 0.8643396007828414);
});

test('negative seed wraps to the same stream as its uint32 equivalent', () => {
  assert.equal(mulberry32(-1)(), mulberry32(4294967295)());
  assert.equal(mulberry32(-1)(), 0.8964226141106337);
  const seeded = mulberry32(1);
  for (let i = 0; i < 100000; i++) {
    const v = seeded();
    assert.ok(v >= 0 && v < 1, `draw ${i} out of range: ${v}`);
  }
});

test('noise tables: permutation and gradient golden values', () => {
  assert.deepEqual(Array.from(NOISE_PERMUTATION_TABLE.slice(0, 8)), [238, 184, 179, 185, 206, 6, 115, 50]);
  assert.equal(NOISE_PERMUTATION_TABLE[255], 47);
  assert.equal(NOISE_PERMUTATION_TABLE.length, 512);
  for (let i = 0; i < 256; i++) assert.equal(NOISE_PERMUTATION_TABLE[i], NOISE_PERMUTATION_TABLE[i + 256]);
  const firstHalf = new Set(NOISE_PERMUTATION_TABLE.slice(0, 256));
  assert.equal(firstHalf.size, 256);

  assert.deepEqual(NOISE_GRADIENT_TABLE[0], [-0.2858554861213234, -0.9582727383445393]);
  assert.deepEqual(NOISE_GRADIENT_TABLE[255], [0.5764237308618348, 0.817150954536139]);
  assert.equal(NOISE_GRADIENT_TABLE.length, 256);
});

test('noise2 and fbm golden values', () => {
  assert.equal(noise2(0.5, 0.5), 0.012673795429414804);
  assert.equal(noise2(-12.34, 56.78), -0.19809995170568076);
  assert.ok(Object.is(noise2(7, 9), 0));

  assert.equal(fbm(1.3, -2.7), -0.10389885740262683);
  assert.equal(fbm(0.028 * 10 + 3.1, 0.028 * -20 - 7.3, 4), 0.08199003655590674);
  assert.equal(fbm(3.3, 4.4, 2), 0.4663986735766229);
  assert.equal(fbm(3.3, 4.4, 3), 0.48800558624717205);

  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i <= 200; i++) {
    for (let j = 0; j <= 200; j++) {
      const v = noise2(-62 + 0.62 * i, -62 + 0.62 * j);
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  assert.ok(min >= -0.7 && max <= 0.7, `grid out of range: [${min}, ${max}]`);
});

test('smoothstep and lerp golden values', () => {
  assert.equal(smoothstep(0, 1, 0.25), 0.15625);
  assert.equal(smoothstep(0.2, -1.2, -0.5), 0.5);
  assert.ok(Number.isNaN(smoothstep(1, 1, 1)));
  assert.equal(lerp(2, 4, 0.25), 2.5);
});

test('scalar helpers are bitwise-equal to the inline formulas over random samples', () => {
  const draw = mulberry32(5);
  for (let i = 0; i < 1000; i++) {
    const a = (draw() - 0.5) * 20;
    const b = (draw() - 0.5) * 20;
    assert.ok(Object.is(wrapAngle(a), Math.atan2(Math.sin(a), Math.cos(a))));
    assert.ok(Object.is(positiveModulo(a, b || 1), ((a % (b || 1)) + (b || 1)) % (b || 1)));
    assert.ok(Object.is(exponentialResponse(Math.abs(a), Math.abs(b)), 1 - Math.exp(-Math.abs(a) * Math.abs(b))));
  }
  assert.equal(positiveModulo(-1, 5), 4);
  assert.equal(positiveModulo(-0.25, 1), 0.75);
});

test('parity: first 10000 mulberry32 draws match the original oracle', { skip }, () => {
  for (const seed of [42, 1337, 7821, 20260930, 0, 0xffffffff]) {
    const cloneDraws = drawN(mulberry32(seed), 10000);
    const originalDraws = drawN(original.mulberry32(seed), 10000);
    for (let i = 0; i < 10000; i++) {
      assert.ok(Object.is(cloneDraws[i], originalDraws[i]), `seed ${seed} draw ${i}`);
    }
  }
});

test('parity: rebuilt perm/grad tables deep-equal the clone tables', { skip }, () => {
  const draw = original.mulberry32(1337);
  const table = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(draw() * (i + 1));
    [table[i], table[j]] = [table[j], table[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = table[i & 255];
  assert.deepEqual(Array.from(perm), Array.from(NOISE_PERMUTATION_TABLE));
  const grads = [];
  for (let i = 0; i < 256; i++) {
    const angle = draw() * Math.PI * 2;
    grads.push([Math.cos(angle), Math.sin(angle)]);
  }
  assert.deepEqual(grads, NOISE_GRADIENT_TABLE);
});

test('parity: noise2 full 512x512 lattice sweep matches the oracle', { skip }, () => {
  // A single mismatch count keeps this fast (~262k samples) while covering every perm
  // entry and the negative AND-255 path, per cell offset (0.37, 0.61).
  let mismatches = 0;
  for (let ix = -256; ix <= 255; ix++) {
    for (let iy = -256; iy <= 255; iy++) {
      if (!Object.is(noise2(ix + 0.37, iy + 0.61), original.noise2(ix + 0.37, iy + 0.61))) mismatches++;
    }
  }
  assert.equal(mismatches, 0);
  for (let ix = -256; ix <= 255; ix++) {
    for (let iy = -256; iy <= 255; iy++) {
      assert.ok(Object.is(noise2(ix, iy), original.noise2(ix, iy)), `integer lattice ${ix},${iy}`);
    }
  }
});

test('parity: 201x201 fbm/noise2 grid matches the oracle', { skip }, () => {
  for (let i = 0; i <= 200; i++) {
    const x = -62 + 0.62 * i;
    for (let j = 0; j <= 200; j++) {
      const z = -62 + 0.62 * j;
      assert.ok(Object.is(noise2(x, z), original.noise2(x, z)), `grid noise2 ${i},${j}`);
      for (const oct of [2, 3, 4]) {
        assert.ok(Object.is(fbm(x, z, oct), original.fbm(x, z, oct)), `grid fbm${oct} ${i},${j}`);
      }
      assert.ok(Object.is(
        fbm(0.028 * x + 3.1, 0.028 * z - 7.3, 4),
        original.fbm(0.028 * x + 3.1, 0.028 * z - 7.3, 4),
      ));
      assert.ok(Object.is(
        fbm(0.045 * x + 10, 0.045 * z - 3, 3),
        original.fbm(0.045 * x + 10, 0.045 * z - 3, 3),
      ));
      assert.ok(Object.is(fbm(0.09 * x, 0.09 * z, 2), original.fbm(0.09 * x, 0.09 * z, 2)));
    }
  }
});

test('parity: smoothstep/lerp match the oracle over random triples', { skip }, () => {
  const draw = mulberry32(99);
  for (let i = 0; i < 10000; i++) {
    const reversed = i % 4 === 0;
    const lo = (draw() - 0.5) * 10;
    const hi = reversed ? lo - draw() * 10 : lo + draw() * 10;
    const x = (draw() - 0.5) * 20;
    assert.ok(Object.is(smoothstep(lo, hi, x), original.smoothstep(lo, hi, x)), `smoothstep ${i}`);
    assert.ok(Object.is(lerp(lo, hi, x), original.lerp(lo, hi, x)), `lerp ${i}`);
  }
});
