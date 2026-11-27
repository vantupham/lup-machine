import reference from '@/core/trace/softmax-trace.reference.json';
import { lossAndGradient, trainSoftmax, type LabeledVectors } from './softmax-regression';
import { batchesPerEpoch, batchLosses, replayBatch } from './train-step';
import { cellAt, classContributions, maxAbs, rankOrder, rowDelta, topActivating, topScoring, updateNorms, weightNorms, weightRow } from './weight-stats';

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

describe('đọc trọng số theo nghĩa: đặc trưng nào cộng điểm, ảnh nào tiêu biểu', () => {
  /** 2 lớp, 3 đặc trưng. Lớp 0 dựa vào đặc trưng 0, lớp 1 dựa vào đặc trưng 2. */
  const tiny = { numClasses: 2, dim: 3, weights: Float32Array.from([2, 0.5, -1, -1, 0.25, 3]), bias: Float32Array.from([0.1, -0.1]) };
  const data: LabeledVectors = {
    xs: [Float32Array.from([1, 0, 0]), Float32Array.from([3, 2, 0]), Float32Array.from([0, 1, 2]), Float32Array.from([0, 0, 4])],
    ys: [0, 0, 1, 1],
  };

  test('đóng góp trung bình W[k, j]·x[j] trên các ảnh của lớp k, lớn nhất trước', () => {
    const top = classContributions(tiny, data, 0, 2);
    // lớp 0: x trung bình = (2, 1, 0) → đóng góp (4, 0,5, 0)
    expect(top.map((c) => c.index)).toEqual([0, 1]);
    expect(top[0]!.value).toBeCloseTo(4, 6);
    expect(top[0]!.weight).toBeCloseTo(2, 6);
    expect(top[0]!.meanX).toBeCloseTo(2, 6);
    expect(classContributions(tiny, data, 1, 1)[0]).toMatchObject({ index: 2 });
  });

  test('lớp không có ảnh nào: không có đóng góp', () => {
    expect(classContributions(tiny, { xs: data.xs, ys: [0, 0, 0, 0] }, 1, 3)).toEqual([]);
  });

  test('ảnh có điểm (logit) cao nhất cho lớp k', () => {
    // điểm lớp 1: -0,1 ; -2,6 ; 6,15 ; 11,9
    expect(topScoring(tiny, data.xs, 1, 2)).toEqual([
      { index: 3, score: expect.closeTo(11.9, 5) },
      { index: 2, score: expect.closeTo(6.15, 5) },
    ]);
  });

  test('giá trị tuyệt đối lớn nhất', () => {
    expect(maxAbs([0.5, -2, 1])).toBe(2);
    expect(maxAbs([])).toBe(0);
  });

  test('thứ tự từ lớn đến nhỏ (bằng nhau thì số thứ tự nhỏ trước)', () => {
    expect(rankOrder([0.5, -2, 3, 0.5])).toEqual([2, 0, 3, 1]);
  });

  test('trên dữ liệu huấn luyện thật: đóng góp lớn nhất của mỗi lớp là dương sau khi học', () => {
    const last = params.at(-1)!;
    for (let k = 0; k < last.numClasses; k++) {
      expect(classContributions(last, train, k, 1)[0]!.value).toBeGreaterThan(0);
    }
  });
});

