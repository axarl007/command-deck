#!/usr/bin/env node
// Installability + offline check against a running server (see qa-screenshot.mjs
// for the same local-server pattern). Modern Lighthouse (v10+) dropped the scored
// "pwa" category in favor of Chrome's own installability check — this script
// calls that same check directly via CDP, which is the actually-supported path
// now, plus a manual offline-reload check sw.js's cache-first fallback depends on.
import { chromium } from 'playwright';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/check-pwa.mjs <url>');
  process.exit(1);
}

// A regular (non-incognito) persistent profile is required — Chrome's own
// installability check unconditionally fails with "in-incognito" inside an
// ephemeral context, which browser.newContext() creates under the hood.
const userDataDir = await mkdtemp(join(tmpdir(), 'command-deck-pwa-check-'));
const context = await chromium.launchPersistentContext(userDataDir, {
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);

await page.goto(url, { waitUntil: 'networkidle' });

// 1. Installability — same check Chrome itself uses to decide whether to show
// the install prompt / offer "Add to Home Screen".
await cdp.send('Page.enable');
const installabilityResult = await cdp.send('Page.getInstallabilityErrors');
const errors = installabilityResult.installabilityErrors || installabilityResult.errors || [];
let ok = true;
if (errors.length) {
  ok = false;
  console.error('FAIL installability:');
  for (const e of errors) console.error('  -', e.errorId, JSON.stringify(e.errorArguments));
} else {
  console.log('OK installability: no errors (manifest + service worker + icons all satisfy Chrome\'s install criteria)');
}

// 2. Offline navigation — sw.js should serve the cached shell, not a browser error page.
await page.waitForTimeout(500); // let the SW finish precaching after install
await context.setOffline(true);
try {
  await page.reload({ waitUntil: 'networkidle', timeout: 10000 });
  const bodyText = await page.textContent('body');
  const isRealApp = bodyText && bodyText.includes('Command Deck');
  if (isRealApp) {
    console.log('OK offline: reload while offline still renders the app shell');
  } else {
    ok = false;
    console.error('FAIL offline: reload while offline did not render the app (got browser error page or blank)');
  }
} catch (e) {
  ok = false;
  console.error('FAIL offline: reload threw —', e.message);
}
await context.setOffline(false);

await context.close();
process.exit(ok ? 0 : 1);
