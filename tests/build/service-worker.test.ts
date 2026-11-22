import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheVersion, listPublicFiles, precacheList, renderServiceWorker } from '../../build/service-worker';

const SCOPE = 'https://example.org/lup-machine/';

type Listener = (event: FakeEvent) => void;
interface FakeEvent {
  request?: { method: string; url: string; mode: string; varyMismatch?: boolean } | undefined;
  waitUntil(p: Promise<unknown>): void;
  respondWith(p: Promise<unknown>): void;
}

/** Chạy mã service worker trong môi trường giả: self, caches, fetch. */
function bootWorker(source: string, { online = true, existingCaches = [] as string[] } = {}) {
  const listeners = new Map<string, Listener>();
  const stores = new Map<string, Map<string, string>>(existingCaches.map((k) => [k, new Map()]));
  const network = new Map<string, string>();
  const fetchFn = vi.fn(async (req: string | { url: string }) => {
    const url = typeof req === 'string' ? new URL(req, SCOPE).href : req.url;
    if (!online) throw new TypeError('offline');
    return `net:${url}`;
  });
  const caches = {
    open: async (name: string) => {
      const store = stores.get(name) ?? new Map<string, string>();
      stores.set(name, store);
      return {
        addAll: async (urls: string[]) => {
          for (const u of urls) store.set(new URL(u, SCOPE).href, `cached:${u}`);
        },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    // Giống trình duyệt thật: bản lưu có "Vary: Origin" không khớp yêu cầu <script crossorigin> trừ khi ignoreVary.
    match: async (req: string | { url: string; varyMismatch?: boolean }, options?: { ignoreVary?: boolean }) => {
      const url = typeof req === 'string' ? new URL(req, SCOPE).href : req.url;
      if (typeof req !== 'string' && req.varyMismatch && !options?.ignoreVary) return undefined;
      for (const store of stores.values()) if (store.has(url)) return store.get(url);
      return undefined;
    },
  };
  const self = {
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
    location: { origin: 'https://example.org' },
    registration: { scope: SCOPE },
    clients: { claim: vi.fn(async () => undefined) },
  };
  new Function('self', 'caches', 'fetch', source)(self, caches, fetchFn);

  async function dispatch(type: string, request?: FakeEvent['request']) {
    let pending: Promise<unknown> = Promise.resolve();
    let response: Promise<unknown> | null = null;
    listeners.get(type)?.({ request, waitUntil: (p) => (pending = p), respondWith: (p) => (response = p) });
    await pending;
    return response === null ? null : await response;
  }
  return { dispatch, stores, fetchFn, self, network };
}

const get = (path: string, mode = 'cors') => ({ method: 'GET', url: new URL(path, SCOPE).href, mode });

describe('danh sách tệp lưu sẵn', () => {
  test('gộp tệp build và tệp public, bỏ bản đồ nguồn, tài liệu và chính sw.js, có trang gốc', () => {
    const list = precacheList(['assets/app-1a2b.js', 'assets/app-1a2b.js.map', 'index.html', 'sw.js'], ['models/m/model.json', 'models/README.md', 'favicon.svg']);
    expect(list).toEqual(['./', 'assets/app-1a2b.js', 'favicon.svg', 'index.html', 'models/m/model.json']);
  });

  test('liệt kê đệ quy thư mục public bằng đường dẫn dùng dấu /', () => {
    const dir = mkdtempSync(join(tmpdir(), 'lup-public-'));
    mkdirSync(join(dir, 'models', 'm'), { recursive: true });
    writeFileSync(join(dir, 'favicon.svg'), '<svg/>');
    writeFileSync(join(dir, 'models', 'm', 'model.json'), '{}');
    expect(listPublicFiles(dir).map((f) => f.path).sort()).toEqual(['favicon.svg', 'models/m/model.json']);
  });

  test('phiên bản cache đổi khi tên hoặc nội dung tệp đổi, không phụ thuộc thứ tự', () => {
    const f = (path: string, content: string) => ({ path, content: Buffer.from(content) });
    const a = cacheVersion([f('index.html', 'x'), f('m.bin', '1')]);
    expect(cacheVersion([f('m.bin', '1'), f('index.html', 'x')])).toBe(a);
    expect(cacheVersion([f('index.html', 'y'), f('m.bin', '1')])).not.toBe(a);
    expect(cacheVersion([f('index.htm', 'x'), f('m.bin', '1')])).not.toBe(a);
  });
});

describe('service worker', () => {
  const source = renderServiceWorker('v2', ['./', 'index.html', 'assets/app.js', 'models/m/model.json']);

  test('cài đặt: lưu sẵn mọi tệp (kể cả mô hình) vào cache của phiên bản này', async () => {
    const w = bootWorker(source);
    await w.dispatch('install');
    const store = w.stores.get('lup-machine-v2')!;
    expect([...store.keys()]).toContain(`${SCOPE}models/m/model.json`);
    expect(store.size).toBe(4);
  });

  test('kích hoạt: xóa cache của phiên bản cũ, không đụng cache của ứng dụng khác', async () => {
    const w = bootWorker(source, { existingCaches: ['lup-machine-v1', 'other-app'] });
    await w.dispatch('install');
    await w.dispatch('activate');
    expect([...w.stores.keys()].sort()).toEqual(['lup-machine-v2', 'other-app']);
    expect(w.self.clients.claim).toHaveBeenCalled();
  });

  test('tệp đã lưu được phục vụ từ cache, không cần mạng', async () => {
    const w = bootWorker(source);
    await w.dispatch('install');
    expect(await w.dispatch('fetch', get('assets/app.js'))).toBe('cached:assets/app.js');
    expect(w.fetchFn).not.toHaveBeenCalled();
  });

  test('script crossorigin (yêu cầu có Origin, bản lưu có Vary: Origin) vẫn lấy từ cache', async () => {
    const w = bootWorker(source);
    await w.dispatch('install');
    expect(await w.dispatch('fetch', { ...get('assets/app.js'), varyMismatch: true })).toBe('cached:assets/app.js');
    expect(w.fetchFn).not.toHaveBeenCalled();
  });

  test('tệp chưa lưu thì lấy từ mạng', async () => {
    const w = bootWorker(source);
    await w.dispatch('install');
    expect(await w.dispatch('fetch', get('assets/other.js'))).toBe(`net:${SCOPE}assets/other.js`);
  });

  test('mở trang khi mất mạng: trả về index.html đã lưu', async () => {
    const w = bootWorker(source);
    await w.dispatch('install');
    const offline = bootWorker(source, { online: false });
    // dùng chung cache với lần cài trước
    offline.stores.set('lup-machine-v2', w.stores.get('lup-machine-v2')!);
    expect(await offline.dispatch('fetch', get('#/studio', 'navigate'))).toBe('cached:index.html');
  });

  test('mở trang khi có mạng: lấy bản mới nhất từ mạng', async () => {
    const w = bootWorker(source);
    await w.dispatch('install');
    expect(await w.dispatch('fetch', get('', 'navigate'))).toBe(`net:${SCOPE}`);
  });

  test('bỏ qua yêu cầu khác GET hoặc khác nguồn', async () => {
    const w = bootWorker(source);
    expect(await w.dispatch('fetch', { method: 'POST', url: `${SCOPE}x`, mode: 'cors' })).toBeNull();
    expect(await w.dispatch('fetch', { method: 'GET', url: 'https://cdn.example.com/x.js', mode: 'cors' })).toBeNull();
  });
});
