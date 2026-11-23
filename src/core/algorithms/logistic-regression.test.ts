import reference from '../../../tests/fixtures/logistic-reference.json';
import { minimizeLbfgs } from './lbfgs';
import { fitLogisticRegression, predictLogistic, predictLogisticProba } from './logistic-regression';

const COEF_DIGITS = 6;

describe('fitLogisticRegression – đối chiếu với scikit-learn', () => {
  for (const [name, set, numClasses] of [
    ['3 lớp (softmax)', reference.multiclass, 3],
    ['2 lớp (sigmoid)', reference.binary, 2],
  ] as const) {
    for (const c of set.cases) {
      test(`${name}, C = ${c.C}: trọng số, độ lệch và xác suất khớp`, () => {
        const model = fitLogisticRegression(set.x, set.y, numClasses, { c: c.C });
        expect(model.converged).toBe(true);
        model.weights.forEach((row, k) => row.forEach((w, j) => expect(w).toBeCloseTo(c.coef[k]![j]!, COEF_DIGITS)));
        model.intercepts.forEach((b, k) => expect(b).toBeCloseTo(c.intercept[k]!, COEF_DIGITS));
        set.x.forEach((x, i) => {
          predictLogisticProba(model, x).forEach((p, k) => expect(p).toBeCloseTo(c.proba[i]![k]!, COEF_DIGITS));
        });
      });
    }
  }
});

describe('fitLogisticRegression – quy tắc', () => {
  test('dự đoán là lớp có xác suất lớn nhất; xác suất cộng lại bằng 1', () => {
    const model = fitLogisticRegression([[-2], [-1], [1], [2]], [0, 0, 1, 1], 2);
    expect(predictLogistic(model, [-3])).toBe(0);
    expect(predictLogistic(model, [3])).toBe(1);
    expect(predictLogisticProba(model, [0.3]).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  test('C nhỏ (phạt mạnh) làm trọng số nhỏ hơn', () => {
    const xs = [[-2], [-1], [1], [2]];
    const ys = [0, 0, 1, 1];
    const loose = fitLogisticRegression(xs, ys, 2, { c: 10 });
    const strict = fitLogisticRegression(xs, ys, 2, { c: 0.01 });
    expect(Math.abs(strict.weights[0]![0]!)).toBeLessThan(Math.abs(loose.weights[0]![0]!));
  });

  test('báo lỗi với đầu vào không hợp lệ', () => {
    expect(() => fitLogisticRegression([], [], 2)).toThrow(RangeError);
    expect(() => fitLogisticRegression([[1]], [0], 1)).toThrow(RangeError);
    expect(() => fitLogisticRegression([[1]], [0], 2, { c: 0 })).toThrow(RangeError);
    expect(() => fitLogisticRegression([[1]], [0, 1], 2)).toThrow(RangeError);
  });
});

describe('minimizeLbfgs', () => {
  test('tìm cực tiểu của hàm Rosenbrock', () => {
    const result = minimizeLbfgs(([x, y]) => ({
      value: (1 - x!) ** 2 + 100 * (y! - x! * x!) ** 2,
      gradient: [-2 * (1 - x!) - 400 * x! * (y! - x! * x!), 200 * (y! - x! * x!)],
    }), [-1.2, 1]);
    expect(result.converged).toBe(true);
    expect(result.x[0]).toBeCloseTo(1, 6);
    expect(result.x[1]).toBeCloseTo(1, 6);
  });

  test('dừng ngay khi gradient đã bằng 0', () => {
    const result = minimizeLbfgs((x) => ({ value: x[0]! ** 2, gradient: [2 * x[0]!] }), [0]);
    expect(result.iterations).toBe(0);
  });
});
