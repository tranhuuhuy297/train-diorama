# 13. HUD and UI patterns

[Index](../diorama-techniques.md)

## 13.1 Settings schema, validation and persistence

`src/ui/settings-schema-defaults.js` and `settings-local-storage-persistence.js`:

- Enums are ordered tuples (MODES, TIMES_OF_DAY, PIXEL_MODES), so the UI, shortcuts and validation share one source.
- `DEFAULT_STATE` (frozen): mode overview, speed 1, pixelResolution native, lastPixelResolution pixel360, outline true, timeOfDay day, paused false, spin true, timeScale 1, hudVisible true.
- Each key has one validator, built from tiny combinators (`bool`, `numberBetween(min, max)`, `oneOf(list)`, `pixelModeKey`). Speed is 0–2.5 and time scale 0–2.
- Loading is all-or-nothing:
  1. parse the JSON;
  2. migrate old values (`golden` → `evening`);
  3. validate every key.
  Any failure discards the whole object, uses the defaults and logs a warning.
- The saver writes after every action. After the first storage error (private mode, quota) it disables itself.
- The storage key is `train-scene-settings-v2`. Bump the suffix when the shape changes.

## 13.2 Actions pipeline

In `src/ui/hud-state-actions.js`, every control goes through one action, which runs these steps in order:

1. update the state;
2. tell the diorama, if it exists yet;
3. re-render the affected buttons;
4. log a `[TAG]` line;
5. save.

Toasts are mostly raised by the caller (the shortcut handler or the DOM binding) after the action; the actions themselves toast only for Free mode and HUD visibility. The HUD works before the engine has loaded; actions simply skip the diorama.

## 13.3 Keyboard shortcuts

`src/ui/keyboard-shortcuts.js` splits the work in two. A pure resolver, `resolveKeyAction(event, {mode, flightLocked})`, returns an action object, and the binder executes it. Flight keys take priority while the pointer is locked in Free mode. Otherwise the resolver ignores repeats, modifier keys and editable targets.

| Key | Action |
|---|---|
| 1–4 | camera modes |
| B | bridge camera + toast |
| T / Shift+T | next / previous time of day |
| P | pixel art on/off (remembers the last resolution) |
| O | ink lines |
| X | time scale 0× / 1× (also stops the turntable) |
| Space | pause (not while flying) |
| H | hide/show the HUD |
| L | log the camera pose (useful when authoring shots) |

## 13.4 Toast

`src/ui/shortcut-toast.js` uses one `role=status` element. Each message replaces its text, toggles a class and restarts a single timer (2.8 s).

## 13.5 Loading step runner

`src/ui/loading-screen-step-runner.js` and `src/main-entry.js` run weighted steps:

| Step | Weight | Work |
|---|---|---|
| LOADING ENGINE | 30 | dynamic import of the engine |
| BUILDING VALLEY AND TRAIN | 60 | the Diorama constructor |
| PREPARING FIRST FRAME | 10 | one paint |

Before each step the runner sets the label and awaits two `requestAnimationFrame`s, so the label paints before the main thread blocks. Hints rotate every 2.6 s. At the end the screen shows READY, waits 260 ms, adds the fade class, waits 420 ms and hides. Errors show "LOADING FAILED: …".

## 13.6 Night theme

`renderTimeOfDay` sets `document.body.dataset.timeOfDay`. `styles/night-theme-overrides.css` is loaded last and scoped entirely to `body[data-time-of-day=night]`: a navy panel (#192943eb), accent #ef704c and light text. Evening keeps the day styling.

## 13.7 Debug menu

`src/ui/debug-menu-panel.js` is a `<details>` panel with layer toggles (Trees, Clouds) and a performance readout. The readout refreshes every 500 ms, only while the panel is open, and shows:

- FPS and frame ms (EMA);
- CPU submit ms;
- draw calls, triangles, geometries and textures.

`renderer.info.autoReset = false` plus a manual `info.reset()` at the start of each frame makes the counts cover every pass (shadow + main + post).

## 13.8 Styling

- Font: Fredoka from Google Fonts.
- Panel: warm cream glass (#fbf4e2 at 85 %) with backdrop blur, accent #ca4e36, dark-brown text #3f2a1f.
- Markup: utility class names in a Tailwind-like style, written by hand in `styles/base-reset-and-utilities.css`, with no build step.

## Files

`src/ui/*`, `src/main-entry.js`, `styles/*`, and `index.html`.

## Cost

The HUD is plain DOM outside the canvas: no per-frame work except the debug readout (every 500 ms, only while open). The backdrop blur costs some compositor time on low-end GPUs.

## Pitfalls

- Persisting `paused` and `hudVisible` can bring a user back to a paused or hidden scene. Persist preferences only, not transient state.
- A focused slider swallows shortcuts. Blur it on Esc.
- Right-click on a toggle resets it but toasts a stale label (a kept quirk).
