// Just enough `document` for world builds in node: canvas elements whose 2D context records every
// property write and method call, so sign drawing can be compared without a real rasteriser.

let shimRegistry = null;

const MEASURE_WIDTH_PER_CHARACTER = 10;

function recordingContext(canvas) {
  const store = { canvas };
  return new Proxy(store, {
    set(target, property, value) {
      canvas.operations.push(['set', property, value]);
      target[property] = value;
      return true;
    },
    get(target, property) {
      if (typeof property === 'symbol') return undefined;
      if (Object.hasOwn(target, property)) return target[property];
      if (property === 'measureText') {
        return text => {
          canvas.operations.push(['call', 'measureText', [text]]);
          return { width: MEASURE_WIDTH_PER_CHARACTER * String(text).length };
        };
      }
      return (...args) => {
        canvas.operations.push(['call', property, args]);
      };
    },
  });
}

export function createRecordingCanvas() {
  let context2d = null;
  const canvas = {
    width: 300,
    height: 150,
    style: {},
    operations: [],
    getContext(type) {
      if (type !== '2d') return null;
      context2d ??= recordingContext(canvas);
      return context2d;
    },
    addEventListener() {},
    removeEventListener() {},
  };
  return canvas;
}

function createElementFor(tag) {
  if (String(tag).toLowerCase() !== 'canvas') throw new Error(`minimal DOM shim: unsupported element ${tag}`);
  const canvas = createRecordingCanvas();
  shimRegistry.canvases.push(canvas);
  return canvas;
}

export function installMinimalDomShim() {
  if (shimRegistry) return shimRegistry;
  shimRegistry = { canvases: [] };
  // A real (or test-provided) document wins; the registry then simply stays empty.
  if (globalThis.document) return shimRegistry;
  globalThis.document = {
    createElement: tag => createElementFor(tag),
    createElementNS: (namespace, tag) => createElementFor(tag),
  };
  return shimRegistry;
}
