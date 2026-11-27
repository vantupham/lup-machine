/**
 * Hồi quy logistic có điều chuẩn L2, khớp LogisticRegression (lbfgs) của scikit-learn:
 *   cực tiểu  C · Σ_i −log p(y_i | x_i)  +  ½‖W‖²     (độ lệch b không bị phạt)
 * - 2 lớp: một vector trọng số, p(lớp 2) = sigmoid(w·x + b).
 * - từ 3 lớp: mỗi lớp một vector, p = softmax(W·x + b); độ lệch được căn để tổng bằng 0 như scikit-learn.
 */
import type { Vector } from './knn';
import { minimizeLbfgs } from './lbfgs';

export interface LogisticModel {
  readonly numClasses: number;
  /** 2 lớp: một hàng (cho lớp thứ 2). Từ 3 lớp: mỗi lớp một hàng. */
  readonly weights: readonly (readonly number[])[];
  readonly intercepts: readonly number[];
  readonly converged: boolean;
}

export interface LogisticOptions {
  /** Nghịch đảo độ mạnh điều chuẩn (C lớn = phạt ít). Mặc định 1 như scikit-learn. */
  readonly c?: number;
  readonly maxIterations?: number;
  /**
   * Dừng khi mọi thành phần gradient (của hàm mục tiêu chia cho số mẫu) nhỏ hơn mức này.
   * Mặc định 1e-6: chặt hơn mặc định 1e-4 của scikit-learn mà vẫn nhanh trên trình duyệt.
   */
  readonly tolerance?: number;
  /** Gọi ở mỗi vòng lặp L-BFGS (vòng 0 = mọi trọng số bằng 0) với mô hình tạm và giá trị hàm mục tiêu. */
  readonly onIteration?: (iteration: number, model: LogisticModel, objective: number) => void;
}

export const DEFAULT_LOGISTIC_TOLERANCE = 1e-6;

const LOG_EPSILON = 1e-300;

function softmax(z: readonly number[]): number[] {
  const max = Math.max(...z);
  const e = z.map((v) => Math.exp(v - max));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

/** Điểm (logit) của từng hàng trọng số. */
export function logisticScores(model: LogisticModel, x: Vector): number[] {
  return model.weights.map((w, k) => w.reduce((s, wj, j) => s + wj * (x[j] as number), model.intercepts[k] as number));
}

export function predictLogisticProba(model: LogisticModel, x: Vector): number[] {
  const z = logisticScores(model, x);
  if (model.numClasses === 2) {
    const p = 1 / (1 + Math.exp(-(z[0] as number)));
    return [1 - p, p];
  }
  return softmax(z);
}

export function predictLogistic(model: LogisticModel, x: Vector): number {
  const p = predictLogisticProba(model, x);
  return p.indexOf(Math.max(...p));
}

export function fitLogisticRegression(
  xs: readonly Vector[],
  ys: readonly number[],
  numClasses: number,
  { c = 1, maxIterations = 2000, tolerance = DEFAULT_LOGISTIC_TOLERANCE, onIteration }: LogisticOptions = {},
): LogisticModel {
  if (xs.length === 0) throw new RangeError('Cần ít nhất một mẫu để huấn luyện');
  if (xs.length !== ys.length) throw new RangeError('Số mẫu và số nhãn không bằng nhau');
  if (numClasses < 2) throw new RangeError('Cần ít nhất 2 lớp');
  if (!(c > 0)) throw new RangeError('C phải dương');

  const d = xs[0]?.length ?? 0;
  const rows = numClasses === 2 ? 1 : numClasses;
  const stride = d + 1; // mỗi hàng: d trọng số + 1 độ lệch
  // chia cho C để hàm mục tiêu có độ lớn vừa phải (cùng nghiệm): Σ loss + ‖W‖²/(2C)
  const lambda = 1 / c;

  const objective = (params: readonly number[]) => {
    const grad = new Array<number>(params.length).fill(0);
    let value = 0;
    xs.forEach((x, n) => {
      const z = Array.from({ length: rows }, (_, k) => {
        let s = params[k * stride + d] as number;
        for (let j = 0; j < d; j++) s += (params[k * stride + j] as number) * (x[j] as number);
        return s;
      });
      const label = ys[n] as number;
      let residuals: number[];
      if (rows === 1) {
        const p = 1 / (1 + Math.exp(-(z[0] as number)));
        const target = label === 1 ? 1 : 0;
        value -= Math.log(Math.max(target === 1 ? p : 1 - p, LOG_EPSILON));
        residuals = [p - target];
      } else {
        const p = softmax(z);
        value -= Math.log(Math.max(p[label] as number, LOG_EPSILON));
        residuals = p.map((pk, k) => pk - (k === label ? 1 : 0));
      }
      residuals.forEach((r, k) => {
        for (let j = 0; j < d; j++) grad[k * stride + j]! += r * (x[j] as number);
        grad[k * stride + d]! += r;
      });
    });
    for (let k = 0; k < rows; k++) {
      for (let j = 0; j < d; j++) {
        const w = params[k * stride + j] as number;
        value += (lambda / 2) * w * w;
        grad[k * stride + j]! += lambda * w;
      }
    }
    return { value, gradient: grad };
  };

  const toModel = (x: readonly number[], converged: boolean): LogisticModel => {
    const weights = Array.from({ length: rows }, (_, k) => x.slice(k * stride, k * stride + d));
    let intercepts = Array.from({ length: rows }, (_, k) => x[k * stride + d] as number);
    if (rows > 1) {
      const mean = intercepts.reduce((a, b) => a + b, 0) / rows;
      intercepts = intercepts.map((b) => b - mean);
    }
    return { numClasses, weights, intercepts, converged };
  };
  const result = minimizeLbfgs(objective, new Array<number>(rows * stride).fill(0), {
    maxIterations,
    gradientTolerance: tolerance * xs.length,
    ...(onIteration ? { onIteration: (iteration: number, x: readonly number[], value: number) => onIteration(iteration, toModel(x, false), value) } : {}),
  });
  return toModel(result.x, result.converged);
}

export interface LogisticIterate {
  readonly iteration: number;
  /** Hàm mục tiêu: tổng loss + ‖W‖² / (2C). */
  readonly objective: number;
  readonly model: LogisticModel;
}

/** Huấn luyện như fitLogisticRegression và ghi lại mô hình sau mỗi vòng lặp L-BFGS (để phát lại ở bước 4). */
export function fitLogisticHistory(
  xs: readonly Vector[],
  ys: readonly number[],
  numClasses: number,
  options: Omit<LogisticOptions, 'onIteration'> = {},
): { readonly model: LogisticModel; readonly history: readonly LogisticIterate[] } {
  const history: LogisticIterate[] = [];
  const model = fitLogisticRegression(xs, ys, numClasses, { ...options, onIteration: (iteration, m, objective) => history.push({ iteration, objective, model: m }) });
  return { model, history };
}

/**
 * Trọng số "nghiêng về lớp c" của từng đặc trưng: 2 lớp dùng thẳng ±w (logit z = w·x + b);
 * từ 3 lớp dùng w_c − trung bình các lớp, để điểm s_c − tb(s) = (b_c − tb(b)) + Σ_j x_j · nghiêng_j.
 */
export function logisticLeaning(model: LogisticModel, c: number): number[] {
  if (model.numClasses === 2) {
    const w = model.weights[0] as readonly number[];
    return w.map((v) => (c === 1 ? v : -v));
  }
  const k = model.weights.length;
  return (model.weights[c] as readonly number[]).map((v, j) => v - model.weights.reduce((s, r) => s + (r[j] as number), 0) / k);
}

/** Phần cố định (không phụ thuộc đặc trưng) của điểm tương đối ở trên. */
export function logisticBase(model: LogisticModel, c: number): number {
  if (model.numClasses === 2) {
    const b = model.intercepts[0] as number;
    return c === 1 ? b : -b;
  }
  return (model.intercepts[c] as number) - model.intercepts.reduce((a, b) => a + b, 0) / model.intercepts.length;
}

/** Điểm tương đối của lớp c (bằng đúng logisticBase + Σ x·logisticLeaning). */
export function logisticRelativeScore(model: LogisticModel, x: Vector, c: number): number {
  const z = logisticScores(model, x);
  if (model.numClasses === 2) return c === 1 ? (z[0] as number) : -(z[0] as number);
  return (z[c] as number) - z.reduce((a, b) => a + b, 0) / z.length;
}
