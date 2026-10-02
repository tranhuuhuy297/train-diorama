// Arch, spandrel columns, cross braces, approach piers and stone abutments. They follow the
// straight chord between the deck's end frames, not the curved track, and stand on the
// graded heightmap as it was before any building pad.
import * as THREE from 'three';
import { lerp } from '../../core/seeded-prng-and-gradient-noise.js';
import { extrude } from '../../geometry/extrude-profile-along-frames.js';
import { box } from '../../geometry/procedural-geometry-helpers.js';
import { UP } from '../world-constants.js';
import { heightAt } from '../terrain/terrain-heightmap-grading.js';

const RIB_STEPS = 48;
const RIB_OFFSET = 1.15;
const RIB_PROFILE = [[-0.28, -0.45], [0.28, -0.45], [0.28, 0.45], [-0.28, 0.45]];
const TANGENT_REACH = 0.002;
const SPAN_SPACING = 1.7;
const PIER_OFFSET = 1.0;
// Chord fractions of the two arch springs, their sink below ground, and the crown's drop below the deck.
const SPRINGS = [0.13, 0.87];
const SPRING_SINK = 0.6;
const CROWN_DROP = 1.35;

// Parabola over the straight line low0..low1 (kappa 0..1), lifted to `crown` at kappa = 0.5.
function parabolaOverSlopedLine(low0, low1, crown, kappa) {
  const line = lerp(low0, low1, kappa);
  const bulge = 1 - (2 * kappa - 1) ** 2;
  return line + (crown - line) * bulge;
}

/** Chord frame and arch curve; pure maths, creates no scene objects. */
export function createBridgeChord(world, bridgeFrames) {
  const P0 = bridgeFrames[0].p;
  const P1 = bridgeFrames[bridgeFrames.length - 1].p;
  const span = new THREE.Vector3().subVectors(P1, P0);
  const len = span.length();
  const dir = span.normalize();
  const right = dir.clone().cross(UP).normalize();
  const [sA, sB] = SPRINGS;
  const at = s => new THREE.Vector3().copy(P0).addScaledVector(dir, s * len);
  const groundAt = s => {
    const foot = at(s);
    return heightAt(world, foot.x, foot.z);
  };
  const deckY = (P0.y + P1.y) / 2;
  const apex = deckY - CROWN_DROP;
  const [baseA, baseB] = [groundAt(sA) - SPRING_SINK, groundAt(sB) - SPRING_SINK];
  const archY = s => parabolaOverSlopedLine(baseA, baseB, apex, (s - sA) / (sB - sA));
  const archPt = s => at(s).setY(archY(s));
  return { P0, P1, deckY, len, dir, right, sA, sB, baseA, baseB, apex, at, groundAt, archY, archPt };
}

// Unit arch tangent at s from a central difference clamped to the springs.
function archTangent(chord, s) {
  const ahead = chord.archPt(Math.min(chord.sB, s + TANGENT_REACH));
  const behind = chord.archPt(Math.max(chord.sA, s - TANGENT_REACH));
  return ahead.sub(behind).normalize();
}

// Rib frames: lateral axis = chord right, up = right × tangent flipped to point skyward.
function ribFrames(chord, offset) {
  return Array.from({ length: RIB_STEPS + 1 }, (_, step) => {
    const s = lerp(chord.sA, chord.sB, step / RIB_STEPS);
    const up = new THREE.Vector3().crossVectors(chord.right, archTangent(chord, s)).normalize();
    if (up.y < 0) up.negate();
    return { p: chord.archPt(s).addScaledVector(chord.right, offset), r: chord.right.clone(), u: up };
  });
}

// Box aimed along the chord (local +Z toward position + dir).
function chordBox(world, chord, size, material, x, y, z) {
  const mesh = box(size[0], size[1], size[2], material, x, y, z, world.group);
  mesh.lookAt(mesh.position.clone().add(chord.dir));
  return mesh;
}

// Pair of uprights at ±offset across the chord from `centre`, spanning y from base to base + height.
function uprightPair(world, chord, centre, offset, size, material, base, height) {
  for (const lateral of [-offset, offset]) {
    const spot = centre.clone().addScaledVector(chord.right, lateral);
    chordBox(world, chord, [size, height, size], material, spot.x, base + height / 2, spot.z);
  }
}

function addSpandrelsAndPiers(world, chord, { red, darkRed }) {
  const { sA, sB, deckY, archY, at } = chord;
  const spans = Math.round(chord.len / SPAN_SPACING);
  const deckUnderside = deckY - 1.2;
  for (let i = 1; i < spans; i++) {
    const s = i / spans;
    const centre = at(s);
    if (s > sA && s < sB) {
      const columnBase = archY(s) + 0.35;
      const columnHeight = deckUnderside - columnBase;
      if (columnHeight > 0.25) uprightPair(world, chord, centre, RIB_OFFSET, 0.26, red, columnBase, columnHeight);
      if (i % 2 === 0) chordBox(world, chord, [2.3, 0.22, 0.22], darkRed, centre.x, archY(s) + 0.2, centre.z);
    } else {
      const pierBase = chord.groundAt(s) - 0.5;
      const pierHeight = deckUnderside - pierBase;
      if (pierHeight > 0.5) uprightPair(world, chord, centre, PIER_OFFSET, 0.5, red, pierBase, pierHeight);
    }
  }
}

export function buildBridgeArchAndSupports(world, bridgeFrames, materials) {
  const chord = createBridgeChord(world, bridgeFrames);
  for (const offset of [-RIB_OFFSET, RIB_OFFSET]) {
    world.group.add(new THREE.Mesh(extrude(ribFrames(chord, offset), RIB_PROFILE, true), materials.red));
  }
  addSpandrelsAndPiers(world, chord, materials);
  for (const s of SPRINGS) {
    const spring = chord.at(s);
    chordBox(world, chord, [3.4, 2.2, 2.2], materials.stone, spring.x, chord.groundAt(s) - 0.2, spring.z);
  }
}
