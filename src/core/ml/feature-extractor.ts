/**
 * Bộ trích đặc trưng: MobileNetV2 (α=0,35) → tầng out_relu (7×7×1280) → trung bình theo không gian → 1280 số.
 * Trọng số mô hình được đóng băng (không huấn luyện lại) — đây là "học chuyển giao".
 */
import * as tf from '@tensorflow/tfjs-core';
import { loadLayersModel, model as functionalModel, type LayersModel, type SymbolicTensor } from '@tensorflow/tfjs-layers';
import { MODEL_INPUT_SIZE, rgbaToModelInput, type RgbaImage } from '@/core/image/preprocess';

import type { ActivationTensor } from './feature-maps';
import { FEATURE_DIM, FEATURE_MODEL_ID } from './feature-model';

export { FEATURE_DIM, FEATURE_MODEL_ID };
const BATCH_SIZE = 8;

export interface FeatureExtractor {
  readonly modelId: string;
  extract(images: readonly RgbaImage[], onProgress?: (done: number) => void): Promise<Float32Array[]>;
  /** Kích hoạt 7×7×1280 trước khi lấy trung bình (dùng cho bản đồ "mô hình nhìn vào đâu"). */
  extractSpatial(images: readonly RgbaImage[]): Promise<Float32Array[]>;
  /** Kích hoạt của các tầng trung gian (bản đồ đặc trưng) cho MỘT ảnh. */
  extractLayers(image: RgbaImage, layerNames: readonly string[]): Promise<ActivationTensor[]>;
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

async function extractSpatialBatch(model: LayersModel, images: readonly RgbaImage[]): Promise<Float32Array[]> {
  const output = tf.tidy(() => model.predict(toBatchTensor(images)) as tf.Tensor4D);
  try {
    const flat = (await output.data()) as Float32Array;
    const size = flat.length / images.length;
    return images.map((_, i) => flat.slice(i * size, (i + 1) * size));
  } finally {
    output.dispose();
  }
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

/**
 * Mô hình con dùng chung trọng số với mô hình gốc, có đầu ra là các tầng được yêu cầu.
 * Không gọi dispose() riêng: trọng số thuộc về mô hình gốc.
 */
function buildLayerModel(model: LayersModel, layerNames: readonly string[]): LayersModel {
  const outputs = layerNames.map((name) => {
    const layer = model.layers.find((l) => l.name === name);
    if (!layer) throw new Error(`Mô hình không có tầng "${name}"`);
    return layer.output as SymbolicTensor;
  });
  return functionalModel({ inputs: model.inputs, outputs });
}

async function extractLayersFrom(layerModel: LayersModel, image: RgbaImage, layerNames: readonly string[]): Promise<ActivationTensor[]> {
  const outputs = tf.tidy(() => {
    const result = layerModel.predict(toBatchTensor([image]));
    return (Array.isArray(result) ? result : [result]) as tf.Tensor4D[];
  });
  try {
    const data = await Promise.all(outputs.map((t) => t.data() as Promise<Float32Array>));
    return outputs.map((t, i) => {
      const [, height, width, channels] = t.shape;
      return { layer: layerNames[i]!, height, width, channels, data: data[i]! };
    });
  } finally {
    outputs.forEach((t) => t.dispose());
  }
}

export async function createFeatureExtractor(source: string | tf.io.IOHandler): Promise<FeatureExtractor> {
  const model = await loadLayersModel(source);
  const outputShape = model.outputs[0]?.shape;
  if (outputShape?.at(-1) !== FEATURE_DIM) {
    model.dispose();
    throw new Error(`Mô hình không đúng: đầu ra ${JSON.stringify(outputShape)}`);
  }

  const layerModels = new Map<string, LayersModel>();

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
    async extractSpatial(images) {
      const results: Float32Array[] = [];
      for (let start = 0; start < images.length; start += BATCH_SIZE) {
        results.push(...(await extractSpatialBatch(model, images.slice(start, start + BATCH_SIZE))));
      }
      return results;
    },
    async extractLayers(image, layerNames) {
      const key = layerNames.join('|');
      let layerModel = layerModels.get(key);
      if (!layerModel) {
        layerModel = buildLayerModel(model, layerNames);
        layerModels.set(key, layerModel);
      }
      return extractLayersFrom(layerModel, image, layerNames);
    },
    dispose: () => {
      layerModels.clear();
      model.dispose();
    },
  };
}
