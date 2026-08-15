# Command Deck

A single-file, offline-first PWA for personal work triage: capture things as they come in, sort them
onto a board, log signals (things learned from calls/tickets/data), and check a weekly pulse. No backend
— everything lives in the browser's IndexedDB. No build step, no framework: `index.html` is the entire
app (inline CSS + JS), by design, so it stays editable by hand.

This file is standing context for any session working in this repo. It captures decisions that must be
honored across sessions, not a one-time task list.

## Decisions already made — do not re-litigate these

1. **Storage is IndexedDB, full stop.** There is no backend and no `window.storage` (that API only
   exists inside Claude-generated artifacts — it silently no-ops on any real host, which is exactly the
   bug this repo was bootstrapped to fix). A small vanilla wrapper (`openDB`/`idbGet`/`idbSet`) lives
   inline in `index.html`. Don't add `localStorage` as a "simpler" alternative — it's synchronous and
   caps out well below what IndexedDB allows, and mixing two storage backends is worse than either alone.
2. **Visual identity — "Ops Room."** There is no design mockup for this app (unlike `arthquest-pwa`,
   which pixel-matches an uploaded design). The look is a deliberate, from-scratch identity: capture is a
   written strip, the board is a strip rack sorted into status lanes, signal is incoming chatter worth
   logging, pulse is the room's live readout — flat ink surfaces, one restrained signature accent, a
   desaturated lane-status palette, no glow/gradient-mesh/glassmorphism. Design tokens live in
   `index.html`'s `:root` block (`--ink`, `--panel`, `--accent`, `--lane-*`, plus a defined
   spacing/type scale) — read them before adding any new color or spacing value by hand.
3. **Icon and in-app theme are one system, not two.** The app icon is a minimal "scope" mark (ring +
   off-center blip + short sweep arc). The same glyph family is reused for the manifest shortcut icons
   and echoed subtly inside the UI (e.g. a sweep-arc accent on pulse stat cards, a blip mark for empty
   states). Don't design new UI accents that don't trace back to this motif.
4. **Deploy: GitHub Pages**, not Netlify — no Netlify credentials exist for this project.
   `.github/workflows/deploy.yml` deploys on push to `main`, no build step (`upload-pages-artifact` +
   `deploy-pages` directly against the repo root). Served at `https://axarl007.github.io/command-deck/`
   — see the subpath gotcha below.
5. **Deep-link routing**: `location.hash` (`#capture`/`#board`/`#signal`/`#pulse`) drives the view on
   load and on `hashchange`; `switchView()` syncs the hash back via `history.replaceState`, not a plain
   `location.hash =` assignment, so tapping between nav tabs doesn't spam browser history. This is also
   how the manifest's `shortcuts` entries jump straight to a screen.
6. **Native wrapper (`/native`) mirrors the `arthquest` Android repo's own release pattern exactly** —
   that repo has no CI signing automation at all: `local.properties` (gitignored) holds the real
   keystore, and each release is a single human-built, human-uploaded `app-release.apk` GitHub Release
   asset with `adb install -r app-release.apk` instructions. Do the same here. Don't try to automate
   signing in CI without being asked — there's a real, deliberate reason the source project doesn't.
7. **No real Android home-screen widget yet.** `/native` is a Bubblewrap TWA scaffold only — it wraps the
   PWA as an installable APK. `AppWidgetProvider`, widget layout XML, and update logic are unbuilt,
   tracked as separate future work, not stubbed here.
8. **Never push to `main` directly.** All work lands on a feature branch, then a PR is opened for review.

## Process

1. Keep `index.html` a single file — inline CSS/JS, no bundler, no framework. Any new script belongs in
   `scripts/` as a dev-time helper (icon generation, Lighthouse checks), never as an app runtime
   dependency.
2. Before committing any visual/manifest/service-worker change, take Playwright screenshots at
   mobile (~390px), tablet (~768px), and desktop (~1200px) widths and actually look at them — there's no
   mockup to diff against, so this is the only check against drift.
3. Before shipping manifest/service-worker changes, run `node scripts/check-pwa.mjs <url>` — modern
   Lighthouse (v10+) dropped the scored "PWA" category, so this calls Chrome's own
   `Page.getInstallabilityErrors` CDP check directly (the same check Chrome itself uses to decide
   whether to offer install) plus a real offline-reload check. Run `npx lighthouse` for
   accessibility/best-practices/performance — those categories are still scored normally.
4. Run the `code-review` skill on the staged diff before every commit. Fix every finding; re-verify after
   fixing rather than trusting the fix looks right.
5. Commit, push the feature branch, open a PR against `main`, subscribe to its activity.

## Repo structure

```
index.html    # the entire app — inline CSS/JS, IndexedDB storage, hash routing
manifest.json # PWA manifest, incl. shortcuts (Capture/Board/Signal)
sw.js         # app-shell cache-first service worker; offline fallback is the cached index.html itself
icon-*.png    # generated app + maskable + shortcut icons (scope/blip motif)
scripts/      # dev-time only: icon generation (Playwright SVG rasterization), Lighthouse helper
native/       # Bubblewrap TWA scaffold — see native/README.md for the build/sign/release flow
.github/workflows/deploy.yml  # GitHub Pages deploy on push to main
```

## Gotchas

- **GitHub Pages serves from a subpath** (`/command-deck/`). Every path in `manifest.json`, `sw.js`, and
  any icon/shortcut URL must be relative (`./...`), never root-absolute (`/...`) — an absolute path 404s
  once deployed even though it works fine opened straight from disk. Same class of bug as
  `arthquest-pwa`'s Vite `base` gotcha.
- Chromium for local Lighthouse/Playwright runs: `/opt/pw-browsers/...` (path specific to the sandboxed
  dev environment) — don't run `playwright install`, it's already there.
- In the sandboxed dev environment, Chromium launched by Playwright can't reach Google Fonts (no proxy
  configured for its egress) — `scripts/qa-screenshot.mjs` already ignores failures against
  `fonts.googleapis.com`/`fonts.gstatic.com` as a known local-only limitation, not a real app bug. Real
  deployments have normal internet access.
- `scripts/check-pwa.mjs` must use `chromium.launchPersistentContext()`, not `browser.newContext()` —
  an ephemeral context reads as Incognito to Chrome's installability check and always fails with
  `in-incognito`, which isn't a real defect.
- This environment's network policy blocks the Android SDK entirely (`dl.google.com` /
  `android.clients.google.com` both 403 at the proxy) — `bubblewrap init`'s normal wizard can't run
  here. `native/` was generated by calling `@bubblewrap/core`'s `TwaManifest`/`TwaGenerator` library
  directly instead (see `native/README.md`) — that part doesn't need the SDK, only a real `gradlew
  build` does. Don't re-attempt an SDK download in this environment; it's a policy block, not a
  transient failure.
- IndexedDB is the only persistence layer. If a browser genuinely has no IndexedDB (very old browsers,
  some restrictive private-mode configurations), the app degrades to in-memory-only for that session —
  that's an accepted tradeoff, not a bug to route around with a `localStorage` fallback.
