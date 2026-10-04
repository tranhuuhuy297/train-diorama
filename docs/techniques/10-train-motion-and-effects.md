# 10. Train, station-stop motion and effects

[Index](../diorama-techniques.md)

## 10.1 Train model

`src/train/*` builds:

- **Locomotive:** boiler, cab with glass, driver and raven, a smokebox door with 10 bolts, buffers, a cowcatcher wedge, pilot bars, 3 lamps with halos, a headlight anchor with a light cone, 6 driving wheels, 2 pony wheels and coupling rods.
- **Coal tender.**
- **Four passenger coaches** in #7a3b2c, #7a3b2c, #2f6150 and #7a3b2c. Each has a cream window band with emissive night glow, 12 window halos (6 per side), X muntins cloned from one template, a clerestory roof with 3 vents and 8 wheels.

All parts come from part tables (`addParts`, chapter 7). Each car is merged by material, with the wheel groups excluded so they can spin. After merging: locomotive 46 meshes, tender 11, each coach 23.

## 10.2 Placing cars on the spline

`Train.update(world, s)` in `src/train/train.js` places every car:

1. Each car has an offset behind the locomotive (half-lengths plus a 0.45 coupling gap). A car's track distance is a = s − offset.
2. Sample the spline at a ± 0.34 × car length.
3. Put the car at the midpoint of that chord and make it `lookAt` the front point.
4. Rotate the wheels by a / r (rolling without slip).

This "two bogies" trick makes long cars cut corners realistically and pitch on slopes.

## 10.3 Station-stop motion state machine

`src/train/train-station-motion-controller.js` holds pure functions on `{s, speed, stopTimer, justLeft, speedMul}`:

| Parameter | Value |
|---|---|
| Cruise speed | 7.5 × speed slider (0–2.5) |
| Response | speed += (target − speed) × min(1, dt × 0.9) |
| Brake zone | 26 units before the stop |
| Braking target | max(0.35, top × √(ahead / 26)), a constant-deceleration profile; speed snaps down to it |
| Stop | when the next step would pass the stop: s += ahead exactly, speed = 0 |
| Dwell | 4 s |
| Departure window | braking is disabled until the train is 30 units past the station |
| Start | s = stationS + 1, speed 2, already departing |

`computeBrakeStrength` returns min(1, deceleration / 3) while braking above 0.1 units/s. It drives the sparks.

## 10.4 Smoke puff pool

`src/train/locomotive-smoke-puff-pool.js` pre-allocates 70 icosphere meshes (npr #fbfbff, stipple 0.3, scale 2.2). They live in world space, not parented to the train, so the trail stays behind.

| Parameter | Value |
|---|---|
| Emission interval | standing: 0.55 / 1.2 s; moving: max(0.07, 0.3 − 0.03 × speed) / 1.2 |
| Life | 2.4–3.6 s |
| Size | 0.7–1.3 |
| Velocity | x ±0.3, rise 2.2–3.0, z ±0.3; wind +0.8 in x; rise damped by (1 − 0.6 dt) |
| Scale curve | size × (0.5 + 2.4 a) × min(1, (1 − a) × 3.5), where a is the age fraction |

Puffs are opaque and cel-shaded, so no sorting is needed. At most one puff is emitted per frame; if all 70 are alive the emission is skipped silently. At top speed the interval is 0.058 s, so about 17 puffs/s × up to 3.6 s life ≈ 62 live puffs: 70 leaves little margin (the roadmap lists pool exhaustion at top speed as a kept quirk).

## 10.5 Brake sparks

`src/train/brake-sparks.js` is a ring buffer of 269 instances of a unit box (MeshBasic #ffe56b, `DynamicDrawUsage`, frustum culling off): one draw call.

- **Emission:** (40 + 140 × strength) × 1.4 sparks per second, round-robin over the locomotive wheels, spawned at the rim contact point.
- **Launch velocity** (rotated with the loco): outward 1.5–4.5, up 0.9–2.9, along the track −3.7 … 2.7.
- **Flight:** ballistic with gravity 9.8. On hitting `heightAt`, vy × −0.48 and horizontal drag 0.7. Life 0.7–1.15 s.
- **Streaks:** each is aligned to its velocity (`setFromUnitVectors(UP, v̂)`), 0.028 wide and 0.1 + 0.025 × speed long, both shrinking with remaining life. Dead slots get a zero-scale matrix.

## 10.6 Headlight: cone mesh and light pool

- **Anchor:** `train.headlight` at (0, 2.1, 2.5) on the loco, aimed at (0, −0.08, 1).
- **Visible beam:** `src/effects/night-headlight-light-cone.js`, an open cylinder of length 18 widening from radius 0.12 to 4.5. It is BackSide, additive and has depthWrite off. Alpha = rim fade (view angle) × axial fade (smoothstep(0, 0.035) × (1 − travel)^1.5) × 0.2 × uNight.
- **Light on the world:** the render pipeline writes `uHeadlightPosition/Direction` every frame, and every NPR and water shader adds `headlightAt()` (chapter 2). There is no three.js light.

## 10.7 Night glow sprites

`createLightGlows([{position, size, normal, strength}])` in `src/effects/night-light-glow-sprites.js` makes one mesh with an `InstancedBufferGeometry` quad per light.

- The vertex shader billboards each quad around its centre in view space. Sizes are in world units, scaled by the model matrix.
- A non-zero normal fades the halo when it is seen from behind (windows). A zero normal makes it omnidirectional (lamps).
- The fragment is a Gaussian core exp(−4.5 r²) with a soft rim cut and a warm tint (1, 0.78, 0.45), additive, with alpha × uNight.
- The bounding sphere is computed manually, because the vertices move in the shader.

The registry (`src/engine/night-light-glow-registry.js`) collects all 17 glow meshes (16 sprite meshes plus the headlight cone) once, by material name, and toggles their visibility each frame (`uNight > 0`). By day they cost nothing.

| Light | Size | Strength |
|---|---|---|
| Cottage window | 1.65 × 2.0 | 0.18 |
| Station window | 2.0 × 1.8 | 0.2 |
| Station lamp | 2.4 × 2.4 (omni) | 0.3 |
| Loco headlamp / buffer lamps | 3.45 / 1.2 | 0.55 / 0.38 |
| Coach window | 1.35 × 1.05 | 0.13 |
| Balloon burner | 1.7 × 1.7 (omni) | 0.85 |

## Files

`src/train/*`, `src/effects/*`, `src/engine/night-light-glow-registry.js`, and `src/engine/render-pipeline.js`.

## Cost

| Item | Cost |
|---|---|
| Train | 149 meshes, about 20 800 triangles per pass by day, 33–46 ms build |
| Smoke | up to 70 draws (only live puffs are visible) |
| Sparks | 1 draw |
| Glows | 17 draws, at night only |

## Pitfalls

- The coupling rods stay still while the wheels turn. `s` is never wrapped: fine for hours, but wrap it for a long-running kiosk.
- Dropping the speed slider while braking spikes the brake strength (capped at 1), and a slowing step with dt = 0 gives strength 1.
- Size a particle pool for max emission rate × max life plus a margin; this pool sits close to that limit at top speed.
- Additive glows must stay transparent with depthWrite off (`ADDITIVE_GLOW_RENDER_STATE`), or the static merge would bake them into an opaque batch.
