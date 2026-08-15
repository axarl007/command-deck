#!/usr/bin/env node
// Dev-time visual QA: serves the repo root and screenshots each view at
// mobile/tablet/desktop widths. Not run in CI — see CLAUDE.md "Process".
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const PORT = 4571;
const MIME = { '.html':'text/html', '.json':'application/json', '.js':'text/javascript', '.png':'image/png', '.svg':'image/svg+xml' };

const server = createServer(async (req, res) => {
  const path = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  try {
    const data = await readFile(join(ROOT, path));
    res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' });
    res.end(data);
  } catch (err) {
    console.error('404', path, err.message);
    res.writeHead(404);
    res.end('not found');
  }
});
server.on('clientError', (err, socket) => {
  console.error('clientError', err.message);
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
await new Promise(resolve => server.listen(PORT, resolve));

// Google Fonts is unreachable from this sandbox's browser process (no proxy
// configured for Chromium's egress) — that's a local-only limitation, not an
// app bug, so failures against it don't fail this check. Real deployments
// have normal internet access.
const IGNORED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const isIgnored = (url) => IGNORED_HOSTS.some((h) => url.includes(h));

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const breakpoints = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1200, height: 800 },
];
const views = ['capture', 'board', 'signal', 'pulse'];

let hadConsoleError = false;
for (const bp of breakpoints) {
  const page = await browser.newPage({ viewport: { width: bp.width, height: bp.height } });
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    if (isIgnored(msg.location()?.url || '')) return;
    hadConsoleError = true;
    console.error(`[console error][${bp.name}]`, msg.text());
  });
  page.on('pageerror', err => { hadConsoleError = true; console.error(`[page error][${bp.name}]`, err.message); });
  page.on('requestfailed', req => {
    if (isIgnored(req.url())) return;
    hadConsoleError = true;
    console.error(`[request failed][${bp.name}]`, req.url(), req.failure()?.errorText);
  });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForTimeout(300);
  for (const v of views) {
    await page.evaluate((view) => window.switchView(view), v);
    await page.waitForTimeout(150);
    await page.screenshot({ path: `/tmp/qa-${bp.name}-${v}.png` });
  }
  await page.close();
}
await browser.close();
server.close();

console.log(hadConsoleError ? 'FAIL: console/page errors detected' : 'OK: no console/page errors, screenshots in /tmp/qa-*.png');
process.exit(hadConsoleError ? 1 : 0);
