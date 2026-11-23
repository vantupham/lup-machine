/**
 * Gradient descent trên các "mặt lỗi" 2 biến có công thức và đạo hàm chính xác.
 * Mỗi bước: (x, y) ← (x, y) − η·∇f(x, y).
 */
export type SurfaceId = 'bowl' | 'valley' | 'two-minima';

export const SURFACE_IDS: readonly SurfaceId[] = ['bowl', 'valley', 'two-minima'];

export interface Surface {
  readonly id: SurfaceId;
  /** Công thức hiển thị cho học sinh. */
  readonly formula: string;
  readonly f: (x: number, y: number) => number;
  readonly grad: (x: number, y: number) => readonly [number, number];
  /** Cực tiểu toàn cục. */
  readonly minimum: readonly [number, number];
  readonly range: number;
}

export const SURFACES: Readonly<Record<SurfaceId, Surface>> = {
  bowl: {
    id: 'bowl',
    formula: 'f(x, y) = x² + y²',
    f: (x, y) => x * x + y * y,
    grad: (x, y) => [2 * x, 2 * y],
    minimum: [0, 0],
    range: 2,
  },
  valley: {
    id: 'valley',
    formula: 'f(x, y) = x² + 10y²',
    f: (x, y) => x * x + 10 * y * y,
    grad: (x, y) => [2 * x, 20 * y],
    minimum: [0, 0],
    range: 2,
  },
  'two-minima': {
    id: 'two-minima',
    formula: 'f(x, y) = (x² − 1)² + 0.3x + y²',
    f: (x, y) => (x * x - 1) ** 2 + 0.3 * x + y * y,
    grad: (x, y) => [4 * x * (x * x - 1) + 0.3, 2 * y],
    // nghiệm của 4x³ − 4x + 0.3 = 0 gần x = −1 (cực tiểu sâu hơn)
    minimum: [-1.035579, 0],
    range: 2,
  },
};

export interface GdStep {
  readonly x: number;
  readonly y: number;
  readonly loss: number;
}

export interface GdRun {
  readonly steps: GdStep[];
  /** true khi các bước "văng" ra xa (η quá lớn). */
  readonly diverged: boolean;
}

const DIVERGE_LIMIT = 1e6;

export function runGradientDescent(surface: Surface, start: readonly [number, number], learningRate: number, maxSteps: number): GdRun {
  const steps: GdStep[] = [{ x: start[0], y: start[1], loss: surface.f(start[0], start[1]) }];
  for (let i = 0; i < maxSteps; i++) {
    const { x, y } = steps.at(-1) as GdStep;
    const [gx, gy] = surface.grad(x, y);
    const nx = x - learningRate * gx;
    const ny = y - learningRate * gy;
    const loss = surface.f(nx, ny);
    if (!Number.isFinite(loss) || Math.abs(nx) > DIVERGE_LIMIT || Math.abs(ny) > DIVERGE_LIMIT) {
      return { steps, diverged: true };
    }
    steps.push({ x: nx, y: ny, loss });
  }
  return { steps, diverged: false };
}

export interface LineFitStep {
  readonly w: number;
  readonly b: number;
  readonly mse: number;
}

/** Gradient descent cho đường thẳng ŷ = w·x + b, hàm mất mát MSE. */
export function fitLineByGradientDescent(
  xs: readonly number[],
  ys: readonly number[],
  learningRate: number,
  steps: number,
  start: { w: number; b: number } = { w: 0, b: 0 },
): LineFitStep[] {
  if (xs.length === 0) throw new RangeError('Cần ít nhất một điểm dữ liệu');
  const n = xs.length;
  const mseOf = (w: number, b: number) => xs.reduce((s, x, i) => s + (w * x + b - (ys[i] as number)) ** 2, 0) / n;
  const history: LineFitStep[] = [{ ...start, mse: mseOf(start.w, start.b) }];
  for (let k = 0; k < steps; k++) {
    const { w, b } = history.at(-1) as LineFitStep;
    let gw = 0;
    let gb = 0;
    xs.forEach((x, i) => {
      const err = w * x + b - (ys[i] as number);
      gw += (2 / n) * err * x;
      gb += (2 / n) * err;
    });
    const nw = w - learningRate * gw;
    const nb = b - learningRate * gb;
    history.push({ w: nw, b: nb, mse: mseOf(nw, nb) });
  }
  return history;
}
