/**
 * Bộ trích đặc trưng: MobileNetV2 (α=0,35) → tầng out_relu (7×7×1280) → trung bình theo không gian → 1280 số.
 * Trọng số mô hình được đóng băng (không huấn luyện lại) — đây là "học chuyển giao".
 */
import * as tf from '@tensorflow/tfjs-core';
import { loadLayersModel, type LayersModel } from '@tensorflow/tfjs-layers';
import { MODEL_INPUT_SIZE, rgbaToModelInput, type RgbaImage } from '@/core/image/preprocess';

import { FEATURE_DIM, FEATURE_MODEL_ID } from './feature-model';

export { FEATURE_DIM, FEATURE_MODEL_ID };
const BATCH_SIZE = 8;

export interface FeatureExtractor {
  readonly modelId: string;
  extract(images: readonly RgbaImage[], onProgress?: (done: number) => void): Promise<Float32Array[]>;
  dispose(): void;
}

function toBatchTensor(images: readonly RgbaImage[]): tf.Tensor4D {
  const size = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3;
  const buffer = new Float32Array(images.length * size);
  images.forEach((img, i) => {
    if (img.width !== MODEL_INPUT_SIZE || img.height !== MODEL_INPUT_SIZE) {
      throw new RangeError(`Ảnh phải có kích thước ${MODEL_INPUT_SIZE}×${MODEL_INPUT_SIZE}`);
    }
    buffer.set(rgbaToModelInput(img), i * size);
  });
  return tf.tensor4d(buffer, [images.length, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3]);
}

async function extractBatch(model: LayersModel, images: readonly RgbaImage[]): Promise<Float32Array[]> {
  const pooled = tf.tidy(() => {
    const output = model.predict(toBatchTensor(images)) as tf.Tensor4D;
    return tf.mean(output, [1, 2]) as tf.Tensor2D; // global average pooling
  });
  try {
    const flat = (await pooled.data()) as Float32Array;
    return images.map((_, i) => flat.slice(i * FEATURE_DIM, (i + 1) * FEATURE_DIM));
  } finally {
    pooled.dispose();
  }
}

export async function createFeatureExtractor(source: string | tf.io.IOHandler): Promise<FeatureExtractor> {
  const model = await loadLayersModel(source);
  const outputShape = model.outputs[0]?.shape;
  if (outputShape?.at(-1) !== FEATURE_DIM) {
    model.dispose();
    throw new Error(`Mô hình không đúng: đầu ra ${JSON.stringify(outputShape)}`);
  }

  return {
    modelId: FEATURE_MODEL_ID,
    async extract(images, onProgress) {
      const results: Float32Array[] = [];
      for (let start = 0; start < images.length; start += BATCH_SIZE) {
        results.push(...(await extractBatch(model, images.slice(start, start + BATCH_SIZE))));
        onProgress?.(results.length);
        await tf.nextFrame(); // nhường luồng cho giao diện cập nhật
      }
      return results;
    },
    dispose: () => model.dispose(),
  };
}
