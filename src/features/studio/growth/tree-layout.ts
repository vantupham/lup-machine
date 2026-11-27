/**
 * Bố cục sơ đồ cây quyết định đang mọc: chỉ các nút đã dựng (id < count), lá xếp đều từ trái sang phải,
 * nút trong nằm giữa hai con, mỗi tầng sâu xuống một hàng. Toạ độ theo đơn vị ô (cột, hàng), không theo pixel.
 * Cây dựng theo chiều sâu (hết nhánh trái mới tới nhánh phải), nên nhánh phải chưa dựng được giữ chỗ bằng một ô chờ.
 */
import type { DecisionTree } from '@/core/algorithms/decision-tree';

export interface PlacedNode {
  readonly id: number;
  /** Cột (có thể lẻ nửa ô với nút trong). */
  readonly col: number;
  readonly row: number;
  /** Đã tách và đã dựng con trái. */
  readonly isOpenSplit: boolean;
  /** Ô chờ: con phải của một nút đã tách nhưng máy chưa dựng tới. */
  readonly isPending: boolean;
}

export interface PlacedEdge {
  readonly from: number;
  readonly to: number;
  /** Nhánh trái = điều kiện "≤ ngưỡng" đúng. */
  readonly isLeft: boolean;
  readonly isPending: boolean;
}

export interface TreeLayout {
  readonly nodes: readonly PlacedNode[];
  readonly edges: readonly PlacedEdge[];
  /** Số cột (= số lá và ô chờ đang thấy). */
  readonly columns: number;
  /** Số hàng (= độ sâu lớn nhất + 1). */
  readonly rows: number;
}

export function treeLayout(tree: DecisionTree, count: number): TreeLayout {
  const nodes: PlacedNode[] = [];
  const edges: PlacedEdge[] = [];
  let nextLeaf = 0;
  let rows = 0;

  const leafAt = (id: number, row: number, isPending: boolean): number => {
    const col = nextLeaf++;
    rows = Math.max(rows, row + 1);
    nodes.push({ id, col, row, isOpenSplit: false, isPending });
    return col;
  };

  const place = (id: number, row: number): number => {
    const split = tree.nodes[id]!.split;
    if (split === null || split.left >= count) return leafAt(id, row, false);
    rows = Math.max(rows, row + 1);
    const left = place(split.left, row + 1);
    const isPending = split.right >= count;
    const right = isPending ? leafAt(split.right, row + 1, true) : place(split.right, row + 1);
    edges.push({ from: id, to: split.left, isLeft: true, isPending: false }, { from: id, to: split.right, isLeft: false, isPending });
    const col = (left + right) / 2;
    nodes.push({ id, col, row, isOpenSplit: true, isPending: false });
    return col;
  };

  if (count > 0 && tree.nodes.length > 0) place(0, 0);
  return { nodes: [...nodes].sort((a, b) => a.id - b.id), edges, columns: nextLeaf, rows };
}
