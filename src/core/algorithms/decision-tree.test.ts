import reference from '../../../tests/fixtures/tree-reference.json';
import { featureImportances, fitTree, impurity, predictTree, type Criterion } from './decision-tree';

describe('fitTree – đối chiếu với scikit-learn', () => {
  for (const c of reference.cases) {
    describe(`${c.criterion}, độ sâu tối đa ${c.maxDepth}`, () => {
      const tree = fitTree(reference.x, reference.y, 3, { criterion: c.criterion as Criterion, maxDepth: c.maxDepth });

      test('cấu trúc cây (thứ tự nút, đặc trưng, ngưỡng, số mẫu) khớp', () => {
        expect(tree.nodes).toHaveLength(c.feature.length);
        tree.nodes.forEach((node, i) => {
          expect(node.samples).toBe(c.samples[i]);
          expect(node.impurity).toBeCloseTo(c.impurity[i]!, 9);
          if (node.split === null) {
            expect(c.childrenLeft[i]).toBe(-1);
          } else {
            expect(node.split.feature).toBe(c.feature[i]);
            // scikit-learn ép dữ liệu về float32 trước khi tách, nên ngưỡng chỉ khớp tới độ chính xác float32
            expect(node.split.threshold).toBeCloseTo(c.threshold[i]!, 6);
            expect(node.split.left).toBe(c.childrenLeft[i]);
            expect(node.split.right).toBe(c.childrenRight[i]);
          }
        });
      });

      test('độ quan trọng của đặc trưng khớp', () => {
        featureImportances(tree).forEach((v, i) => expect(v).toBeCloseTo(c.featureImportances[i]!, 9));
      });

      test('dự đoán trên điểm mới khớp', () => {
        expect(reference.queries.map((q) => predictTree(tree, q).label)).toEqual(c.predictions);
      });
    });
  }
});

describe('impurity', () => {
  test('Gini và entropy (log cơ số 2) của các phân bố quen thuộc', () => {
    expect(impurity([5, 5], 'gini')).toBeCloseTo(0.5);
    expect(impurity([10, 0], 'gini')).toBe(0);
    expect(impurity([5, 5], 'entropy')).toBeCloseTo(1);
    expect(impurity([2, 2, 2, 2], 'entropy')).toBeCloseTo(2);
    expect(impurity([0, 0], 'gini')).toBe(0);
  });
});

describe('fitTree – quy tắc dừng', () => {
  const xs = [[0], [1], [2], [3]];

  test('nút thuần nhất không tách nữa', () => {
    const tree = fitTree(xs, [1, 1, 1, 1], 2, { criterion: 'gini', maxDepth: null });
    expect(tree.nodes).toHaveLength(1);
    expect(predictTree(tree, [9]).label).toBe(1);
  });

  test('không giới hạn độ sâu thì học thuộc toàn bộ dữ liệu', () => {
    const ys = [0, 1, 0, 1];
    const tree = fitTree(xs, ys, 2, { criterion: 'gini', maxDepth: null });
    xs.forEach((x, i) => expect(predictTree(tree, x).label).toBe(ys[i]));
  });

  test('độ sâu 0 chỉ có nút gốc, đoán lớp đông nhất', () => {
    const tree = fitTree(xs, [0, 1, 1, 1], 2, { criterion: 'gini', maxDepth: 0 });
    expect(tree.nodes).toHaveLength(1);
    expect(predictTree(tree, [0]).label).toBe(1);
  });

  test('mọi đặc trưng giống nhau thì không tách được', () => {
    const tree = fitTree([[1], [1]], [0, 1], 2, { criterion: 'gini', maxDepth: null });
    expect(tree.nodes).toHaveLength(1);
  });

  test('đường đi dự đoán liệt kê các nút từ gốc tới lá', () => {
    const tree = fitTree(xs, [0, 0, 1, 1], 2, { criterion: 'gini', maxDepth: 3 });
    const result = predictTree(tree, [3]);
    expect(result.path[0]).toBe(0);
    expect(tree.nodes[result.path.at(-1)!]!.split).toBeNull();
    expect(result.proba).toEqual([0, 1]);
  });

  test('báo lỗi với dữ liệu rỗng', () => {
    expect(() => fitTree([], [], 2, { criterion: 'gini', maxDepth: 2 })).toThrow(RangeError);
  });
});
