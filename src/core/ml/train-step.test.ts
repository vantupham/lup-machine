import reference from '@/core/trace/softmax-trace.reference.json';
import { trainSoftmax, type LabeledVectors } from './softmax-regression';
import { batchesPerEpoch, explainSample, replayBatch, topContributions } from './train-step';

const train: LabeledVectors = { xs: reference.input.xs.map((r) => Float32Array.from(r)), ys: reference.input.ys };
const options = reference.input.options;
const snapshots = [...trainSoftmax(train, null, options)];
const lastBatch = batchesPerEpoch(train.xs.length, options.batchSize) - 1;

describe('replayBatch', () => {
  test('trọng số sau lô cuối của mỗi epoch trùng khớp tuyệt đối ảnh chụp epoch đó', () => {
    for (let epoch = 1; epoch <= options.epochs; epoch++) {
      const replay = replayBatch(train, null, options, { epoch, batch: lastBatch });
      expect(Array.from(replay.after.weights)).toEqual(Array.from(snapshots[epoch]!.params.weights));
      expect(Array.from(replay.after.bias)).toEqual(Array.from(snapshots[epoch]!.params.bias));
    }
  });

  test('trọng số trước lô đầu của epoch 1 là trọng số ngẫu nhiên ban đầu (epoch 0)', () => {
    const replay = replayBatch(train, null, options, { epoch: 1, batch: 0 });
    expect(Array.from(replay.before.weights)).toEqual(Array.from(snapshots[0]!.params.weights));
  });

  test('lô cuối có thể ít ảnh hơn; mọi ảnh của một epoch xuất hiện đúng một lần', () => {
    const seen = Array.from({ length: lastBatch + 1 }, (_, b) => replayBatch(train, null, options, { epoch: 2, batch: b }).indices).flat();
    expect([...seen].sort((a, b) => a - b)).toEqual(train.xs.map((_, i) => i));
    expect(replayBatch(train, null, options, { epoch: 2, batch: lastBatch }).indices).toHaveLength(train.xs.length - lastBatch * options.batchSize);
  });

  test('báo lỗi khi epoch hoặc lô nằm ngoài phạm vi', () => {
    expect(() => replayBatch(train, null, options, { epoch: 0, batch: 0 })).toThrow(RangeError);
    expect(() => replayBatch(train, null, options, { epoch: 1, batch: lastBatch + 1 })).toThrow(RangeError);
  });
});

describe('explainSample', () => {
  const replay = replayBatch(train, null, options, { epoch: 1, batch: 0 });
  const step = explainSample(train, replay, 0);

  test('xác suất cộng lại bằng 1; sai lệch = p − đáp án (lớp đúng âm, lớp khác dương)', () => {
    expect(step.proba.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    step.error.forEach((e, k) => (k === step.label ? expect(e).toBeLessThan(0) : expect(e).toBeGreaterThan(0)));
    expect(step.loss).toBeCloseTo(-Math.log(step.proba[step.label]!), 12);
  });

  test('sau khi chỉnh, ảnh này được đoán lớp đúng với xác suất cao hơn (bước đi ngược hướng gradient)', () => {
    expect(step.probaAfter[step.label]!).toBeGreaterThan(step.proba[step.label]!);
    expect(step.lossAfter).toBeLessThan(step.loss);
  });

  test('mức thay đổi thật ngược dấu với gradient ở mọi ô có gradient đủ lớn (đặc trưng của Adam bước đầu)', () => {
    step.gradRow.forEach((g, j) => {
      if (Math.abs(g) > 1e-6) expect(Math.sign(step.deltaRow[j]!)).toBe(-Math.sign(g));
    });
  });

  test('đóng góp lớn nhất của lớp đúng: W·x, sắp theo độ lớn', () => {
    const top = topContributions(replay.before, step.x, step.label, 2);
    expect(top).toHaveLength(2);
    expect(Math.abs(top[0]!.value)).toBeGreaterThanOrEqual(Math.abs(top[1]!.value));
  });
});
