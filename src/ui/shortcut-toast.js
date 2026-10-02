// Single-element toast; each new message restarts the auto-hide timer.
import { element } from './hud-button-renderers.js';

export const TOAST_DURATION_MILLISECONDS = 2800;

let pendingHide = null;

function scheduleHide(toastNode) {
  if (pendingHide !== null) clearTimeout(pendingHide);
  pendingHide = setTimeout(() => toastNode.classList.remove('is-visible'), TOAST_DURATION_MILLISECONDS);
}

export function showToast(message) {
  const toastNode = element('shortcut-toast');
  toastNode.textContent = message;
  toastNode.classList.add('is-visible');
  scheduleHide(toastNode);
}
