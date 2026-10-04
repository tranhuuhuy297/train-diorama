# 4. Time-of-day palettes and the 3 s blend

[Index](../diorama-techniques.md)

## What it achieves

Three moods: Day, Evening and Night. T / Shift+T or the HUD switches between them, and each switch blends smoothly over 3 seconds. The light direction swings, shadows change colour, the sky repaints, the fog tints, windows and lamps light up, stars appear and the ink lines soften.

## How it works

`src/engine/time-of-day-palettes-and-transition.js` holds frozen palettes with 12 keys each. All values are written in place into the shared uniform bag (chapter 2), so every material follows without rebinding. Three functions do the work:

- `applyPalette(uniforms, id)` applies a palette at once (boot, persisted state).
- `beginPaletteTransition(uniforms, id)` snapshots the current values as the start of a blend.
- `stepPaletteTransition(uniforms, transition, realDt)` advances the blend. It eases with p = smoothstep(elapsed / 3), lerps numbers, colours (`Color.lerp`) and vectors (`Vector3.lerp`), renormalises `uLightDir`, and returns null when done.

The frame loop steps the blend with real dt, so it keeps animating while the simulation is paused.

## The palettes (all values)

| Key | Day | Evening | Night |
|---|---|---|---|
| uNight | 0 | 0 | 1 |
| uSaturation | 1 | 1 | 2.5 |
| uLightDir (written before normalising) | (0.55, 0.72, 0.42): sun 46° high | (−0.72, 0.36, 0.4): sun 24° high, from the west (−x) | (−0.42, 0.8, −0.3): moon 57° high |
| uLightColor | (1.04, 1.0, 0.92) | (1.22, 0.96, 0.72) | (0.44, 0.56, 0.76) |
| uShadowTint | (0.5, 0.57, 0.78) | (0.46, 0.38, 0.64) | (0.22, 0.31, 0.48) |
| uAmbient | (0.55, 0.7, 0.95) | (0.95, 0.62, 0.7) | (0.26, 0.34, 0.52) |
| uFogColor | #cfe4f2 | #f2c6a6 | #344968 |
| uZenith | #4f8fde | #6b76c4 | #172740 |
| uHorizon | #cfe6f4 | #fbc596 | #405575 |
| uHill | #5e9c62 | #8c7488 | #2d4261 |
| uMist | #e4eef6 | #f6d6c6 | #354966 |
| uSunColor | #fff6d8 | #ffe0a0 | #d5e4f7 |

Design notes:

- Evening is not a darker day. Its light colour goes above 1 in red (1.22) and its shadow tint turns purple. That warm/cool contrast with long shadows is the look.
- Night keeps `uLightDir` pointing at a moon high in the sky, so shadows remain, tinted deep blue.
- Night uses a separate shading ramp (chapter 2) plus a post-pass saturation of 2.5.

## Everything that reads uNight

| Consumer | Behaviour |
|---|---|
| npr materials | night ramp, emissive off, NIGHT_GLOW, LOCAL_GLOW, headlight pool |
| Sky | weaker sun glow, stars on |
| Water / waterfall | moonlit palette; headlight pool on the water (not on the waterfall) |
| Post pass | ink 28 %, grain off, lighter vignette |
| Glow sprites + headlight cone | alpha × uNight; the registry hides all 17 glow meshes when uNight = 0, so they cost no draw calls by day |
| World (`world.nightAmount`) | pasture sheep fall asleep (sleep blend rate 1.8/s): legs fold, ears go still |
| HUD | `body[data-time-of-day=night]` turns the panel navy (#192943) with accent #ef704c |

Evening has uNight = 0, so lamps are not lit in the evening here.

## Files

`src/engine/time-of-day-palettes-and-transition.js`, `src/engine/diorama.js` (`setTimeOfDay`, `updateTimeOfDay`), `src/engine/night-light-glow-registry.js`, `src/ui/keyboard-shortcuts.js` (the T cycle), and `styles/night-theme-overrides.css`.

## Cost

During a blend, 12 uniform writes per frame; otherwise nothing. The night state draws 20 more calls than day (1391 vs 1371), most of them the 17 glow meshes, and compiles 2 more programs (27 vs 25).

## Pitfalls

- The blend uses unclamped real dt, so after a background tab it completes instantly (kept from the reference).
- `handleCycleTimeOfDay` hard-codes modulo 3 for the T cycle. A fourth palette needs changes there, in `TIMES_OF_DAY` in `src/ui/settings-schema-defaults.js`, in the settings validator and in the HUD.
- Glow visibility is binary (uNight > 0). An evening palette with uNight 0.3 would switch every glow on at 30 % alpha, and would also mix 30 % of the moonlit ramp into every material, cut the ink to 72 % and weaken the grain. That can be the intended golden-hour effect, but check the whole look.
- Settings migration: a persisted `golden` value is rewritten to `evening` on load (an earlier name).
