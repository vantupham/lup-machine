/**
 * Tối ưu không ràng buộc bằng L-BFGS (bộ nhớ m cặp gần nhất) với tìm bước lùi Armijo.
 * Dùng cho các hàm lồi trơn như hồi quy logistic, nơi cần nghiệm chính xác để đối chiếu scikit-learn.
 */
export interface ValueAndGradient {
  readonly value: number;
  readonly gradient: readonly number[];
}

export interface LbfgsOptions {
  readonly maxIterations?: number;
  /** Dừng khi chuẩn vô cùng của gradient nhỏ hơn mức này. */
  readonly gradientTolerance?: number;
  readonly memory?: number;
}

export interface LbfgsResult {
  readonly x: number[];
  readonly value: number;
  readonly iterations: number;
  readonly converged: boolean;
}

const ARMIJO_C = 1e-4;
const MAX_BACKTRACKS = 60;

function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] as number) * (b[i] as number);
  return s;
}

function maxAbs(v: readonly number[]): number {
  return v.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
}

/** Hướng tìm kiếm −H·g theo vòng lặp hai lần của L-BFGS. */
function searchDirection(g: readonly number[], ss: readonly number[][], ys: readonly number[][]): number[] {
  const q = [...g];
  const alphas: number[] = [];
  for (let i = ss.length - 1; i >= 0; i--) {
    const rho = 1 / dot(ys[i]!, ss[i]!);
    const alpha = rho * dot(ss[i]!, q);
    alphas[i] = alpha;
    for (let j = 0; j < q.length; j++) q[j]! -= alpha * ys[i]![j]!;
  }
  const last = ss.length - 1;
  const gamma = last >= 0 ? dot(ss[last]!, ys[last]!) / dot(ys[last]!, ys[last]!) : 1;
  for (let j = 0; j < q.length; j++) q[j]! *= gamma;
  for (let i = 0; i < ss.length; i++) {
    const rho = 1 / dot(ys[i]!, ss[i]!);
    const beta = rho * dot(ys[i]!, q);
    for (let j = 0; j < q.length; j++) q[j]! += ss[i]![j]! * (alphas[i]! - beta);
  }
  return q.map((v) => -v);
}

export function minimizeLbfgs(
  fn: (x: readonly number[]) => ValueAndGradient,
  x0: readonly number[],
  { maxIterations = 1000, gradientTolerance = 1e-9, memory = 10 }: LbfgsOptions = {},
): LbfgsResult {
  let x = [...x0];
  let current = fn(x);
  const ss: number[][] = [];
  const ys: number[][] = [];

  for (let iter = 0; iter < maxIterations; iter++) {
    if (maxAbs(current.gradient) < gradientTolerance) return { x, value: current.value, iterations: iter, converged: true };
    let direction = searchDirection(current.gradient, ss, ys);
    let slope = dot(direction, current.gradient);
    if (!(slope < 0)) {
      // hướng không đi xuống (hiếm): bỏ bộ nhớ, quay về gradient descent
      ss.length = 0;
      ys.length = 0;
      direction = current.gradient.map((g) => -g);
      slope = dot(direction, current.gradient);
    }

    let step = 1;
    let next = x;
    let nextEval = current;
    let accepted = false;
    for (let k = 0; k < MAX_BACKTRACKS; k++) {
      next = x.map((v, i) => v + step * direction[i]!);
      nextEval = fn(next);
      if (Number.isFinite(nextEval.value) && nextEval.value <= current.value + ARMIJO_C * step * slope) {
        accepted = true;
        break;
      }
      step /= 2;
    }
    if (!accepted) return { x, value: current.value, iterations: iter, converged: maxAbs(current.gradient) < gradientTolerance * 1e3 };

    const s = next.map((v, i) => v - x[i]!);
    const y = nextEval.gradient.map((v, i) => v - current.gradient[i]!);
    if (dot(s, y) > 1e-12) {
      ss.push(s);
      ys.push(y);
      if (ss.length > memory) {
        ss.shift();
        ys.shift();
      }
    }
    x = next;
    current = nextEval;
  }
  return { x, value: current.value, iterations: maxIterations, converged: maxAbs(current.gradient) < gradientTolerance };
}
