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
2. **A real signing key**, generated the same way regardless of which build path below you use:
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
4. **Build — pick one:**

   **A. Locally**, same pattern as the `arthquest` Android repo (checked directly — that repo has no CI
   signing automation, it's pure local `local.properties`): add these four lines to `native/local.properties`
   (gitignored, same file as the SDK path above):
   ```
   RELEASE_STORE_FILE=android.keystore
   RELEASE_STORE_PASSWORD=<your keystore password>
   RELEASE_KEY_ALIAS=android
   RELEASE_KEY_PASSWORD=<your key password>
   ```
   then `./gradlew assembleRelease` from this directory produces a signed APK at
   `app/build/outputs/apk/release/app-release.apk`. Leave those four lines out and the same command
   still succeeds — it just produces an unsigned APK nothing can install as an update, the same
   graceful-degradation behavior as `arthquest`'s own `build.gradle.kts`.

   **B. In CI** (`.github/workflows/build-signed-apk.yml`, triggered manually from the Actions tab) — a
   deliberate divergence from `arthquest`'s local-only approach for this repo, since a GitHub-hosted
   runner has normal internet access and isn't subject to this dev environment's network policy that
   blocks the Android SDK. One-time setup, in **Settings → Secrets and variables → Actions**:
   - `ANDROID_KEYSTORE_BASE64` — `base64 -w0 android.keystore` (macOS: `base64 -i android.keystore`),
     paste the output
   - `ANDROID_KEYSTORE_PASSWORD` — your keystore password
   - `ANDROID_KEY_PASSWORD` — your key password (alias is hardcoded to `android` in the workflow)

   Then run the workflow (Actions tab → "Build signed APK" → Run workflow), give it a version name —
   it bumps `versionCode`/`versionName` in `build.gradle`, builds, and (if left checked) attaches the
   signed APK straight to a new GitHub Release. Not run here either — I can write and syntax-check the
   workflow, but I have no way to actually execute a GitHub Actions run or verify secrets from this
   session.
5. **Install on a device/emulator.** No device or emulator is attached to this environment — this is
   genuinely a "run it yourself" step regardless of which build path you used.

Either path produces the same thing the `arthquest` repo already does with its releases: a signed
`app-release.apk` attached to a GitHub Release with `adb install -r app-release.apk` instructions,
updating in place on future releases.

## Not done yet (separate follow-up, not this ticket)

A real Android home-screen **widget** is a different, unbuilt thing from this TWA shell:
`AppWidgetProvider` class, a widget layout XML, and update logic (periodic `RemoteViews` refresh from
the PWA's IndexedDB data — which a plain TWA has no access to; a widget would need its own small data
bridge). This scaffold only gets you an installable app icon that opens the PWA — nothing here reads
Command Deck's actual capture/board/signal/pulse data outside the WebView.
