import reference from '../../../tests/fixtures/mlp-reference.json';
import { createRng } from '@/core/random/seeded-rng';
import { accuracyOf, forward, gradientStep, initMlp, lossAndGradients, predictProba, type Activation, type Mlp } from './mlp';
import { makeDataset2d } from './datasets-2d';

function fromReference(c: (typeof reference.cases)[number]): Mlp {
  const sizes = [2, ...c.hidden, 3];
  return { sizes, activation: c.activation as Activation, weights: c.initCoefs, biases: c.initIntercepts };
}

describe('mạng nơ-ron mini – đối chiếu với scikit-learn MLPClassifier', () => {
  for (const c of reference.cases) {
    describe(`tầng ẩn ${c.hidden.join('-')}, hàm kích hoạt ${c.activation}`, () => {
      const net = fromReference(c);

      test('xác suất dự đoán với cùng trọng số khớp', () => {
        reference.x.forEach((x, i) => {
          predictProba(net, x).forEach((p, k) => expect(p).toBeCloseTo(c.probaBefore[i]![k]!, 9));
        });
      });

      test('sau đúng một bước gradient descent, trọng số mới khớp', () => {
        const { net: next } = gradientStep(net, reference.x, reference.y, c.learningRate);
        next.weights.forEach((layer, l) =>
          layer.forEach((row, i) => row.forEach((w, j) => expect(w).toBeCloseTo(c.coefsAfter[l]![i]![j]!, 9))),
        );
        next.biases.forEach((layer, l) => layer.forEach((b, j) => expect(b).toBeCloseTo(c.interceptsAfter[l]![j]!, 9)));
      });
    });
  }
});

describe('mạng nơ-ron mini – tính đúng đắn', () => {
  test('đạo hàm lan truyền ngược khớp với sai phân số', () => {
    const net = initMlp([2, 4, 3, 3], 'tanh', createRng(5));
    const xs = [[0.3, -0.2], [-0.5, 0.8], [0.9, 0.1]];
    const ys = [0, 2, 1];
    const { gradWeights } = lossAndGradients(net, xs, ys);
    const h = 1e-6;
    const perturb = (delta: number): Mlp => ({
      ...net,
      weights: net.weights.map((layer, l) =>
        layer.map((row, i) => row.map((w, j) => (l === 1 && i === 2 && j === 1 ? w + delta : w))),
      ),
    });
    const numeric = (lossAndGradients(perturb(h), xs, ys).loss - lossAndGradients(perturb(-h), xs, ys).loss) / (2 * h);
    expect(gradWeights[1]![2]![1]).toBeCloseTo(numeric, 6);
  });

  test('học được bài toán XOR mà một đường thẳng không tách được', () => {
    const data = makeDataset2d('xor', 80, 0.1, 3);
    let net = initMlp([2, 6, 2], 'tanh', createRng(11));
    for (let i = 0; i < 600; i++) net = gradientStep(net, data.points, data.labels, 0.5).net;
    expect(accuracyOf(net, data.points, data.labels)).toBeGreaterThan(0.9);
  });

  test('forward trả về đầu ra từng tầng, tầng cuối là xác suất có tổng bằng 1', () => {
    const net = initMlp([2, 3, 2], 'relu', createRng(1));
    const layers = forward(net, [0.5, -0.5]);
    expect(layers.map((l) => l.length)).toEqual([2, 3, 2]);
    expect(layers[2]!.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  test('khởi tạo tái lập theo seed và không thay đổi mạng cũ khi huấn luyện', () => {
    const a = initMlp([2, 3, 2], 'tanh', createRng(9));
    expect(a).toEqual(initMlp([2, 3, 2], 'tanh', createRng(9)));
    const before = JSON.stringify(a);
    gradientStep(a, [[1, 1]], [0], 0.1);
    expect(JSON.stringify(a)).toBe(before);
  });

  test('báo lỗi với cấu trúc không hợp lệ', () => {
    expect(() => initMlp([2], 'tanh', createRng(1))).toThrow(RangeError);
  });
});
