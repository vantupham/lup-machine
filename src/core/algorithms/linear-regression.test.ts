import reference from '../../../tests/fixtures/linreg-reference.json';
import { fitLinearRegression, meanSquaredError, predictLinear, r2Score } from './linear-regression';

describe('fitLinearRegression – đối chiếu với scikit-learn', () => {
  const model = fitLinearRegression(reference.x, reference.y);
  const predictions = reference.x.map((x) => predictLinear(model, x));

  test('hệ số và độ lệch khớp', () => {
    model.weights.forEach((w, i) => expect(w).toBeCloseTo(reference.coef[i]!, 9));
    expect(model.intercept).toBeCloseTo(reference.intercept, 9);
  });

  test('MSE và R² khớp', () => {
    expect(meanSquaredError(reference.y, predictions)).toBeCloseTo(reference.mse, 9);
    expect(r2Score(reference.y, predictions)).toBeCloseTo(reference.r2, 9);
  });

  test('hồi quy một biến (đường thẳng) khớp', () => {
    const simple = fitLinearRegression(reference.x.map((x) => [x[0]!]), reference.y);
    expect(simple.weights[0]).toBeCloseTo(reference.simpleCoef, 9);
    expect(simple.intercept).toBeCloseTo(reference.simpleIntercept, 9);
  });
});

describe('fitLinearRegression – trường hợp đặc biệt', () => {
  test('dữ liệu nằm đúng trên đường thẳng thì tìm lại đúng đường đó', () => {
    const model = fitLinearRegression([[0], [1], [2]], [1, 3, 5]);
    expect(model.weights[0]).toBeCloseTo(2);
    expect(model.intercept).toBeCloseTo(1);
  });

  test('đặc trưng hằng số thì hệ số bằng 0, độ lệch là trung bình', () => {
    const model = fitLinearRegression([[2], [2], [2]], [1, 2, 6]);
    expect(model.weights[0]).toBeCloseTo(0);
    expect(model.intercept).toBeCloseTo(3);
  });

  test('R² bằng 1 khi y không đổi mà dự đoán đúng, báo lỗi khi rỗng', () => {
    expect(r2Score([2, 2], [2, 2])).toBe(1);
    expect(() => fitLinearRegression([], [])).toThrow(RangeError);
    expect(() => meanSquaredError([], [])).toThrow(RangeError);
  });
});
