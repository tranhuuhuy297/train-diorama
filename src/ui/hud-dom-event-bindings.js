// Wires the static HUD DOM to actions, in the fixed listener-registration order the parity
// probes rely on: time-of-day, initial value sync, camera modes, toggles, speed, pixel art,
// time scale, help panel.
import { DEFAULT_STATE, PIXEL_MODES } from './settings-schema-defaults.js';
import { element, TOGGLES } from './hud-button-renderers.js';
import { applyHudVisibility } from './hud-state-actions.js';
import { showToast } from './shortcut-toast.js';

const closestWithData = (event, attribute) => event.target.closest(`[${attribute}]`);

function bindTimeOfDayGroup(actions) {
  const group = element('time-of-day');
  group.addEventListener('click', event => {
    const picked = closestWithData(event, 'data-time-of-day');
    if (picked) actions.setTimeOfDay(picked.dataset.timeOfDay);
  });
  group.addEventListener('contextmenu', event => {
    event.preventDefault();
    actions.setTimeOfDay(DEFAULT_STATE.timeOfDay);
    showToast('Time of day · Day');
  });
}

// Fills the native <select> options and mirrors the persisted values onto the controls,
// before any listener below can fire.
function syncInitialValues(state) {
  const pixelSelect = element('pixel-resolution');
  pixelSelect.innerHTML = Object.entries(PIXEL_MODES)
    .map(([id, mode]) => `<option value="${id}">${mode.label}</option>`)
    .join('');
  pixelSelect.value = state.pixelResolution;
  element('speed').value = String(state.speed);
  element('time-scale').value = String(state.timeScale);
  element('time-scale-value').textContent = `${state.timeScale}×`;
  applyHudVisibility(state.hudVisible);
}

function bindCameraModeGroup(actions) {
  const group = element('camera-modes');
  group.addEventListener('click', event => {
    const picked = closestWithData(event, 'data-mode');
    if (picked) actions.setMode(picked.dataset.mode);
  });
  group.addEventListener('contextmenu', event => {
    if (!closestWithData(event, 'data-mode')) return;
    event.preventDefault();
    actions.setMode(DEFAULT_STATE.mode);
    showToast('Camera · Default');
  });
}

function bindDisplayToggleGroup(state, actions) {
  const group = element('display-controls');
  group.addEventListener('click', event => {
    const picked = closestWithData(event, 'data-toggle');
    if (picked) actions.toggle(picked.dataset.toggle);
  });
  group.addEventListener('contextmenu', event => {
    const picked = closestWithData(event, 'data-toggle');
    if (!picked) return;
    event.preventDefault();
    const id = picked.dataset.toggle;
    if (!TOGGLES.some(entry => entry.id === id)) throw new Error(`Unknown toggle: ${id}`);
    if (state[id] !== DEFAULT_STATE[id]) actions.toggle(id);
    showToast(`${picked.textContent.trim()} · Default`);
  });
}

function bindSpeedSlider(actions) {
  const input = element('speed');
  input.addEventListener('input', event => actions.setSpeed(Number(event.target.value)));
  input.closest('label').addEventListener('contextmenu', event => {
    event.preventDefault();
    actions.setSpeed(DEFAULT_STATE.speed);
    showToast('Train speed · Default');
  });
}

function bindPixelResolutionSelect(state, actions) {
  const select = element('pixel-resolution');
  select.addEventListener('change', event => actions.setPixelResolution(event.target.value));
  select.closest('label').addEventListener('contextmenu', event => {
    event.preventDefault();
    state.lastPixelResolution = DEFAULT_STATE.lastPixelResolution;
    actions.setPixelResolution(DEFAULT_STATE.pixelResolution);
    showToast('Pixel art · Native');
  });
}

function bindTimeScaleSlider(state, actions) {
  const input = element('time-scale');
  input.addEventListener('input', event => {
    actions.setTimeScale(Number(event.target.value));
    showToast(`Time scale · ${state.timeScale}×`);
  });
  element('time-scale-control').addEventListener('contextmenu', event => {
    event.preventDefault();
    actions.setTimeScale(DEFAULT_STATE.timeScale);
    showToast('Time scale · Default');
  });
}

function bindHelpPanel(actions) {
  element('controls-button').addEventListener('click', () => actions.setHelpVisible(element('help').hidden));
  element('hide-help').addEventListener('click', () => actions.setHelpVisible(false));
}

export function bindHud(state, actions) {
  bindTimeOfDayGroup(actions);
  syncInitialValues(state);
  bindCameraModeGroup(actions);
  bindDisplayToggleGroup(state, actions);
  bindSpeedSlider(actions);
  bindPixelResolutionSelect(state, actions);
  bindTimeScaleSlider(state, actions);
  bindHelpPanel(actions);
}
