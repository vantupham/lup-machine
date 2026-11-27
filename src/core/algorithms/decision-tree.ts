/**
 * Cây quyết định phân loại (CART), tách nhị phân "x[đặc trưng] ≤ ngưỡng".
 * Khớp DecisionTreeClassifier của scikit-learn: ngưỡng là trung điểm hai giá trị liền kề,
 * entropy dùng log cơ số 2, nút được đánh số theo thứ tự duyệt sâu (trái trước).
 * Khác biệt duy nhất: khi hai đặc trưng cho cùng mức cải thiện, ta chọn đặc trưng có số thứ tự nhỏ hơn
 * (scikit-learn duyệt đặc trưng theo thứ tự ngẫu nhiên).
 */
import type { Vector } from './knn';

export type Criterion = 'gini' | 'entropy';

export interface TreeOptions {
  readonly criterion: Criterion;
  /** null = không giới hạn độ sâu. */
  readonly maxDepth: number | null;
  readonly minSamplesSplit?: number;
  readonly minSamplesLeaf?: number;
}

export interface TreeSplit {
  readonly feature: number;
  readonly threshold: number;
  readonly left: number;
  readonly right: number;
}

export interface TreeNode {
  readonly id: number;
  readonly depth: number;
  readonly samples: number;
  /** Số mẫu của từng lớp trong nút. */
  readonly counts: readonly number[];
  readonly impurity: number;
  readonly split: TreeSplit | null;
}

export interface DecisionTree {
  readonly numClasses: number;
  readonly numFeatures: number;
  readonly criterion: Criterion;
  readonly nodes: readonly TreeNode[];
}

export interface TreePrediction {
  readonly label: number;
  readonly proba: readonly number[];
  /** Các nút đi qua, từ gốc tới lá. */
  readonly path: readonly number[];
}

const FEATURE_THRESHOLD = 1e-7; // như scikit-learn: hai giá trị gần hơn mức này coi là bằng nhau
const PURE_EPSILON = Number.EPSILON;

export function impurity(counts: readonly number[], criterion: Criterion): number {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total === 0) return 0;
  let value = criterion === 'gini' ? 1 : 0;
  for (const c of counts) {
    if (c === 0) continue;
    const p = c / total;
    value += criterion === 'gini' ? -p * p : -p * Math.log2(p);
  }
  return Math.max(0, value);
}

function countLabels(indices: readonly number[], ys: readonly number[], numClasses: number): number[] {
  const counts = new Array<number>(numClasses).fill(0);
  for (const i of indices) counts[ys[i] as number]! += 1;
  return counts;
}

interface BestSplit {
  readonly feature: number;
  readonly threshold: number;
  readonly left: number[];
  readonly right: number[];
}

export interface SplitCandidate {
  readonly threshold: number;
  /** Mức giảm tạp chất: tạp chất nút cha − trung bình có trọng số của hai nút con. */
  readonly improvement: number;
  /** Số mẫu sang nhánh trái (≤ ngưỡng). */
  readonly left: number;
}

/**
 * Mọi ngưỡng hợp lệ của đặc trưng `feature` tại một nút (giữa hai giá trị liền nhau khác nhau), theo thứ tự tăng.
 * Dùng cho cả việc dựng cây lẫn biểu đồ "thử mọi ngưỡng" ở bước 4.
 */
export function splitCandidates(
  indices: readonly number[],
  xs: readonly Vector[],
  ys: readonly number[],
  numClasses: number,
  feature: number,
  criterion: Criterion,
  minLeaf = 1,
): SplitCandidate[] {
  const n = indices.length;
  const parentImpurity = impurity(countLabels(indices, ys, numClasses), criterion);
  const sorted = [...indices].sort((a, b) => (xs[a]![feature] as number) - (xs[b]![feature] as number));
  const left = new Array<number>(numClasses).fill(0);
  const right = countLabels(sorted, ys, numClasses);
  const out: SplitCandidate[] = [];
  for (let p = 1; p < n; p++) {
    const moved = ys[sorted[p - 1] as number] as number;
    left[moved]! += 1;
    right[moved]! -= 1;
    const prev = xs[sorted[p - 1] as number]![feature] as number;
    const curr = xs[sorted[p] as number]![feature] as number;
    if (curr <= prev + FEATURE_THRESHOLD) continue;
    if (p < minLeaf || n - p < minLeaf) continue;
    const improvement = parentImpurity - (p / n) * impurity(left, criterion) - ((n - p) / n) * impurity(right, criterion);
    let threshold = prev / 2 + curr / 2;
    if (threshold === curr || !Number.isFinite(threshold)) threshold = prev;
    out.push({ threshold, improvement, left: p });
  }
  return out;
}

function findBestSplit(
  indices: readonly number[],
  xs: readonly Vector[],
  ys: readonly number[],
  numClasses: number,
  criterion: Criterion,
  minLeaf: number,
): BestSplit | null {
  let best: { feature: number; threshold: number; improvement: number } | null = null;
  for (let f = 0; f < (xs[0]?.length ?? 0); f++) {
    for (const c of splitCandidates(indices, xs, ys, numClasses, f, criterion, minLeaf)) {
      if (best === null || c.improvement > best.improvement) best = { feature: f, threshold: c.threshold, improvement: c.improvement };
    }
  }
  if (best === null) return null;
  const { feature, threshold } = best;
  return {
    feature,
    threshold,
    left: indices.filter((i) => (xs[i]![feature] as number) <= threshold),
    right: indices.filter((i) => (xs[i]![feature] as number) > threshold),
  };
}

/** Các mẫu (số thứ tự) rơi vào nút `nodeId`, đi từ gốc theo các câu hỏi của cây. */
export function nodeSamples(tree: DecisionTree, xs: readonly Vector[], nodeId: number): number[] {
  return xs.flatMap((x, i) => {
    let node = tree.nodes[0]!;
    while (node.id !== nodeId && node.split) node = tree.nodes[(x[node.split.feature] as number) <= node.split.threshold ? node.split.left : node.split.right]!;
    return node.id === nodeId ? [i] : [];
  });
}

export function fitTree(xs: readonly Vector[], ys: readonly number[], numClasses: number, options: TreeOptions): DecisionTree {
  if (xs.length === 0) throw new RangeError('Cần ít nhất một mẫu để dựng cây');
  if (xs.length !== ys.length) throw new RangeError('Số mẫu và số nhãn không bằng nhau');
  const minSplit = options.minSamplesSplit ?? 2;
  const minLeaf = options.minSamplesLeaf ?? 1;
  const nodes: TreeNode[] = [];

  const build = (indices: readonly number[], depth: number): number => {
    const id = nodes.length;
    const counts = countLabels(indices, ys, numClasses);
    const nodeImpurity = impurity(counts, options.criterion);
    const leaf = { id, depth, samples: indices.length, counts, impurity: nodeImpurity, split: null };
    nodes.push(leaf);

    const canSplit =
      (options.maxDepth === null || depth < options.maxDepth) &&
      indices.length >= minSplit &&
      indices.length >= 2 * minLeaf &&
      nodeImpurity > PURE_EPSILON;
    const best = canSplit
      ? findBestSplit(indices, xs, ys, numClasses, options.criterion, minLeaf)
      : null;
    if (best === null) return id;

    const left = build(best.left, depth + 1);
    const right = build(best.right, depth + 1);
    nodes[id] = { ...leaf, split: { feature: best.feature, threshold: best.threshold, left, right } };
    return id;
  };

  build(xs.map((_, i) => i), 0);
  return { numClasses, numFeatures: xs[0]?.length ?? 0, criterion: options.criterion, nodes };
}

export function predictTree(tree: DecisionTree, x: Vector): TreePrediction {
  const path: number[] = [];
  let node = tree.nodes[0] as TreeNode;
  path.push(node.id);
  while (node.split !== null) {
    const next = (x[node.split.feature] as number) <= node.split.threshold ? node.split.left : node.split.right;
    node = tree.nodes[next] as TreeNode;
    path.push(node.id);
  }
  let label = 0;
  node.counts.forEach((c, k) => {
    if (c > (node.counts[label] as number)) label = k;
  });
  return { label, proba: node.counts.map((c) => c / node.samples), path };
}

/** Tổng mức giảm tạp chất (có trọng số theo số mẫu) do mỗi đặc trưng tạo ra, chuẩn hóa để tổng bằng 1. */
export function featureImportances(tree: DecisionTree): number[] {
  const out = new Array<number>(tree.numFeatures).fill(0);
  for (const node of tree.nodes) {
    if (node.split === null) continue;
    const l = tree.nodes[node.split.left] as TreeNode;
    const r = tree.nodes[node.split.right] as TreeNode;
    out[node.split.feature]! += node.samples * node.impurity - l.samples * l.impurity - r.samples * r.impurity;
  }
  const total = out.reduce((a, b) => a + b, 0);
  return total > 0 ? out.map((v) => v / total) : out;
}
