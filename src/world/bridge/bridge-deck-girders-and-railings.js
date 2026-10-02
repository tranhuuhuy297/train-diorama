// Red bridge deck over the river span: girders and handrails follow the curved track frames,
// railing posts stand every fourth frame; the arch and its supports are delegated.
import * as THREE from 'three';
import { npr } from '../../materials/npr-cel-material-factory.js';
import { extrude } from '../../geometry/extrude-profile-along-frames.js';
import { buildBridgeArchAndSupports } from './bridge-arch-columns-piers-abutments.js';

const DECK_PROFILE = [[-1.55, -1.25], [1.55, -1.25], [1.55, -0.45], [-1.55, -0.45]];
const POST_FRAME_STRIDE = 4;
const POST_LATERAL = 1.67;
const POST_RISE = 0.4;

// Rectangle between lateral offsets inner..outer (scaled by side) and heights bottom..top.
function sideProfile(side, inner, outer, bottom, top) {
  return [[side * inner, bottom], [side * outer, bottom], [side * outer, top], [side * inner, top]];
}

function addRailingPosts(world, deckFrames, material) {
  const perSide = Math.floor((deckFrames.length - 1) / POST_FRAME_STRIDE) + 1;
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), material, perSide * 2);
  const spot = new THREE.Vector3();
  const translation = new THREE.Matrix4();
  let written = 0;
  for (let index = 0; index < deckFrames.length; index += POST_FRAME_STRIDE) {
    const { p, r } = deckFrames[index];
    for (const side of [-1, 1]) {
      spot.copy(p).addScaledVector(r, side * POST_LATERAL);
      spot.y += POST_RISE;
      posts.setMatrixAt(written++, translation.makeTranslation(spot.x, spot.y, spot.z));
    }
  }
  posts.count = written;
  world.group.add(posts);
}

export function buildBridge(world) {
  const [firstFrame, lastFrame] = world.bridge;
  const deckFrames = world.frames.slice(firstFrame, lastFrame + 1);
  const red = npr({ color: '#b8432f', stipple: 0.12, stippleScale: 3, doubleSided: true });
  const darkRed = npr({ color: '#8a2f24', stipple: 0.1, stippleScale: 3, doubleSided: true });
  const stone = npr({ color: '#b9ae98', stipple: 0.35, stippleScale: 2.2 });
  world.group.add(new THREE.Mesh(extrude(deckFrames, DECK_PROFILE, true), darkRed));
  for (const side of [-1, 1]) {
    world.group.add(new THREE.Mesh(extrude(deckFrames, sideProfile(side, 1.5, 1.75, -1.45, -0.15), true), red));
    world.group.add(new THREE.Mesh(extrude(deckFrames, sideProfile(side, 1.62, 1.72, 0.85, 0.95), true), red));
  }
  addRailingPosts(world, deckFrames, red);
  buildBridgeArchAndSupports(world, deckFrames, { red, darkRed, stone });
}
