import reference from '../../../tests/fixtures/knn-reference.json';
import { knnClassify, knnGrid, knnRegress } from './knn';

type Point = readonly [number, number];
const xs = reference.x as unknown as Point[];

describe('knnClassify – đối chiếu với scikit-learn', () => {
  for (const c of reference.cases) {
    test(`k = ${c.k}: nhãn dự đoán, láng giềng và khoảng cách khớp`, () => {
      reference.queries.forEach((q, i) => {
        const result = knnClassify(xs, reference.y, 3, q, c.k);
        expect(result.label).toBe(c.predictions[i]);
        expect(result.neighbors.map((n) => n.index)).toEqual(c.neighbors[i]);
        result.neighbors.forEach((n, j) => expect(n.distance).toBeCloseTo(c.distances[i]![j]!, 9));
      });
    });
  }
});

describe('knnRegress – đối chiếu với scikit-learn', () => {
  for (const c of reference.regression) {
    test(`k = ${c.k}: giá trị dự đoán là trung bình của k láng giềng`, () => {
      reference.queries.forEach((q, i) => {
        expect(knnRegress(xs, reference.targets, q, c.k).value).toBeCloseTo(c.predictions[i]!, 9);
      });
    });
  }
});

describe('knnClassify – quy tắc', () => {
  const points: Point[] = [[0, 0], [1, 0], [5, 5], [6, 5]];
  const labels = [0, 0, 1, 1];

  test('đếm phiếu bầu của k láng giềng', () => {
    const result = knnClassify(points, labels, 2, [0.2, 0], 3);
    expect(result.votes).toEqual([2, 1]);
    expect(result.label).toBe(0);
  });

  test('hòa phiếu thì chọn lớp có số thứ tự nhỏ hơn (giống scikit-learn)', () => {
    const result = knnClassify(points, labels, 2, [3, 2.5], 4);
    expect(result.votes).toEqual([2, 2]);
    expect(result.label).toBe(0);
  });

  test('k lớn hơn số điểm thì dùng toàn bộ điểm', () => {
    expect(knnClassify(points, labels, 2, [0, 0], 10).neighbors).toHaveLength(4);
  });

  test('báo lỗi khi chưa có điểm hoặc k không hợp lệ', () => {
    expect(() => knnClassify([], [], 2, [0, 0], 1)).toThrow(RangeError);
    expect(() => knnClassify(points, labels, 2, [0, 0], 0)).toThrow(RangeError);
    expect(() => knnClassify(points, [0], 2, [0, 0], 1)).toThrow(RangeError);
  });
});

describe('knnGrid', () => {
  test('tô vùng phân loại trên lưới, khớp từng điểm với knnClassify', () => {
    const points: Point[] = [[-1, -1], [1, 1]];
    const grid = knnGrid(points, [0, 1], 2, 1, { xMin: -2, xMax: 2, yMin: -2, yMax: 2, resolution: 4 });
    expect(grid).toHaveLength(16);
    expect(grid[0]).toBe(0); // góc dưới trái
    expect(grid[15]).toBe(1); // góc trên phải
  });
});
