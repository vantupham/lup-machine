/**
 * Mạng nơ-ron nhiều tầng (MLP) mini: các tầng ẩn dùng tanh / ReLU / sigmoid, tầng ra softmax,
 * hàm mất mát cross-entropy trung bình, huấn luyện bằng gradient descent trên toàn bộ dữ liệu.
 * Bố cục trọng số giống scikit-learn: weights[l][i][j] nối nơ-ron i của tầng l với nơ-ron j của tầng l+1.
 * Một bước huấn luyện khớp MLPClassifier(solver="sgd", momentum=0, alpha=0, batch_size=n).
 */
import type { Rng } from '@/core/random/seeded-rng';
import type { Vector } from './knn';

export type Activation = 'tanh' | 'relu' | 'logistic';

export interface Mlp {
  /** Số nơ-ron mỗi tầng, gồm cả tầng vào và tầng ra. */
  readonly sizes: readonly number[];
  readonly activation: Activation;
  readonly weights: readonly (readonly (readonly number[])[])[];
  readonly biases: readonly (readonly number[])[];
}

export interface LossAndGradients {
  readonly loss: number;
  readonly gradWeights: number[][][];
  readonly gradBiases: number[][];
}

const LOG_EPSILON = 1e-12;

export function initMlp(sizes: readonly number[], activation: Activation, rng: Rng): Mlp {
  if (sizes.length < 2 || sizes.some((s) => !Number.isInteger(s) || s < 1)) {
    throw new RangeError('Mạng cần ít nhất tầng vào và tầng ra, mỗi tầng ≥ 1 nơ-ron');
  }
  const weights: number[][][] = [];
  const biases: number[][] = [];
  for (let l = 0; l < sizes.length - 1; l++) {
    const fanIn = sizes[l] as number;
    const fanOut = sizes[l + 1] as number;
    const factor = activation === 'logistic' ? 2 : 6; // như scikit-learn (Glorot)
    const bound = Math.sqrt(factor / (fanIn + fanOut));
    const uniform = () => (rng() * 2 - 1) * bound;
    weights.push(Array.from({ length: fanIn }, () => Array.from({ length: fanOut }, uniform)));
    biases.push(Array.from({ length: fanOut }, uniform));
  }
  return { sizes: [...sizes], activation, weights, biases };
}

function activate(z: number, kind: Activation): number {
  if (kind === 'tanh') return Math.tanh(z);
  if (kind === 'relu') return Math.max(0, z);
  return 1 / (1 + Math.exp(-z));
}

/** Đạo hàm của hàm kích hoạt, tính theo đầu ra a. */
function derivative(a: number, kind: Activation): number {
  if (kind === 'tanh') return 1 - a * a;
  if (kind === 'relu') return a > 0 ? 1 : 0;
  return a * (1 - a);
}

function softmax(z: readonly number[]): number[] {
  const max = Math.max(...z);
  const exps = z.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

/** Đầu ra của từng tầng (tầng 0 là dữ liệu vào, tầng cuối là xác suất softmax). */
export function forward(net: Mlp, x: Vector): number[][] {
  const layers: number[][] = [[...x]];
  const last = net.weights.length - 1;
  net.weights.forEach((w, l) => {
    const input = layers[l] as number[];
    const z = (net.biases[l] as readonly number[]).map((b, j) => input.reduce((s, a, i) => s + a * (w[i]![j] as number), b));
    layers.push(l === last ? softmax(z) : z.map((v) => activate(v, net.activation)));
  });
  return layers;
}

export function predictProba(net: Mlp, x: Vector): number[] {
  return forward(net, x).at(-1) as number[];
}

export function lossAndGradients(net: Mlp, xs: readonly Vector[], ys: readonly number[]): LossAndGradients {
  const n = xs.length;
  const gradWeights = net.weights.map((layer) => layer.map((row) => row.map(() => 0)));
  const gradBiases = net.biases.map((layer) => layer.map(() => 0));
  let loss = 0;

  xs.forEach((x, s) => {
    const layers = forward(net, x);
    const proba = layers.at(-1) as number[];
    const label = ys[s] as number;
    loss -= Math.log(Math.max(proba[label] as number, LOG_EPSILON));
    let delta = proba.map((p, k) => (p - (k === label ? 1 : 0)) / n);
    for (let l = net.weights.length - 1; l >= 0; l--) {
      const input = layers[l] as number[];
      input.forEach((a, i) => delta.forEach((d, j) => (gradWeights[l]![i]![j]! += a * d)));
      delta.forEach((d, j) => (gradBiases[l]![j]! += d));
      if (l > 0) {
        const w = net.weights[l] as readonly (readonly number[])[];
        delta = input.map((a, i) => derivative(a, net.activation) * delta.reduce((sum, d, j) => sum + d * (w[i]![j] as number), 0));
      }
    }
  });
  return { loss: loss / n, gradWeights, gradBiases };
}

/** Một bước gradient descent; trả về mạng MỚI (không sửa mạng cũ) và loss trước khi cập nhật. */
export function gradientStep(net: Mlp, xs: readonly Vector[], ys: readonly number[], learningRate: number): { net: Mlp; loss: number } {
  const { loss, gradWeights, gradBiases } = lossAndGradients(net, xs, ys);
  return {
    loss,
    net: {
      ...net,
      weights: net.weights.map((layer, l) => layer.map((row, i) => row.map((w, j) => w - learningRate * gradWeights[l]![i]![j]!))),
      biases: net.biases.map((layer, l) => layer.map((b, j) => b - learningRate * gradBiases[l]![j]!)),
    },
  };
}

export function accuracyOf(net: Mlp, xs: readonly Vector[], ys: readonly number[]): number {
  if (xs.length === 0) return 0;
  let correct = 0;
  xs.forEach((x, i) => {
    const p = predictProba(net, x);
    if (p.indexOf(Math.max(...p)) === ys[i]) correct++;
  });
  return correct / xs.length;
}
