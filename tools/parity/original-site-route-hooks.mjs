// Exposes the live original to the harness: its entry module is intercepted in the test browser only and
// our own hook block is inserted right after its single overview-intro preparation call.

export const ORIGINAL_SITE_URL = process.env.TARGET_URL ?? 'https://train-diorama.vercel.app/';

// Search key only: the call statement the hook must follow (same synchronous task as the clone hook).
export const ORIGINAL_HOOK_ANCHOR = 'diorama.prepareOverviewIntro();';

// One self-contained block statement (no module-scope names); same parameter table, effect order,
// build info and log lines as installParityTestHook.
export const ORIGINAL_HOOK_SNIPPET = `
{
  const parityQuery = new URLSearchParams(location.search);
  if (parityQuery.has('parity')) {
    const parityMode = parityQuery.get('parity') === 'freeze' ? 'freeze' : 'live';
    const parityFontSet = document.fonts;
    const parityFontsReady = parityFontSet ? parityFontSet.check('bold 106px Fredoka') && parityFontSet.check('24px Fredoka') : null;
    window.__parityBuildInfo = { fredokaReadyAtBuild: parityFontsReady };
    window.__diorama = diorama;
    if (parityMode === 'freeze') diorama.paused = true;
    console.log('[PARITY] Hook installed: ' + parityMode);
  }
}
`;

export function patchTrainSceneSource(source) {
  const occurrences = source.split(ORIGINAL_HOOK_ANCHOR).length - 1;
  if (occurrences !== 1) {
    throw new Error(`Original TrainScene.js: expected exactly one "${ORIGINAL_HOOK_ANCHOR}", found ${occurrences}`);
  }
  // Replacer function: "$" sequences in the source are never treated as replacement patterns.
  return source.replace(ORIGINAL_HOOK_ANCHOR, () => ORIGINAL_HOOK_ANCHOR + ORIGINAL_HOOK_SNIPPET);
}

const DROPPED_HEADERS = new Set(['content-length', 'content-encoding']);

export async function installOriginalRouteHooks(context) {
  let rejectFailed;
  // Settles only on a route error; pre-handled so an unobserved failure is never an unhandled rejection.
  const failed = new Promise((resolve, reject) => { rejectFailed = reject; });
  failed.catch(() => {});
  const state = { patched: false, error: null, failed };
  await context.route('**/TrainScene.js', async route => {
    try {
      const response = await route.fetch();
      const body = patchTrainSceneSource(await response.text());
      const headers = Object.fromEntries(Object.entries(response.headers()).filter(([name]) => !DROPPED_HEADERS.has(name.toLowerCase())));
      headers['content-type'] = 'text/javascript';
      await route.fulfill({ status: response.status(), headers, body });
      state.patched = true;
    } catch (error) {
      state.error = error;
      rejectFailed(error);
      await route.abort('failed').catch(() => {});
    }
  });
  return state;
}

export function assertOriginalHookPatched(state) {
  if (state.error) throw state.error;
  if (!state.patched) throw new Error('Original TrainScene.js was never patched');
}

// An aborted entry module means the page never gets ready, so the route error wins over the readiness timeout.
export async function awaitReadinessOrHookError(readiness, state) {
  if (!state) return readiness;
  try {
    await Promise.race([readiness, state.failed]);
  } catch (error) {
    assertOriginalHookPatched(state);
    throw error;
  }
  assertOriginalHookPatched(state);
}
