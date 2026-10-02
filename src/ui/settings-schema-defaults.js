// Enums, defaults and validators shared by settings persistence and the HUD renderers.

// [id, label, key] tuples keep the ordered mode list compact.
const MODE_TUPLES = [
  ['overview', 'Overview', '1'],
  ['orbit', 'Free', '2'],
  ['side', 'Train', '3'],
  ['bridge', 'Bridge', '4'],
];
export const MODES = MODE_TUPLES.map(([id, label, key]) => ({ id, label, key }));

export const FLIGHT_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'KeyC', 'ShiftLeft', 'ShiftRight']);

const TIME_OF_DAY_TUPLES = [
  ['day', 'Day', '☀'],
  ['evening', 'Evening', '◐'],
  ['night', 'Night', '☾'],
];
export const TIMES_OF_DAY = TIME_OF_DAY_TUPLES.map(([id, label, icon]) => ({ id, label, icon }));

const PIXEL_MODE_TUPLES = [
  ['native', 'Native', null],
  ['pixel720', '720p', 720],
  ['pixel540', '540p', 540],
  ['pixel360', '360p', 360],
];
export const PIXEL_MODES = Object.fromEntries(PIXEL_MODE_TUPLES.map(([id, label, shortSide]) => [id, { label, shortSide }]));

export const STORAGE_KEY = 'train-scene-settings-v2';

export const DEFAULT_STATE = Object.freeze({
  mode: 'overview',
  speed: 1,
  pixelResolution: 'native',
  lastPixelResolution: 'pixel360',
  outline: true,
  timeOfDay: 'day',
  paused: false,
  spin: true,
  timeScale: 1,
  hudVisible: true,
});

// Small validator combinators, composed below into one predicate per settings key.
const bool = value => typeof value === 'boolean';
const numberBetween = (min, max) => value => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
const oneOf = (list, pick = entry => entry.id) => value => list.some(entry => pick(entry) === value);
const pixelModeKey = (excludeNative = false) => value =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(PIXEL_MODES, value) && (!excludeNative || value !== 'native');

export const SETTING_VALIDATORS = {
  mode: oneOf(MODES),
  speed: numberBetween(0, 2.5),
  pixelResolution: pixelModeKey(),
  lastPixelResolution: pixelModeKey(true),
  outline: bool,
  timeOfDay: oneOf(TIMES_OF_DAY),
  paused: bool,
  spin: bool,
  timeScale: numberBetween(0, 2),
  hudVisible: bool,
};
