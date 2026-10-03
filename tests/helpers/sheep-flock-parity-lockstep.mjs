// Sheep-flock lockstep for node parity: an in-place, bit-exact comparison of every sheep state, route and
// instance matrix, and a frame runner that gives each side its own Math.random stream and [SHEEP] log buffer.
import { mulberry32 } from '../../src/core/seeded-prng-and-gradient-noise.js';

export const LOCKSTEP_RANDOM_SEED = 20260930;

const STATE_FIELDS = ['x', 'z', 'direction', 'size', 'phase', 'speed', 'turnSpeed', 'groundHeight', 'gait', 'sleep'];
const QUATERNION_FIELDS = ['x', 'y', 'z', 'w'];
const ROUTE_FIELDS = ['mode', 'offset', 'along', 'across', 'speed', 'clearTime', 'reactionTime', 'hopAge'];
// Instance layers with the number of instances each sheep owns.
const LAYERS = [['sheep', 1], ['sheepLegs', 4], ['sheepEars', 2]];

const differ = (sheepIndex, field, original, clone) => ({ sheepIndex, field, original, clone });

function stateMismatch(index, expected, actual) {
  for (const field of STATE_FIELDS) {
    if (!Object.is(expected[field], actual[field])) return differ(index, field, expected[field], actual[field]);
  }
  for (const axis of QUATERNION_FIELDS) {
    const [a, b] = [expected.orientation[axis], actual.orientation[axis]];
    if (!Object.is(a, b)) return differ(index, `orientation.${axis}`, a, b);
  }
  if (Boolean(expected.route) !== Boolean(actual.route)) return differ(index, 'route', Boolean(expected.route), Boolean(actual.route));
  if (!expected.route) return null;
  for (const field of ROUTE_FIELDS) {
    const [a, b] = [expected.route[field], actual.route[field]];
    if (!Object.is(a, b)) return differ(index, `route.${field}`, a, b);
  }
  return null;
}

/** First differing value between the two flocks (null when identical); never copies anything. */
export function firstSheepFlockMismatch(originalWorld, cloneWorld) {
  const [expected, actual] = [originalWorld.sheepStates, cloneWorld.sheepStates];
  if (expected.length !== actual.length) return differ(-1, 'count', expected.length, actual.length);
  for (let index = 0; index < expected.length; index++) {
    const found = stateMismatch(index, expected[index], actual[index]);
    if (found) return found;
  }
  for (const [name, perSheep] of LAYERS) {
    const [a, b] = [originalWorld[name].instanceMatrix.array, cloneWorld[name].instanceMatrix.array];
    if (a.length !== b.length) return differ(-1, `${name}.length`, a.length, b.length);
    for (let element = 0; element < a.length; element++) {
      if (!Object.is(a[element], b[element])) {
        return differ(Math.floor(element / 16 / perSheep), `${name}[${element}]`, a[element], b[element]);
      }
    }
  }
  return null;
}

/** Steps both sides `frames` times (frame numbers start at 1) and stops at the first mismatch `compare`
 * reports. Math.random and console.log are swapped per side and always restored. */
export function runSheepLockstep({ frames, stepOriginal, stepClone, beforeFrame = () => {}, compare }) {
  const logs = { original: [], clone: [] };
  const streams = { original: mulberry32(LOCKSTEP_RANDOM_SEED), clone: mulberry32(LOCKSTEP_RANDOM_SEED) };
  const realRandom = Math.random;
  const realLog = console.log;
  let side = null;
  let frame = 0;
  console.log = (...args) => {
    const message = args.map(String).join(' ');
    if (side !== null && message.startsWith('[SHEEP]')) logs[side].push([frame, message]);
  };
  const runSide = (name, step) => {
    side = name;
    Math.random = streams[name];
    try {
      step(frame);
    } finally {
      Math.random = realRandom;
      side = null;
    }
  };
  try {
    for (frame = 1; frame <= frames; frame++) {
      beforeFrame(frame);
      runSide('original', stepOriginal);
      runSide('clone', stepClone);
      const found = compare(frame);
      if (found) return { mismatch: { frame, ...found }, logs };
    }
    return { mismatch: null, logs };
  } finally {
    Math.random = realRandom;
    console.log = realLog;
  }
}
