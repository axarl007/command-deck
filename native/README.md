# Command Deck — Android TWA wrapper

A [Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity/) shell that
wraps the deployed PWA (`https://axarl007.github.io/command-deck/`) as an installable Android app —
the prerequisite for a real home-screen widget later (see "Not done yet" below).

## How this was generated

Not via `bubblewrap init`'s interactive wizard — it requires downloading the Android SDK from Google's
servers, which this dev environment's network policy blocks outright (confirmed: `CONNECT` to
`dl.google.com`/`android.clients.google.com` is rejected by the egress proxy with a policy 403, not a
missing-config issue). A JDK *was* available here, so rather than stop at paperwork, the project was
generated for real using `@bubblewrap/core`'s library API directly (`TwaManifest` +
`TwaGenerator.createTwaProject()` — the same code `bubblewrap init` calls internally after its wizard
collects answers), fetching this repo's actual `manifest.json` from a local dev server so the generator
could pull in the real name, colors, and icons. `host`/`startUrl` were set to the real production
values (`axarl007.github.io` / `/command-deck/index.html`) before generation so they're correctly baked
into `AndroidManifest.xml`'s intent filter; the few remaining dev-server URLs left in `build.gradle` and
`twa-manifest.json` afterward (shortcut URLs, `webManifestUrl`, `fullScopeUrl`) were patched to the real
domain by hand. Everything else — the Gradle project, `AndroidManifest.xml`, Java launcher/delegation
classes, and every icon (`ic_launcher`, `ic_maskable`, notification icon, splash screens, shortcut
icons at every density) — is real generated output, not stubbed.

## What's left before this builds or installs anywhere

1. **Android SDK.** Install Android Studio (or the standalone `cmdline-tools` + `sdkmanager`) locally —
   this repo/session cannot do it. Point `local.properties` (create it, gitignored) at your SDK:
   `sdk.dir=/path/to/Android/sdk`.
2. **A real signing key**, generated and kept exactly like the `arthquest` Android repo's own release
   process (checked directly — that repo has no CI signing automation either):
   ```
   keytool -genkey -v -keystore android.keystore -alias android \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   `android.keystore` is gitignored here — never commit it. `twa-manifest.json`'s `signingKey` already
   points at `./android.keystore` with alias `android`, matching `keytool`'s defaults above.
3. **Digital Asset Links.** For Chrome to open the TWA without browser chrome, `https://axarl007.github.io/.well-known/assetlinks.json`
   must publish your signing key's SHA-256 fingerprint. Once you have a real key:
   ```
   npx @bubblewrap/cli fingerprint  # or: keytool -list -v -keystore android.keystore
   ```
   then add that fingerprint to `arthquest-pwa`-style `.well-known/assetlinks.json` served from the
   `command-deck` GitHub Pages root (a new small file — not part of this PR, since it depends on a key
   that doesn't exist yet).
4. **Build.** `./gradlew assembleDebug` (or `assembleRelease` once signed) from this directory, once 1–3
   are done. Not run here — no Android SDK in this environment, so I cannot confirm it actually compiles,
   only that the generated project has the shape and content `bubblewrap init` normally produces.
5. **Install on a device/emulator.** No device or emulator is attached to this environment either — this
   is genuinely a "run it yourself" step.

Once you have a signed `app-release.apk`, the intended pattern is the same one `arthquest` already
uses: attach it directly to a GitHub Release on this repo (tag, e.g., `v1.0`) with
`adb install -r app-release.apk` instructions in the release notes, updating in place on future
releases — not automated in CI, by design (see the `arthquest` repo's own `local.properties`-gitignored
approach).

## Not done yet (separate follow-up, not this ticket)

A real Android home-screen **widget** is a different, unbuilt thing from this TWA shell:
`AppWidgetProvider` class, a widget layout XML, and update logic (periodic `RemoteViews` refresh from
the PWA's IndexedDB data — which a plain TWA has no access to; a widget would need its own small data
bridge). This scaffold only gets you an installable app icon that opens the PWA — nothing here reads
Command Deck's actual capture/board/signal/pulse data outside the WebView.
