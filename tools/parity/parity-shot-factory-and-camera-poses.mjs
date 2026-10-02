// Shot record factory (defaults, freshness, threshold class) and the camera poses shared by the
// shot list. Poses are world-space unless `relativeTo` names a frame the page resolves.

// Overview home pose and orbit target; the zoomed pose is 12 wheel notches (0.95^1.2 each) toward the target.
export const HOME = [-55.522, 62.771, 130.519];
export const TARGET = [0, 4, 0];
const ZOOM = 0.95 ** 14.4;
export const ZOOMED = { position: HOME.map((value, axis) => TARGET[axis] + (value - TARGET[axis]) * ZOOM), target: TARGET };
export const LOCO_CHASE = { relativeTo: 'loco', offset: [9, 4.5, 7], lookAt: [0, 1.6, -6] };
export const BRIDGE_VIEW = { position: [-3, 5.5, 60], target: [0, 8.5, 36], fov: 42 };
// Sky-direction poses look from the orbit target along a fixed direction (clone vs original only, no reference).
export const lookFromTarget = direction => ({ position: TARGET, target: TARGET.map((value, axis) => value + 10 * direction[axis]) });
export const locoView = (position, target) => ({ relativeTo: 'loco', position, target });

const DEFAULTS = Object.freeze({
  viewport: 'desktop', mode: 'overview', timeOfDay: 'day', pixelShortSide: null, outline: true, seconds: 0,
  hide: [], camera: null, actions: [], selectors: null, pad: 16, mask: [], keepToast: false, reportOnly: false, parkTrain: false,
  regions: [],
});

/** Frozen shot record; stepped or scripted shots get their own page load unless `fresh` says otherwise. */
export function shot(id, stage, kind, reference, settings = {}) {
  const merged = { ...DEFAULTS, ...settings };
  const fresh = settings.fresh ?? (merged.seconds > 0 || merged.actions.length > 0);
  const thresholdClass = settings.thresholdClass ?? (kind === 'dom' ? 'dom' : 'deterministic');
  return Object.freeze({ id, stage, kind, ...merged, fresh, thresholdClass, reference });
}
