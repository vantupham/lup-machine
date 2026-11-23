/**
 * Hồi quy tuyến tính bình phương tối thiểu: ŷ = w·x + b.
 * Giải hệ phương trình chuẩn trên dữ liệu đã trừ trung bình (khử Gauss có chọn trụ).
 * Khớp LinearRegression của scikit-learn; đặc trưng phụ thuộc tuyến tính nhận hệ số 0.
 */
import type { Vector } from './knn';

export interface LinearModel {
  readonly weights: readonly number[];
  readonly intercept: number;
}

const SINGULAR_TOLERANCE = 1e-10;

export function predictLinear(model: LinearModel, x: Vector): number {
  let y = model.intercept;
  model.weights.forEach((w, i) => {
    y += w * (x[i] as number);
  });
  return y;
}

function mean(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Giải A·w = c; cột có trụ quá nhỏ (phụ thuộc tuyến tính) nhận nghiệm 0. */
function solveSymmetric(a: number[][], c: number[]): number[] {
  const d = c.length;
  const m = a.map((row, i) => [...row, c[i] as number]);
  const scale = Math.max(1, ...a.map((row, i) => Math.abs(row[i] as number)));
  const pivotCols: number[] = [];
  let r = 0;
  for (let col = 0; col < d && r < d; col++) {
    let best = r;
    for (let i = r + 1; i < d; i++) if (Math.abs(m[i]![col]!) > Math.abs(m[best]![col]!)) best = i;
    if (Math.abs(m[best]![col]!) <= SINGULAR_TOLERANCE * scale) continue;
    [m[r], m[best]] = [m[best]!, m[r]!];
    for (let i = 0; i < d; i++) {
      if (i === r) continue;
      const factor = m[i]![col]! / m[r]![col]!;
      for (let j = col; j <= d; j++) m[i]![j]! -= factor * m[r]![j]!;
    }
    pivotCols.push(col);
    r++;
  }
  const w = new Array<number>(d).fill(0);
  pivotCols.forEach((col, row) => {
    w[col] = m[row]![d]! / m[row]![col]!;
  });
  return w;
}

export function fitLinearRegression(xs: readonly Vector[], ys: readonly number[]): LinearModel {
  if (xs.length === 0) throw new RangeError('Cần ít nhất một điểm dữ liệu');
  if (xs.length !== ys.length) throw new RangeError('Số điểm và số giá trị y không bằng nhau');
  const d = xs[0]?.length ?? 0;
  const xMean = Array.from({ length: d }, (_, j) => mean(xs.map((x) => x[j] as number)));
  const yMean = mean(ys);

  const a = Array.from({ length: d }, () => new Array<number>(d).fill(0));
  const c = new Array<number>(d).fill(0);
  xs.forEach((x, n) => {
    const yc = (ys[n] as number) - yMean;
    for (let i = 0; i < d; i++) {
      const xi = (x[i] as number) - (xMean[i] as number);
      c[i]! += xi * yc;
      for (let j = 0; j < d; j++) a[i]![j]! += xi * ((x[j] as number) - (xMean[j] as number));
    }
  });
  const weights = solveSymmetric(a, c);
  const intercept = yMean - weights.reduce((s, w, i) => s + w * (xMean[i] as number), 0);
  return { weights, intercept };
}

export function meanSquaredError(yTrue: readonly number[], yPred: readonly number[]): number {
  if (yTrue.length === 0) throw new RangeError('Không có điểm nào để tính sai số');
  return yTrue.reduce((s, y, i) => s + (y - (yPred[i] as number)) ** 2, 0) / yTrue.length;
}

/** Hệ số xác định R² = 1 − SSE/SST (khớp quy ước của scikit-learn khi y không đổi). */
export function r2Score(yTrue: readonly number[], yPred: readonly number[]): number {
  const yMean = mean(yTrue);
  const sse = yTrue.reduce((s, y, i) => s + (y - (yPred[i] as number)) ** 2, 0);
  const sst = yTrue.reduce((s, y) => s + (y - yMean) ** 2, 0);
  if (sst === 0) return sse === 0 ? 1 : 0;
  return 1 - sse / sst;
}
