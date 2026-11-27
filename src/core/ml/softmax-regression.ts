/**
 * Tầng phân loại cuối: hồi quy softmax (một tầng Dense + softmax), tối ưu bằng Adam.
 *   logit_k = Σ_j W[k][j]·x[j] + b[k]      p = softmax(logit)      loss = −log p[nhãn đúng]
 * Tự cài đặt (không dùng model.fit) để: có trọng số thật sau MỖI epoch (phát lại),
 * tái lập tuyệt đối bằng seed, và kiểm thử đạo hàm bằng sai phân số.
 */
import { createRng, shuffle, type Rng } from '@/core/random/seeded-rng';
import { argmax } from './metrics';

export interface SoftmaxParams {
  readonly numClasses: number;
  readonly dim: number;
  /** Hàng k (độ dài dim) là trọng số của lớp k. */
  readonly weights: Float32Array;
  readonly bias: Float32Array;
}

export interface LabeledVectors {
  readonly xs: readonly Float32Array[];
  readonly ys: readonly number[];
}

export interface TrainOptions {
  readonly epochs: number;
  readonly learningRate: number;
  readonly batchSize: number;
  readonly seed: number;
}

export interface SplitScore {
  readonly loss: number;
  readonly accuracy: number;
}

export interface EpochSnapshot {
  readonly epoch: number;
  readonly params: SoftmaxParams;
  readonly train: SplitScore;
  readonly test: SplitScore | null;
}

const ADAM_BETA1 = 0.9;
const ADAM_BETA2 = 0.999;
const ADAM_EPSILON = 1e-8;
const LOG_EPSILON = 1e-12;

/** Khởi tạo Glorot/Xavier đều, theo seed. */
export function initParams(dim: number, numClasses: number, rng: Rng): SoftmaxParams {
  const limit = Math.sqrt(6 / (dim + numClasses));
  return {
    dim,
    numClasses,
    weights: Float32Array.from({ length: dim * numClasses }, () => (rng() * 2 - 1) * limit),
    bias: new Float32Array(numClasses),
  };
}

export function computeLogits(params: SoftmaxParams, x: ArrayLike<number>): Float64Array {
  const out = new Float64Array(params.numClasses);
  for (let k = 0; k < params.numClasses; k++) {
    let s = params.bias[k]!;
    const offset = k * params.dim;
    for (let j = 0; j < params.dim; j++) s += params.weights[offset + j]! * (x[j] as number);
    out[k] = s;
  }
  return out;
}

/** softmax ổn định số học: trừ logit lớn nhất trước khi lấy mũ. */
export function softmax(logits: Float64Array): Float64Array {
  let max = -Infinity;
  for (const v of logits) max = Math.max(max, v);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((v) => v / sum);
}

export function predictProba(params: SoftmaxParams, x: ArrayLike<number>): Float64Array {
  return softmax(computeLogits(params, x));
}

/** Cross-entropy trung bình và đạo hàm theo W, b trên một lô. */
export function lossAndGradient(
  params: SoftmaxParams,
  xs: readonly ArrayLike<number>[],
  ys: readonly number[],
): { loss: number; gradW: Float64Array; gradB: Float64Array } {
  const gradW = new Float64Array(params.weights.length);
  const gradB = new Float64Array(params.numClasses);
  let loss = 0;
  xs.forEach((x, i) => {
    const p = predictProba(params, x);
    const y = ys[i]!;
    loss -= Math.log(Math.max(p[y]!, LOG_EPSILON));
    for (let k = 0; k < params.numClasses; k++) {
      const delta = (p[k]! - (k === y ? 1 : 0)) / xs.length;
      gradB[k]! += delta;
      const offset = k * params.dim;
      for (let j = 0; j < params.dim; j++) gradW[offset + j]! += delta * (x[j] as number);
    }
  });
  return { loss: loss / xs.length, gradW, gradB };
}

export function score(params: SoftmaxParams, data: LabeledVectors): SplitScore {
  let loss = 0;
  let correct = 0;
  data.xs.forEach((x, i) => {
    const p = predictProba(params, x);
    loss -= Math.log(Math.max(p[data.ys[i]!]!, LOG_EPSILON));
    if (argmax(p) === data.ys[i]) correct += 1;
  });
  return { loss: loss / data.xs.length, accuracy: correct / data.xs.length };
}

function validate(train: LabeledVectors, options: TrainOptions): void {
  if (train.xs.length === 0) throw new RangeError('Cần ít nhất 1 mẫu để huấn luyện');
  if (train.xs.length !== train.ys.length) throw new RangeError('Số mẫu và số nhãn không bằng nhau');
  if (!(Number.isInteger(options.epochs) && options.epochs > 0)) throw new RangeError('Số epoch phải là số nguyên dương');
  if (!(options.learningRate > 0)) throw new RangeError('Tốc độ học phải lớn hơn 0');
  if (!(Number.isInteger(options.batchSize) && options.batchSize > 0)) throw new RangeError('Batch size phải là số nguyên dương');
}

export class AdamState {
  private readonly m: Float64Array;
  private readonly v: Float64Array;
  private step = 0;
  constructor(size: number) {
    this.m = new Float64Array(size);
    this.v = new Float64Array(size);
  }
  apply(target: Float32Array, grad: Float64Array, lr: number): void {
    this.step += 1;
    const c1 = 1 - ADAM_BETA1 ** this.step;
    const c2 = 1 - ADAM_BETA2 ** this.step;
    for (let i = 0; i < target.length; i++) {
      this.m[i] = ADAM_BETA1 * this.m[i]! + (1 - ADAM_BETA1) * grad[i]!;
      this.v[i] = ADAM_BETA2 * this.v[i]! + (1 - ADAM_BETA2) * grad[i]! ** 2;
      target[i]! -= (lr * (this.m[i]! / c1)) / (Math.sqrt(this.v[i]! / c2) + ADAM_EPSILON);
    }
  }
}

function snapshot(epoch: number, params: SoftmaxParams, train: LabeledVectors, test: LabeledVectors | null): EpochSnapshot {
  const copy: SoftmaxParams = { ...params, weights: Float32Array.from(params.weights), bias: Float32Array.from(params.bias) };
  return {
    epoch,
    params: copy,
    train: score(copy, train),
    test: test && test.xs.length > 0 ? score(copy, test) : null,
  };
}

/**
 * Huấn luyện từng epoch; mỗi lần gọi next() chạy đúng 1 epoch → giao diện điều khiển được tốc độ
 * (bình thường / chậm / từng bước). Epoch 0 = trạng thái ngẫu nhiên trước khi học.
 */
export function* trainSoftmax(
  train: LabeledVectors,
  test: LabeledVectors | null,
  options: TrainOptions,
): Generator<EpochSnapshot, void, void> {
  validate(train, options);
  const rng = createRng(options.seed);
  const numClasses = Math.max(...train.ys, ...(test?.ys ?? [])) + 1;
  const dim = train.xs[0]!.length;
  const params = initParams(dim, numClasses, rng);
  const adamW = new AdamState(params.weights.length);
  const adamB = new AdamState(params.bias.length);
  const indices = train.xs.map((_, i) => i);

  yield snapshot(0, params, train, test);
  for (let epoch = 1; epoch <= options.epochs; epoch++) {
    const order = shuffle(indices, rng);
    for (let start = 0; start < order.length; start += options.batchSize) {
      const batch = order.slice(start, start + options.batchSize);
      const { gradW, gradB } = lossAndGradient(
        params,
        batch.map((i) => train.xs[i]!),
        batch.map((i) => train.ys[i]!),
      );
      adamW.apply(params.weights, gradW, options.learningRate);
      adamB.apply(params.bias, gradB, options.learningRate);
    }
    yield snapshot(epoch, params, train, test);
  }
}
