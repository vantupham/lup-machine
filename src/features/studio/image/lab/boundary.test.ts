import { predictProba } from '@/core/ml/softmax-regression';
import { argmax } from '@/core/ml/metrics';
import { pointBounds, trainBoundary, GRID_SIZE } from './boundary';

const points = [
  { x: 100, y: -5, label: 0 },
  { x: 110, y: 5, label: 0 },
  { x: 120, y: 0, label: 0 },
  { x: 300, y: -5, label: 1 },
  { x: 310, y: 5, label: 1 },
  { x: 320, y: 0, label: 1 },
];

describe('trainBoundary', () => {
  test('tách được 2 cụm; lưới khớp đúng mô hình trên tọa độ GỐC (đã gộp chuẩn hóa)', () => {
    const bounds = pointBounds(points);
    const b = trainBoundary(points, bounds)!;
    expect(b.trainAccuracy).toBe(1);
    expect(b.grid.size).toBe(GRID_SIZE);
    for (const p of points) expect(argmax(predictProba(b.params, [p.x, p.y]))).toBe(p.label);
    // ô trái giữa thuộc lớp 0, ô phải giữa thuộc lớp 1
    const midRow = Math.floor(GRID_SIZE / 2) * GRID_SIZE;
    expect(b.grid.classes[midRow]).toBe(0);
    expect(b.grid.classes[midRow + GRID_SIZE - 1]).toBe(1);
  });

  test('chỉ 1 lớp thì không vẽ', () => {
    expect(trainBoundary(points.filter((p) => p.label === 0), pointBounds(points))).toBeNull();
  });

  test('pointBounds có lề và không suy biến khi các điểm trùng nhau', () => {
    const b = pointBounds([{ x: 1, y: 1 }, { x: 1, y: 1 }]);
    expect(b.maxX).toBeGreaterThan(b.minX);
    expect(b.maxY).toBeGreaterThan(b.minY);
  });
});
