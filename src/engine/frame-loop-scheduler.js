// 120fps-capped deadline loop; every member is read from `d` inside the frame body (never
// cached), so swapping an instance override onto `d` takes effect on the very next frame.
import { stepSimulation } from './simulation-step.js';

export const FRAME_INTERVAL_MILLISECONDS = 1000 / 120;

// null = skip this callback; otherwise the next deadline, keeping cadence across skipped frames.
export function nextFrameDeadline(now, nextFrameAt) {
  if (now + 0.1 < nextFrameAt) return null;
  const elapsedIntervals = Math.max(1, Math.floor((now - nextFrameAt) / FRAME_INTERVAL_MILLISECONDS) + 1);
  return nextFrameAt + elapsedIntervals * FRAME_INTERVAL_MILLISECONDS;
}

export function createFrameLoop(d) {
  function loop(now) {
    d.raf = requestAnimationFrame(loop);
    const deadline = nextFrameDeadline(now, d.nextFrameAt);
    if (deadline === null) return;
    d.nextFrameAt = deadline;

    const frameStart = performance.now();
    const realDt = (now - d.last) / 1000;
    const dt = Math.min(0.05, realDt);
    d.last = now;

    d.updateTimeOfDay(realDt);
    d.world.nightAmount = d.lightingUniforms.uNight.value;
    if (!d.paused && d.timeScale > 0) stepSimulation(d, dt * d.timeScale);
    d.updateCamera(dt);
    // Real clamped dt, outside the sim gate: clouds still part around the camera while paused.
    d.world.updateCloudCamera(d.camera.position, dt);
    d.render();

    const stats = d.performanceStats;
    stats.frameMilliseconds += 0.1 * (realDt * 1000 - stats.frameMilliseconds);
    stats.cpuMilliseconds += 0.1 * (performance.now() - frameStart - stats.cpuMilliseconds);
  }
  return loop;
}
