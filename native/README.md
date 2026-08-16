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

**Don't run `bubblewrap update`** without re-applying the signing/versioning changes described below
first — it regenerates `app/build.gradle` wholesale from `twa-manifest.json` via the same
`TwaGenerator.createTwaProject()` path, which would silently overwrite the hand-added `signingConfigs`
block and the `ANDROID_VERSION_CODE`-driven `versionCode`/`versionName` logic entirely, not just
`twa-manifest.json`'s own (otherwise-unused, purely informational) `appVersionCode`/`appVersionName`
fields.

## What's left before this builds or installs anywhere

1. **Android SDK.** Install Android Studio (or the standalone `cmdline-tools` + `sdkmanager`) locally —
   this repo/session cannot do it. Point `local.properties` (create it, gitignored) at your SDK:
   `sdk.dir=/path/to/Android/sdk`. (CI doesn't need this step — `android-release.yml` installs the SDK
   itself via `android-actions/setup-android`, since this project's `compileSdkVersion`/
   `targetSdkVersion` 36 isn't reliably among whatever ubuntu-latest ships preinstalled.)
2. **A real signing key** — same command regardless of which build path below you use:
   ```
   mkdir -p keystore  # keytool doesn't create missing parent directories itself
   keytool -genkey -v -keystore keystore/release.keystore -alias android \
     -keyalg RSA -keysize 2048 -validity 10000
   ```
   `keystore/` is gitignored entirely here — never commit either the keystore or a properties file
   next to it. **This key must stay the same forever** once you start publishing releases with it — a
   different key on a future build makes Android refuse to install it as an update over the existing
   app, forcing an uninstall/reinstall.
3. **Digital Asset Links.** For Chrome to open the TWA without browser chrome, `https://axarl007.github.io/.well-known/assetlinks.json`
   must publish your signing key's SHA-256 fingerprint. Once you have a real key:
   ```
   npx @bubblewrap/cli fingerprint  # or: keytool -list -v -keystore keystore/release.keystore -alias android
   ```
   then add that fingerprint to `arthquest-pwa`-style `.well-known/assetlinks.json` served from the
   `command-deck` GitHub Pages root (a new small file — not part of this PR, since it depends on a key
   that doesn't exist yet).
4. **Build — pick one:**

   **A. Locally**, for testing before you've set up CI secrets: create
   `native/keystore/release.keystore.properties` (gitignored) next to the keystore from step 2:
   ```
   storePassword=<your keystore password>
   keyAlias=android
   keyPassword=<your key password>
   ```
   then `./gradlew assembleRelease` from this directory produces a signed APK at
   `app/build/outputs/apk/release/app-release.apk`. Leave that file out and the same command still
   succeeds — it just produces `app-release-unsigned.apk` instead, which nothing can install as an
   update.

   **B. In CI** (`.github/workflows/android-release.yml`) — mirrors `arthquest-pwa`'s own
   `android-release.yml` pattern exactly (checked directly). Runs automatically on every push to `main`,
   or manually via the Actions tab. One-time setup, in **Settings → Secrets and variables → Actions**,
   add four repository secrets:
   - `ANDROID_KEYSTORE_BASE64` — `base64 -w0 keystore/release.keystore` (macOS:
     `base64 -i keystore/release.keystore`), paste the output
   - `ANDROID_KEYSTORE_STORE_PASSWORD` — your keystore password
   - `ANDROID_KEYSTORE_KEY_ALIAS` — `android` (or whatever alias you used in step 2)
   - `ANDROID_KEYSTORE_KEY_PASSWORD` — your key password

   Until all four are set, the workflow **fails loudly** at either the "Decode release keystore" step
   (empty secret) or the "Verify a signed release APK was produced" step (partial config) — it never
   silently publishes an unsigned build labeled as signed. Not run here either — I can write and
   syntax-check the workflow, but I have no way to actually execute a GitHub Actions run or verify
   secrets from this session.
5. **Install on a device/emulator.** No device or emulator is attached to this environment — this is
   genuinely a "run it yourself" step regardless of which build path you used.

Path B produces exactly what `arthquest-pwa` already does with its own Android releases: a signed
`app-release.apk` published to GitHub Releases (tag `android-v<run-number>`), installable in place over
any prior release from this repo via `adb install -r app-release.apk`.

## Not done yet (separate follow-up, not this ticket)

A real Android home-screen **widget** is a different, unbuilt thing from this TWA shell:
`AppWidgetProvider` class, a widget layout XML, and update logic (periodic `RemoteViews` refresh from
the PWA's IndexedDB data — which a plain TWA has no access to; a widget would need its own small data
bridge). This scaffold only gets you an installable app icon that opens the PWA — nothing here reads
Command Deck's actual capture/board/signal/pulse data outside the WebView.
