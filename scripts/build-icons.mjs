/**
 * Dựng biểu tượng PNG cho ứng dụng cài đặt (PWA) từ public/favicon.svg, bằng Chromium của Playwright
 * (có sẵn trong dự án, không cần thêm thư viện). Chạy lại khi đổi logo:
 *   node scripts/build-icons.mjs
 *
 * - icon-192.png, icon-512.png: biểu tượng thường (góc bo trong suốt, giống favicon)
 * - icon-maskable-512.png: nền kín khung, logo thu về 80% quanh tâm để nằm trong vùng an toàn
 *   (hình tròn bán kính 40%) khi Android cắt thành tròn / bo góc
 * - apple-touch-icon.png (180): nền kín khung vì iOS tự bo góc và không dùng phần trong suốt
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'icons');
const BRAND_BLUE = '#1d4ed8';
const MASKABLE_SCALE = 0.8;

const favicon = readFileSync(join(ROOT, 'public', 'favicon.svg'), 'utf8');
const glyph = favicon.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<rect[^>]*\/>/, '');

/** Nền kín khung (không bo góc), logo thu nhỏ quanh tâm. */
const fullBleed = (scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="${BRAND_BLUE}"/>` +
  `<g transform="translate(32 32) scale(${scale}) translate(-32 -32)">${glyph}</g></svg>`;

const ICONS = [
  { file: 'icon-192.png', size: 192, svg: favicon },
  { file: 'icon-512.png', size: 512, svg: favicon },
  { file: 'icon-maskable-512.png', size: 512, svg: fullBleed(MASKABLE_SCALE) },
  { file: 'apple-touch-icon.png', size: 180, svg: fullBleed(1) },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  for (const { file, size, svg } of ICONS) {
    await page.setViewportSize({ width: size, height: size });
    const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
    await page.setContent(`<!doctype html><html><body style="margin:0;background:transparent">${sized}</body></html>`);
    const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    writeFileSync(join(OUT, file), png);
    console.log(`${file}: ${size}×${size}, ${(png.length / 1024).toFixed(1)} KB`);
  }
} finally {
  await browser.close();
}
