# Deployment guide

**Current state: not published.** The repository is private and no copy of the site is deployed
anywhere. The GitHub Pages site that existed briefly (2026-10-02 → 2026-10-04) has been removed
together with its workflow. The project is meant to run locally; this guide covers local use and,
if a deploy is ever wanted, how to put it on any static host.

## 1. Local use

```bash
npm run dev            # http://127.0.0.1:4317
```

- No install and no build are needed to view the scene: `index.html` loads `three@0.186.0` from
  unpkg through the import map and the Fredoka font from Google Fonts.
- `tools/static-dev-server.mjs` serves the repository root with correct MIME types, answers only
  GET/HEAD, returns 404 for any path segment that starts with a dot or is the modules folder, and
  accepts `--root <dir>` and `--port <n>` (defaults: repository root, `PORT` or 4317; host from `HOST`,
  default `127.0.0.1`).
- Any other static server works too (`python3 -m http.server`, `npx serve`), as long as `.js` is
  served as JavaScript. Opening `index.html` from `file://` does not work: ES modules need HTTP.
- Tests and the parity tools need `npm install` (Node ≥ 22) and a Chromium: `npx playwright install
  chromium`, or set `CHROMIUM_PATH` to an existing binary (see `README.md`).

## 2. What a deploy would contain

The site is static. Only four paths are needed at runtime:

| Path | Content |
|---|---|
| `index.html` | page shell, import map, font links, analytics stub |
| `src/` | all runtime modules |
| `styles/` | the five CSS files |
| `assets/` | logo (`train-diorama-logo.svg`) and favicon (`clock-favicon.svg`) |

Everything else must stay out of a deploy: `tests/`, `tools/`, `docs/`, `CLAUDE.md`, `README.md`,
`package.json`, `package-lock.json`, `node_modules/`, `.claude/`, `.parity-output/` and especially
`.parity-cache/`, which holds the reference author's source, fetched only as a local test oracle
(gitignored, never committed, never deployed).

## 3. Deploying to any static host

1. Copy the four runtime paths into an empty folder:

   ```bash
   rm -rf /tmp/train-diorama-site && mkdir -p /tmp/train-diorama-site
   cp -r index.html src styles assets /tmp/train-diorama-site/
   ```

2. Upload that folder to the host (Netlify drop, Cloudflare Pages, GitHub Pages on a public repo or
   a paid plan, S3 + CloudFront, any nginx). No build command, no install command, output directory =
   the folder root. All runtime URLs are relative (`./src/…`, `./styles/…`, `./assets/…`), so the site
   also works under a sub-path such as `/train-diorama/`.
3. Serve `.js` as `text/javascript` and `.svg` as `image/svg+xml` (most hosts do by default).
4. Smoke-check the result:

   ```bash
   npm run parity:smoke -- --url <deployed-url>
   ```

   It loads the page in Chromium and fails on: console or page errors; warnings other than the
   SwiftShader ReadPixels ones; failed or ≥ 400 requests; a loader that is not hidden within 180 s; a
   missing `[GAMEPLAY] Started` log or `H · Hide HUD` toast; a synthetic pagehide that does not
   dispose the canvas cleanly. Analytics: on `*.vercel.app` the `window.va` stub must exist and
   `/_vercel/insights/script.js` must return 200; on every other host no insights request may be
   made. On any non-local host, every development-only path must return 404:
   `.parity-cache/original/Diorama.js`, a unit test, `tools/static-dev-server.mjs`,
   `docs/code-standards.md`, `node_modules/three/package.json`, `.github/workflows/deploy-pages.yml`
   and `README.md`. The report goes to `.parity-output/smoke/<host>.json`.

## 4. Vercel (optional)

The repo keeps a ready Vercel configuration in `vercel.json`:

```json
{ "framework": null, "installCommand": "", "buildCommand": "", "outputDirectory": "." }
```

No framework preset, no install, no build; the output directory is the repository root, and
`.vercelignore` drops `tests/`, `tools/`, `docs/`, `.parity-cache/`, `.parity-output/`,
`node_modules/`, `package.json`, `package-lock.json`, `.claude/`, `.github/`, `.gitignore` and
`README.md` (`vercel.json` itself must stay). **Before a Vercel deploy, add `CLAUDE.md` to
`.vercelignore`**: it was added to the repository root in the 2026-10-04 documentation pass, after
the ignore file was written. (`docs/` is already excluded as a whole.)

```bash
npx vercel login                      # interactive; no token is written to the repo
npx vercel link                       # once: scope + project name
npx vercel deploy                     # preview URL
npm run parity:smoke -- --url <preview-url>
npx vercel deploy --prod              # production
npx vercel rollback                   # back to the previous production deploy
```

- **Web Analytics.** `index.html` defines the `window.va` queue stub everywhere but injects
  `/_vercel/insights/script.js` only when `location.hostname` ends with `.vercel.app`. Enable Analytics
  in the Vercel project first, or the script 404s and logs a console error. On localhost and every
  other host no analytics request is made (the smoke check asserts both cases). A custom domain on
  Vercel would need the hostname check extended.
- **Deployment Protection.** For protected previews, the smoke and parity tools send
  `x-vercel-protection-bypass` with `VERCEL_AUTOMATION_BYPASS_SECRET` from the environment, only to
  the site's own origin (never to the CDNs); reports never record request headers.
- **Parity against a deploy.** `CLONE_URL=<url> npm run parity:capture -- --shots
  ov-day-t0,ov-night-t0,dom-hud-day --target both`, then `npm run parity:compare -- --shots
  ov-day-t0,ov-night-t0,dom-hud-day`. (`parity:signoff` chains capture → compare → probe for the
  whole sign-off set; extra arguments to it would reach only its last command.)

## 5. Troubleshooting

| Symptom | Cause and fix |
|---|---|
| Loader shows `LOADING FAILED: …` | the engine import failed (unpkg blocked or down: there is no bundled three.js fallback by design) or the build threw (e.g. no WebGL context). Retry, allow `unpkg.com`, or check WebGL. |
| Text in a system font, station sign in sans-serif | Google Fonts blocked; the page still runs. |
| Black canvas or WebGL error | no WebGL (disabled GPU, old browser); enable hardware acceleration. |
| Blank page in an old browser | import maps need Chrome 89+, Safari 16.4+ or Firefox 108+. |
| Blank page from `file://` | ES modules need HTTP; use `npm run dev`. |
| Console error for `/_vercel/insights/script.js` | Analytics not enabled on the Vercel project. |
| 401 from the smoke check | Vercel Deployment Protection on; export `VERCEL_AUTOMATION_BYPASS_SECRET`. |
| `?parity` in a shared link | harmless: it only exposes the scene to the tab's own console (`?parity=freeze` also pauses that tab). |

## 6. Licensing note

The code is an independent implementation written from behavioural specs, with no text, markup,
shaders or artwork from the reference, verified by the independence audit recorded in
`parity-testing-guide.md`. The logo and favicon are this project's own designs. The project is not
affiliated with the original author; any public deploy should keep the README's References and
non-affiliation note visible somewhere (e.g. an about link).
