/**
 * PCA 2 thành phần bằng phép lặp lũy thừa (power iteration) trên ma trận dữ liệu đã trừ trung bình.
 * Không lập ma trận hiệp phương sai d×d (d = 1280 rất lớn) → mỗi vòng lặp chỉ tốn O(n·d).
 * Kết quả được kiểm thử đối chiếu với sklearn.decomposition.PCA.
 */
import { createRng } from '@/core/random/seeded-rng';

type Row = ArrayLike<number>;

export interface PcaModel {
  readonly mean: Float64Array;
  readonly components: readonly [Float64Array, Float64Array];
  /** Tỉ lệ phương sai mỗi trục giữ lại được (trên tổng phương sai). */
  readonly explainedVarianceRatio: readonly [number, number];
}

const MAX_ITERATIONS = 1000;
const CONVERGENCE_TOLERANCE = 1e-11;
const PCA_SEED = 1;

function validate(rows: readonly Row[]): number {
  if (rows.length < 2) throw new RangeError('PCA cần ít nhất 2 mẫu');
  const dim = rows[0]!.length;
  if (dim === 0 || rows.some((r) => r.length !== dim)) throw new RangeError('Các mẫu phải cùng số chiều');
  return dim;
}

function centered(rows: readonly Row[], dim: number): { mean: Float64Array; data: Float64Array[] } {
  const mean = new Float64Array(dim);
  for (const r of rows) for (let j = 0; j < dim; j++) mean[j]! += (r[j] as number) / rows.length;
  const data = rows.map((r) => Float64Array.from({ length: dim }, (_, j) => (r[j] as number) - mean[j]!));
  return { mean, data };
}

function dot(a: Float64Array, b: Float64Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * b[i]!;
  return s;
}

function normalize(v: Float64Array): number {
  const norm = Math.sqrt(dot(v, v));
  if (norm > 0) for (let i = 0; i < v.length; i++) v[i]! /= norm;
  return norm;
}

/** w = Xcᵀ (Xc v), trực giao hóa với các thành phần đã tìm. */
function applyCovariance(data: Float64Array[], v: Float64Array, previous: readonly Float64Array[]): Float64Array {
  const w = new Float64Array(v.length);
  for (const row of data) {
    const s = dot(row, v);
    for (let j = 0; j < w.length; j++) w[j]! += s * row[j]!;
  }
  for (const p of previous) {
    const proj = dot(w, p);
    for (let j = 0; j < w.length; j++) w[j]! -= proj * p[j]!;
  }
  return w;
}

/** Dấu quy ước: phần tử có trị tuyệt đối lớn nhất mang dấu dương → kết quả ổn định. */
function fixSign(v: Float64Array): void {
  let maxIdx = 0;
  for (let i = 1; i < v.length; i++) if (Math.abs(v[i]!) > Math.abs(v[maxIdx]!)) maxIdx = i;
  if (v[maxIdx]! < 0) for (let i = 0; i < v.length; i++) v[i]! *= -1;
}

function topComponent(data: Float64Array[], dim: number, previous: readonly Float64Array[], seed: number): Float64Array {
  const rng = createRng(seed);
  let v: Float64Array = Float64Array.from({ length: dim }, () => rng() - 0.5);
  normalize(v);
  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const w = applyCovariance(data, v, previous);
    if (normalize(w) === 0) return new Float64Array(dim);
    // So sánh trực tiếp hai vector liên tiếp (đã cùng hướng) — chặt hơn so sánh cos.
    const sign = dot(w, v) < 0 ? -1 : 1;
    let change = 0;
    for (let j = 0; j < dim; j++) change = Math.max(change, Math.abs(sign * w[j]! - v[j]!));
    v = w;
    if (change < CONVERGENCE_TOLERANCE) break;
  }
  fixSign(v);
  return v;
}

function varianceAlong(data: Float64Array[], v: Float64Array): number {
  let s = 0;
  for (const row of data) s += dot(row, v) ** 2;
  return s / (data.length - 1);
}

export function fitPca2(rows: readonly Row[]): PcaModel {
  const dim = validate(rows);
  const { mean, data } = centered(rows, dim);
  const totalVariance = data.reduce((sum, r) => sum + dot(r, r), 0) / (data.length - 1);

  const first = topComponent(data, dim, [], PCA_SEED);
  const second = topComponent(data, dim, [first], PCA_SEED + 1);
  const ratio = (v: Float64Array) => (totalVariance === 0 ? 0 : varianceAlong(data, v) / totalVariance);

  return { mean, components: [first, second], explainedVarianceRatio: [ratio(first), ratio(second)] };
}

/** Tọa độ 2D của một mẫu: chiếu (x − trung bình) lên hai thành phần chính. */
export function projectPca(model: PcaModel, row: Row): [number, number] {
  let a = 0;
  let b = 0;
  for (let j = 0; j < model.mean.length; j++) {
    const c = (row[j] as number) - model.mean[j]!;
    a += c * model.components[0][j]!;
    b += c * model.components[1][j]!;
  }
  return [a, b];
}
