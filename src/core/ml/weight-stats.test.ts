import reference from '@/core/trace/softmax-trace.reference.json';
import { lossAndGradient, trainSoftmax, type LabeledVectors } from './softmax-regression';
import { batchesPerEpoch, batchLosses, replayBatch } from './train-step';
import { cellAt, rowDelta, topActivating, updateNorms, weightNorms, weightRow } from './weight-stats';

const train: LabeledVectors = { xs: reference.input.xs.map((r) => Float32Array.from(r)), ys: reference.input.ys };
const options = reference.input.options;
const params = [...trainSoftmax(train, null, options)].map((s) => s.params);

describe('số đo trọng số theo epoch', () => {
  test('hàng của lớp k và phần thay đổi giữa hai epoch', () => {
    const k = 1;
    const row = weightRow(params[2]!, k);
    expect(row).toHaveLength(params[2]!.dim);
    expect(row[0]).toBe(params[2]!.weights[k * params[2]!.dim]);
    const delta = rowDelta(params[2]!, params[1]!, k);
    expect(delta[0]).toBeCloseTo(params[2]!.weights[k * params[2]!.dim]! - params[1]!.weights[k * params[1]!.dim]!, 12);
  });

  test('độ lớn trọng số mỗi epoch; độ lớn phần thay đổi (epoch 0 không có)', () => {
    const norms = weightNorms(params);
    expect(norms).toHaveLength(options.epochs + 1);
    norms.forEach((n) => expect(n).toBeGreaterThan(0));
    const updates = updateNorms(params);
    expect(updates[0]).toBeNull();
    updates.slice(1).forEach((u) => expect(u).toBeGreaterThan(0));
  });

  test('ảnh bật mạnh một đặc trưng nhất (bằng nhau thì ảnh đứng trước)', () => {
    expect(topActivating([[0.1, 5], [0.9, 5], [0.5, 5]], 0)).toEqual([1, 2, 0]);
    expect(topActivating([[0.1, 5], [0.9, 5], [0.5, 5]], 1, 2)).toEqual([0, 1]);
  });

  test('ô được bấm trên lưới 64 cột', () => {
    expect(cellAt(0, 0, 64, 1280)).toBe(0);
    expect(cellAt(0.999, 0.999, 64, 1280)).toBe(1279);
    expect(cellAt(0.5, 0.04, 64, 1280)).toBe(32);
    expect(cellAt(0.5, 0.05, 64, 1280)).toBe(96);
    expect(cellAt(1.2, -0.1, 64, 1280)).toBe(63);
  });
});

describe('loss từng lô', () => {
  test('mỗi epoch một số lô; loss lô đầu khớp lại khi tính trên trọng số trước lô đó', () => {
    const losses = batchLosses(train, null, options);
    expect(losses).toHaveLength(options.epochs * batchesPerEpoch(train.xs.length, options.batchSize));
    const replay = replayBatch(train, null, options, { epoch: 2, batch: 1 });
    const again = lossAndGradient(replay.before, replay.indices.map((i) => train.xs[i]!), replay.indices.map((i) => train.ys[i]!)).loss;
    expect(losses[batchesPerEpoch(train.xs.length, options.batchSize) + 1]).toBe(again);
  });
});
