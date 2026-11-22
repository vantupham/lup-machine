import { createRng } from '@/core/random/seeded-rng';
import {
  initParams,
  lossAndGradient,
  predictProba,
  trainSoftmax,
  type LabeledVectors,
  type SoftmaxParams,
  type TrainOptions,
} from './softmax-regression';

/** Ba cụm tách biệt trong không gian 4 chiều. */
function blobs(perClass: number, seed: number): LabeledVectors {
  const rng = createRng(seed);
  const centers = [
    [3, 0, 0, 0],
    [0, 3, 0, 0],
    [0, 0, 3, 0],
  ];
  const xs: Float32Array[] = [];
  const ys: number[] = [];
  centers.forEach((c, label) => {
    for (let i = 0; i < perClass; i++) {
      xs.push(Float32Array.from(c.map((v) => v + (rng() - 0.5))));
      ys.push(label);
    }
  });
  return { xs, ys };
}

const OPTIONS: TrainOptions = { epochs: 30, learningRate: 0.05, batchSize: 8, seed: 7 };

describe('predictProba', () => {
  test('xác suất các lớp có tổng bằng 1 và đúng công thức softmax', () => {
    const params: SoftmaxParams = {
      numClasses: 2,
      dim: 2,
      weights: Float32Array.from([1, 0, 0, 1]),
      bias: Float32Array.from([0, 0]),
    };
    const p = predictProba(params, Float32Array.from([2, 0]));
    expect(p[0]! + p[1]!).toBeCloseTo(1, 10);
    expect(p[0]).toBeCloseTo(Math.exp(2) / (Math.exp(2) + 1), 6);
  });

  test('ổn định số học với logit rất lớn', () => {
    const params: SoftmaxParams = { numClasses: 2, dim: 1, weights: Float32Array.from([1000, -1000]), bias: new Float32Array(2) };
    const p = predictProba(params, Float32Array.from([1]));
    expect(Number.isFinite(p[0])).toBe(true);
    expect(p[0]).toBeCloseTo(1, 10);
  });
});

describe('lossAndGradient – kiểm tra đạo hàm bằng sai phân số', () => {
  test('đạo hàm giải tích khớp với đạo hàm số', () => {
    const data = blobs(3, 1);
    const params = initParams(4, 3, createRng(3));
    const { gradW, gradB } = lossAndGradient(params, data.xs, data.ys);
    const h = 1e-3;
    const lossAt = (p: SoftmaxParams) => lossAndGradient(p, data.xs, data.ys).loss;

    for (const i of [0, 5, 11]) {
      const plus = { ...params, weights: Float32Array.from(params.weights) };
      const minus = { ...params, weights: Float32Array.from(params.weights) };
      plus.weights[i]! += h;
      minus.weights[i]! -= h;
      expect(gradW[i]).toBeCloseTo((lossAt(plus) - lossAt(minus)) / (2 * h), 3);
    }
    const plusB = { ...params, bias: Float32Array.from(params.bias) };
    const minusB = { ...params, bias: Float32Array.from(params.bias) };
    plusB.bias[1]! += h;
    minusB.bias[1]! -= h;
    expect(gradB[1]).toBeCloseTo((lossAt(plusB) - lossAt(minusB)) / (2 * h), 3);
  });
});

describe('trainSoftmax', () => {
  const train = blobs(20, 11);
  const testSet = blobs(5, 12);

  test('epoch 0 là trạng thái trước khi học, sau đó có đúng số epoch', () => {
    const snaps = [...trainSoftmax(train, testSet, OPTIONS)];
    expect(snaps.map((s) => s.epoch)).toEqual(Array.from({ length: 31 }, (_, i) => i));
  });

  test('loss giảm và đạt độ chính xác cao trên dữ liệu tách biệt', () => {
    const snaps = [...trainSoftmax(train, testSet, OPTIONS)];
    const first = snaps[0]!;
    const last = snaps.at(-1)!;
    expect(last.train.loss).toBeLessThan(first.train.loss / 5);
    expect(last.train.accuracy).toBe(1);
    expect(last.test?.accuracy).toBe(1);
  });

  test('cùng seed cho cùng kết quả (tái lập)', () => {
    const a = [...trainSoftmax(train, testSet, OPTIONS)].at(-1)!;
    const b = [...trainSoftmax(train, testSet, OPTIONS)].at(-1)!;
    expect(Array.from(a.params.weights)).toEqual(Array.from(b.params.weights));
  });

  test('mỗi snapshot là bản sao độc lập (không bị epoch sau ghi đè)', () => {
    const snaps = [...trainSoftmax(train, null, OPTIONS)];
    expect(Array.from(snaps[1]!.params.weights)).not.toEqual(Array.from(snaps[2]!.params.weights));
    expect(snaps[1]!.test).toBeNull();
  });

  test('từ chối dữ liệu hoặc tham số không hợp lệ', () => {
    expect(() => [...trainSoftmax({ xs: [], ys: [] }, null, OPTIONS)]).toThrow(RangeError);
    expect(() => [...trainSoftmax(train, null, { ...OPTIONS, epochs: 0 })]).toThrow(RangeError);
    expect(() => [...trainSoftmax(train, null, { ...OPTIONS, learningRate: -1 })]).toThrow(RangeError);
    expect(() => [...trainSoftmax({ xs: train.xs, ys: train.ys.slice(1) }, null, OPTIONS)]).toThrow(RangeError);
  });
});
