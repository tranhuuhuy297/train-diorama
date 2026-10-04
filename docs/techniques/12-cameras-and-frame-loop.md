# 12. Cameras and the frame loop

[Index](../diorama-techniques.md)

## 12.1 Mode director

`src/engine/cameras/camera-mode-director.js` manages four modes, each with its own FOV: overview 42, orbit (Free) 65, side (Train) 48 and bridge 42.

- Overview and Free drive the camera directly. Entering Overview snaps back to the home pose (damping-off double reset); entering Free restores the saved free pose.
- Train and Bridge only compute a goal pose, which a shared exponential glide follows: position and target lerp by 1 − e^(−rate × dt). Switching into these two modes therefore blends from wherever the camera was instead of cutting.
- Selecting any mode cancels the overview intro.

## 12.2 Overview orbit and intro dolly

`src/engine/cameras/overview-orbit-camera.js` uses three.js OrbitControls:

| Setting | Value |
|---|---|
| Damping | 0.06 (per frame) |
| Auto-rotate | speed −0.245, i.e. 2π/60 × 0.245 rad/s, about 245 s per turn |
| Distance | 25–240 |
| Max polar angle | 1.5 rad |
| Intro | starts 1.22× farther out on the home → target axis and eases to home over 3.2 s with smootherstep p³(6p² − 15p + 10); any user drag interrupts it |
| Reset | damping off, `reset()` twice (the first call applies the pending damped delta), damping back on |

## 12.3 Free fly (pointer lock)

`src/engine/cameras/free-fly-pointer-lock-camera.js` uses `PointerLockControls`:

- Click the canvas to lock the mouse and Esc to release it. Vertical look stops 5° short of the poles.
- WASD moves, Space/C rise and descend, Shift sprints. Speed 12, sprint 24.
- The camera is clamped to the board (±61), at least 1.2 above the ground and below a ceiling of 200.
- The pose is saved when leaving the mode and restored on return. The first visit starts on the platform, looking along it.
- Movement keys are cleared on unlock, window blur and tab hide.

## 12.4 Train fly-along rig

`src/engine/cameras/train-fly-along-camera-rig.js` is a cinematic chase camera designed not to feel robotic:

- **Anchor:** the driver's position, (0, 2.45, −1.4) in loco space.
- **Carry first:** every frame the rig moves with the anchor before anything else, so the glide never lags the train.
- **Offsets** in loco space, each a slow sine with an unrelated period: lateral side × (20 + 4 sin(2πt/31)), height 5 + 2 sin(2πt/23), along 7 sin(2πt/41).
- **Wide shot** every 56 s: blend = ((1 − cos(2πt/56)) / 2)³ scales the offsets up to × 2.
- **Floors:** terrain + 3, and canopy + 1.5. The canopy is checked under the camera, under the goal, and under the goal 0.8 s ahead (radius 5, growing to 14 during the wide shot).
- **Glide:** position 2/s, target 5/s. Height climbs at 3/s and sinks at 0.7/s, so the camera rises fast to clear trees and settles slowly.
- **Side:** picked once on entry, on the outside of the loop.

## 12.5 Bridge tripod

`src/engine/cameras/bridge-tripod-camera.js` is a fixed riverbank camera at (−3, 5.5, 60). It pans to follow the track point under the train, with target (clamp(x, ±14) × 0.35, 8.5, 36). This pan-only tripod keeps the hero, the arch, always framed.

## 12.6 The frame loop

`src/engine/frame-loop-scheduler.js`:

- `requestAnimationFrame` fires every vsync, but work runs only at a 120 fps deadline. `nextFrameDeadline` keeps the cadence across skipped frames, so 144/165 Hz screens run at no more than 120 fps.
- realDt comes from the timestamps. dt = min(0.05, realDt) drives simulation and cameras, so a stalled tab never teleports the train.
- Order per frame:
  1. time-of-day blend (real dt);
  2. `world.nightAmount`;
  3. simulation, if not paused and timeScale > 0 (dt × timeScale, range 0–2);
  4. camera (dt);
  5. cloud avoidance (dt, also while paused);
  6. render;
  7. EMA stats (α 0.1) for frame time (FPS) and CPU submit time.
- The loop body reads every member from the diorama object; nothing is cached. Tests can therefore swap methods on the instance.
- `scene.matrixWorldAutoUpdate = false`. The render pipeline calls `scene.updateMatrixWorld()` once per frame, before the shadow and main passes, which share the result.

### Test hook

`src/engine/parity-test-hook.js`: `?parity` exposes the live diorama as `window.__diorama`, and `?parity=freeze` also pauses it. Headless Chromium renders through SwiftShader at about 2 FPS, so screenshot tests freeze the scene and step it with a fixed dt instead of waiting on wall-clock time. This approach works for any diorama.

## Files

`src/engine/cameras/*`, `src/engine/frame-loop-scheduler.js`, `src/engine/simulation-step.js`, `src/engine/diorama.js`, and `src/engine/parity-test-hook.js`.

## Cost

Negligible CPU: the camera rigs do a handful of vector operations and at most 3 canopy-grid queries plus 2 `heightAt` calls per frame. The frame loop's main lever is the 120 fps cap, which bounds GPU work on high-refresh screens.

## Pitfalls

- OrbitControls damping is applied per frame, so the feel depends on the frame rate (another reason for the 120 cap).
- Free-fly clamps only apply while moving. `lock(true)` (unadjusted movement) is rejected on some platforms, and the rejection is not caught, so Free never locks there.
- The fly-along clock advances by clamped real dt (it stops while paused or at time scale 0), so its periods ignore the time scale.
- The bridge camera overwrites `controls.target`.
