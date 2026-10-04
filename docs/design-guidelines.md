# Design guidelines

The visual target of the scene and the UI, written as checkable criteria with the values the code
uses. The style bible below was ticked item by item against the sign-off shots and the research
contact sheet at release 1.0.0. Screenshots: `docs/images/`.

## 1. Style bible

| # | Item | Criterion (values from the code) |
|---|---|---|
| 1 | Subject and framing | A square, floating "cake-slice" slab (124 × 124 units) with a layered soil cross-section at the edges, a river notching the slab and pouring off the front as a waterfall, and clouds around and below the slab. Default overview: FOV 42, camera (−55.522, 62.771, 130.519) → target (0, 4, 0), a slow turntable (auto-rotate −0.245) and a 3.2 s dolly-in intro from 1.22 × the distance. |
| 2 | Toon lighting | 3 hard cel bands per surface (thresholds 0.16 / 0.46 on N·L × shadow) plus a rare 4th highlight band (shade ≥ 0.88 where stipple ≥ 0.25). The shadow band is the base colour times a cool tint, never black. |
| 3 | Painterly stipple | World-space value noise perturbs the band thresholds, so canopies and hills read as irregular blotches, not smooth ramps. No image textures: the 6 renderer textures are render targets, the sign canvas and the height texture; everything else is procedural. |
| 4 | Ink outlines | Screen-space depth-Laplacian edges, 1 px at native resolution, a dark tinted line (`col · (0.22, 0.20, 0.28)`), not black. Toggle with O; strength 0.9 by day, 0.28 at night. |
| 5 | Post finish | Subtle grain (day only), a soft vignette, no bloom, SSAO or TAA. `antialias: false`, device pixel ratio capped at 2. |
| 6 | Sky | Gradient dome, sun disc and glow, 3 painted ridge silhouettes at the horizon, horizon mist, fog from 110 to 420 units at 85 % maximum, stars at night only. |
| 7 | Time of day | Presets via T / Shift+T blended over 3 s: Day (cool blue shadows, green hills), Evening (warm key light from the other side, purple shadows, peach/mauve sky), Night (near-monochrome blue, saturation 2.5 in post, warm window, lamp and headlight accents only). |
| 8 | Palette anchors | Rendered colours sampled from the reference screenshots: foliage greens `#2a6635 … #6ac745`, soil `#885737` / `#a8693d`, water `#3481cb`, bridge `#c5462e`. Material base colours in code (before cel shading): terrain low/mid/high grass (0.5, 0.76, 0.32) / (0.37, 0.65, 0.26) / (0.27, 0.54, 0.24), sand (0.87, 0.8, 0.58); water shallow (0.48, 0.82, 0.86) → deep (0.2, 0.5, 0.8); bridge red `#b8432f`; locomotive red `#d23a2c` with gold `#f0c150`; coaches maroon/maroon/green/maroon (`#7a3b2c` / `#7a3b2c` / `#2f6150` / `#7a3b2c`) with a cream window band `#f3dfae`; balloon red `#d93f36` / cream `#fff4e4`. |
| 9 | Geometry language | Low-poly and faceted: broadleaf trees as icosphere clusters, conifers as stacked cones, chunky faceless figures, jittered icosahedron clouds and puffs. Budget: about 1.76–1.77 M triangles and 1370–1410 draw calls per frame. |
| 10 | Scene inventory | Oval loop track (276 units), steam locomotive + tender + 4 coaches with a smoke trail, a red arch bridge, a pond and river, 8 cottages with chimney smoke, the Mossbrook station with a clock, a windmill, a hot-air balloon, 24 + 3 sheep, 18 birds in 7 flocks, two station travelers, two village residents and a dog, 6665 trees, 80 rocks, 33 clouds, a waterfall. |
| 11 | Cameras | Overview (orbit + zoom, turntable), Free (FOV 65, pointer-lock WASD), Train (high chase rig, FOV 48), Bridge (low riverbank tripod, FOV 42). Train and Bridge glide in; Overview and Free snap. |
| 12 | Pixel-art mode | P toggles; Native / 720p / 540p / 360p (360p remembered by default). Render-target downscale, nearest upscale, 14-level posterise with a 4×4 Bayer dither. The HUD always stays crisp. |
| 13 | HUD | Fredoka font; warm cream glass panel `#fbf4e2` at 85 % opacity with blur, docked bottom-centre. Active accent `#ca4e36` (day/evening) or `#ef704c` on a navy panel `#192943` (night). Top-left Shortcuts pill and help list, top-right `···` debug menu, centred toast. H hides everything; the panel wraps on mobile. |
| 14 | Loader | Dark teal radial background, the chunky logo, a thin gold-bordered bar with a copper → cream gradient fill, a monospace phase/percent row, hints rotating every 2.6 s, a 420 ms fade-out. |
| 15 | Persistence | Settings saved to `localStorage['train-scene-settings-v2']`, validated per key, falling back to defaults wholesale when anything is invalid. |

## 2. Contact-sheet procedure (visual review)

1. Serve the clone (`npm run dev`) and run `npm run parity:research`. It stages the research capture
   script into `.parity-cache/research-recapture/` (never run in place), runs its main and extras
   passes against the clone (`--pass main|extras|both`, default both; `--compare-only` rescoring
   existing captures) and copies the 28 PNGs and both logs to
   `.parity-output/research-recapture/captures/`.
2. Open `.parity-output/research-recapture/research-contact-sheet.html`: each research shot sits next
   to the clone's recapture at 640 px with both top-10 colour-chip rows and the palette overlap score.
3. A shot passes at overlap ≥ 7/10. A failing shot reruns its pass once; if it still fails it is
   accepted only when its deterministic sign-off equivalent passed (`RESEARCH_EQUIVALENTS`) in
   `.parity-output/compare/signoff-report.json`, which only `compare --shots signoff` writes and which
   must cover every sign-off shot from one capture run, with the cause written into the parity guide.
4. Tick the style bible items 1–15 against the sheet and the sign-off shots and record the result in
   the parity guide ("Sign-off results"). At release all 28 shots scored 8–10/10 and all 15 items were
   ticked.

## 3. HUD tokens

| Token | Value |
|---|---|
| Panel background | `#fbf4e2` at 85 % (`#192943` at 92 %, i.e. `#192943eb`, at night) |
| Active accent | `--ui-active`: `#ca4e36` (day/evening), `#ef704c` (night) |
| Ink / outline | `#3f2a1f` |
| Radii | `--radius-xl 0.25rem`, `--radius-2xl calc(1rem / 3)`, `--radius-3xl 0.5rem` |
| Mode button | rounded-2xl pill, bold label + small key-hint span; active = `scale-105 text-white shadow-md` |
| Toggle pill | rounded-full; active = white text + inset shadow; titles `<hint> · Right click to reset` |
| Time-of-day segmented control | 3 buttons (☀ Day, ◐ Evening, ☾ Night) in a bordered track; active gets a soft shadow |
| Sliders | Train speed 0–2.5 (step 0.05), ⏱ Time 0–2 (step 0.05) with a live `1×` readout; accent-coloured thumb |
| Toast | single element, 2800 ms auto-hide, restarted by each new message |

## 4. Loader tokens

| Token | Value |
|---|---|
| Background | radial gradient `#345b70 → #173747 → #102832` (ellipse at 50 % 34 %) |
| Card width | `min(86vw, 540px)` |
| Logo box | `min(100%, 430px)` wide, height auto (intrinsic 1482 × 644; measured 430 × 186.844 px at 1600 × 900) |
| Bar | 8 px tall, `#ae9360` border on `#0b2029`, fill gradient `#b9784d → #e4b56b → #fff0cf`, breathing pulse while a step runs |
| Phases | `LOADING ENGINE` 30 %, `BUILDING VALLEY AND TRAIN` 60 %, `PREPARING FIRST FRAME` 10 %, then `READY` |
| Hint rotation | every 2600 ms, 5 strings |
| Fade-out | READY → 260 ms → `.is-gone` → 420 ms → `hidden` |
| Failure | `LOADING FAILED: <message>` with "Reload the page to try again." |

## 5. Logo and favicon (original artwork)

**`assets/train-diorama-logo.svg`**: viewBox `0 0 1482 644` (intrinsic aspect ≈ 2.3012, matching the
loader's `.load-logo` box). Fredoka 700 glyph outlines for "Train" (filled `#ca4e36`) and "Diorama"
(filled `#fbf4e2`), each as three stacked path layers (a drop shadow shifted about 18 units down in
`#3f2a1f`, a `#3f2a1f` outline stroke, then the fill) for the chunky cartoon-outline look. A small
original steam-locomotive motif (cab, boiler, chimney with a wider cap, triangular cowcatcher, 3
wheels with cream hubs, overlapping steam puffs) sits left of "Train", built from basic shapes in the
same three colours. No `<text>`, no external references, no font imports: the glyphs are pre-outlined
to `<path>` data because an SVG loaded through `<img>` cannot load web fonts.

**`assets/clock-favicon.svg`**: viewBox `0 0 64 64`. A rounded-square `#ca4e36` tile, a cream clock
face with an ink rim, four tick marks and hour/minute hands at 10:10: an original composition, not a
copy of the reference favicon's ring-and-single-hand design.

Neither asset reuses or traces the reference artwork; the SVG hash check in the independence audit
confirms no shared file.
