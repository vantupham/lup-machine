import { fitTree, predictTree } from '@/core/algorithms/decision-tree';
import { makeDataset2d } from '@/core/algorithms/datasets-2d';
import { accuracyOpened, growthOrder, predictOpened, scoresByDepth, stopNode } from './tree-view';

const data = makeDataset2d('xor', 80, 0.05, 2);
const tree = fitTree(data.points, data.labels, 2, { criterion: 'gini', maxDepth: 4 });

describe('cây mọc từng bước', () => {
  test('thứ tự mở nút: gốc trước, độ sâu không giảm', () => {
    const order = growthOrder(tree);
    expect(order[0]).toBe(0);
    const depths = order.map((id) => tree.nodes[id]!.depth);
    expect([...depths].sort((a, b) => a - b)).toEqual(depths);
  });

  test('chưa mở nút nào: mọi điểm dừng ở gốc và nhận lớp đông nhất', () => {
    const opened = new Set<number>();
    expect(stopNode(tree, [0.5, 0.5], opened).id).toBe(0);
    const root = tree.nodes[0]!;
    const expected = root.counts[0]! >= root.counts[1]! ? 0 : 1;
    expect(predictOpened(tree, [0.5, 0.5], opened)).toBe(expected);
  });

  test('mở hết các nút: dự đoán trùng với cây đầy đủ', () => {
    const opened = new Set(growthOrder(tree));
    data.points.forEach((p) => expect(predictOpened(tree, p, opened)).toBe(predictTree(tree, p).label));
    expect(accuracyOpened(tree, data.points, data.labels, opened)).toBeGreaterThan(0.9);
    expect(accuracyOpened(tree, [], [], opened)).toBe(0);
  });
});

describe('scoresByDepth', () => {
  test('độ chính xác tập Dạy không giảm khi cây sâu hơn', () => {
    const test = makeDataset2d('xor', 80, 0.05, 3);
    const scores = scoresByDepth(
      { xs: data.points, ys: data.labels },
      { xs: test.points, ys: test.labels },
      2,
      'gini',
      6,
    );
    expect(scores).toHaveLength(6);
    for (let i = 1; i < scores.length; i++) expect(scores[i]!.train).toBeGreaterThanOrEqual(scores[i - 1]!.train);
  });
});
