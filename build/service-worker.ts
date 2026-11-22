/**
 * Chạy ngoại tuyến (PWA) không cần thư viện ngoài: khi build, sinh `sw.js` chứa danh sách MỌI tệp của ứng dụng
 * (mã, giao diện, mô hình MobileNet). Lần đầu mở trang có mạng, trình duyệt tải sẵn tất cả;
 * từ lần sau phòng máy mất mạng vẫn chạy được.
 *
 * Cập nhật an toàn: không ép kích hoạt ngay (không skipWaiting) — phiên bản mới chỉ thay thế khi mọi tab cũ đã đóng,
 * tránh trường hợp trang cũ cần một tệp đã bị xóa khỏi cache.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import type { Plugin } from 'vite';

export const SW_FILE = 'sw.js';
const CACHE_PREFIX = 'lup-machine-';
const VERSION_LENGTH = 12;
/** Không cần khi chạy: bản đồ nguồn (gỡ lỗi, rất nặng) và tài liệu. */
const SKIPPED_EXTENSIONS = ['.map', '.md'];

export interface PublicFile {
  readonly path: string;
  readonly content: Buffer;
}

/** Mọi tệp trong thư mục public (đệ quy), đường dẫn dùng dấu / như trên web. */
export function listPublicFiles(dir: string): PublicFile[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const full = join(entry.parentPath, entry.name);
      return { path: relative(dir, full).split(sep).join('/'), content: readFileSync(full) };
    });
}

/** Danh sách tệp cần lưu sẵn: trang gốc + tệp build + tệp public, bỏ bản đồ nguồn (.map), tài liệu (.md) và chính sw.js. */
export function precacheList(builtFiles: readonly string[], publicFiles: readonly string[]): string[] {
  const files = [...builtFiles, ...publicFiles].filter((f) => !SKIPPED_EXTENSIONS.some((ext) => f.endsWith(ext)) && f !== SW_FILE);
  return ['./', ...[...new Set(files)].sort()];
}

/** Phiên bản cache băm theo tên + nội dung của mọi tệp: đổi bất kỳ tệp nào → phiên bản mới. */
export function cacheVersion(files: readonly PublicFile[]): string {
  const hash = createHash('sha256');
  [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    .forEach((f) => hash.update(`${f.path}\n`).update(f.content).update('\n'));
  return hash.digest('hex').slice(0, VERSION_LENGTH);
}

export function renderServiceWorker(version: string, precache: readonly string[]): string {
  return `// Generated at build time by build/service-worker.ts - do not edit by hand.
const CACHE = ${JSON.stringify(CACHE_PREFIX + version)};
const PRECACHE = ${JSON.stringify(precache)};

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(${JSON.stringify(CACHE_PREFIX)}) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    // Trang: ưu tiên bản mới từ mạng; mất mạng thì dùng bản đã lưu.
    event.respondWith(fetch(request).catch(() => caches.match(new URL('index.html', self.registration.scope).href)));
    return;
  }
  // Mã, mô hình, ảnh: tên tệp có mã băm nên bản trong cache luôn đúng → dùng cache trước.
  // ignoreVary: thẻ <script crossorigin> gửi kèm Origin, còn bản lưu (tải lúc cài) có "Vary: Origin" → nếu không bỏ qua sẽ không khớp.
  event.respondWith(caches.match(request, { ignoreVary: true }).then((hit) => hit || fetch(request)));
});
`;
}

export function serviceWorkerPlugin(publicDir: string): Plugin {
  return {
    name: 'lup-service-worker',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const built = Object.values(bundle)
        .filter((item) => !item.fileName.endsWith('.map'))
        .map((item) => ({
          path: item.fileName,
          content: Buffer.from(item.type === 'asset' ? item.source : item.code),
        }));
      const publicFiles = listPublicFiles(publicDir);
      const precache = precacheList([...built.map((f) => f.path), 'index.html'], publicFiles.map((f) => f.path));
      const version = cacheVersion([...built, ...publicFiles]);
      this.emitFile({ type: 'asset', fileName: SW_FILE, source: renderServiceWorker(version, precache) });
    },
  };
}
