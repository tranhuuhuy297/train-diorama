# Design guidelines

## Style bible (acceptance criteria for every later visual phase)

1. **Subject and framing:** a square, floating "cake-slice" diorama slab with a layered soil
   cross-section at the front edge, a river notching the slab and pouring off as a waterfall, and
   clouds around/below the slab. Default overview: FOV 42, camera `(-55.522, 62.771, 130.519)` →
   target `(0, 4, 0)`, a slow turntable, and a 3.2 s dolly-in intro from 1.22× distance.
2. **Toon lighting:** 3 hard cel bands per surface (thresholds around 0.16 / 0.46 on N·L ×
   shadow) plus a rare 4th highlight band. The shadow band is the base colour times a cool tint —
   never pure black.
3. **Painterly stipple:** world-space value noise perturbs the band thresholds so canopies and
   hills read as irregular blotches, not smooth ramps. No image textures (6 total); everything
   procedural.
4. **Ink outlines:** screen-space depth edges, 1 px at native resolution, a dark tinted line
   (not black). Toggle with O; fades to about 28% at night.
5. **Post finish:** subtle grain (day only), a soft vignette, no bloom/SSAO/TAA.
   `antialias: false`, device pixel ratio capped at 2.
6. **Sky:** gradient dome, sun disc + glow, 3 painted ridge silhouettes at the horizon, fog
   110–420 units at 85% max, stars at night only.
7. **Time-of-day presets** (T / Shift+T), blended over 3 s: Day (cool blue shadows, green hills),
   Evening (warm key light, purple shadows, peach/mauve sky), Night (near-monochrome blue, warm
   window/headlamp accents only).
8. **Palette anchors:** foliage greens `#2a6635 … #6ac745`; soil `#885737`/`#a8693d`; water
   `#3481cb`; bridge `#c5462e`; coaches maroon/maroon/green/maroon (`#7a3b2c`/`#7a3b2c`/`#2f6150`/
   `#7a3b2c`) with a cream window band `#f3dfae`.
9. **Geometry language:** low-poly, faceted; broadleaf trees as icosphere clusters, conifers as
   stacked cones; chunky faceless figures. Reference budget: about 1.77M triangles, 1400 draw
   calls per frame.
10. **Scene inventory:** oval loop track, steam loco + tender + 4 carriages with a smoke trail, an
    arched truss bridge, a central lake, a 5-cottage village with chimney smoke, a station, a
    windmill, a hot-air balloon, a sheep flock, birds, a waterfall.
11. **Cameras:** Overview (orbit + zoom, turntable), Free (FOV 65, pointer-lock WASD), Train (high
    chase, FOV 48), Bridge (low side view, FOV 42). Mode switches blend, never cut.
12. **Pixel-art mode** (P; Native/720p/540p/360p, default 360p): render-target downscale, nearest
    upscale, quantised banding with a 4×4 Bayer dither. The HUD itself always stays crisp.
13. **HUD:** Fredoka font, warm cream glass panel `#fbf4e2` at 85% opacity with blur, docked
    bottom-centre. Active accent `#ca4e36` (day/evening) or `#ef704c` on a navy panel `#192943`
    (night). Top-left Shortcuts pill + help list, top-right debug panel (later phase), centred
    toast. H hides everything; the HUD wraps on mobile.
14. **Loader:** dark teal radial background, a chunky warm logo, a thin gold-bordered bar with a
    copper→cream gradient fill, a monospace phase/percent row, hints rotating every 2.6 s, a
    420 ms fade-out.
15. **Persistence:** settings saved to `localStorage['train-scene-settings-v2']`, validated per
    key, falling back to defaults wholesale when anything is invalid.

## HUD tokens (this phase)

| Token | Value |
|---|---|
| Panel background | `#fbf4e2` at 85% (`#192943` at 92% at night) |
| Active accent | `#ca4e36` (day/evening), `#ef704c` (night) |
| Ink / outline | `#3f2a1f` |
| Radii | `--radius-xl 0.25rem`, `--radius-2xl calc(1rem/3)`, `--radius-3xl 0.5rem` |
| Mode button | rounded-2xl pill, bold label + small key-hint span |
| Toggle pill | rounded-full, active = white text + inset shadow |
| Time-of-day segmented control | 3 buttons in a bordered track, active gets a soft shadow |
| Sliders | fixed two/three-column grid, accent-coloured thumb |

## Loader tokens

| Token | Value |
|---|---|
| Background | radial gradient `#345b70 → #173747 → #102832` |
| Card width | `min(86vw, 540px)` |
| Logo box | `min(100%, 430px)` wide, height auto (intrinsic 1482×644 ⇒ ≈186.9 px tall) |
| Bar | 8px tall, gold border, copper→cream gradient fill |
| Hint rotation | every 2600 ms, 5 strings |
| Fade-out | READY → 260 ms → `.is-gone` → 420 ms → `hidden` |

## Logo & favicon spec (original artwork, D7)

**`assets/train-diorama-logo.svg`** — viewBox `0 0 1482 644` (intrinsic aspect ≈2.3012, matching
the loader's `.load-logo` box layout). Fredoka 700 glyph outlines for "Train" (filled `#ca4e36`)
and "Diorama" (filled `#fbf4e2`), each as three stacked path layers (drop shadow shifted ~18 units
down in `#3f2a1f`, a `#3f2a1f` outline stroke, then the fill on top) — the chunky cartoon-outline
look from the style bible. A small original steam-locomotive motif (cab, boiler, chimney with a
wider cap, triangular cowcatcher, 3 wheels with cream hubs, overlapping steam puffs) sits to the
left of "Train", built from basic shapes in the same three-colour palette
(`#3f2a1f` / `#ca4e36` / `#fbf4e2`). No `<text>`, no external references, no font imports — the
glyphs are pre-outlined to `<path>` data (an SVG `<img>` cannot load web fonts).

**`assets/clock-favicon.svg`** — viewBox `0 0 64 64`. A rounded-square `#ca4e36` tile, a cream
clock face with an ink rim, four tick marks, and hour/minute hands in a "10:10" pose — an original
clock composition, not a copy of the reference favicon's ring-and-single-hand design.
