/**
 * Khởi động TensorFlow.js: ưu tiên WebGL (card đồ họa; trong Web Worker dùng OffscreenCanvas),
 * máy không hỗ trợ thì tự chuyển sang CPU. Dùng chung cho worker và cho đường dự phòng ở luồng chính.
 */
import { FEATURE_MODEL_ID } from '@/core/ml/feature-model';
import type { FeatureExtractor } from '@/core/ml/feature-extractor';

export async function initBackend(): Promise<string> {
  const tf = await import('@tensorflow/tfjs-core');
  await Promise.all([import('@tensorflow/tfjs-backend-webgl'), import('@tensorflow/tfjs-backend-cpu')]);
  const hasWebgl = await tf.setBackend('webgl').catch(() => false);
  if (!hasWebgl) await tf.setBackend('cpu');
  await tf.ready();
  return tf.getBackend();
}

/** Tải MobileNet tự lưu trữ trong public/models (không phụ thuộc CDN). */
export async function createLocalExtractor(): Promise<{ extractor: FeatureExtractor; backend: string }> {
  const backend = await initBackend();
  const { createFeatureExtractor } = await import('@/core/ml/feature-extractor');
  const extractor = await createFeatureExtractor(`${import.meta.env.BASE_URL}models/${FEATURE_MODEL_ID}/model.json`);
  return { extractor, backend };
}
