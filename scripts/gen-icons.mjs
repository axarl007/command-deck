#!/usr/bin/env node
// Rasterizes the "scope" icon motif (ring + off-center blip + sweep line) to every
// PWA icon size needed, via a Playwright screenshot of inline SVG — no native
// canvas/image dependency required. Re-run after changing the motif in this file
// or in index.html's <symbol> defs (keep them in sync by eye, they're small).
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const INK = '#14120E';
const ACCENT = '#E3A63C';

// glyph = raw SVG markup (viewBox 0 0 24 24), stroke/fill using currentColor via ACCENT directly
const GLYPHS = {
  scope: `<circle cx="12" cy="12" r="9" fill="none" stroke="${ACCENT}" stroke-width="1.6"/><path d="M12 12 L12 4" stroke="${ACCENT}" stroke-width="1.6" stroke-linecap="round"/><circle cx="15.2" cy="8.6" r="1.6" fill="${ACCENT}"/>`,
  capture: `<circle cx="12" cy="12" r="8" fill="none" stroke="${ACCENT}" stroke-width="2"/><path d="M12 9v6M9 12h6" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round"/>`,
  board: `<rect x="4" y="9" width="4" height="11" rx="1" fill="none" stroke="${ACCENT}" stroke-width="2"/><rect x="10" y="4" width="4" height="16" rx="1" fill="none" stroke="${ACCENT}" stroke-width="2"/><rect x="16" y="12" width="4" height="8" rx="1" fill="none" stroke="${ACCENT}" stroke-width="2"/>`,
  signal: `<path d="M8.5 17a6 6 0 0 1 0-10M15.5 7a6 6 0 0 1 0 10M5.5 19.5a10 10 0 0 1 0-15M18.5 4.5a10 10 0 0 1 0 15" fill="none" stroke="${ACCENT}" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="12" r="1.6" fill="${ACCENT}"/>`,
};

function pageHtml(glyphKey, size, { maskable = false } = {}) {
  const glyphSize = maskable ? size * 0.5 : size * 0.62;
  const bg = maskable
    ? `background:${INK};`
    : `background:${INK}; border-radius:${size * 0.22}px;`;
  return `<!doctype html><html><head><style>
    html,body{margin:0;padding:0;}
    .icon{width:${size}px;height:${size}px;${bg}display:flex;align-items:center;justify-content:center;}
  </style></head><body>
    <div class="icon"><svg width="${glyphSize}" height="${glyphSize}" viewBox="0 0 24 24">${GLYPHS[glyphKey]}</svg></div>
  </body></html>`;
}

const targets = [
  { file: 'icon-192.png', glyph: 'scope', size: 192 },
  { file: 'icon-512.png', glyph: 'scope', size: 512 },
  { file: 'icon-192-maskable.png', glyph: 'scope', size: 192, maskable: true },
  { file: 'icon-512-maskable.png', glyph: 'scope', size: 512, maskable: true },
  { file: 'shortcut-capture.png', glyph: 'capture', size: 192 },
  { file: 'shortcut-board.png', glyph: 'board', size: 192 },
  { file: 'shortcut-signal.png', glyph: 'signal', size: 192 },
];

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size }, deviceScaleFactor: 1 });
  await page.setContent(pageHtml(t.glyph, t.size, { maskable: t.maskable }));
  const buf = await page.screenshot({ omitBackground: false });
  await writeFile(join(ROOT, t.file), buf);
  await page.close();
  console.log('wrote', t.file);
}
await browser.close();
