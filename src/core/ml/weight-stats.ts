/**
 * Số đo trên trọng số của tầng Dense qua các epoch (bước 4, bản đồ trọng số):
 * độ lớn trọng số, độ lớn phần thay đổi mỗi epoch, hàng trọng số của một lớp, ảnh bật mạnh một đặc trưng.
 * Đầu vào là ảnh chụp trọng số sau mỗi epoch mà trang đã lưu để phát lại (không tính lại gì).
 */
import type { SoftmaxParams } from './softmax-regression';

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
