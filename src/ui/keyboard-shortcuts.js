// Pure key resolver plus the window/document listeners that drive it.
import { FLIGHT_KEYS, MODES, TIMES_OF_DAY } from './settings-schema-defaults.js';
import { showToast } from './shortcut-toast.js';

export function isEditableTarget(target) {
  if (!target) return false;
  return target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable === true;
}

export function resolveKeyAction(event, { mode, flightLocked }) {
  if (mode === 'orbit' && flightLocked && FLIGHT_KEYS.has(event.code)) {
    return { type: 'flight-key', code: event.code };
  }
  if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === 'l') return { type: 'log-camera-pose' };
  const modeMatch = MODES.find(entry => entry.key === event.key);
  if (modeMatch) return { type: 'set-mode', mode: modeMatch.id };
  if (key === 'b') return { type: 'bridge-camera' };
  if (key === 'h') return { type: 'toggle-hud' };
  if (key === 'p') return { type: 'toggle-pixel-art' };
  if (key === 'o') return { type: 'toggle-outline' };
  if (key === 'x') return { type: 'toggle-time-scale' };
  if (key === 't') return { type: 'cycle-time-of-day', direction: event.shiftKey ? -1 : 1 };
  if (event.key === ' ') return { type: 'toggle-pause' };
  return null;
}

function handleXSequence(state, actions) {
  if (state.spin) actions.toggle('spin');
  actions.setTimeScale(state.timeScale === 0 ? 1 : 0);
  console.log(`[GAMEPLAY] Time scale: ${state.timeScale}`);
  showToast(`X · Time scale · ${state.timeScale}×`);
}

function handleCycleTimeOfDay(state, actions, direction) {
  const index = TIMES_OF_DAY.findIndex(entry => entry.id === state.timeOfDay);
  const next = TIMES_OF_DAY[(index + direction + 3) % 3];
  actions.setTimeOfDay(next.id);
}

export function bindKeyboardShortcuts({ state, actions, getDiorama }) {
  window.addEventListener('keydown', event => {
    const diorama = getDiorama();
    const flightLocked = Boolean(diorama?.firstPersonControls?.isLocked);
    const action = resolveKeyAction(event, { mode: state.mode, flightLocked });
    if (!action) return;
    switch (action.type) {
      case 'flight-key':
        diorama?.movementKeys.add(action.code);
        event.preventDefault();
        break;
      case 'log-camera-pose':
        diorama?.logCameraPose();
        break;
      case 'set-mode':
        actions.setMode(action.mode);
        break;
      case 'bridge-camera':
        actions.setMode('bridge');
        showToast('B · Bridge camera');
        break;
      case 'toggle-hud':
        actions.toggleHudVisible();
        break;
      case 'toggle-pixel-art':
        actions.setPixelResolution(state.pixelResolution === 'native' ? state.lastPixelResolution : 'native');
        break;
      case 'toggle-outline':
        actions.toggle('outline');
        break;
      case 'toggle-time-scale':
        handleXSequence(state, actions);
        break;
      case 'cycle-time-of-day':
        handleCycleTimeOfDay(state, actions, action.direction);
        break;
      case 'toggle-pause':
        event.preventDefault();
        actions.toggle('paused');
        break;
    }
  });

  window.addEventListener('keyup', event => {
    getDiorama()?.movementKeys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    getDiorama()?.movementKeys.clear();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) getDiorama()?.movementKeys.clear();
  });
}
