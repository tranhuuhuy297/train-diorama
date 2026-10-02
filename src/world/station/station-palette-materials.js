// npr option tables for every station surface. The npr cache keys on the serialised options, so
// each table keeps one fixed key order; equal tables elsewhere in the world share a material.
import { npr } from '../../materials/npr-cel-material-factory.js';

// Base set, requested in this key order before any station mesh exists.
export const STATION_MATERIAL_OPTIONS = Object.freeze({
  platform: Object.freeze({ color: '#d9cfbd', stipple: 0.25, stippleScale: 2 }),
  edge: Object.freeze({ color: '#f2e7a8', stipple: 0.05 }),
  wood: Object.freeze({ color: '#7a4f35', stipple: 0.2, stippleScale: 3 }),
  darkWood: Object.freeze({ color: '#513b31', stipple: 0.12 }),
  green: Object.freeze({ color: '#3f7d5a', stipple: 0.1 }),
  cream: Object.freeze({ color: '#f4ead2', stipple: 0.12 }),
  roof: Object.freeze({ color: '#c9503c', stipple: 0.15, stippleScale: 3 }),
});

// Requested later, at their first use inside the individual builders.
export const WINDOW_GLASS_OPTIONS = Object.freeze({ color: '#ffe6a0', emissive: 0.6, nightGlow: true });
export const SHUTTER_WOOD_OPTIONS = Object.freeze({ color: '#765039', stipple: 0.16, stippleScale: 3 });
export const SHUTTER_PANEL_OPTIONS = Object.freeze({ color: '#a67850', stipple: 0.12, stippleScale: 3 });
export const SUITCASE_LEATHER_OPTIONS = Object.freeze({ color: '#93613e', stipple: 0.16, stippleScale: 3 });
export const SUITCASE_TRIM_OPTIONS = Object.freeze({ color: '#543c30', stipple: 0.1 });
export const LAMP_LANTERN_OPTIONS = Object.freeze({ color: '#ffe28a', emissive: 0.8, nightGlow: true });
export const FOOTPATH_OPTIONS = Object.freeze({ color: '#bda580', stipple: 0.22, stippleScale: 3 });

// Bottom-to-top stack beside the platform bench; width runs along the track.
export const GRANDMOTHER_SUITCASES = Object.freeze([
  Object.freeze({ width: 0.78, depth: 0.45, height: 0.29, color: '#805138' }),
  Object.freeze({ width: 0.68, depth: 0.4, height: 0.25, color: '#a3744c' }),
  Object.freeze({ width: 0.57, depth: 0.36, height: 0.22, color: '#654b3c' }),
]);

/** The seven shared station materials, created in table order. */
export function createStationMaterials() {
  const materials = {};
  for (const name of Object.keys(STATION_MATERIAL_OPTIONS)) materials[name] = npr(STATION_MATERIAL_OPTIONS[name]);
  return materials;
}

/** Leather for one stacked case: same stipple as the traveler's, own colour. */
export function grandmotherSuitcaseLeather(color) {
  return npr({ color, stipple: 0.16, stippleScale: 3 });
}
