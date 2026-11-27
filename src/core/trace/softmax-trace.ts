/**
 * Vết chạy của chương trình Python `softmax_train.py` (bước Huấn luyện của Studio ảnh).
 * Mỗi bước ứng với một dòng mã vừa chạy và các biến dòng đó vừa đổi. Số liệu là số THẬT:
 * dùng đúng các hàm, đúng thứ tự số ngẫu nhiên của `trainSoftmax`, nên trọng số sau cùng
 * trùng khớp với mô hình mà trình duyệt vừa huấn luyện (có test), và khớp bản Python (có số đối chiếu).
 */
import { createRng, shuffle } from '@/core/random/seeded-rng';
import {
  AdamState,
  computeLogits,
  initParams,
  lossAndGradient,
  score,
  softmax,
  type LabeledVectors,
  type SoftmaxParams,
  type TrainOptions,
} from '@/core/ml/softmax-regression';
import { createProgram, lineOf } from './program';
import { array, scalar, text, type TraceValue } from './trace-value';
import programSource from './python/softmax_train.py?raw';
import helpersSource from './python/lup_helpers.py?raw';

export const SOFTMAX_PROGRAM = createProgram('softmax_train.py', programSource);
export const HELPERS_PROGRAM = createProgram('lup_helpers.py', helpersSource);

export interface TraceStep {
  /** Dòng (đếm từ 0) vừa chạy. */
  readonly line: number;
  readonly changed: Readonly<Record<string, TraceValue>>;
  /** Dòng chữ chương trình in ra màn hình ở bước này. */
  readonly output?: string;
  /** Epoch đang chạy (0 trước vòng lặp). */
  readonly epoch: number;
}

const at = (anchor: string) => lineOf(SOFTMAX_PROGRAM, anchor);
const LINES = {
  inputs: at('# Đầu vào'),
  shape: at('n, d = X_train.shape'),
  rng: at('rng = Rng(SEED)'),
  weights: at('W = glorot('),
  bias: at('b = np.zeros('),
  adam: at('adam_W, adam_b ='),
  epoch: at('for epoch in'),
  order: at('order = shuffle('),
  start: at('for start in'),
  batch: at('batch = order['),
  xy: at('X, y = X_train[batch]'),
  logits: at('logits = X @ W.T'),
  proba: at('p = softmax('),
  loss: at('loss = -np.log('),
  error: at('error = p - one_hot('),
  gradW: at('grad_W = error.T'),
  gradB: at('grad_b = error.mean('),
  stepW: at('W = adam_W.step('),
  stepB: at('b = adam_b.step('),
  evaluate: at('train_loss, train_acc = evaluate('),
  print: at('print(f"epoch'),
} as const;

/** Làm tròn kiểu Python cho `:.0%`: đúng nửa thì về số chẵn (12,5 → 12). */
export function pythonPercent(value: number): string {
  const scaled = value * 100;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  const rounded = diff > 0.5 || (diff === 0.5 && floor % 2 !== 0) ? floor + 1 : floor;
  return `${rounded}%`;
}

export function epochLine(epoch: number, loss: number, accuracy: number): string {
  return `epoch ${epoch}: loss ${loss.toFixed(3)}, đúng ${pythonPercent(accuracy)}`;
}

const weightsView = (params: SoftmaxParams) =>
  array(params.weights, { shape: [params.numClasses, params.dim], view: 'W[0, :3]' });
const biasView = (params: SoftmaxParams) => array(params.bias, { shape: [params.numClasses], size: params.numClasses });

function inputsStep(train: LabeledVectors, numClasses: number, options: TrainOptions): TraceStep {
  const n = train.xs.length;
  const dim = train.xs[0]!.length;
  return {
    line: LINES.inputs,
    epoch: 0,
    changed: {
      X_train: array(train.xs[0]!, { shape: [n, dim], view: 'X_train[0, :3]' }),
      y_train: array(train.ys, { shape: [n], isInt: true, size: 6 }),
      NUM_CLASSES: scalar(numClasses, true),
      EPOCHS: scalar(options.epochs, true),
      LEARNING_RATE: scalar(options.learningRate),
      BATCH_SIZE: scalar(options.batchSize, true),
      SEED: scalar(options.seed, true),
    },
  };
}

/** Các bước của một lô: dự đoán, tính sai, tính hướng chỉnh, chỉnh trọng số (thay đổi `params` tại chỗ như `trainSoftmax`). */
function* batchSteps(
  params: SoftmaxParams,
  adam: { readonly w: AdamState; readonly b: AdamState },
  train: LabeledVectors,
  batch: readonly number[],
  options: TrainOptions,
  epoch: number,
): Generator<TraceStep, void, void> {
  const step = (line: number, changed: Record<string, TraceValue>): TraceStep => ({ line, changed, epoch });
  const xs = batch.map((i) => train.xs[i]!);
  const ys = batch.map((i) => train.ys[i]!);
  const k = params.numClasses;
  yield step(LINES.batch, { batch: array(batch, { shape: [batch.length], isInt: true, size: 6 }) });
  yield step(LINES.xy, {
    X: array(xs[0]!, { shape: [xs.length, params.dim], view: 'X[0, :3]' }),
    y: array(ys, { shape: [ys.length], isInt: true, size: 6 }),
  });
  const logits0 = computeLogits(params, xs[0]!);
  const p0 = softmax(logits0);
  yield step(LINES.logits, { logits: array(logits0, { shape: [xs.length, k], view: 'logits[0]', size: k }) });
  yield step(LINES.proba, { p: array(p0, { shape: [xs.length, k], view: 'p[0]', size: k }) });
  const { loss, gradW, gradB } = lossAndGradient(params, xs, ys);
  yield step(LINES.loss, { loss: scalar(loss) });
  const error0 = p0.map((v, c) => v - (c === ys[0] ? 1 : 0));
  yield step(LINES.error, { error: array(error0, { shape: [xs.length, k], view: 'error[0]', size: k }) });
  yield step(LINES.gradW, { grad_W: array(gradW, { shape: [k, params.dim], view: 'grad_W[0, :3]' }) });
  yield step(LINES.gradB, { grad_b: array(gradB, { shape: [k], size: k }) });
  adam.w.apply(params.weights, gradW, options.learningRate);
  yield step(LINES.stepW, { W: weightsView(params) });
  adam.b.apply(params.bias, gradB, options.learningRate);
  yield step(LINES.stepB, { b: biasView(params) });
}

/**
 * Chạy lại quá trình huấn luyện từng dòng một. Lười: chỉ tính khi giao diện xin bước tiếp theo.
 * `test` chỉ dùng để biết số lớp (giống `trainSoftmax`).
 */
export function* traceSoftmaxTraining(
  train: LabeledVectors,
  test: LabeledVectors | null,
  options: TrainOptions,
): Generator<TraceStep, SoftmaxParams, void> {
  const numClasses = Math.max(...train.ys, ...(test?.ys ?? [])) + 1;
  const n = train.xs.length;
  const dim = train.xs[0]!.length;
  yield inputsStep(train, numClasses, options);
  yield { line: LINES.shape, epoch: 0, changed: { n: scalar(n, true), d: scalar(dim, true) } };
  const rng = createRng(options.seed);
  yield { line: LINES.rng, epoch: 0, changed: { rng: text(`Rng(${options.seed})`) } };
  const params = initParams(dim, numClasses, rng);
  yield { line: LINES.weights, epoch: 0, changed: { W: weightsView(params) } };
  yield { line: LINES.bias, epoch: 0, changed: { b: biasView(params) } };
  const adam = { w: new AdamState(params.weights.length), b: new AdamState(params.bias.length) };
  yield { line: LINES.adam, epoch: 0, changed: { adam_W: text(`Adam((${numClasses}, ${dim}))`), adam_b: text(`Adam((${numClasses},))`) } };

  const indices = train.xs.map((_, i) => i);
  for (let epoch = 1; epoch <= options.epochs; epoch++) {
    yield { line: LINES.epoch, epoch, changed: { epoch: scalar(epoch, true) } };
    const order = shuffle(indices, rng);
    yield { line: LINES.order, epoch, changed: { order: array(order, { shape: [n], isInt: true, size: 6 }) } };
    for (let start = 0; start < n; start += options.batchSize) {
      yield { line: LINES.start, epoch, changed: { start: scalar(start, true) } };
      yield* batchSteps(params, adam, train, order.slice(start, start + options.batchSize), options, epoch);
    }
    const result = score(params, train);
    yield {
      line: LINES.evaluate,
      epoch,
      changed: { train_loss: scalar(result.loss), train_acc: scalar(result.accuracy) },
    };
    yield { line: LINES.print, epoch, changed: {}, output: epochLine(epoch, result.loss, result.accuracy) };
  }
  return params;
}
