import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';
import type { RgbaImage } from '@/core/image/preprocess';
import { createFeatureExtractor, FEATURE_DIM, type FeatureExtractor } from './feature-extractor';
import { SPATIAL_SHAPE } from './feature-model';
import { globalAveragePool } from './explain';

const MODEL_DIR = join(process.cwd(), 'public', 'models', 'mobilenet-v2-035');

function loadFromDisk(): tf.io.IOHandler {
  const manifest = JSON.parse(readFileSync(join(MODEL_DIR, 'model.json'), 'utf8'));
  const bin = readFileSync(join(MODEL_DIR, 'group1-shard1of1.bin'));
  return tf.io.fromMemory({
    modelTopology: manifest.modelTopology,
    weightSpecs: manifest.weightsManifest[0].weights,
    weightData: bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength),
  });
}

function solid(rgb: readonly [number, number, number]): RgbaImage {
  const data = new Uint8ClampedArray(224 * 224 * 4);
  for (let i = 0; i < 224 * 224; i++) data.set([...rgb, 255], i * 4);
  return { width: 224, height: 224, data };
}

function stripes(): RgbaImage {
  const data = new Uint8ClampedArray(224 * 224 * 4);
  for (let y = 0; y < 224; y++) {
    for (let x = 0; x < 224; x++) {
      const v = Math.floor(x / 16) % 2 === 0 ? 255 : 0;
      data.set([v, v, v, 255], (y * 224 + x) * 4);
    }
  }
  return { width: 224, height: 224, data };
}

let extractor: FeatureExtractor;

beforeAll(async () => {
  await tf.setBackend('cpu');
  extractor = await createFeatureExtractor(loadFromDisk());
}, 60_000);

afterAll(() => extractor?.dispose());

describe('Trích đặc trưng bằng MobileNetV2 (mô hình thật, backend CPU)', () => {
  test('mỗi ảnh thành đúng 1280 con số, không âm (sau ReLU + trung bình)', async () => {
    const [v] = await extractor.extract([stripes()]);
    expect(v).toBeInstanceOf(Float32Array);
    expect(v).toHaveLength(FEATURE_DIM);
    expect(Math.min(...v!)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...v!)).toBeGreaterThan(0);
  }, 60_000);

  test('cùng ảnh cho cùng vector; ảnh khác cho vector khác', async () => {
    const [a, b, c] = await extractor.extract([stripes(), stripes(), solid([200, 30, 30])]);
    expect(Array.from(a!)).toEqual(Array.from(b!));
    expect(Array.from(a!)).not.toEqual(Array.from(c!));
  }, 60_000);

  test('xử lý theo lô cho cùng kết quả với xử lý từng ảnh', async () => {
    const images = [solid([10, 120, 240]), stripes()];
    const batched = await extractor.extract(images);
    const single = await extractor.extract([images[1]!]);
    single[0]!.forEach((v, i) => expect(batched[1]![i]).toBeCloseTo(v, 4));
  }, 60_000);

  test('báo tiến độ và giải phóng tensor (không rò rỉ bộ nhớ)', async () => {
    const before = tf.memory().numTensors;
    const progress: number[] = [];
    await extractor.extract([stripes(), stripes(), stripes()], (done) => progress.push(done));
    expect(progress.at(-1)).toBe(3);
    expect(tf.memory().numTensors).toBe(before);
  }, 60_000);

  test('kích hoạt không gian 7×7×1280; lấy trung bình ra đúng vector đặc trưng', async () => {
    const image = stripes();
    const [spatial] = await extractor.extractSpatial([image]);
    const [vector] = await extractor.extract([image]);
    expect(spatial).toHaveLength(SPATIAL_SHAPE.height * SPATIAL_SHAPE.width * SPATIAL_SHAPE.channels);
    const pooled = globalAveragePool(spatial!, SPATIAL_SHAPE);
    pooled.forEach((v, i) => expect(v).toBeCloseTo(vector![i]!, 4));
  }, 60_000);

  test('từ chối ảnh không đúng 224×224', async () => {
    await expect(extractor.extract([{ width: 2, height: 2, data: new Uint8ClampedArray(16) }])).rejects.toThrow(RangeError);
  });
});
