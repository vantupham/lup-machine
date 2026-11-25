import type { StoredImage } from '@/storage/db';
import { decodeStoredImage } from '../image-codec.browser';
import { loadFeatureExtractor } from '../feature-loader.browser';

/** Biến MỘT ảnh thành vector đặc trưng bằng đúng MobileNet đã dùng cho dữ liệu (không lưu gì cả). */
export async function analyzeImage(image: StoredImage): Promise<Float32Array> {
  const [extractor, rgba] = await Promise.all([loadFeatureExtractor(), decodeStoredImage(image)]);
  const [vector] = await extractor.extract([rgba]);
  if (!vector) throw new Error('Mô hình không trả về vector đặc trưng');
  return vector;
}
