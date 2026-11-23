import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import reference from '../../../tests/fixtures/keras-features-reference.json';
import type { RgbaImage } from '@/core/image/preprocess';
import { cosineSimilarity } from './metrics';
import { createFeatureExtractor, type FeatureExtractor } from './feature-extractor';

/**
 * Notebook Colab của dự án ảnh ghép tầng phân loại với MobileNetV2 của Keras Applications.
 * Kiểm thử này chứng minh Keras (scripts/gen-keras-reference.py) và LUP Machine (TF.js) cho CÙNG vector đặc trưng.
 */
const MODEL_DIR = join(process.cwd(), 'public', 'models', 'mobilenet-v2-035');
const SIZE = 224;
/** Sai khác cho phép giữa hai thư viện (thứ tự cộng dồn số thực float32 khác nhau). */
const ABS_TOLERANCE = 1e-3;

function loadFromDisk(): tf.io.IOHandler {
  const manifest = JSON.parse(readFileSync(join(MODEL_DIR, 'model.json'), 'utf8'));
  const bin = readFileSync(join(MODEL_DIR, 'group1-shard1of1.bin'));
  return tf.io.fromMemory({
    modelTopology: manifest.modelTopology,
    weightSpecs: manifest.weightsManifest[0].weights,
    weightData: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
  });
}

function image(pixel: (x: number, y: number) => [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) data.set([...pixel(x, y), 255], (y * SIZE + x) * 4);
  return { width: SIZE, height: SIZE, data };
}

const IMAGES: Record<string, RgbaImage> = {
  stripes: image((x) => {
    const v = Math.floor(x / 16) % 2 === 0 ? 255 : 0;
    return [v, v, v];
  }),
  gradient: image((x, y) => [x, y, (x * y) % 256]),
};

let extractor: FeatureExtractor;

beforeAll(async () => {
  await tf.setBackend('cpu');
  extractor = await createFeatureExtractor(loadFromDisk());
}, 60_000);

afterAll(() => extractor?.dispose());

describe('đặc trưng LUP Machine (TF.js) trùng với Keras MobileNetV2 α=0.35', () => {
  reference.images.forEach((name, i) => {
    test(`ảnh "${name}"`, async () => {
      const [ours] = await extractor.extract([IMAGES[name]!]);
      const keras = reference.features[i]!;
      expect(ours).toHaveLength(keras.length);
      let maxDiff = 0;
      keras.forEach((v, j) => (maxDiff = Math.max(maxDiff, Math.abs(v - ours![j]!))));
      expect(maxDiff).toBeLessThan(ABS_TOLERANCE);
      expect(cosineSimilarity(ours!, keras)).toBeGreaterThan(0.99999);
    }, 60_000);
  });
});
