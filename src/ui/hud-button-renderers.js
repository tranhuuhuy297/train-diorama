// Builds the dynamic HUD markup; serialized innerHTML (attribute/class order) is part of parity.
import { MODES, TIMES_OF_DAY } from './settings-schema-defaults.js';

export function element(id) {
  const node = document.getElementById(id);
  if (node) return node;
  throw new Error(`Missing interface element: ${id}`);
}

export const TOGGLES = [
  { id: 'paused', container: 'toggles', isActive: s => s.paused, label: s => (s.paused ? '▶ Resume' : '⏸ Pause'), hint: 'Space', shown: () => true },
  { id: 'outline', container: 'outline-toggle', isActive: s => s.outline, label: () => 'Ink lines', hint: 'O', shown: () => true },
  { id: 'spin', container: 'toggles', isActive: s => s.spin, label: () => 'Turntable', hint: 'Auto-rotate', shown: s => s.mode === 'overview' },
];

const MODE_CLASSES = {
  base: 'flex items-center gap-1.5 rounded-2xl px-3.5 py-2 text-sm font-semibold transition-all',
  active: 'scale-105 text-white shadow-md',
  inactive: 'bg-white/70 text-[#3f2a1f] hover:-translate-y-0.5 hover:bg-white',
};
const PILL_CLASSES = {
  base: 'rounded-full px-3 py-1.5 text-xs font-semibold transition-all',
  active: 'text-white shadow-inner',
  inactive: 'bg-white/60 text-[#5a3b2a] hover:bg-white',
};

const markup = {
  modeButton(mode, state) {
    const active = state.mode === mode.id;
    const classes = `${MODE_CLASSES.base} ${active ? MODE_CLASSES.active : MODE_CLASSES.inactive}`;
    const keySpanClass = active ? 'text-[10px] text-white/70' : 'text-[10px] text-[#3f2a1f]/40';
    return `<button data-mode="${mode.id}" title="Right click to reset camera" aria-pressed="${active}" class="${classes}">${mode.label}<span class="${keySpanClass}">${mode.key}</span></button>`;
  },
  togglePill(toggle, state) {
    const active = toggle.isActive(state);
    const classes = `${PILL_CLASSES.base} ${active ? PILL_CLASSES.active : PILL_CLASSES.inactive}`;
    return `<button data-toggle="${toggle.id}" title="${toggle.hint} · Right click to reset" aria-pressed="${active}" class="${classes}">${toggle.label(state)}</button>`;
  },
  timeOfDayButton(entry, state) {
    const active = state.timeOfDay === entry.id;
    return `<button type="button" data-time-of-day="${entry.id}" aria-pressed="${active}" title="${entry.label} · T next / Shift+T previous"><span aria-hidden="true">${entry.icon}</span> ${entry.label}</button>`;
  },
};

export function renderModes(state) {
  element('camera-modes').innerHTML = MODES.map(mode => markup.modeButton(mode, state)).join('');
}

export function renderToggles(state) {
  const containerIds = [...new Set(TOGGLES.map(toggle => toggle.container))];
  for (const containerId of containerIds) {
    const visible = TOGGLES.filter(toggle => toggle.container === containerId && toggle.shown(state));
    element(containerId).innerHTML = visible.map(toggle => markup.togglePill(toggle, state)).join('');
  }
}

export function renderTimeOfDay(state) {
  document.body.dataset.timeOfDay = state.timeOfDay;
  element('time-of-day').innerHTML = TIMES_OF_DAY.map(entry => markup.timeOfDayButton(entry, state)).join('');
}
