import { createRng } from '@/core/random/seeded-rng';
import { DATASET_2D_KINDS, gaussian, makeDataset2d, makeRegressionData } from './datasets-2d';

describe('makeDataset2d', () => {
  test.each(DATASET_2D_KINDS)('%s: đủ số điểm, nhãn hợp lệ, tái lập theo seed', (kind) => {
    const a = makeDataset2d(kind, 60, 0.1, 4);
    expect(a.points).toHaveLength(60);
    expect(a.labels.every((l) => l >= 0 && l < a.numClasses)).toBe(true);
    expect(new Set(a.labels).size).toBe(a.numClasses);
    expect(makeDataset2d(kind, 60, 0.1, 4)).toEqual(a);
    expect(makeDataset2d(kind, 60, 0.1, 5)).not.toEqual(a);
  });

  test('XOR không nhiễu: nhãn theo dấu của x·y', () => {
    const d = makeDataset2d('xor', 40, 0, 1);
    d.points.forEach(([x, y], i) => expect(d.labels[i]).toBe(x * y > 0 ? 0 : 1));
  });

  test('hai vòng tròn không nhiễu: lớp 0 ở vòng trong', () => {
    const d = makeDataset2d('circles', 20, 0, 1);
    d.points.forEach(([x, y], i) => expect(Math.hypot(x, y)).toBeCloseTo(d.labels[i] === 0 ? 0.35 : 0.8));
  });
});

describe('gaussian và dữ liệu hồi quy', () => {
  test('phân phối chuẩn có trung bình ≈ 0 và độ lệch chuẩn ≈ 1', () => {
    const rng = createRng(3);
    const v = Array.from({ length: 20000 }, () => gaussian(rng));
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length);
    expect(mean).toBeCloseTo(0, 1);
    expect(sd).toBeCloseTo(1, 1);
  });

  test('không nhiễu thì y nằm đúng trên đường thẳng', () => {
    const d = makeRegressionData(10, 2, -1, 0, 8);
    d.xs.forEach((x, i) => expect(d.ys[i]).toBeCloseTo(2 * x - 1));
  });
});
