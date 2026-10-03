// Hot-air balloon parts in balloon-local space: the red/cream harlequin envelope, the woven
// basket, its suspension ropes and the four hanging sandbags. Everything here is lit by the
// burner's local glow, which reads positions before the model matrix (hence merged later).
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { box } from '../../geometry/procedural-geometry-helpers.js';

export const BALLOON_LOCAL_GLOW = Object.freeze({ position: Object.freeze([0, -1.9, 0]), radius: 4.5, strength: 0.65 });

// [radius, y] from the burner mouth up to the crown.
export const BALLOON_ENVELOPE_PROFILE = Object.freeze([
  [0.22, -1.9], [0.35, -1.85], [0.9, -1.2], [1.45, -0.35], [1.72, 0.4],
  [1.62, 1.15], [1.2, 1.75], [0.6, 2.08], [0.01, 2.18],
].map(point => Object.freeze(point)));

const ENVELOPE_SEGMENTS = 14;
// Colour comes from the vertices; local glow goes first in every option set (cache key order).
const ENVELOPE_FINISH = Object.freeze({ vertexColors: true, stipple: 0.12, stippleScale: 2 });
const PANEL_RED = '#d93f36';
const PANEL_CREAM = '#fff4e4';

/** Non-indexed lathe with smooth normals and per-panel checker vertex colours (no uv). */
export function createBalloonEnvelopeGeometry() {
  const outline = BALLOON_ENVELOPE_PROFILE.map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(outline, ENVELOPE_SEGMENTS).toNonIndexed();
  geometry.deleteAttribute('uv');
  const rows = outline.length - 1;
  const swatches = [new THREE.Color(PANEL_RED), new THREE.Color(PANEL_CREAM)];
  const count = geometry.attributes.position.count;
  const rgb = new Float32Array(count * 3);
  // After expansion every lathe quad is 6 consecutive vertices, sector by sector, bottom row first.
  for (let first = 0; first < count; first += 3) {
    const quad = Math.floor(first / 6);
    const swatch = swatches[(Math.floor(quad / rows) + (quad % rows)) % 2];
    for (let corner = first; corner < first + 3; corner++) {
      rgb[corner * 3] = swatch.r;
      rgb[corner * 3 + 1] = swatch.g;
      rgb[corner * 3 + 2] = swatch.b;
    }
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(rgb, 3));
  return geometry;
}

export function createBalloonEnvelope(balloon, localGlow) {
  const geometry = createBalloonEnvelopeGeometry();
  const envelope = new THREE.Mesh(geometry, npr({ localGlow, ...ENVELOPE_FINISH }));
  balloon.add(envelope);
  return envelope;
}

// One mirrored basket side (sign = -1 or +1): plank walls, top/bottom rails, rim, then the weave.
function addBasketSide(balloon, sign, { wood, wicker, basketTrim }) {
  const add = (w, h, d, material, x, y, z) => box(w, h, d, material, x, y, z, balloon);
  add(0.07, 0.5, 0.7, wood, sign * 0.315, -2.885, 0);
  add(0.56, 0.5, 0.07, wood, 0, -2.885, sign * 0.315);
  for (const railY of [-3.12, -2.63]) {
    add(0.085, 0.075, 0.77, basketTrim, sign * 0.35, railY, 0);
    add(0.64, 0.075, 0.085, basketTrim, 0, railY, sign * 0.35);
  }
  add(0.095, 0.035, 0.78, wicker, sign * 0.35, -2.585, 0);
  add(0.64, 0.035, 0.095, wicker, 0, -2.585, sign * 0.35);
  for (let course = 0; course < 7; course++) {
    const y = -3.065 + course * 0.06;
    add(0.025, 0.025, 0.64, wicker, sign * 0.357, y, 0);
    add(0.64, 0.025, 0.025, wicker, 0, y, sign * 0.357);
    // Stakes alternate in and out between courses so the weave reads as basketry.
    for (let stake = 0; stake < 5; stake++) {
      const along = -0.26 + stake * 0.13;
      const outward = 0.357 + ((course + stake) % 2) * 0.012;
      add(0.025, 0.052, 0.025, wicker, sign * outward, y, along);
      add(0.025, 0.052, 0.025, wicker, along, y, sign * outward);
    }
  }
}

export function buildBalloonBasket(balloon, localGlow) {
  const materials = {
    wood: npr({ localGlow, color: '#a47748', stipple: 0.2, stippleScale: 5 }),
    wicker: npr({ localGlow, color: '#cfaa70', stipple: 0.16, stippleScale: 5 }),
    basketTrim: npr({ localGlow, color: '#795332', stipple: 0.12 }),
  };
  box(0.7, 0.07, 0.7, materials.basketTrim, 0, -3.14, 0, balloon);
  for (const sign of [-1, 1]) addBasketSide(balloon, sign, materials);
}

const ROPE_CORNERS = [[0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]];
const SANDBAG_SPOTS = [[-0.43, 0], [0.43, 0], [0, -0.43], [0, 0.43]];

export function buildBalloonRopesAndSandbags(balloon, localGlow) {
  const rope = npr({ localGlow, color: '#4a3a30' });
  for (const [x, z] of ROPE_CORNERS) box(0.025, 0.94, 0.025, rope, x, -2.17, z, balloon);
  const bagShape = new THREE.IcosahedronGeometry(1, 1);
  const canvas = npr({ localGlow, color: '#d1b783', stipple: 0.14, stippleScale: 4 });
  for (const [x, z] of SANDBAG_SPOTS) {
    box(0.022, 0.14, 0.022, rope, x, -2.66, z, balloon);
    const bag = new THREE.Mesh(bagShape, canvas);
    bag.position.set(x, -2.94, z);
    bag.scale.set(0.12, 0.22, 0.12);
    balloon.add(bag);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, 0.075, 6), canvas);
    neck.position.set(x, -2.73, z);
    balloon.add(neck);
    box(0.1, 0.025, 0.1, rope, x, -2.755, z, balloon);
  }
}
