/**
 * Tải bộ trích đặc trưng khi cần (trang đầu không phải tải ~1 MB TensorFlow.js).
 * Ưu tiên chạy MobileNet trong Web Worker để giao diện luôn mượt; nếu trình duyệt không tạo được
 * module worker hoặc mô hình không khởi động được trong worker, tự chuyển sang chạy ở luồng chính.
 */
import type { FeatureExtractor } from '@/core/ml/feature-extractor';
import { connectFeatureExtractor, type PortLike } from '@/core/ml/worker-protocol';

let extractorPromise: Promise<FeatureExtractor> | null = null;

async function loadInWorker(): Promise<FeatureExtractor> {
  const worker = new Worker(new URL('./feature-worker.browser.ts', import.meta.url), { type: 'module', name: 'lup-model' });
  try {
    const remote = await connectFeatureExtractor(worker as unknown as PortLike, () => worker.terminate());
    // Worker sập giữa chừng (ví dụ hết bộ nhớ card đồ họa): lần gọi sau sẽ tạo lại từ đầu.
    worker.addEventListener('error', () => {
      extractorPromise = null;
    });
    return remote;
  } catch (error: unknown) {
    worker.terminate();
    throw error;
  }
}

async function loadOnMainThread(): Promise<FeatureExtractor> {
  const { createLocalExtractor } = await import('./tf-backend.browser');
  return (await createLocalExtractor()).extractor;
}

async function loadPreferred(): Promise<FeatureExtractor> {
  if (typeof Worker !== 'undefined') {
    try {
      return await loadInWorker();
    } catch (error: unknown) {
      console.warn('Không chạy được mô hình trong Web Worker, chuyển sang luồng chính', error);
    }
  }
  return loadOnMainThread();
}

export function loadFeatureExtractor(): Promise<FeatureExtractor> {
  extractorPromise ??= loadPreferred().catch((error: unknown) => {
    extractorPromise = null; // cho phép thử lại
    throw error;
  });
  return extractorPromise;
}
