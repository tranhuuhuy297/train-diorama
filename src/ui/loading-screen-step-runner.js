// Weighted loading-step runner. Two paint frames let a phase label land before work blocks.
export const LOADING_HINTS = [
  'Drag to orbit the valley. Scroll to zoom.',
  'Press 1–4 to change the camera view.',
  'In Free view, click the scene to fly with mouse and WASD. Space rises, C descends, Shift sprints.',
  'Press T for Day / Evening / Night and P for pixel art.',
  'The train pauses at the station.',
];

const paint = () => new Promise(done => requestAnimationFrame(done));
const pause = duration => new Promise(done => setTimeout(done, duration));

// Groups the loader DOM reads behind a small view so the runner stays declarative.
function createLoaderView(doc) {
  const screen = doc.getElementById('loading');
  const phaseLabel = doc.getElementById('load-phase');
  const percentLabel = doc.getElementById('load-percent');
  const hintLabel = doc.getElementById('load-hint');
  const track = screen.querySelector('[role="progressbar"]');
  const fill = track.querySelector('.load-fill');

  const setProgress = value => {
    fill.style.width = `${value}%`;
    percentLabel.textContent = `${value}%`;
    track.setAttribute('aria-valuenow', String(value));
  };

  return {
    reset() {
      screen.hidden = false;
      screen.classList.remove('is-gone', 'is-working');
      screen.setAttribute('aria-busy', 'true');
      hintLabel.textContent = LOADING_HINTS[0];
      setProgress(0);
    },
    showPhase(label) {
      phaseLabel.textContent = label;
    },
    setWorking(active) {
      screen.classList.toggle('is-working', active);
    },
    advanceProgress: setProgress,
    showHint(text) {
      hintLabel.textContent = text;
    },
    async settle() {
      await pause(260);
      screen.classList.add('is-gone');
      await pause(420);
      screen.hidden = true;
      screen.setAttribute('aria-busy', 'false');
    },
    fail(message) {
      screen.classList.remove('is-gone', 'is-working');
      phaseLabel.textContent = `LOADING FAILED: ${message}`;
      hintLabel.textContent = 'Reload the page to try again.';
    },
  };
}

// Cycles through the hint strings on a fixed interval until the returned stop() fires.
function startHintRotation(view, hints, intervalMs) {
  let index = 0;
  const timer = setInterval(() => {
    index = (index + 1) % hints.length;
    view.showHint(hints[index]);
  }, intervalMs);
  return () => clearInterval(timer);
}

// Runs one weighted step, returning the new running total once it settles.
async function runStep(view, step, completed) {
  view.showPhase(step.label);
  view.setWorking(true);
  await paint();
  await paint();
  await step.run();
  const total = completed + step.weight;
  view.setWorking(false);
  view.advanceProgress(total);
  return total;
}

export async function runLoadingSteps(steps) {
  const view = createLoaderView(document);
  view.reset();
  const stopHintRotation = startHintRotation(view, LOADING_HINTS, 2600);

  try {
    let completed = 0;
    for (const step of steps) completed = await runStep(view, step, completed);
    view.showPhase('READY');
    await view.settle();
  } catch (error) {
    view.fail(error.message);
    throw error;
  } finally {
    stopHintRotation();
  }
}
