# Deployment guide

The site is static: `index.html`, `src/`, `styles/` and `assets/` served as they are, with three.js
and the Fredoka font loaded from public CDNs at runtime. Nothing is installed or built for a deploy.
Two hosts are prepared: GitHub Pages (live, pushed by CI) and Vercel (configured, deploy on approval).

## 1. Prerequisites

- Node ≥ 22 for the smoke check and the parity tools (`npm install` once; with
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` if a Chromium already exists, then point `CHROMIUM_PATH` at it).
- Vercel: an account and the CLI through `npx vercel@latest` (no global install). Log in
  interactively with `npx vercel login`; no token is ever written to disk or committed.
- GitHub Pages: a public repository with Pages set to "GitHub Actions".

## 2. `vercel.json`

```json
{ "framework": null, "installCommand": "", "buildCommand": "", "outputDirectory": "." }
```

No framework preset, no install, no build; the output directory is the repository root. If a deploy
log ever shows an install or build step, the overrides were lost: check the project settings.

## 3. `.vercelignore` and what must never ship

`.vercelignore` drops `tests/`, `tools/`, `docs/`, `.parity-cache/`, `.parity-output/`, the modules
folder, `package.json`, `package-lock.json`, `.claude/`, `.github/` (the Pages workflow), `.gitignore`
and `README.md`; `vercel.json` must stay (it is the deploy config). `.parity-cache/` holds the reference
author's original source, fetched only as a local black-box test oracle: it is gitignored, never
committed and never deployed. The GitHub Pages workflow copies only `index.html src styles assets`
into its artifact, so the same paths are absent there. The smoke check asserts 404 for
`/.parity-cache/original/Diorama.js`, `/tests/unit/keyboard-shortcut-resolution.test.mjs`,
`/tools/static-dev-server.mjs`, `/docs/code-standards.md`, `/node_modules/three/package.json`,
`/.github/workflows/deploy-pages.yml` and `/README.md` on every deployed host.

## 4. Web Analytics

`index.html` defines the Vercel Web Analytics queue stub (`window.va`) everywhere, but injects
`/_vercel/insights/script.js` only on `*.vercel.app` hosts, where the endpoint exists. Before the first
Vercel deploy, enable Analytics in Project → Analytics; otherwise the script 404s and the page logs a
console error. On localhost and GitHub Pages no insights request is made (the smoke check asserts it).
A custom Vercel domain would need the gate extended to that hostname.

## 5. Deployment Protection

For protected previews, the smoke and parity tools send `x-vercel-protection-bypass` with the value
of `VERCEL_AUTOMATION_BYPASS_SECRET`, read from the environment only and sent only to the site's own
origin (never to the CDNs). Smoke reports never record request headers.

## 6. Preview deploy and checks

```bash
npx vercel link                       # once, interactive: scope + project name
npx vercel deploy                     # preview URL printed at the end
npm run parity:smoke -- --url <preview-url>
CLONE_URL=<preview-url> npm run parity:capture -- --shots ov-day-t0,ov-night-t0,dom-hud-day --target both
npm run parity:compare -- --shots ov-day-t0,ov-night-t0,dom-hud-day
```

`parity:signoff` chains capture → compare → probe for the whole sign-off set; for a subset run the
capture and compare steps directly as above (extra arguments to `parity:signoff` would reach only
its last command).

## 7. Production

```bash
npx vercel deploy --prod
npm run parity:smoke -- --url <production-url>
```

GitHub Pages: every push to `main` runs `.github/workflows/deploy-pages.yml` (unit tests, then the
static artifact). Smoke it the same way:
`npm run parity:smoke -- --url https://tranhuuhuy297.github.io/train-diorama/`.

## 8. Rollback

`npx vercel rollback` returns production to the previous deployment; `npx vercel promote <url>`
promotes any earlier deployment. On GitHub Pages, re-run the workflow of an earlier commit or revert
the commit on `main`.

## 9. Troubleshooting

| symptom | cause and fix |
|---|---|
| loader shows `LOADING FAILED: …` | unpkg blocked or down (three.js); the page has no bundled fallback by design. Retry or allow `unpkg.com`. |
| text in a system font, station sign in sans-serif | Google Fonts blocked; the page still runs. |
| black canvas or WebGL error | no WebGL (disabled GPU, old browser); enable hardware acceleration. |
| blank page in an old browser | import maps need Chrome 89+, Safari 16.4+ or Firefox 108+. |
| console error for `/_vercel/insights/script.js` | Analytics not enabled on the Vercel project (section 4). |
| 401 from the smoke check | Deployment Protection on; export `VERCEL_AUTOMATION_BYPASS_SECRET`. |
| `?parity` in a shared link | harmless: it only exposes the scene to the tab's own console (`?parity=freeze` pauses that tab). |

## 10. Licensing and the approval gate

The code is an independent implementation (D0): written from behavioural specs, with no text,
markup, shaders or artwork from the reference site, and verified by the independence audit (overlap
checker, citation grep, SVG hash check) recorded in `parity-testing-guide.md`. The logo and favicon
are this project's own designs (D7). Deploying is an explicit user decision: whether to deploy,
public or behind Deployment Protection, and which Vercel scope, project name and domain. Until that
approval, only the configuration and this guide are prepared; the GitHub Pages site follows `main`.
