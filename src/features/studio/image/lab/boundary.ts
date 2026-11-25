/**
 * Ranh giới quyết định CHÍNH XÁC trên bản đồ 2D: huấn luyện một mô hình phụ chỉ trên 2 tọa độ PCA,
 * rồi tô vùng mà mô hình phụ đó chọn cho từng lớp. (Mô hình chính 1280 chiều không vẽ được ranh giới 2D chính xác.)
 */
import { decisionGrid, type Bounds, type DecisionGrid } from '@/core/ml/explain';
import { trainSoftmax, type SoftmaxParams } from '@/core/ml/softmax-regression';

const BOUNDARY_OPTIONS = { epochs: 150, learningRate: 0.05, batchSize: 16, seed: 42 } as const;
export const GRID_SIZE = 48;
const PADDING_RATIO = 0.05;

export interface LabeledPoint {
  readonly x: number;
  readonly y: number;
  readonly label: number;
}

export interface Boundary2D {
  readonly grid: DecisionGrid;
  readonly bounds: Bounds;
  readonly params: SoftmaxParams;
  readonly trainAccuracy: number;
}

export function pointBounds(points: readonly { x: number; y: number }[]): Bounds {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const padX = (Math.max(...xs) - Math.min(...xs)) * PADDING_RATIO || 1;
  const padY = (Math.max(...ys) - Math.min(...ys)) * PADDING_RATIO || 1;
  return { minX: Math.min(...xs) - padX, maxX: Math.max(...xs) + padX, minY: Math.min(...ys) - padY, maxY: Math.max(...ys) + padY };
}

/** null nếu chưa đủ ít nhất 2 lớp có điểm Huấn luyện. */
export function trainBoundary(trainPoints: readonly LabeledPoint[], bounds: Bounds): Boundary2D | null {
  if (new Set(trainPoints.map((p) => p.label)).size < 2) return null;
  // Chuẩn hóa tọa độ để tốc độ học ổn định, rồi gộp phép chuẩn hóa vào trọng số → mô hình trên tọa độ gốc.
  const sx = Math.max(1e-9, (bounds.maxX - bounds.minX) / 2);
  const sy = Math.max(1e-9, (bounds.maxY - bounds.minY) / 2);
  const cx = (bounds.maxX + bounds.minX) / 2;
  const cy = (bounds.maxY + bounds.minY) / 2;
  const data = {
    xs: trainPoints.map((p) => Float32Array.from([(p.x - cx) / sx, (p.y - cy) / sy])),
    ys: trainPoints.map((p) => p.label),
  };
  let last = null;
  for (const snap of trainSoftmax(data, null, BOUNDARY_OPTIONS)) last = snap;
  const scaled = last!.params;
  const weights = new Float32Array(scaled.weights.length);
  const bias = Float32Array.from(scaled.bias);
  for (let k = 0; k < scaled.numClasses; k++) {
    const wx = scaled.weights[k * 2]! / sx;
    const wy = scaled.weights[k * 2 + 1]! / sy;
    weights[k * 2] = wx;
    weights[k * 2 + 1] = wy;
    bias[k] = bias[k]! - wx * cx - wy * cy;
  }
  const params: SoftmaxParams = { ...scaled, weights, bias };
  return { params, bounds, grid: decisionGrid(params, bounds, GRID_SIZE), trainAccuracy: last!.train.accuracy };
}
