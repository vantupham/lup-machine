import type { SoftmaxParams } from '@/core/ml/softmax-regression';
import evaluateRef from './evaluate.reference.json';
import predictRef from './predict.reference.json';
import { EVALUATE_PROGRAM, PREDICT_PROGRAM, recallLine, totalLine, traceEvaluate, tracePredict } from './evaluate-trace';
import type { TraceStep } from './trace-value';

const all = (gen: Generator<TraceStep, unknown, void>) => [...(gen as Iterable<TraceStep>)];
const outputs = (steps: readonly TraceStep[]) => steps.flatMap((s) => (s.output ? [s.output] : []));

function paramsOf(weights: readonly (readonly number[])[], bias: readonly number[]): SoftmaxParams {
  return { numClasses: weights.length, dim: weights[0]!.length, weights: Float32Array.from(weights.flat()), bias: Float32Array.from(bias) };
}

describe('traceEvaluate', () => {
  const input = {
    xs: evaluateRef.input.xs.map((x) => Float32Array.from(x)),
    ys: evaluateRef.input.ys,
    params: paramsOf(evaluateRef.input.weights, evaluateRef.input.bias),
    classNames: ['A', 'B', 'C'],
  };

  test('in ra đúng như bản Python (lớp không có ảnh thì bỏ qua)', () => {
    expect(outputs(all(traceEvaluate(input)))).toEqual(evaluateRef.output);
  });

  test('mọi bước trỏ vào dòng có thật; mỗi ảnh 2 dòng khi đếm vào ma trận', () => {
    const steps = all(traceEvaluate(input));
    for (const s of steps) expect(EVALUATE_PROGRAM.lines[s.line]).toBeDefined();
    const addLine = EVALUATE_PROGRAM.lines.findIndex((l) => l.includes('matrix[actual, guess] += 1'));
    expect(steps.filter((s) => s.line === addLine)).toHaveLength(input.ys.length);
  });

  test('định dạng dòng in', () => {
    expect(totalLine(1, 8)).toBe('đúng 1/8 ảnh (12.5%)');
    expect(recallLine('A', 1, 8)).toBe('A: nhận ra 1/8 (12%)');
  });
});

describe('tracePredict', () => {
  const params = paramsOf(predictRef.weights, predictRef.bias);

  test.each(predictRef.cases.map((c, i) => [i, c] as const))('ảnh %i: in ra đúng như bản Python', (_i, c) => {
    const steps = all(tracePredict({ vector: Float32Array.from(c.vector), params, classNames: ['A', 'B', 'C'], uncertainBelow: 0.6, size: 224 }));
    expect(outputs(steps)).toEqual(c.output);
    for (const s of steps) expect(PREDICT_PROGRAM.lines[s.line]).toBeDefined();
  });
});
