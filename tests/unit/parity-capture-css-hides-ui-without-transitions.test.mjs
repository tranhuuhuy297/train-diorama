// Capture-time CSS: hidden UI must be hidden on the next style pass, not after a visibility transition.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureCssText } from '../../tools/parity/dom-shot-page-helpers.mjs';

const UI = ['#hud-top', '#hud-controls', '#shortcut-toast', '#debug-menu', '#loading'];
const rule = selector => `${selector}, ${selector} * { visibility: hidden !important; transition: none !important; }`;

test('3D shots hide every UI root and all descendants with transitions disabled', () => {
  assert.equal(captureCssText({ hideUi: true }), UI.map(rule).join('\n'));
});

test('DOM shots hide the canvas and, unless kept, the toast', () => {
  assert.equal(captureCssText({ hideCanvas: true, hideToast: true }), ['#scene', '#shortcut-toast'].map(rule).join('\n'));
  assert.equal(captureCssText({ hideCanvas: true }), rule('#scene'));
});

test('selectors are deduplicated and no options emit no rules', () => {
  const css = captureCssText({ hideUi: true, hideToast: true });
  assert.equal(css.split('\n').filter(line => line.startsWith('#shortcut-toast,')).length, 1);
  assert.equal(captureCssText(), '');
});
