import type { DecisionTree, TreeNode } from '@/core/algorithms/decision-tree';
import { treeLayout } from './tree-layout';

function node(id: number, depth: number, split: TreeNode['split'] = null): TreeNode {
  return { id, depth, samples: 10, counts: [5, 5], impurity: 0.5, split };
}

/**
 *        0
 *      /   \
 *     1     2
 *          / \
 *         3   4
 */
const tree: DecisionTree = {
  numClasses: 2,
  numFeatures: 1,
  criterion: 'gini',
  nodes: [
    node(0, 0, { feature: 0, threshold: 1, left: 1, right: 2 }),
    node(1, 1),
    node(2, 1, { feature: 0, threshold: 2, left: 3, right: 4 }),
    node(3, 2),
    node(4, 2),
  ],
};

describe('treeLayout: sơ đồ cây đang mọc', () => {
  test('mới có gốc: một ô, chưa tách', () => {
    const layout = treeLayout(tree, 1);
    expect(layout.nodes).toEqual([{ id: 0, col: 0, row: 0, isOpenSplit: false, isPending: false }]);
    expect(layout.edges).toEqual([]);
    expect(layout).toMatchObject({ columns: 1, rows: 1 });
  });

  test('đủ cây: lá xếp trái sang phải, nút trong nằm giữa hai con', () => {
    const layout = treeLayout(tree, 5);
    const at = (id: number) => layout.nodes.find((n) => n.id === id)!;
    expect([at(1).col, at(3).col, at(4).col]).toEqual([0, 1, 2]);
    expect(at(2).col).toBe(1.5);
    expect(at(0).col).toBe(0.75);
    expect(at(3).row).toBe(2);
    expect(layout).toMatchObject({ columns: 3, rows: 3 });
    expect(layout.edges).toContainEqual({ from: 2, to: 3, isLeft: true, isPending: false });
    expect(layout.edges).toContainEqual({ from: 0, to: 2, isLeft: false, isPending: false });
  });

  test('cây dựng theo chiều sâu: con phải chưa dựng thì giữ chỗ bằng ô chờ', () => {
    const two = treeLayout(tree, 2);
    expect(two.nodes.map((n) => [n.id, n.isPending])).toEqual([[0, false], [1, false], [2, true]]);
    expect(two.edges).toContainEqual({ from: 0, to: 2, isLeft: false, isPending: true });
    const four = treeLayout(tree, 4);
    expect(four.nodes.map((n) => n.id)).toEqual([0, 1, 2, 3, 4]);
    expect(four.nodes.find((n) => n.id === 2)!.isOpenSplit).toBe(true);
    expect(four.nodes.find((n) => n.id === 4)!.isPending).toBe(true);
  });

  test('count = 0: không có gì', () => {
    expect(treeLayout(tree, 0)).toEqual({ nodes: [], edges: [], columns: 0, rows: 0 });
  });
});
