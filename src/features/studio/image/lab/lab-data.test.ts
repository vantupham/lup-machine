import type { ClassRecord, SampleRecord } from '@/storage/db';
import type { SoftmaxParams } from '@/core/ml/softmax-regression';
import { buildTrainingData, nearestTrainSamples, predictSamples } from './lab-data';

const image = { bytes: new ArrayBuffer(1), mime: 'image/jpeg', width: 224, height: 224 };
const cls = (id: string, order: number): ClassRecord => ({ id, projectId: 'p', name: id, order, createdAt: '' });
const sample = (id: string, classId: string, split: 'train' | 'test'): SampleRecord => ({
  id,
  projectId: 'p',
  classId,
  split,
  source: 'upload',
  image,
  createdAt: '',
});

const classes = [cls('a', 0), cls('b', 1)];
const samples = [sample('a1', 'a', 'train'), sample('a2', 'a', 'test'), sample('b1', 'b', 'train'), sample('b2', 'b', 'test')];
const features = new Map<string, Float32Array>([
  ['a1', Float32Array.from([1, 0])],
  ['a2', Float32Array.from([0.9, 0.1])],
  ['b1', Float32Array.from([0, 1])],
  ['b2', Float32Array.from([0.2, 0.8])],
]);

describe('buildTrainingData', () => {
  test('nhãn theo thứ tự lớp; tách tập Huấn luyện / Kiểm tra', () => {
    const result = buildTrainingData(classes, samples, features);
    expect(result.readiness).toBe('ready');
    if (result.readiness !== 'ready') return;
    expect(result.data.train.ys).toEqual([0, 1]);
    expect(result.data.test?.ys).toEqual([0, 1]);
    expect(result.trainSamples.map((s) => s.id)).toEqual(['a1', 'b1']);
  });

  test('thiếu vector đặc trưng thì chưa sẵn sàng', () => {
    const partial = new Map(features);
    partial.delete('b2');
    expect(buildTrainingData(classes, samples, partial).readiness).toBe('need-features');
  });

  test('cần ít nhất 2 lớp có ảnh Huấn luyện', () => {
    const onlyA = samples.filter((s) => s.classId === 'a');
    expect(buildTrainingData(classes, onlyA, features).readiness).toBe('need-classes');
  });

  test('không có ảnh Kiểm tra thì test = null', () => {
    const trainOnly = samples.filter((s) => s.split === 'train');
    const result = buildTrainingData(classes, trainOnly, features);
    expect(result.readiness === 'ready' && result.data.test).toBeNull();
  });
});

describe('predictSamples', () => {
  test('dự đoán lớp và xác suất cho từng ảnh', () => {
    const params: SoftmaxParams = { numClasses: 2, dim: 2, weights: Float32Array.from([5, 0, 0, 5]), bias: new Float32Array(2) };
    const preds = predictSamples(params, classes, samples, features);
    expect(preds.get('a2')).toMatchObject({ predicted: 0, actual: 0, isCorrect: true });
    expect(preds.get('b2')?.probabilities[1]).toBeGreaterThan(0.9);
  });
});

describe('nearestTrainSamples', () => {
  test('ảnh Huấn luyện giống nhất theo độ tương đồng cosine, loại chính nó', () => {
    const result = nearestTrainSamples('a2', samples, features, 2);
    expect(result.map((r) => r.sample.id)).toEqual(['a1', 'b1']);
    expect(result[0]!.similarity).toBeGreaterThan(result[1]!.similarity);
    expect(nearestTrainSamples('a1', samples, features, 3).map((r) => r.sample.id)).not.toContain('a1');
  });
});
