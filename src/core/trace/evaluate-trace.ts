/**
 * Vết chạy của `evaluate.py` (bước 5 Đánh giá) và `predict.py` (bước 6 Sử dụng) của Studio ảnh.
 * Xác suất tính bằng chính `predictProba` của mô hình trên trang, nên ma trận nhầm lẫn và câu trả lời
 * trùng với những gì giao diện đang hiện.
 */
import { argmax } from '@/core/ml/metrics';
import { computeLogits, predictProba, type SoftmaxParams } from '@/core/ml/softmax-regression';
import { createProgram, lineOf, type PythonProgram } from './program';
import { pythonPercent, pythonStringList } from './python-format';
import { array, scalar, text, type TraceStep } from './trace-value';
import evaluateSource from './python/evaluate.py?raw';
import predictSource from './python/predict.py?raw';

export const EVALUATE_PROGRAM = createProgram('evaluate.py', evaluateSource);
export const PREDICT_PROGRAM = createProgram('predict.py', predictSource);

const step = (line: number, changed: TraceStep['changed'] = {}, output?: string): TraceStep =>
  output === undefined ? { line, changed, epoch: 0 } : { line, changed, epoch: 0, output };

const linesOf = <K extends string>(program: PythonProgram, anchors: Record<K, string>) =>
  Object.fromEntries(Object.entries<string>(anchors).map(([k, a]) => [k, lineOf(program, a)])) as Record<K, number>;

const EVAL = linesOf(EVALUATE_PROGRAM, {
  inputs: '# Đầu vào',
  p: 'p = softmax(X @ W.T',
  predicted: 'predicted = p.argmax(',
  correct: 'correct = int(',
  printTotal: 'print(f"đúng {correct}',
  k: 'k = len(CLASS_NAMES)',
  matrix: 'matrix = np.zeros(',
  loop: 'for actual, guess in zip(',
  add: 'matrix[actual, guess] += 1',
  classLoop: 'for c in range(k)',
  ifEmpty: 'if matrix[c].sum() == 0',
  skip: 'continue  #',
  printClass: 'print(f"{CLASS_NAMES[c]}: nhận ra',
});

export interface EvaluateInput {
  readonly xs: readonly Float32Array[];
  readonly ys: readonly number[];
  readonly params: SoftmaxParams;
  readonly classNames: readonly string[];
}

export function totalLine(correct: number, total: number): string {
  return `đúng ${correct}/${total} ảnh (${pythonPercent(correct / total, 1)})`;
}

export function recallLine(name: string, hit: number, support: number): string {
  return `${name}: nhận ra ${hit}/${support} (${pythonPercent(hit / support)})`;
}

function inputsStep({ xs, ys, params, classNames }: EvaluateInput): TraceStep {
  return step(EVAL.inputs, {
    X: array(xs[0] ?? [], { shape: [xs.length, params.dim], view: 'X[0, :3]' }),
    y: array(ys, { shape: [ys.length], isInt: true, size: 6 }),
    W: array(params.weights, { shape: [params.numClasses, params.dim], view: 'W[0, :3]' }),
    b: array(params.bias, { shape: [params.numClasses], size: params.numClasses }),
    CLASS_NAMES: text(pythonStringList(classNames)),
  });
}

/** Chấm điểm một tập bằng mô hình đang xem, từng dòng. */
export function* traceEvaluate(input: EvaluateInput): Generator<TraceStep, void, void> {
  const { xs, ys, params, classNames } = input;
  const n = ys.length;
  const k = classNames.length;
  yield inputsStep(input);
  const probs = xs.map((x) => predictProba(params, x));
  yield step(EVAL.p, { p: array(probs[0] ?? [], { shape: [n, params.numClasses], view: 'p[0]', size: params.numClasses }) });
  const predicted = probs.map((p) => argmax(p));
  yield step(EVAL.predicted, { predicted: array(predicted, { shape: [n], isInt: true, size: 6 }) });
  const correct = predicted.filter((p, i) => p === ys[i]).length;
  yield step(EVAL.correct, { correct: scalar(correct, true) });
  yield step(EVAL.printTotal, {}, totalLine(correct, n));
  yield step(EVAL.k, { k: scalar(k, true) });
  const matrix = Array.from({ length: k }, () => new Array<number>(k).fill(0));
  yield step(EVAL.matrix, { matrix: array(matrix.flat(), { shape: [k, k], view: 'matrix[0]', isInt: true, size: k }) });
  for (let i = 0; i < n; i++) {
    yield step(EVAL.loop, { actual: scalar(ys[i]!, true), guess: scalar(predicted[i]!, true) });
    matrix[ys[i]!]![predicted[i]!]! += 1;
    yield step(EVAL.add, { matrix: array(matrix[ys[i]!]!, { shape: [k, k], view: `matrix[${ys[i]}]`, isInt: true, size: k }) });
  }
  for (let c = 0; c < k; c++) {
    yield step(EVAL.classLoop, { c: scalar(c, true) });
    yield step(EVAL.ifEmpty);
    const support = matrix[c]!.reduce((a, v) => a + v, 0);
    if (support === 0) {
      yield step(EVAL.skip);
      continue;
    }
    yield step(EVAL.printClass, {}, recallLine(classNames[c]!, matrix[c]![c]!, support));
  }
}

const PRED = linesOf(PREDICT_PROGRAM, {
  inputs: '# Đầu vào',
  x: 'x = mobilenet_v2(',
  logits: 'logits = W @ x + b',
  p: 'p = softmax(logits',
  best: 'best = int(',
  loop: 'for c in range(len(CLASS_NAMES))',
  printClass: 'print(f"{CLASS_NAMES[c]}: {p[c]',
  ifUnsure: 'if p[best] < UNCERTAIN_BELOW',
  printUnsure: 'print(f"Máy chưa chắc',
  printGuess: 'print(f"Máy đoán',
});
const ELSE_LINE = lineOf(PREDICT_PROGRAM, 'else:');

export interface PredictInput {
  readonly vector: Float32Array;
  readonly params: SoftmaxParams;
  readonly classNames: readonly string[];
  readonly uncertainBelow: number;
  /** Cạnh ảnh (224). */
  readonly size: number;
}

/** Dự đoán một ảnh mới, từng dòng. */
export function* tracePredict({ vector, params, classNames, uncertainBelow, size }: PredictInput): Generator<TraceStep, void, void> {
  const k = params.numClasses;
  yield step(PRED.inputs, {
    image: text(`(${size}, ${size}, 3)`),
    W: array(params.weights, { shape: [k, params.dim], view: 'W[0, :3]' }),
    b: array(params.bias, { shape: [k], size: k }),
    CLASS_NAMES: text(pythonStringList(classNames)),
    UNCERTAIN_BELOW: scalar(uncertainBelow),
  });
  yield step(PRED.x, { x: array(vector, { shape: [vector.length], view: 'x[:3]' }) });
  yield step(PRED.logits, { logits: array(computeLogits(params, vector), { shape: [k], size: k }) });
  const p = predictProba(params, vector);
  yield step(PRED.p, { p: array(p, { shape: [k], size: k }) });
  const best = argmax(p);
  yield step(PRED.best, { best: scalar(best, true) });
  for (let c = 0; c < classNames.length; c++) {
    yield step(PRED.loop, { c: scalar(c, true) });
    yield step(PRED.printClass, {}, `${classNames[c]}: ${pythonPercent(p[c]!, 1)}`);
  }
  yield step(PRED.ifUnsure);
  if (p[best]! < uncertainBelow) {
    yield step(PRED.printUnsure, {}, `Máy chưa chắc: cao nhất chỉ ${pythonPercent(p[best]!, 1)}`);
  } else {
    yield step(ELSE_LINE);
    yield step(PRED.printGuess, {}, `Máy đoán: ${classNames[best]}`);
  }
}
