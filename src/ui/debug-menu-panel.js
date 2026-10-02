// Body-level "···" panel: Trees/Clouds layer switches plus a perf readout refreshed only while open.
import { element } from './hud-button-renderers.js';

export const PERFORMANCE_REFRESH_MILLISECONDS = 500;

const READOUT_LABEL_WIDTH = 13;
const READOUT_FOOTER = 'All render passes · CPU excludes GPU time';

// Layer objects are resolved at toggle time so a world-less Diorama toggles nothing instead of throwing.
const LAYER_SWITCHES = [
  { label: 'Trees', targets: world => world?.treeLayers ?? [] },
  { label: 'Clouds', targets: world => (world?.clouds ?? []).map(cloud => cloud.group) },
];

export function formatPerformanceText(performanceStats, rendererInfo) {
  const { frameMilliseconds, cpuMilliseconds } = performanceStats;
  const { render, memory } = rendererInfo;
  const readings = [
    ['FPS', (1000 / frameMilliseconds).toFixed(1)],
    ['Frame', `${frameMilliseconds.toFixed(1)} ms`],
    ['CPU submit', `${cpuMilliseconds.toFixed(1)} ms`],
    ['Draw calls', String(render.calls)],
    // No-argument toLocaleString keeps the viewer's own digit grouping.
    ['Triangles', render.triangles.toLocaleString()],
    ['Geometries', String(memory.geometries)],
    ['Textures', String(memory.textures)],
  ];
  const lines = readings.map(([label, value]) => label.padEnd(READOUT_LABEL_WIDTH, ' ') + value);
  lines.push(READOUT_FOOTER);
  return lines.join('\n');
}

function makeNode(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

function buildPanel() {
  const summary = makeNode('summary', { textContent: '···' });
  summary.setAttribute('title', 'Debug menu');
  summary.setAttribute('aria-label', 'Debug menu');
  const content = makeNode('div', { className: 'debug-content' }, [
    makeNode('strong', { textContent: 'Scene debug' }),
    makeNode('div', { id: 'debug-layers' }),
    makeNode('pre', { id: 'debug-performance' }),
  ]);
  return makeNode('details', { id: 'debug-menu' }, [summary, content]);
}

function layerRow(diorama, { label, targets }) {
  // checked is set as a property only, so the markup carries just the type attribute.
  const toggle = makeNode('input', { type: 'checkbox' });
  toggle.checked = true;
  toggle.addEventListener('change', () => {
    const shown = toggle.checked;
    for (const object of targets(diorama.world)) object.visible = shown;
    console.log(`[DEBUG] ${label}: ${shown ? 'shown' : 'hidden'}`);
  });
  return makeNode('label', {}, [toggle, document.createTextNode(label)]);
}

export function mountDebugMenu(diorama) {
  const panel = buildPanel();
  document.body.append(panel);
  const layerList = element('debug-layers');
  const readout = element('debug-performance');
  for (const layer of LAYER_SWITCHES) layerList.append(layerRow(diorama, layer));

  const refreshReadout = () => {
    if (!panel.open) return;
    readout.textContent = formatPerformanceText(diorama.performanceStats, diorama.renderer.info);
  };
  panel.addEventListener('toggle', refreshReadout);
  const refreshTimer = setInterval(refreshReadout, PERFORMANCE_REFRESH_MILLISECONDS);
  window.addEventListener('pagehide', () => clearInterval(refreshTimer), { once: true });
  return panel;
}
