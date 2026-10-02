// Boot sequence: load settings, wire the HUD, then run the weighted loading steps.
import { PIXEL_MODES } from './ui/settings-schema-defaults.js';
import { loadSettings, createSettingsSaver } from './ui/settings-local-storage-persistence.js';
import { element, renderModes, renderToggles, renderTimeOfDay } from './ui/hud-button-renderers.js';
import { createHudActions } from './ui/hud-state-actions.js';
import { bindHud } from './ui/hud-dom-event-bindings.js';
import { bindKeyboardShortcuts } from './ui/keyboard-shortcuts.js';
import { showToast } from './ui/shortcut-toast.js';
import { runLoadingSteps } from './ui/loading-screen-step-runner.js';
import { mountDebugMenu } from './ui/debug-menu-panel.js';
import { installParityTestHook } from './engine/parity-test-hook.js';

// Holds the live Diorama once the engine module resolves; undefined until then.
let activeDiorama;
const getActiveDiorama = () => activeDiorama;

// Dynamically imports the engine module and returns its Diorama export.
async function importEngine() {
  const module = await import('./engine/diorama.js');
  return module.Diorama;
}

// Pushes every persisted setting onto an already-stored diorama, in contract order.
// Called only after the instance is in the shared slot, so a thrown setter still leaves
// something the pagehide handler can dispose.
function applyPersistedState(diorama, state) {
  diorama.setMode(state.mode);
  diorama.speedMul = state.speed;
  diorama.timeScale = state.timeScale;
  diorama.setPixelResolution(PIXEL_MODES[state.pixelResolution].shortSide);
  diorama.setOutline(state.outline);
  diorama.setTimeOfDay(state.timeOfDay, true);
  diorama.setAutoRotate(state.spin);
  diorama.paused = state.paused;
  diorama.prepareOverviewIntro();
}

const nextPaint = () => new Promise(resolve => requestAnimationFrame(resolve));

function announceReady() {
  console.log('[GAMEPLAY] Started');
  if (activeDiorama.overviewIntro) {
    activeDiorama.overviewIntro.playing = true;
    console.log('[CAMERA] Overview intro started');
  }
  mountDebugMenu(activeDiorama);
  showToast('H · Hide HUD');
}

async function boot(state) {
  let DioramaClass;
  await runLoadingSteps([
    { label: 'LOADING ENGINE', weight: 30, run: async () => { DioramaClass = await importEngine(); } },
    { label: 'BUILDING VALLEY AND TRAIN', weight: 60, run: () => { activeDiorama = new DioramaClass(element('scene')); applyPersistedState(activeDiorama, state); installParityTestHook(activeDiorama); } },
    { label: 'PREPARING FIRST FRAME', weight: 10, run: nextPaint },
  ]);
  announceReady();
}

const state = loadSettings();
const save = createSettingsSaver(state);
const actions = createHudActions({ state, getDiorama: getActiveDiorama, save });

renderModes(state);
renderToggles(state);
renderTimeOfDay(state);
bindHud(state, actions);
bindKeyboardShortcuts({ state, actions, getDiorama: getActiveDiorama });

window.addEventListener('pagehide', () => getActiveDiorama()?.dispose(), { once: true });

boot(state).catch(error => console.error(error));
