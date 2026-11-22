import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC = join(process.cwd(), 'public');
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

/** Kích thước ghi trong khối IHDR của tệp PNG (byte 16–23). */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  expect([...bytes.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

const manifest = JSON.parse(readFileSync(join(PUBLIC, 'manifest.webmanifest'), 'utf8')) as { icons: ManifestIcon[] };
const pngIcons = manifest.icons.filter((i) => i.type === 'image/png');

describe('Biểu tượng ứng dụng (PWA)', () => {
  test('manifest có PNG 192 và 512 (Chrome yêu cầu để cài đặt), và bản maskable cho Android', () => {
    expect(pngIcons.some((i) => i.sizes === '192x192' && (i.purpose ?? 'any') === 'any')).toBe(true);
    expect(pngIcons.some((i) => i.sizes === '512x512' && (i.purpose ?? 'any') === 'any')).toBe(true);
    expect(pngIcons.some((i) => i.sizes === '512x512' && i.purpose === 'maskable')).toBe(true);
  });

  test.each(pngIcons.map((i) => [i.src, i] as const))('%s: tồn tại, là PNG thật và đúng kích thước khai báo', (_src, icon) => {
    const file = join(PUBLIC, icon.src);
    expect(existsSync(file)).toBe(true);
    const { width, height } = pngSize(file);
    expect(`${width}x${height}`).toBe(icon.sizes);
  });

  test('đường dẫn biểu tượng là tương đối (chạy đúng dưới /lup-machine/ trên GitHub Pages)', () => {
    for (const icon of manifest.icons) expect(icon.src).not.toMatch(/^(\/|https?:)/);
  });

  test('index.html khai báo apple-touch-icon 180×180 cho iPhone / iPad', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    const href = /<link rel="apple-touch-icon" href="\.\/([^"]+)"/.exec(html)?.[1];
    expect(href).toBe('icons/apple-touch-icon.png');
    expect(pngSize(join(PUBLIC, href!))).toEqual({ width: 180, height: 180 });
  });
});
