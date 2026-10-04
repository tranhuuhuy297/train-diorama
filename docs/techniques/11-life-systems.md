# 11. Life systems

[Index](../diorama-techniques.md)

All life systems share one structure:

- **pure decision logic:** plain numbers, no three.js, unit-tested in node;
- **pose writers:** write transforms into reused objects;
- **sim-time driving:** pause freezes them and the time scale speeds them up.

## 11.1 Bird flocks (`src/life/birds/*`)

### What it achieves

Small flocks perch on the bridge railings, the station shelter roof and grassy spots beside the track. They take off when the train approaches, circle overhead, and land again when the track is clear. The animation includes wing beats, glides, banking, a crouch before take-off and a flare when landing.

### Perches (`src/world/perches/bird-perch-builders.js`, the last build step)

- **Bridge:** 3 flocks at fractions of the span, [0.12, 0.19, 0.32], [0.43, 0.48] and [0.69, 0.84, 0.89], on alternating rails, sitting on top of the handrail (1.67 out, y + 0.96).
- **Station roof:** 3 spots on the sloped shelter roof.
- **Trackside:** 4 clusters at loop fractions 0.08, 0.36, 0.56 and 0.73. Each scans 60 frames (stride 3) for dry, unexcluded ground within 2.5 of rail height, 2.6–3.3 units off the track; an empty cluster is skipped (trackside-1 ends up empty here).

In total: 7 flocks, 18 birds.

### State machine (`bird-flock-state-machine.js`)

perched → flying → returning → perched, plus returning → flying if the train comes back.

| Signal | Rule |
|---|---|
| approaching | the train is moving (speed > 0.2) and either the perch is within max(19, speed × 2.5) ahead along the track or a car is within 12 |
| clear | the nearest car is beyond 24, and not (moving and within max(26, speed × 3) ahead) |
| flying → returning | after at least 7 s aloft, once clear |
| returning → perched | after 3.6 s |

### Motion (`bird-flight-poses.js`, `bird-wing-body-animator.js`)

- **Perched:** idle pecks (sin^12) and a look-around, wings folded (shoulder swept 1.35 rad, scale 0.6/1/0.8).
- **Flying:** an orbit in front of the perch, outward 7 ± 3 and sweeping ±5 at 0.72 rad/s with a bob of 0.5. Each bird is delayed by 0.09 s × its index (plus a 0.28 s take-off lead) and climbs from the take-off point over 2.2 s, carrying its launch velocity.
- **Flight height:** max(perch + 5, ground + 3, canopy + 2), sampled at 24 points around the orbit (canopy grid, chapter 8).
- **Returning:** a smoothstep from the current position back home over 2.8 s plus the delay, carrying momentum and hopping 0.7 over the arc.
- **Orientation:** yaw from the direction of travel, pitch 0.55 × the climb angle, bank −0.22 × the turn rate (clamped to 0.48). It slerps at most 4 rad/s with response 9/s.
- **Wings:** beat at 21 rad/s (about 3.3 Hz). A glide cycle, smoothstep(sin(1.4t + φ), 0.45, 0.8), reduces the amplitude. Wing tips lag the shoulder. The body crouches before take-off and flares and squashes at touchdown.

Each bird rig is: figure > body (merged mesh with head, beak, legs and eyes) + tail + 2 wing pivots > wing + tip. That is six meshes per bird, 108 in total.

## 11.2 Sheep (`src/life/sheep/*`)

### Pasture flock

24 sheep are placed from up to 4000 attempts (2 draws per candidate, 5 per sheep). `sheepGroundAt` allows a spot only if it is:

- inside ±60;
- at height 1–8;
- at least 5 from the track;
- outside the exclusions grown by 1;
- inside a meadow patch (fbm(0.045) ≤ −0.05);
- flat enough (normal.y ≥ 0.88).

Each sheep walks at 0.16–0.34 with a constant turn of ±0.25 rad/s. When its next step is forbidden, it turns at 2.4 rad/s instead. At night (`world.nightAmount`) the flock falls asleep: movement stops, the body sinks 0.24 × size and the legs fold 1.35 rad.

### Trackside sheep (escape state machine)

Three sheep graze on the rails at the clearing that best overlaps the pasture flock. The clearing is scored by the sum of max(0, 18 − distance to each pasture sheep), checked on every 12th frame on both sides. A clearing also needs level shoulders and free landing spots 3.5 units out.

States: track → startled → escaping → waiting → returning → track.

| Rule | Value |
|---|---|
| Danger | the train within max(18, speed × 3.2) ahead, or its tail within train length + 5 behind |
| Startle | freeze for the per-sheep reaction delay: 0.06 / 0.38 / 0.2 s |
| Panic | jump at once if the train is within max(5, speed × 1.5) |
| Escape | hop to 3.5 units out at 3.4–4.1 units/s; hop height 0.46–0.66, duration 0.6–0.72 s, then a 0.3 s landing squash |
| Wait | until the track has been clear for 5–6.3 s |
| Return | amble back at 0.65 |
| Grazing sway | a Lissajous figure along and across the rails (0.44–0.72 rad/s), heading from the analytic velocity; height = max(ground, ballast / rail-head profile) |

### Rendering: three instanced layers for the whole flock

`sheep-geometry-and-instanced-meshes.js` and `sheep-instance-pose-writer.js` draw the flock as three `InstancedMesh`es with capacity 27: bodies (fleece, head and tail merged), legs (4 per sheep) and ears (2 per sheep). That is 3 draw calls for 27 animated sheep. Each frame, per sheep:

- **Body matrix:** position (plus trot bob, sleep drop and the hop arc 4p(1 − p) × height) × orientation (45 % of the slope tilt plus the heading, slerped at rate 8) × squash-and-stretch.
- **Leg matrices:** body × hip transform × swing (0.4 rad, diagonal pairs together, stride 8 rad/s).
- **Ear matrices:** body × ear transform × a flap scaled by speed.

All scratch objects are pre-allocated (`createSheepTransforms`).

## 11.3 Station walker with leg IK (`src/life/station/*`)

An old traveler with a cane strolls between three stops on the platform:

- **Wait:** 5 s at first, then 6 + 2 × the next stop's index.
- **Turn:** on the spot at 1.8 rad/s, followed by two shuffle steps.
- **Walk:** steps of at most 0.2 units taking 0.7 s each, one foot at a time.

The animation:

- **Foot target:** a smoothstep-eased arc with a lift of sin(πp) × 0.085.
- **Two-bone IK** with equal bones, L = 0.36: knee = hip + axis × reach/2 + bend × √(L² − (reach/2)²). The bend direction is a forward pole made perpendicular to the hip–ankle axis. Thigh and shin are unit-height boxes, placed at the bone midpoint, scaled to the bone length and rotated with `setFromUnitVectors`.
- **Body:** bounce and swing chase the step arc at rate 14/s. They drive the bob, a lean, arm swing (±0.38 × swing) and a hat tilt, on top of breathing at sin(1.8t).
- **Cane:** the shaft is rescaled every frame so its tip just touches the platform.

The grandmother and the traveler also sway idly (roll 0.018, nod 0.012, breathing 0.8 %). Both turn their heads toward the locomotive, clamped to ±0.85 rad and fading out between 12 and 32 units.

## 11.4 Village residents (`src/life/village/*`)

- A woman paces her yard on a 28 s loop: out from 4 to 12 s, back from 18 to 26 s, across 1.5 units.
- A man idles by his door.
- His dog wags its tail (5 rad/s, ±0.35) and looks around.

The figures are built from rows of icosphere "shape" and box "block" parts. Head, arms and legs are pivots merged separately, and the ground height is sampled each frame. After merging, the two figures and the dog total 33 meshes.

## Files

`src/life/birds/*`, `src/life/sheep/*`, `src/life/station/*`, `src/life/village/*`, and `src/world/perches/bird-perch-builders.js`.

## Cost

| System | Cost |
|---|---|
| Birds | 108 meshes, 6 624 triangles |
| Sheep | 3 draws, 12 096 triangles |
| Residents | 33 meshes, 4 432 triangles |

The heaviest per-frame CPU work in this group is `sheepGroundAt`: several `heightAt` calls, a nearest-track search and fbm for every pasture sheep every frame. The heap profile attributes about 23.7 KB of allocation per simulation step to `sheepGroundAt` and about 14.8 KB to the closure in `World#excluded`, out of about 74 KB per step in total.

## Pitfalls

- A sheep with no valid ground sinks toward y = 0 (a kept quirk). Keep the last valid height instead.
- The trackside sheep's tail check ignores speed, and the station-roof flock keeps circling through the whole 4 s dwell.
- Bird bank angle depends on dt, and the walker's shoes have no ankle pitch.
- Every pose writer must reuse scratch objects. One `new Vector3()` per animal per frame becomes megabytes per minute.
