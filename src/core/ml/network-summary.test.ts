import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_DIM, FEATURE_MAP_LAYERS, SPATIAL_SHAPE } from './feature-model';
import { blockLabelKey, denseParams, featureMapLayerOf, MOBILENET_SUMMARY } from './network-summary';

const modelJson = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'public', 'models', 'mobilenet-v2-035', 'model.json'), 'utf8')) as {
  modelTopology: { model_config: { config: { layers: unknown[] } } };
  weightsManifest: { weights: { shape: number[] }[] }[];
};

describe('tóm tắt MobileNetV2 khớp tệp mô hình trang đang tải', () => {
  test('cùng số tầng và số tham số (chạy lại scripts/build-network-summary.py nếu đổi mô hình)', () => {
    expect(MOBILENET_SUMMARY.totalLayers).toBe(modelJson.modelTopology.model_config.config.layers.length);
    const params = modelJson.weightsManifest.flatMap((g) => g.weights).reduce((s, w) => s + w.shape.reduce((a, b) => a * b, 1), 0);
    expect(MOBILENET_SUMMARY.totalParams).toBe(params);
    expect(MOBILENET_SUMMARY.blocks.reduce((s, b) => s + b.params, 0)).toBe(params);
  });

  test('ảnh 224 × 224 × 3 nhỏ dần còn 7 × 7 × 1280 (đúng kích hoạt out_relu và vector đặc trưng)', () => {
    expect(MOBILENET_SUMMARY.inputShape).toEqual([224, 224, 3]);
    expect(MOBILENET_SUMMARY.blocks.at(-1)!.outShape).toEqual([SPATIAL_SHAPE.height, SPATIAL_SHAPE.width, FEATURE_DIM]);
    const sizes = MOBILENET_SUMMARY.blocks.map((b) => b.outShape[0]);
    sizes.slice(1).forEach((s, i) => expect(s).toBeLessThanOrEqual(sizes[i]!));
  });

  test('mọi tầng của trình xem bản đồ đặc trưng nằm trong đúng một khối', () => {
    const found = MOBILENET_SUMMARY.blocks.map(featureMapLayerOf).filter((n) => n !== null);
    expect(found).toEqual(FEATURE_MAP_LAYERS.map((l) => l.name));
  });

  test('tầng Dense: 1280 × k trọng số + k độ lệch', () => {
    expect(denseParams(3)).toEqual({ weights: 3840, bias: 3, total: 3843 });
  });

  test('tên khối', () => {
    expect(blockLabelKey('Conv1')).toEqual({ key: 'stem' });
    expect(blockLabelKey('block_7')).toEqual({ key: 'block', n: 7 });
    expect(blockLabelKey('Conv_1')).toEqual({ key: 'head' });
  });
});
