# 5. Seeded PRNG, noise, determinism and draw-order discipline

[Index](../diorama-techniques.md)

## What it achieves

The same world on every load: the same trees, houses, sheep and clouds in the same places. That makes screenshots comparable and bugs reproducible, allows golden-value unit tests, and lets the owner art-direct a seed.

## mulberry32

`src/core/seeded-prng-and-gradient-noise.js`:

```js
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function draw() {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
```

Each call returns an independent stream (a closure). The streams in use:

| Stream | Seed | Owner | Consumers (in order) |
|---|---|---|---|
| Noise tables | 1337 | module load | 255 shuffle draws (permutation), then 256 gradient angles |
| World | 42 | `world.rand` | village: sites, house dimensions and chimney-smoke traits (1024 draws); windmill site (600); trees (76 963); rocks and pasture sheep (7 106); clouds (2 854). Total 88 547 |
| Birds | 7821 | bird system | size, phase and heading per bird (3 draws each) |
| Math.random | – | transient effects | brake sparks (4 draws per spark), smoke puffs (7 per puff) |

Separate streams isolate systems: adding a bird does not move a single tree.

## CPU noise: gradient noise and fbm

- `noise2(x, y)`: 2D Perlin-style gradient noise with a quintic fade, a shuffled 256-entry permutation and random-angle gradients. Range about ±0.7.
- `fbm(x, y, octaves = 4)`: lacunarity 2.03 (not 2.0, to avoid grid alignment) and gain 0.5, normalised and multiplied by 1.6. Range about ±1.1.
- `smoothstep(a, b, x)` on the CPU accepts reversed edges (a > b).

Uses:

- terrain base height: fbm at frequency 0.028, 4 octaves;
- colour wobble: fbm 0.09, 2 octaves;
- forest density: fbm 0.045, 3 octaves;
- sheep meadow mask: fbm 0.045, 3 octaves.

## GPU noise

`src/materials/glsl/hash-and-value-noise-glsl.js` provides sine-free hashes (hash11/12/13, in the spirit of "Hash without Sine") and a trilinear value noise `vnoise(vec3)` with a cubic fade. Avoiding sin() makes the patterns more consistent across GPUs than sin-based hashes, whose results depend on each driver's sin() precision.

## Geometry jitter without the PRNG

`jitter(geometry, amount, seed)` in `src/geometry/procedural-geometry-helpers.js` scales each vertex radially by a sin-hash of its own position and a seed. Tree crowns, rocks, puffs and shrubs get organic lumps without consuming the world stream, so editing a crown never shifts the layout.

## Draw-order discipline

1. **Fixed build order.** `WORLD_BUILD_STEPS` is a frozen list, and every step draws from `world.rand` in a fixed sequence. New steps go at the end.
2. **Draw even when the value is unused.** The tree scatter draws the species roll even when high ground forces a conifer. It also draws both accent rolls (autumn 4 %, blossom 2 %) even when the first one already hit. Later draws then stay aligned when rules change.
3. **Fixed draws per accepted item.** Each tree candidate draws 2 values (x, z); a site that passes the draw-free filters draws 1 acceptance roll; each accepted tree draws 5 more (7 for broadleaves). Each pasture-sheep candidate draws 2 and each kept sheep 5. A rejection that happens before a draw costs nothing.
4. **Draw-free filters first.** Cheap geometric tests (height band, slope, track distance, exclusions) run before any draw.
5. **Record stream positions.** For example, `world.rand` is at draw 1024 after the village and 1624 after the windmill (recorded in `docs/system-architecture.md` and checked by the parity tests). An accidental extra draw then fails loudly.

## Material and child order (draw order)

three.js sorts opaque objects by render order, then material id, then depth, then object id. Material ids follow creation order, so creating materials in a fixed order (palette tables evaluated top to bottom) gives a stable draw order and stable z-fighting tie-breaks. Child order inside groups is kept fixed too.

**Parity-only:** every three.js object draws 4 `Math.random` values for its UUID. Keeping those draws aligned mattered only for matching the reference's transient effects.

## Golden tests

The world builds in node from pure functions; `tests/helpers/minimal-dom-shim.mjs` supplies a recording canvas for the sign. Pinned values:

- unit tests: world length 276.13647750761754 and bridge frames [30, 178] plus FNV-1a hashes of the output typed arrays (`tests/unit/world-core-helpers-registry-and-golden-values.test.mjs` with `tests/helpers/typed-array-fnv1a-hash.mjs`); stationS 236.45464110639873 (`tests/unit/station-sign-clock-and-build-counts.test.mjs`);
- parity tests and runtime probes: tree counts [3749, 1215, 932, 769] (6665), 80 rocks, 33 clouds, 24 + 3 sheep.

A layout change then shows up as a visible, intentional test update.

## Files

`src/core/seeded-prng-and-gradient-noise.js`, `src/core/scalar-math-helpers.js`, `src/materials/glsl/hash-and-value-noise-glsl.js`, `src/geometry/procedural-geometry-helpers.js`, `src/world/world-build-steps.js`, `tests/unit/seeded-prng-and-gradient-noise.test.mjs`, `tests/unit/world-core-helpers-registry-and-golden-values.test.mjs`, and `tests/unit/station-sign-clock-and-build-counts.test.mjs`.

## Cost

mulberry32 is a few integer operations. The world build draws 88 547 values, 87 % of them in the 14 000-attempt tree scatter.

## Pitfalls

- **V8 deopts.** Two patterns sent V8 into deopt loops: `Object.freeze` on constants read in hot per-vertex loops (POND, RIVER), and nested one-shot loops over the 201² grid. Flat loops and unfrozen hot constants fixed it. A `%` in the nearest-sample scan also cost about 9 ms per build, so a branch is used instead.
- **Parity-only:** the operand order of float expressions was kept bit-exact (`Math.hypot` vs the square root of a sum, `**` vs products). New projects do not need this.
- A hard throw when a generator cannot place enough items (fewer than 2 houses, no trackside sheep clearing) turns a seed change into a boot failure. Prefer logged fallbacks.
