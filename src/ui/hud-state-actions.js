// State -> diorama -> DOM -> log -> toast -> save pipeline, one action per HUD control.
import { PIXEL_MODES, TIMES_OF_DAY } from './settings-schema-defaults.js';
import { element, renderModes, renderToggles, renderTimeOfDay } from './hud-button-renderers.js';
import { showToast } from './shortcut-toast.js';

const FREE_FLIGHT_TOAST = 'Free · Click scene to fly · WASD move · Space rise · C descend · Shift sprint · Esc releases mouse';

export function applyHudVisibility(visible) {
  const hidden = !visible;
  element('hud-top').hidden = hidden;
  element('hud-controls').hidden = hidden;
  document.body.classList.toggle('hud-hidden', hidden);
  element('shortcut-toast').classList.toggle('hud-hidden', hidden);
}

// One entry per togglable pill: how to flip it, what to tell the diorama, what to log.
function buildToggleHandlers(state, getDiorama) {
  return {
    paused: () => {
      state.paused = !state.paused;
      const diorama = getDiorama();
      if (diorama) diorama.paused = state.paused;
      console.log(state.paused ? '[PAUSE] Paused' : '[PAUSE] Resumed');
    },
    outline: () => {
      state.outline = !state.outline;
      getDiorama()?.setOutline(state.outline);
    },
    spin: () => {
      state.spin = !state.spin;
      getDiorama()?.setAutoRotate(state.spin);
    },
  };
}

export function createHudActions({ state, getDiorama, save }) {
  const toggleHandlers = buildToggleHandlers(state, getDiorama);

  const setMode = mode => {
    state.mode = mode;
    getDiorama()?.setMode(mode);
    renderModes(state);
    renderToggles(state);
    console.log(`[CAMERA] Mode: ${mode}`);
    if (mode === 'orbit' && getDiorama()) showToast(FREE_FLIGHT_TOAST);
    save();
  };

  const setTimeOfDay = id => {
    if (!TIMES_OF_DAY.some(entry => entry.id === id)) throw new Error(`Invalid time of day: ${id}`);
    state.timeOfDay = id;
    getDiorama()?.setTimeOfDay(id);
    renderTimeOfDay(state);
    console.log(`[GAMEPLAY] Time of day: ${id}`);
    save();
  };

  const setPixelResolution = id => {
    const entry = PIXEL_MODES[id];
    state.pixelResolution = id;
    if (id !== 'native') state.lastPixelResolution = id;
    element('pixel-resolution').value = id;
    getDiorama()?.setPixelResolution(entry.shortSide);
    console.log(`[DEBUG] Pixel resolution: ${entry.label}`);
    save();
  };

  const setSpeed = value => {
    state.speed = value;
    element('speed').value = String(value);
    const diorama = getDiorama();
    if (diorama) diorama.speedMul = value;
    save();
  };

  const setTimeScale = value => {
    state.timeScale = value;
    element('time-scale').value = String(value);
    element('time-scale-value').textContent = `${value}×`;
    const diorama = getDiorama();
    if (diorama) diorama.timeScale = value;
    save();
  };

  const toggle = name => {
    toggleHandlers[name]();
    renderToggles(state);
    save();
  };

  const toggleHudVisible = () => {
    state.hudVisible = !state.hudVisible;
    applyHudVisibility(state.hudVisible);
    console.log(state.hudVisible ? '[HUD] Shown' : '[HUD] Hidden');
    showToast(state.hudVisible ? 'H · HUD shown' : 'H · HUD hidden — press H to show');
    save();
  };

  const setHelpVisible = visible => {
    element('help').hidden = !visible;
    element('controls-button').setAttribute('aria-expanded', String(visible));
  };

  return { setMode, setTimeOfDay, setPixelResolution, setSpeed, setTimeScale, toggle, toggleHudVisible, setHelpVisible };
}
