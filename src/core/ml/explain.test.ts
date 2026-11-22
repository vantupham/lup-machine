import { createRng } from '@/core/random/seeded-rng';
import { computeLogits, initParams, predictProba, type SoftmaxParams } from './softmax-regression';
import {
  classActivationMap,
  decisionGrid,
  globalAveragePool,
  logitBreakdown,
  thresholdCurve,
  type SpatialShape,
} from './explain';

const SHAPE: SpatialShape = { height: 3, width: 3, channels: 4 };

function randomSpatial(seed: number): Float32Array {
  const rng = createRng(seed);
  return Float32Array.from({ length: 3 * 3 * 4 }, () => rng() * 2);
}

function randomParams(dim: number, classes: number, seed: number): SoftmaxParams {
  const p = initParams(dim, classes, createRng(seed));
  return { ...p, bias: Float32Array.from({ length: classes }, (_, k) => k * 0.3 - 0.2) };
}

describe('globalAveragePool', () => {
  test('trung bình từng kênh trên mọi ô', () => {
    const spatial = Float32Array.from([1, 10, 3, 30]); // 2 ô × 2 kênh
    expect(Array.from(globalAveragePool(spatial, { height: 1, width: 2, channels: 2 }))).toEqual([2, 20]);
  });
  test('từ chối dữ liệu sai kích thước', () => {
    expect(() => globalAveragePool(new Float32Array(5), SHAPE)).toThrow(RangeError);
  });
});

describe('classActivationMap (CAM = Grad-CAM với tầng phân loại tuyến tính)', () => {
  test('ĐẲNG THỨC: trung bình bản đồ + b đúng bằng logit của lớp', () => {
    const spatial = randomSpatial(1);
    const params = randomParams(4, 3, 2);
    const logits = computeLogits(params, globalAveragePool(spatial, SHAPE));
    for (let c = 0; c < 3; c++) {
      const map = classActivationMap(spatial, SHAPE, params, c);
      expect(map).toHaveLength(9);
      const mean = map.reduce((a, b) => a + b, 0) / map.length;
      expect(mean + params.bias[c]!).toBeCloseTo(logits[c]!, 5);
    }
  });

  test('ô có kích hoạt cùng hướng với trọng số của lớp thì có giá trị lớn nhất', () => {
    const spatial = new Float32Array(36);
    spatial.set([5, 0, 0, 0], 4 * 4); // ô giữa (1,1) kích hoạt mạnh kênh 0
    const params: SoftmaxParams = { numClasses: 2, dim: 4, weights: Float32Array.from([1, 0, 0, 0, -1, 0, 0, 0]), bias: new Float32Array(2) };
    const map = classActivationMap(spatial, SHAPE, params, 0);
    expect(map.indexOf(Math.max(...map))).toBe(4);
    expect(classActivationMap(spatial, SHAPE, params, 1)[4]).toBe(-5);
  });

  test('từ chối lớp ngoài phạm vi hoặc số kênh không khớp trọng số', () => {
    const params = randomParams(4, 2, 3);
    expect(() => classActivationMap(randomSpatial(1), SHAPE, params, 2)).toThrow(RangeError);
    expect(() => classActivationMap(randomSpatial(1), SHAPE, randomParams(5, 2, 3), 0)).toThrow(RangeError);
  });
});

describe('logitBreakdown (đường đi phép tính)', () => {
  test('ĐẲNG THỨC: tổng mọi đóng góp + b = logit; các đóng góp lớn nhất xếp trước', () => {
    const params = randomParams(6, 2, 4);
    const x = Float32Array.from([0.5, 2, 0, 1.5, 0.1, 3]);
    const result = logitBreakdown(params, x, 1, 3);
    expect(result.top).toHaveLength(3);
    const shown = result.top.reduce((a, t) => a + t.contribution, 0);
    expect(shown + result.otherSum + result.bias).toBeCloseTo(result.logit, 6);
    expect(result.logit).toBeCloseTo(computeLogits(params, x)[1]!, 6);
    const mags = result.top.map((t) => Math.abs(t.contribution));
    expect(mags).toEqual([...mags].sort((a, b) => b - a));
    for (const t of result.top) expect(t.contribution).toBeCloseTo(t.weight * t.value, 6);
  });
});

describe('thresholdCurve (ngưỡng tin cậy)', () => {
  const preds = [
    { confidence: 0.95, isCorrect: true },
    { confidence: 0.9, isCorrect: true },
    { confidence: 0.6, isCorrect: false },
    { confidence: 0.55, isCorrect: true },
  ];

  test('ngưỡng càng cao: trả lời ít hơn nhưng đúng nhiều hơn', () => {
    const [atZero] = thresholdCurve(preds, [0]);
    expect(atZero).toEqual({ threshold: 0, answered: 4, correct: 3, coverage: 1, accuracy: 0.75 });
    const [at07] = thresholdCurve(preds, [0.7]);
    expect(at07).toEqual({ threshold: 0.7, answered: 2, correct: 2, coverage: 0.5, accuracy: 1 });
  });

  test('không còn dự đoán nào vượt ngưỡng thì độ chính xác là null', () => {
    expect(thresholdCurve(preds, [0.99])[0]!.accuracy).toBeNull();
    expect(thresholdCurve([], [0.5])[0]!.coverage).toBe(0);
  });
});

describe('decisionGrid (ranh giới quyết định 2D)', () => {
  test('mỗi ô mang lớp dự đoán và độ tin cậy đúng như mô hình 2D tính', () => {
    // Lớp 0 khi x < 0, lớp 1 khi x > 0.
    const params: SoftmaxParams = { numClasses: 2, dim: 2, weights: Float32Array.from([-4, 0, 4, 0]), bias: new Float32Array(2) };
    const grid = decisionGrid(params, { minX: -1, maxX: 1, minY: -1, maxY: 1 }, 4);
    expect(grid.size).toBe(4);
    expect(Array.from(grid.classes)).toEqual([0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1]);
    const center = { x: -0.75, y: 0.75 }; // ô (0, 0): tâm ô bên trái trên cùng
    expect(grid.confidence[0]).toBeCloseTo(predictProba(params, [center.x, center.y])[0]!, 6);
  });

  test('từ chối mô hình không phải 2 chiều', () => {
    expect(() => decisionGrid(randomParams(3, 2, 1), { minX: 0, maxX: 1, minY: 0, maxY: 1 }, 4)).toThrow(RangeError);
  });
});
