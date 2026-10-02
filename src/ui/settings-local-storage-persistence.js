// Reads and writes the persisted HUD settings, all-or-nothing on load.
import { DEFAULT_STATE, SETTING_VALIDATORS, STORAGE_KEY } from './settings-schema-defaults.js';

const KEYS = Object.keys(DEFAULT_STATE);

function parseAndValidate(raw) {
  const parsed = JSON.parse(raw);
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Invalid saved settings');
  }
  if (parsed.timeOfDay === 'golden') parsed.timeOfDay = 'evening';

  const result = {};
  for (const key of KEYS) {
    const validator = SETTING_VALIDATORS[key];
    if (!validator) throw new Error(`Missing setting validator: ${key}`);
    if (!Object.prototype.hasOwnProperty.call(parsed, key) || !validator(parsed[key])) {
      throw new Error(`Invalid saved setting: ${key}`);
    }
    result[key] = parsed[key];
  }
  return result;
}

export function loadSettings(storage) {
  try {
    const store = storage ?? globalThis.localStorage;
    const raw = store.getItem(STORAGE_KEY);
    if (raw === null) return { ...DEFAULT_STATE };
    return parseAndValidate(raw);
  } catch (error) {
    console.warn('[SETTINGS] Saved settings discarded', error);
    return { ...DEFAULT_STATE };
  }
}

export function createSettingsSaver(state, storage) {
  let failed = false;
  return function save() {
    if (failed) return;
    try {
      (storage ?? globalThis.localStorage).setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      failed = true;
      console.warn('[SETTINGS] Could not save settings', error);
    }
  };
}
