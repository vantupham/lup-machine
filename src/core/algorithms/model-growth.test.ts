import { createRng } from '@/core/random/seeded-rng';
import { fitTree, nodeSamples, splitCandidates } from './decision-tree';
import { fitLogisticHistory, fitLogisticRegression } from './logistic-regression';

/** Dữ liệu tất định 3 lớp, 4 đặc trưng (có giá trị trùng để thử ngưỡng bị bỏ qua). */
function dataset(n = 60) {
  const rng = createRng(11);
  const ys = Array.from({ length: n }, (_, i) => i % 3);
  const xs = ys.map((y) => [y + rng() * 1.5, Math.round(rng() * 4), rng() * 2 - y * 0.3, rng()]);
  return { xs, ys };
}

describe('fitLogisticHistory: ghi lại từng vòng lặp L-BFGS', () => {
  const { xs, ys } = dataset();

  test.each([2, 3])('%i lớp: mô hình cuối trùng khớp fitLogisticRegression', (k) => {
    const labels = ys.map((y) => y % k);
    const { model, history } = fitLogisticHistory(xs, labels, k, { c: 1 });
    const direct = fitLogisticRegression(xs, labels, k, { c: 1 });
    expect(model).toEqual(direct);
    expect(history.at(-1)!.model.weights).toEqual(direct.weights);
  });

  test('vòng 0: mọi trọng số bằng 0; hàm mục tiêu không tăng qua các vòng', () => {
    const { history } = fitLogisticHistory(xs, ys, 3, { c: 1 });
    expect(history[0]!.iteration).toBe(0);
    history[0]!.model.weights.flat().forEach((w) => expect(w).toBe(0));
    history.slice(1).forEach((h, i) => expect(h.objective).toBeLessThanOrEqual(history[i]!.objective));
    expect(history.length).toBeGreaterThan(3);
  });
});

describe('cây mọc từng nút: ngưỡng thử được và ngưỡng đã chọn', () => {
  const { xs, ys } = dataset();
  const tree = fitTree(xs, ys, 3, { criterion: 'gini', maxDepth: 3 });

  test('mỗi nút: số mẫu đi tới đúng bằng số mẫu đã lưu', () => {
    for (const node of tree.nodes) expect(nodeSamples(tree, xs, node.id)).toHaveLength(node.samples);
  });

  test('ngưỡng đã chọn là ngưỡng giảm tạp chất nhiều nhất (đặc trưng khác không hơn)', () => {
    for (const node of tree.nodes.filter((n) => n.split)) {
      const indices = nodeSamples(tree, xs, node.id);
      const chosen = splitCandidates(indices, xs, ys, 3, node.split!.feature, 'gini');
      const best = chosen.reduce((a, b) => (b.improvement > a.improvement ? b : a));
      expect(best.threshold).toBe(node.split!.threshold);
      for (let f = 0; f < 4; f++) {
        for (const c of splitCandidates(indices, xs, ys, 3, f, 'gini')) expect(c.improvement).toBeLessThanOrEqual(best.improvement + 1e-12);
      }
    }
  });

  test('ngưỡng nằm giữa hai giá trị khác nhau; giá trị trùng không tạo ngưỡng', () => {
    const candidates = splitCandidates([0, 1, 2, 3], [[1], [1], [2], [4]], [0, 0, 1, 1], 2, 0, 'gini');
    expect(candidates.map((c) => c.threshold)).toEqual([1.5, 3]);
    expect(candidates[0]).toMatchObject({ left: 2, improvement: 0.5 });
  });
});
