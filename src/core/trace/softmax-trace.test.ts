import { trainSoftmax, type LabeledVectors } from '@/core/ml/softmax-regression';
import reference from './softmax-trace.reference.json';
import { epochLine, pythonPercent, SOFTMAX_PROGRAM, traceSoftmaxTraining, type TraceStep } from './softmax-trace';

/** Số đối chiếu do `scripts/gen-trace-reference.py` sinh ra bằng cách chạy CHÍNH file softmax_train.py. */
const train: LabeledVectors = {
  xs: reference.input.xs.map((row) => Float32Array.from(row)),
  ys: reference.input.ys,
};
const options = reference.input.options;

function runAll(gen: Generator<TraceStep, unknown, void>): { steps: TraceStep[]; result: unknown } {
  const steps: TraceStep[] = [];
  for (;;) {
    const next = gen.next();
    if (next.done) return { steps, result: next.value };
    steps.push(next.value);
  }
}

describe('traceSoftmaxTraining', () => {
  test('in ra đúng các dòng mà bản Python in ra', () => {
    const { steps } = runAll(traceSoftmaxTraining(train, null, options));
    expect(steps.flatMap((s) => (s.output ? [s.output] : []))).toEqual(reference.output);
  });

  test('trọng số sau cùng trùng khớp mô hình của trình duyệt và gần đúng bản Python', () => {
    const { result } = runAll(traceSoftmaxTraining(train, null, options));
    const last = [...trainSoftmax(train, null, options)].at(-1)!;
    const params = result as typeof last.params;
    expect(Array.from(params.weights)).toEqual(Array.from(last.params.weights));
    expect(Array.from(params.bias)).toEqual(Array.from(last.params.bias));
    reference.final.weights.forEach((w, i) => expect(params.weights[i]).toBeCloseTo(w, 5));
    reference.final.bias.forEach((b, i) => expect(params.bias[i]).toBeCloseTo(b, 5));
  });

  test('loss của lô cuối gần đúng bản Python', () => {
    const { steps } = runAll(traceSoftmaxTraining(train, null, options));
    const loss = steps.filter((s) => 'loss' in s.changed).at(-1)!.changed.loss!;
    expect(loss.kind === 'scalar' && loss.value).toBeCloseTo(reference.final.lastBatchLoss, 5);
  });

  test('mọi bước trỏ vào một dòng có thật; dòng đầu là phần đầu vào', () => {
    const { steps } = runAll(traceSoftmaxTraining(train, null, options));
    for (const step of steps) expect(SOFTMAX_PROGRAM.lines[step.line]).toBeDefined();
    expect(SOFTMAX_PROGRAM.lines[steps[0]!.line]).toContain('Đầu vào');
    expect(Object.keys(steps[0]!.changed)).toEqual(['X_train', 'y_train', 'NUM_CLASSES', 'EPOCHS', 'LEARNING_RATE', 'BATCH_SIZE', 'SEED']);
  });

  test('số bước: mỗi lô 11 dòng, mỗi epoch thêm 4 dòng', () => {
    const { steps } = runAll(traceSoftmaxTraining(train, null, options));
    const batches = Math.ceil(train.xs.length / options.batchSize);
    expect(steps).toHaveLength(6 + options.epochs * (4 + batches * 11));
  });

  test('số lớp tính cả nhãn của tập Kiểm tra (giống trainSoftmax)', () => {
    const test = { xs: [train.xs[0]!], ys: [4] };
    const first = traceSoftmaxTraining(train, test, options).next().value as TraceStep;
    expect(first.changed.NUM_CLASSES).toEqual({ kind: 'scalar', value: 5, isInt: true });
  });

  test('lười: chỉ tính khi được hỏi bước tiếp theo', () => {
    const gen = traceSoftmaxTraining(train, null, { ...options, epochs: 100_000 });
    expect(gen.next().done).toBe(false);
  });
});

describe('định dạng kiểu Python', () => {
  test('phần trăm làm tròn nửa về số chẵn như Python', () => {
    expect(pythonPercent(0.125)).toBe('12%');
    expect(pythonPercent(0.375)).toBe('38%');
    expect(pythonPercent(10 / 11)).toBe('91%');
    expect(pythonPercent(1)).toBe('100%');
  });

  test('dòng in mỗi epoch', () => {
    expect(epochLine(3, 0.98321, 7 / 11)).toBe('epoch 3: loss 0.983, đúng 64%');
  });
});
