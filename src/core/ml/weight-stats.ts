/**
 * Số đo trên trọng số của tầng Dense qua các epoch (bước 4, bản đồ trọng số):
 * độ lớn trọng số, độ lớn phần thay đổi mỗi epoch, hàng trọng số của một lớp, ảnh bật mạnh một đặc trưng.
 * Đầu vào là ảnh chụp trọng số sau mỗi epoch mà trang đã lưu để phát lại (không tính lại gì).
 */
import type { LabeledVectors, SoftmaxParams } from './softmax-regression';

export function weightRow(params: SoftmaxParams, k: number): Float32Array {
  return params.weights.slice(k * params.dim, (k + 1) * params.dim);
}

/** W(sau) − W(trước) của lớp k. */
export function rowDelta(after: SoftmaxParams, before: SoftmaxParams, k: number): Float64Array {
  return Float64Array.from({ length: after.dim }, (_, j) => after.weights[k * after.dim + j]! - before.weights[k * before.dim + j]!);
}

function norm(values: ArrayLike<number>): number {
  let s = 0;
  for (let i = 0; i < values.length; i++) s += (values[i] as number) ** 2;
  return Math.sqrt(s);
}

/** ‖W‖ (mọi trọng số, không tính độ lệch) sau mỗi epoch. */
export function weightNorms(snapshots: readonly SoftmaxParams[]): number[] {
  return snapshots.map((p) => norm(p.weights));
}

/** ‖W(epoch) − W(epoch − 1)‖: máy chỉnh nhiều hay ít trong epoch đó; epoch 0 là null. */
export function updateNorms(snapshots: readonly SoftmaxParams[]): (number | null)[] {
  return snapshots.map((p, e) => {
    if (e === 0) return null;
    const prev = snapshots[e - 1]!;
    let s = 0;
    for (let i = 0; i < p.weights.length; i++) s += (p.weights[i]! - prev.weights[i]!) ** 2;
    return Math.sqrt(s);
  });
}

/** Số thứ tự các vector có giá trị ở đặc trưng j lớn nhất (bằng nhau thì vector đứng trước). */
export function topActivating(vectors: readonly ArrayLike<number>[], j: number, count = 3): number[] {
  return vectors
    .map((v, i) => ({ i, value: v[j] as number }))
    .sort((a, b) => b.value - a.value || a.i - b.i)
    .slice(0, count)
    .map((e) => e.i);
}

/** Ô (0…dim−1) được bấm trên lưới `columns` cột, từ tọa độ tương đối (0–1) của cú bấm. */
export function cellAt(relX: number, relY: number, columns: number, dim: number): number {
  const rows = Math.ceil(dim / columns);
  const col = Math.min(columns - 1, Math.max(0, Math.floor(relX * columns)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor(relY * rows)));
  return Math.min(dim - 1, row * columns + col);
}

export interface Contribution {
  /** Số thứ tự đặc trưng (0…dim−1). */
  readonly index: number;
  /** W[k, j] · (trung bình x[j] trên các ảnh của lớp k): trung bình đặc trưng này cộng bao nhiêu điểm cho lớp. */
  readonly value: number;
  readonly weight: number;
  readonly meanX: number;
}

/** Các đặc trưng cộng điểm nhiều nhất cho lớp k, tính trên chính các ảnh của lớp k. */
export function classContributions(params: SoftmaxParams, data: LabeledVectors, k: number, count: number): Contribution[] {
  const members = data.xs.filter((_, i) => data.ys[i] === k);
  if (members.length === 0) return [];
  const sums = new Float64Array(params.dim);
  for (const x of members) for (let j = 0; j < params.dim; j++) sums[j]! += x[j]!;
  return Array.from({ length: params.dim }, (_, j) => {
    const meanX = sums[j]! / members.length;
    const weight = params.weights[k * params.dim + j]!;
    return { index: j, value: weight * meanX, weight, meanX };
  })
    .sort((a, b) => b.value - a.value || a.index - b.index)
    .slice(0, count);
}

/** Các ảnh có điểm (logit = W[k]·x + b[k]) cao nhất cho lớp k. */
export function topScoring(params: SoftmaxParams, xs: readonly ArrayLike<number>[], k: number, count: number): { readonly index: number; readonly score: number }[] {
  return xs
    .map((x, index) => {
      let score = params.bias[k]!;
      for (let j = 0; j < params.dim; j++) score += params.weights[k * params.dim + j]! * (x[j] as number);
      return { index, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count);
}

/** Số thứ tự các phần tử, từ giá trị lớn nhất đến nhỏ nhất (bằng nhau thì số thứ tự nhỏ trước). */
export function rankOrder(values: ArrayLike<number>): number[] {
  return Array.from({ length: values.length }, (_, i) => i).sort((a, b) => (values[b] as number) - (values[a] as number) || a - b);
}
