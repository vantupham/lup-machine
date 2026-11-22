/**
 * Chạy mô hình trong Web Worker để giao diện không bị khựng khi MobileNet làm việc.
 * Tệp này chỉ chứa GIAO THỨC tin nhắn (không phụ thuộc TensorFlow.js hay DOM), nên kiểm thử được:
 *  - phía worker: serveFeatureExtractor — nhận yêu cầu, gọi bộ trích đặc trưng thật, gửi kết quả;
 *  - phía giao diện: connectFeatureExtractor — trả về một FeatureExtractor "từ xa" có cùng cách dùng.
 * Ảnh được SAO CHÉP sang worker (nơi gọi vẫn dùng được); kết quả được CHUYỂN GIAO về (không tốn bản sao).
 */
import type { RgbaImage } from '@/core/image/preprocess';
import type { FeatureExtractor } from './feature-extractor';
import type { ActivationTensor } from './feature-maps';

export interface PortLike {
  postMessage(message: unknown, transfer?: Transferable[]): void;
  addEventListener(type: 'message' | 'error', listener: (event: { data?: unknown }) => void): void;
}

type RequestBody =
  | { readonly kind: 'init' }
  | { readonly kind: 'extract'; readonly images: readonly RgbaImage[] }
  | { readonly kind: 'extractSpatial'; readonly images: readonly RgbaImage[] }
  | { readonly kind: 'extractLayers'; readonly image: RgbaImage; readonly layerNames: readonly string[] };

type Request = RequestBody & { readonly id: number };

type Response =
  | { readonly id: number; readonly kind: 'progress'; readonly done: number }
  | { readonly id: number; readonly kind: 'result'; readonly value: unknown }
  | { readonly id: number; readonly kind: 'error'; readonly message: string };

interface InitInfo {
  readonly backend: string;
  readonly modelId: string;
}

export interface RemoteFeatureExtractor extends FeatureExtractor {
  /** Backend TensorFlow.js trong worker: "webgl" (card đồ họa) hoặc "cpu". */
  readonly backend: string;
}

const REQUEST_KINDS = new Set(['init', 'extract', 'extractSpatial', 'extractLayers']);
const RESPONSE_KINDS = new Set(['progress', 'result', 'error']);

function hasIdAndKind(value: unknown, kinds: ReadonlySet<string>): value is { id: number; kind: string } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { id?: unknown; kind?: unknown };
  return typeof v.id === 'number' && typeof v.kind === 'string' && kinds.has(v.kind);
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));
const uniqueBuffers = (arrays: readonly Float32Array[]) => [...new Set(arrays.map((a) => a.buffer as ArrayBuffer))];

// ───────────────────────────── phía worker ─────────────────────────────

export function serveFeatureExtractor(
  port: PortLike,
  create: () => Promise<{ extractor: FeatureExtractor; backend: string }>,
): void {
  let ready: Promise<{ extractor: FeatureExtractor; backend: string }> | null = null;
  const boot = () => {
    ready ??= create().catch((error: unknown) => {
      ready = null; // cho phép thử lại lần sau
      throw error;
    });
    return ready;
  };

  async function handle(request: Request): Promise<{ value: unknown; transfer: ArrayBuffer[] }> {
    const { extractor, backend } = await boot();
    switch (request.kind) {
      case 'init':
        return { value: { backend, modelId: extractor.modelId } satisfies InitInfo, transfer: [] };
      case 'extract': {
        const vectors = await extractor.extract(request.images, (done) => port.postMessage({ id: request.id, kind: 'progress', done }));
        return { value: vectors, transfer: uniqueBuffers(vectors) };
      }
      case 'extractSpatial': {
        const spatial = await extractor.extractSpatial(request.images);
        return { value: spatial, transfer: uniqueBuffers(spatial) };
      }
      case 'extractLayers': {
        const layers: ActivationTensor[] = await extractor.extractLayers(request.image, request.layerNames);
        return { value: layers, transfer: uniqueBuffers(layers.map((l) => l.data)) };
      }
    }
  }

  port.addEventListener('message', (event) => {
    if (!hasIdAndKind(event.data, REQUEST_KINDS)) return;
    const request = event.data as Request;
    handle(request).then(
      ({ value, transfer }) => port.postMessage({ id: request.id, kind: 'result', value }, transfer),
      (error: unknown) => port.postMessage({ id: request.id, kind: 'error', message: messageOf(error) }),
    );
  });
}

// ──────────────────────────── phía giao diện ────────────────────────────

interface Pending {
  readonly resolve: (value: unknown) => void;
  readonly reject: (error: Error) => void;
  readonly onProgress: ((done: number) => void) | undefined;
}

/** Kết nối tới worker và chờ mô hình khởi động xong; lỗi khởi động → nơi gọi chuyển sang chạy ở luồng chính. */
export async function connectFeatureExtractor(port: PortLike, terminate: () => void): Promise<RemoteFeatureExtractor> {
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let stopped: Error | null = null;

  const stop = (reason: Error) => {
    stopped = reason;
    pending.forEach((p) => p.reject(reason));
    pending.clear();
  };

  port.addEventListener('message', (event) => {
    if (!hasIdAndKind(event.data, RESPONSE_KINDS)) return;
    const response = event.data as Response;
    const entry = pending.get(response.id);
    if (!entry) return;
    if (response.kind === 'progress') {
      entry.onProgress?.(response.done);
      return;
    }
    pending.delete(response.id);
    if (response.kind === 'result') entry.resolve(response.value);
    else entry.reject(new Error(response.message));
  });
  port.addEventListener('error', () => stop(new Error('Web Worker chạy mô hình đã dừng đột ngột')));

  function call<T>(body: RequestBody, onProgress?: (done: number) => void): Promise<T> {
    if (stopped) return Promise.reject(stopped);
    const id = nextId++;
    return new Promise<T>((resolve, reject) => {
      pending.set(id, { resolve: resolve as (value: unknown) => void, reject, onProgress });
      port.postMessage({ ...body, id });
    });
  }

  const info = await call<InitInfo>({ kind: 'init' });
  return {
    modelId: info.modelId,
    backend: info.backend,
    extract: (images, onProgress) => call<Float32Array[]>({ kind: 'extract', images }, onProgress),
    extractSpatial: (images) => call<Float32Array[]>({ kind: 'extractSpatial', images }),
    extractLayers: (image, layerNames) => call<ActivationTensor[]>({ kind: 'extractLayers', image, layerNames }),
    dispose: () => {
      stop(new Error('Web Worker chạy mô hình đã được dừng'));
      terminate();
    },
  };
}
