import type { RgbaImage } from '@/core/image/preprocess';
import type { FeatureExtractor } from './feature-extractor';
import { connectFeatureExtractor, serveFeatureExtractor, type PortLike } from './worker-protocol';

type Listener = (event: { data: unknown }) => void;

/** Cặp cổng giả: gửi bất đồng bộ, sao chép bằng structuredClone (có chuyển giao) như postMessage thật. */
class FakePort implements PortLike {
  peer: FakePort | null = null;
  readonly sent: unknown[] = [];
  private readonly listeners = new Map<string, Listener[]>();
  postMessage(message: unknown, transfer: Transferable[] = []): void {
    this.sent.push(message);
    const copy = structuredClone(message, { transfer });
    queueMicrotask(() => this.peer?.emit('message', { data: copy }));
  }
  addEventListener(type: 'message' | 'error', listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  emit(type: string, event: { data: unknown }): void {
    this.listeners.get(type)?.forEach((l) => l(event));
  }
}

function pair(): [FakePort, FakePort] {
  const a = new FakePort();
  const b = new FakePort();
  a.peer = b;
  b.peer = a;
  return [a, b];
}

const image = (v: number): RgbaImage => ({ width: 1, height: 1, data: new Uint8ClampedArray([v, 0, 0, 255]) });

function fakeExtractor(overrides: Partial<FeatureExtractor> = {}): FeatureExtractor {
  return {
    modelId: 'mobilenet-v2-035',
    extract: async (images, onProgress) => {
      images.forEach((_, i) => onProgress?.(i + 1));
      return images.map((img) => Float32Array.from([img.data[0]!, 1]));
    },
    extractSpatial: async (images) => images.map((img) => Float32Array.from([img.data[0]!, 2, 3])),
    extractLayers: async (img, names) => names.map((layer) => ({ layer, height: 1, width: 1, channels: 1, data: Float32Array.from([img.data[0]!]) })),
    dispose: vi.fn(),
    ...overrides,
  };
}

async function connect(extractor = fakeExtractor(), backend = 'webgl') {
  const [client, worker] = pair();
  const create = vi.fn(async () => ({ extractor, backend }));
  serveFeatureExtractor(worker, create);
  const terminate = vi.fn();
  const remote = await connectFeatureExtractor(client, terminate);
  return { remote, create, terminate, client, worker, extractor };
}

describe('Mô hình chạy trong Web Worker: giao thức tin nhắn', () => {
  test('khởi động: tải mô hình đúng 1 lần trong worker và báo backend đang dùng', async () => {
    const { remote, create } = await connect(fakeExtractor(), 'cpu');
    expect(remote.backend).toBe('cpu');
    expect(remote.modelId).toBe('mobilenet-v2-035');
    await remote.extract([image(5)]);
    expect(create).toHaveBeenCalledTimes(1);
  });

  test('extract: kết quả đúng thứ tự, tiến độ được chuyển về luồng giao diện', async () => {
    const { remote } = await connect();
    const progress: number[] = [];
    const vectors = await remote.extract([image(7), image(9)], (d) => progress.push(d));
    expect(vectors.map((v) => Array.from(v))).toEqual([[7, 1], [9, 1]]);
    // Kiểm tra theo tên kiểu (không dùng instanceof: structuredClone của Node tạo mảng ở "realm" khác jsdom).
    expect(Object.prototype.toString.call(vectors[0])).toBe('[object Float32Array]');
    expect(progress).toEqual([1, 2]);
  });

  test('extractSpatial và extractLayers đi qua worker', async () => {
    const { remote } = await connect();
    expect(Array.from((await remote.extractSpatial([image(4)]))[0]!)).toEqual([4, 2, 3]);
    const layers = await remote.extractLayers(image(6), ['a', 'b']);
    expect(layers.map((l) => [l.layer, l.data[0]])).toEqual([['a', 6], ['b', 6]]);
  });

  test('kết quả được CHUYỂN GIAO (không sao chép) từ worker về: bộ nhớ phía worker bị tách ra', async () => {
    const kept: Float32Array[] = [];
    const extractor = fakeExtractor({
      extract: async (images) => {
        const out = images.map(() => new Float32Array(1280));
        kept.push(...out);
        return out;
      },
    });
    const { remote } = await connect(extractor);
    const [v] = await remote.extract([image(1)]);
    expect(v).toHaveLength(1280);
    expect(kept[0]!.buffer.byteLength).toBe(0); // đã chuyển giao
  });

  test('nhiều yêu cầu cùng lúc: mỗi lời gọi nhận đúng kết quả của mình', async () => {
    const { remote } = await connect();
    const [a, b, c] = await Promise.all([remote.extract([image(1)]), remote.extractSpatial([image(2)]), remote.extract([image(3)])]);
    expect(a[0]![0]).toBe(1);
    expect(b[0]![0]).toBe(2);
    expect(c[0]![0]).toBe(3);
  });

  test('lỗi trong worker được trả về đúng lời gọi, worker vẫn dùng tiếp được', async () => {
    const { remote } = await connect(fakeExtractor({ extractLayers: async () => Promise.reject(new Error('Mô hình không có tầng "x"')) }));
    await expect(remote.extractLayers(image(1), ['x'])).rejects.toThrow('Mô hình không có tầng "x"');
    expect((await remote.extract([image(2)]))[0]![0]).toBe(2);
  });

  test('không khởi động được mô hình trong worker: báo lỗi để chuyển sang luồng chính', async () => {
    const [client, worker] = pair();
    serveFeatureExtractor(worker, async () => Promise.reject(new Error('Không có WebGL lẫn CPU')));
    await expect(connectFeatureExtractor(client, vi.fn())).rejects.toThrow('Không có WebGL lẫn CPU');
  });

  test('worker bị sập: mọi lời gọi đang chờ bị từ chối, lời gọi sau cũng bị từ chối', async () => {
    const never = new Promise<Float32Array[]>(() => undefined);
    const { remote, client } = await connect(fakeExtractor({ extract: () => never }));
    const pending = remote.extract([image(1)]);
    client.emit('error', { data: undefined });
    await expect(pending).rejects.toThrow(/Web Worker/);
    await expect(remote.extract([image(1)])).rejects.toThrow(/Web Worker/);
  });

  test('dispose: dừng worker', async () => {
    const { remote, terminate } = await connect();
    remote.dispose();
    expect(terminate).toHaveBeenCalled();
  });

  test('bỏ qua tin nhắn lạ (không đúng giao thức)', async () => {
    const { remote, client, worker } = await connect();
    worker.postMessage({ hello: 'world' });
    worker.postMessage({ id: 999, kind: 'result', value: [] });
    client.emit('message', { data: null });
    expect((await remote.extract([image(8)]))[0]![0]).toBe(8);
  });
});
