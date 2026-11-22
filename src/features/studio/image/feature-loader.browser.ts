/**
 * Tải TensorFlow.js và mô hình MobileNet khi cần (dynamic import → trang đầu không phải tải ~1 MB thư viện).
 * Ưu tiên WebGL (card đồ họa); máy không hỗ trợ thì tự chuyển sang CPU.
 */
import type { FeatureExtractor } from '@/core/ml/feature-extractor';
import { FEATURE_MODEL_ID } from '@/core/ml/feature-model';

let extractorPromise: Promise<FeatureExtractor> | null = null;

async function initBackend(): Promise<string> {
  const tf = await import('@tensorflow/tfjs-core');
  await Promise.all([import('@tensorflow/tfjs-backend-webgl'), import('@tensorflow/tfjs-backend-cpu')]);
  const hasWebgl = await tf.setBackend('webgl').catch(() => false);
  if (!hasWebgl) await tf.setBackend('cpu');
  await tf.ready();
  return tf.getBackend();
}

export function loadFeatureExtractor(): Promise<FeatureExtractor> {
  extractorPromise ??= (async () => {
    await initBackend();
    const { createFeatureExtractor } = await import('@/core/ml/feature-extractor');
    return createFeatureExtractor(`${import.meta.env.BASE_URL}models/${FEATURE_MODEL_ID}/model.json`);
  })().catch((error: unknown) => {
    extractorPromise = null; // cho phép thử lại
    throw error;
  });
  return extractorPromise;
}
