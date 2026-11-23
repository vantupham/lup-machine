import { fitLinearRegression } from './linear-regression';
import { fitLineByGradientDescent, runGradientDescent, SURFACE_IDS, SURFACES } from './gradient-descent';

describe('mặt lỗi', () => {
  test.each(SURFACE_IDS)('%s: đạo hàm công thức khớp sai phân số', (id) => {
    const s = SURFACES[id];
    const h = 1e-6;
    for (const [x, y] of [[0.7, -0.4], [-1.3, 0.9], [0.1, 0.2]] as const) {
      const [gx, gy] = s.grad(x, y);
      expect(gx).toBeCloseTo((s.f(x + h, y) - s.f(x - h, y)) / (2 * h), 5);
      expect(gy).toBeCloseTo((s.f(x, y + h) - s.f(x, y - h)) / (2 * h), 5);
    }
  });

  test.each(SURFACE_IDS)('%s: gradient bằng 0 tại cực tiểu', (id) => {
    const [gx, gy] = SURFACES[id].grad(...SURFACES[id].minimum);
    expect(Math.abs(gx)).toBeLessThan(1e-3);
    expect(Math.abs(gy)).toBeLessThan(1e-3);
  });
});

describe('runGradientDescent', () => {
  test('η vừa phải: viên bi lăn về đáy chén, loss giảm dần', () => {
    const run = runGradientDescent(SURFACES.bowl, [1.5, -1], 0.1, 100);
    expect(run.diverged).toBe(false);
    const last = run.steps.at(-1)!;
    expect(Math.hypot(last.x, last.y)).toBeLessThan(1e-6);
    for (let i = 1; i < run.steps.length; i++) expect(run.steps[i]!.loss).toBeLessThan(run.steps[i - 1]!.loss);
  });

  test('η quá lớn: các bước văng ra xa và bị phát hiện', () => {
    const run = runGradientDescent(SURFACES.bowl, [1, 1], 1.2, 200);
    expect(run.diverged).toBe(true);
  });

  test('mặt có hai hố: điểm xuất phát quyết định rơi vào hố nào', () => {
    const left = runGradientDescent(SURFACES['two-minima'], [-1.5, 0.5], 0.05, 400).steps.at(-1)!;
    const right = runGradientDescent(SURFACES['two-minima'], [1.5, 0.5], 0.05, 400).steps.at(-1)!;
    expect(left.x).toBeCloseTo(-1.0356, 3);
    expect(right.x).toBeGreaterThan(0.9); // kẹt ở cực tiểu địa phương
    expect(right.loss).toBeGreaterThan(left.loss);
  });
});

describe('fitLineByGradientDescent', () => {
  test('hội tụ về cùng đường thẳng với nghiệm bình phương tối thiểu', () => {
    const xs = [-1, -0.5, 0, 0.4, 1];
    const ys = [-2.1, -0.9, 0.2, 1, 2.2];
    const exact = fitLinearRegression(xs.map((x) => [x]), ys);
    const last = fitLineByGradientDescent(xs, ys, 0.3, 500).at(-1)!;
    expect(last.w).toBeCloseTo(exact.weights[0]!, 6);
    expect(last.b).toBeCloseTo(exact.intercept, 6);
  });

  test('báo lỗi khi không có dữ liệu', () => {
    expect(() => fitLineByGradientDescent([], [], 0.1, 5)).toThrow(RangeError);
  });
});
