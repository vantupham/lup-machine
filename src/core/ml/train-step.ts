/**
 * "Một bước học" ở bước 4: tính lại ĐÚNG một lô của một epoch (cùng seed, cùng thứ tự trộn, cùng Adam
 * như trainSoftmax), rồi tách thành các chặng cho một ảnh trong lô: điểm (logit) → xác suất, loss →
 * sai lệch → hướng chỉnh (gradient cả lô) → cập nhật trọng số. Trọng số sau lô cuối của một epoch trùng
 * khớp tuyệt đối với ảnh chụp của epoch đó (có test).
 */
import { createRng, shuffle } from '@/core/random/seeded-rng';
import {
  AdamState,
  computeLogits,
  initParams,
  lossAndGradient,
  softmax,
  type LabeledVectors,
  type SoftmaxParams,
  type TrainOptions,
} from './softmax-regression';

export interface BatchLocation {
  /** Epoch, đếm từ 1. */
  readonly epoch: number;
  /** Lô trong epoch, đếm từ 0. */
  readonly batch: number;
}

export interface ReplayedBatch {
  /** Số thứ tự (trong tập Huấn luyện) của các ảnh trong lô. */
  readonly indices: readonly number[];
  readonly before: SoftmaxParams;
  readonly after: SoftmaxParams;
  /** Gradient trung bình của cả lô (cùng thứ tự với trọng số: hàng k là lớp k). */
  readonly gradW: Float64Array;
  readonly gradB: Float64Array;
  readonly batchLoss: number;
}

const copyParams = (p: SoftmaxParams): SoftmaxParams => ({ ...p, weights: Float32Array.from(p.weights), bias: Float32Array.from(p.bias) });

export function batchesPerEpoch(trainSize: number, batchSize: number): number {
  return Math.ceil(trainSize / batchSize);
}

interface Run {
  readonly rng: () => number;
  readonly params: SoftmaxParams;
  readonly adamW: AdamState;
  readonly adamB: AdamState;
  readonly indices: readonly number[];
  readonly perEpoch: number;
}

/** Trạng thái ban đầu giống hệt trainSoftmax: cùng seed, cùng khởi tạo, cùng thứ tự lấy số ngẫu nhiên. */
function startRun(train: LabeledVectors, test: LabeledVectors | null, options: TrainOptions): Run {
  const rng = createRng(options.seed);
  const numClasses = Math.max(...train.ys, ...(test?.ys ?? [])) + 1;
  const params = initParams(train.xs[0]!.length, numClasses, rng);
  return {
    rng,
    params,
    adamW: new AdamState(params.weights.length),
    adamB: new AdamState(params.bias.length),
    indices: train.xs.map((_, i) => i),
    perEpoch: batchesPerEpoch(train.xs.length, options.batchSize),
  };
}

/** Các lô của một epoch (trộn bằng rng của lần chạy, như trainSoftmax). */
function epochBatches(run: Run, batchSize: number): number[][] {
  const order = shuffle(run.indices, run.rng);
  return Array.from({ length: run.perEpoch }, (_, b) => order.slice(b * batchSize, (b + 1) * batchSize));
}

/** Một bước học trên một lô: tính loss, gradient rồi để Adam chỉnh trọng số (thay đổi run.params tại chỗ). */
function runBatch(run: Run, train: LabeledVectors, batch: readonly number[], learningRate: number) {
  const result = lossAndGradient(run.params, batch.map((i) => train.xs[i]!), batch.map((i) => train.ys[i]!));
  run.adamW.apply(run.params.weights, result.gradW, learningRate);
  run.adamB.apply(run.params.bias, result.gradB, learningRate);
  return result;
}

/** Chạy lại huấn luyện từ đầu tới đúng lô cần xem (lô đó chạy luôn, giữ lại trọng số trước / sau). */
export function replayBatch(train: LabeledVectors, test: LabeledVectors | null, options: TrainOptions, at: BatchLocation): ReplayedBatch {
  const perEpoch = batchesPerEpoch(train.xs.length, options.batchSize);
  if (!(Number.isInteger(at.epoch) && at.epoch >= 1 && at.epoch <= options.epochs)) throw new RangeError(`Epoch phải từ 1 đến ${options.epochs}`);
  if (!(Number.isInteger(at.batch) && at.batch >= 0 && at.batch < perEpoch)) throw new RangeError(`Lô phải từ 0 đến ${perEpoch - 1}`);
  const run = startRun(train, test, options);
  for (let epoch = 1; epoch <= at.epoch; epoch++) {
    for (const [b, batch] of epochBatches(run, options.batchSize).entries()) {
      const isTarget = epoch === at.epoch && b === at.batch;
      const before = isTarget ? copyParams(run.params) : null;
      const { loss, gradW, gradB } = runBatch(run, train, batch, options.learningRate);
      if (before) return { indices: batch, before, after: copyParams(run.params), gradW, gradB, batchLoss: loss };
    }
  }
  throw new Error('Không tới được lô cần xem');
}

/** Loss trung bình của từng lô, theo đúng thứ tự huấn luyện (mọi epoch). Tính lại cả lần huấn luyện. */
export function batchLosses(train: LabeledVectors, test: LabeledVectors | null, options: TrainOptions): number[] {
  const run = startRun(train, test, options);
  const losses: number[] = [];
  for (let epoch = 1; epoch <= options.epochs; epoch++) {
    for (const batch of epochBatches(run, options.batchSize)) losses.push(runBatch(run, train, batch, options.learningRate).loss);
  }
  return losses;
}

export interface SampleStep {
  readonly x: Float32Array;
  readonly label: number;
  readonly logits: Float64Array;
  readonly proba: Float64Array;
  /** −log p[nhãn đúng] của riêng ảnh này. */
  readonly loss: number;
  /** p − đáp án (one-hot). */
  readonly error: Float64Array;
  /** Hàng trọng số của lớp đúng: gradient cả lô và mức thay đổi thật sau Adam. */
  readonly gradRow: Float64Array;
  readonly deltaRow: Float64Array;
  readonly probaAfter: Float64Array;
  readonly lossAfter: number;
}

const LOG_EPSILON = 1e-12;

/** Các chặng cho ảnh thứ `position` trong lô. */
export function explainSample(train: LabeledVectors, replay: ReplayedBatch, position: number): SampleStep {
  const index = replay.indices[position];
  if (index === undefined) throw new RangeError('Ảnh không có trong lô');
  const x = train.xs[index]!;
  const label = train.ys[index]!;
  const { before, after } = replay;
  const logits = computeLogits(before, x);
  const proba = softmax(logits);
  const error = proba.map((p, k) => p - (k === label ? 1 : 0));
  const row = (arr: ArrayLike<number>) => Float64Array.from({ length: before.dim }, (_, j) => arr[label * before.dim + j] as number);
  const deltaRow = Float64Array.from({ length: before.dim }, (_, j) => after.weights[label * before.dim + j]! - before.weights[label * before.dim + j]!);
  const probaAfter = softmax(computeLogits(after, x));
  return {
    x,
    label,
    logits,
    proba,
    loss: -Math.log(Math.max(proba[label]!, LOG_EPSILON)),
    error,
    gradRow: row(replay.gradW),
    deltaRow,
    probaAfter,
    lossAfter: -Math.log(Math.max(probaAfter[label]!, LOG_EPSILON)),
  };
}

/** Các đặc trưng đóng góp nhiều nhất (theo |W·x|) vào điểm của lớp `k`. */
export function topContributions(params: SoftmaxParams, x: ArrayLike<number>, k: number, count = 3): { index: number; value: number }[] {
  return Array.from({ length: params.dim }, (_, j) => ({ index: j, value: params.weights[k * params.dim + j]! * (x[j] as number) }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value) || a.index - b.index)
    .slice(0, count);
}
