/** Hỗ trợ hiển thị cây "mọc" từng bước: mở dần các nút tách theo thứ tự từng tầng. */
import { fitTree, predictTree, type Criterion, type DecisionTree, type TreeNode } from '@/core/algorithms/decision-tree';
import type { Vector } from '@/core/algorithms/knn';

/** Các nút tách theo thứ tự tầng (gốc trước), cùng tầng thì trái trước. */
export function growthOrder(tree: DecisionTree): number[] {
  return tree.nodes
    .filter((n) => n.split !== null)
    .sort((a, b) => a.depth - b.depth || a.id - b.id)
    .map((n) => n.id);
}

function majority(node: TreeNode): number {
  return node.counts.reduce((best, c, k) => (c > (node.counts[best] as number) ? k : best), 0);
}

/** Đi từ gốc; chỉ rẽ ở nút tách đã được mở. Trả về nút dừng. */
export function stopNode(tree: DecisionTree, x: Vector, opened: ReadonlySet<number>): TreeNode {
  let node = tree.nodes[0] as TreeNode;
  while (node.split !== null && opened.has(node.id)) {
    node = tree.nodes[(x[node.split.feature] as number) <= node.split.threshold ? node.split.left : node.split.right] as TreeNode;
  }
  return node;
}

export function predictOpened(tree: DecisionTree, x: Vector, opened: ReadonlySet<number>): number {
  return majority(stopNode(tree, x, opened));
}

export function accuracyOpened(tree: DecisionTree, xs: readonly Vector[], ys: readonly number[], opened: ReadonlySet<number>): number {
  if (xs.length === 0) return 0;
  return xs.filter((x, i) => predictOpened(tree, x, opened) === ys[i]).length / xs.length;
}

export interface DepthScore {
  readonly depth: number;
  readonly train: number;
  readonly test: number;
}

/** Độ chính xác trên tập Huấn luyện và tập Kiểm tra khi giới hạn độ sâu 1..maxDepth (thấy rõ quá khớp). */
export function scoresByDepth(
  train: { xs: readonly Vector[]; ys: readonly number[] },
  test: { xs: readonly Vector[]; ys: readonly number[] },
  numClasses: number,
  criterion: Criterion,
  maxDepth: number,
): DepthScore[] {
  const acc = (tree: DecisionTree, xs: readonly Vector[], ys: readonly number[]) =>
    xs.length === 0 ? 0 : xs.filter((x, i) => predictTree(tree, x).label === ys[i]).length / xs.length;
  return Array.from({ length: maxDepth }, (_, i) => {
    const tree = fitTree(train.xs, train.ys, numClasses, { criterion, maxDepth: i + 1 });
    return { depth: i + 1, train: acc(tree, train.xs, train.ys), test: acc(tree, test.xs, test.ys) };
  });
}
