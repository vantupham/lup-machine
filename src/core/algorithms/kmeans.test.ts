import reference from '../../../tests/fixtures/kmeans-reference.json';
import { createRng } from '@/core/random/seeded-rng';
import { assignClusters, inertia, kmeansPlusPlus, runKmeans, updateCenters } from './kmeans';

describe('runKmeans – đối chiếu với scikit-learn (Lloyd, cùng tâm khởi đầu)', () => {
  const history = runKmeans(reference.x, reference.init, 100);
  const last = history.at(-1)!;

  test('tâm cụm cuối cùng khớp', () => {
    last.centers.forEach((c, k) => {
      expect(c[0]).toBeCloseTo(reference.centers[k]![0]!, 9);
      expect(c[1]).toBeCloseTo(reference.centers[k]![1]!, 9);
    });
  });

  test('nhãn cụm và tổng bình phương khoảng cách (inertia) khớp', () => {
    expect(last.labels).toEqual(reference.labels);
    expect(last.inertia).toBeCloseTo(reference.inertia, 9);
  });

  test('số vòng lặp khớp', () => {
    expect(history.length - 1).toBe(reference.nIter);
  });

  test('inertia không bao giờ tăng qua các vòng', () => {
    for (let i = 1; i < history.length; i++) {
      expect(history[i]!.inertia).toBeLessThanOrEqual(history[i - 1]!.inertia + 1e-9);
    }
  });
});

describe('các bước của k-means', () => {
  const points = [[0, 0], [0, 1], [10, 10], [10, 11]];

  test('gán mỗi điểm vào tâm gần nhất', () => {
    expect(assignClusters(points, [[0, 0], [10, 10]])).toEqual([0, 0, 1, 1]);
  });

  test('tâm mới là trung bình các điểm của cụm; cụm rỗng giữ nguyên tâm cũ', () => {
    const centers = updateCenters(points, [0, 0, 0, 0], [[1, 1], [99, 99]]);
    expect(centers[0]).toEqual([5, 5.5]);
    expect(centers[1]).toEqual([99, 99]);
  });

  test('inertia là tổng bình phương khoảng cách tới tâm cụm', () => {
    expect(inertia(points, [0, 0, 1, 1], [[0, 0.5], [10, 10.5]])).toBeCloseTo(1);
  });

  test('k-means++ chọn k tâm khác nhau từ dữ liệu, tái lập theo seed', () => {
    const a = kmeansPlusPlus(points, 2, createRng(7));
    const b = kmeansPlusPlus(points, 2, createRng(7));
    expect(a).toEqual(b);
    expect(a).toHaveLength(2);
    // hai cụm cách xa nhau nên k-means++ gần như chắc chắn lấy mỗi cụm một tâm
    expect(assignClusters(points, a)).toEqual(expect.arrayContaining([0, 1]));
  });

  test('báo lỗi khi k lớn hơn số điểm', () => {
    expect(() => kmeansPlusPlus(points, 5, createRng(1))).toThrow(RangeError);
    expect(() => runKmeans([], [[0, 0]], 10)).toThrow(RangeError);
  });
});
