import type { SampleRecord } from '@/storage/db';
import type { SoftmaxParams } from '@/core/ml/softmax-regression';
import { nearestTrainToVector, predictProbe, fitProbeMap, UNCERTAIN_BELOW } from './probe';

const image = { bytes: new ArrayBuffer(1), mime: 'image/jpeg', width: 224, height: 224 };
const sample = (id: string, classId: string, split: 'train' | 'test'): SampleRecord => ({
  id,
  projectId: 'p',
  classId,
  split,
  source: 'upload',
  image,
  createdAt: '',
});

const params: SoftmaxParams = { numClasses: 2, dim: 2, weights: Float32Array.from([5, 0, 0, 5]), bias: new Float32Array(2) };

describe('predictProbe', () => {
  test('ảnh mới rõ ràng: đoán đúng lớp, xác suất cộng lại bằng 1, không bị coi là chưa chắc', () => {
    const p = predictProbe(params, Float32Array.from([1, 0]));
    expect(p.predicted).toBe(0);
    expect(p.probabilities[0]! + p.probabilities[1]!).toBeCloseTo(1, 10);
    expect(p.confidence).toBeGreaterThan(0.99);
    expect(p.isUncertain).toBe(false);
  });

  test(`độ tin cậy cao nhất dưới ${UNCERTAIN_BELOW * 100}% thì báo chưa chắc chắn`, () => {
    const three: SoftmaxParams = { numClasses: 3, dim: 1, weights: new Float32Array(3), bias: new Float32Array(3) };
    const p = predictProbe(three, Float32Array.from([1]));
    expect(p.confidence).toBeCloseTo(1 / 3, 10);
    expect(p.isUncertain).toBe(true);
  });

  test('vector sai số chiều (mô hình cũ, đặc trưng khác) thì từ chối thay vì đoán bừa', () => {
    expect(() => predictProbe(params, Float32Array.from([1, 0, 0]))).toThrow(/số chiều/);
  });
});

describe('nearestTrainToVector', () => {
  const samples = [sample('a1', 'a', 'train'), sample('a2', 'a', 'test'), sample('b1', 'b', 'train'), sample('b2', 'b', 'train')];
  const features = new Map<string, Float32Array>([
    ['a1', Float32Array.from([1, 0])],
    ['a2', Float32Array.from([1, 0.01])],
    ['b1', Float32Array.from([0, 1])],
    ['b2', Float32Array.from([0.2, 1])],
  ]);

  test('chỉ lấy ảnh Huấn luyện, xếp theo độ tương đồng cosine giảm dần', () => {
    const result = nearestTrainToVector(Float32Array.from([1, 0.1]), samples, features, 2);
    expect(result.map((r) => r.sample.id)).toEqual(['a1', 'b2']);
    expect(result[0]!.similarity).toBeGreaterThan(result[1]!.similarity);
  });

  test('bỏ qua ảnh được chỉ định (khi ảnh đang xét cũng là một ảnh Huấn luyện)', () => {
    const result = nearestTrainToVector(Float32Array.from([1, 0]), samples, features, 3, 'a1');
    expect(result.map((r) => r.sample.id)).not.toContain('a1');
  });
});

describe('fitProbeMap', () => {
  test('đặt ảnh mới lên CÙNG mặt phẳng PCA với các ảnh đã có (ảnh trùng một ảnh cũ thì trùng tọa độ)', () => {
    const vectors = [Float32Array.from([0, 0, 1]), Float32Array.from([4, 0, 1]), Float32Array.from([0, 2, 1]), Float32Array.from([4, 2, 1])];
    const map = fitProbeMap(vectors);
    expect(map).not.toBeNull();
    const probe = map!.project(Float32Array.from([4, 0, 1]));
    expect(probe[0]).toBeCloseTo(map!.points[1]![0], 10);
    expect(probe[1]).toBeCloseTo(map!.points[1]![1], 10);
    expect(map!.points).toHaveLength(4);
  });

  test('chưa đủ 2 ảnh thì không vẽ được bản đồ', () => {
    expect(fitProbeMap([Float32Array.from([1, 2])])).toBeNull();
  });
});
