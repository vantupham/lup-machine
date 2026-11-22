/**
 * Công cụ giải thích dự đoán. Mọi hàm đều tính CHÍNH XÁC trên mô hình thật và có đẳng thức kiểm chứng được.
 *
 * Bản đồ kích hoạt lớp (CAM): tầng phân loại là tuyến tính trên trung bình không gian,
 *   logit_c = Σ_k W[c,k] · mean_ij A[i,j,k] + b_c = mean_ij ( Σ_k W[c,k] · A[i,j,k] ) + b_c
 * nên bản đồ M_c[i,j] = Σ_k W[c,k] · A[i,j,k] cho biết mỗi ô đóng góp bao nhiêu vào logit.
 * Với kiến trúc này, Grad-CAM (Selvaraju et al., 2017) trùng với CAM (Zhou et al., 2016) đến một hằng số.
 */
import { argmax } from './metrics';
import { predictProba, computeLogits, type SoftmaxParams } from './softmax-regression';

export interface SpatialShape {
  readonly height: number;
  readonly width: number;
  readonly channels: number;
}

function assertSize(spatial: ArrayLike<number>, shape: SpatialShape): void {
  if (spatial.length !== shape.height * shape.width * shape.channels) {
    throw new RangeError(`Kích hoạt có ${spatial.length} giá trị, cần ${shape.height}×${shape.width}×${shape.channels}`);
  }
}

/** Trung bình theo không gian (global average pooling): H×W×C → C. */
export function globalAveragePool(spatial: ArrayLike<number>, shape: SpatialShape): Float32Array {
  assertSize(spatial, shape);
  const cells = shape.height * shape.width;
  const out = new Float64Array(shape.channels);
  for (let cell = 0; cell < cells; cell++) {
    for (let k = 0; k < shape.channels; k++) out[k]! += (spatial[cell * shape.channels + k] as number) / cells;
  }
  return Float32Array.from(out);
}

/** M_c[i,j] = Σ_k W[c,k]·A[i,j,k] (có dấu: dương = ủng hộ lớp c, âm = chống lại). Độ dài H×W. */
export function classActivationMap(
  spatial: ArrayLike<number>,
  shape: SpatialShape,
  params: SoftmaxParams,
  classIndex: number,
): Float64Array {
  assertSize(spatial, shape);
  if (classIndex < 0 || classIndex >= params.numClasses) throw new RangeError(`Lớp ${classIndex} ngoài phạm vi`);
  if (params.dim !== shape.channels) throw new RangeError('Số kênh kích hoạt không khớp với trọng số');
  const cells = shape.height * shape.width;
  const offset = classIndex * params.dim;
  const map = new Float64Array(cells);
  for (let cell = 0; cell < cells; cell++) {
    let s = 0;
    for (let k = 0; k < shape.channels; k++) s += params.weights[offset + k]! * (spatial[cell * shape.channels + k] as number);
    map[cell] = s;
  }
  return map;
}

export interface Contribution {
  readonly feature: number;
  readonly value: number;
  readonly weight: number;
  readonly contribution: number;
}

export interface LogitBreakdown {
  readonly classIndex: number;
  readonly logit: number;
  readonly bias: number;
  readonly top: readonly Contribution[];
  /** Tổng đóng góp của các đặc trưng không nằm trong top. */
  readonly otherSum: number;
}

/** logit_c = Σ_k w_k·x_k + b, tách ra các đặc trưng đóng góp nhiều nhất (theo trị tuyệt đối). */
export function logitBreakdown(params: SoftmaxParams, x: ArrayLike<number>, classIndex: number, topN: number): LogitBreakdown {
  const offset = classIndex * params.dim;
  const all: Contribution[] = Array.from({ length: params.dim }, (_, k) => {
    const weight = params.weights[offset + k]!;
    const value = x[k] as number;
    return { feature: k, value, weight, contribution: weight * value };
  });
  const sorted = [...all].sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  const top = sorted.slice(0, topN);
  const otherSum = sorted.slice(topN).reduce((s, c) => s + c.contribution, 0);
  const bias = params.bias[classIndex]!;
  return { classIndex, logit: computeLogits(params, x)[classIndex]!, bias, top, otherSum };
}

export interface ThresholdPoint {
  readonly threshold: number;
  readonly answered: number;
  readonly correct: number;
  /** Tỉ lệ ảnh mô hình dám trả lời. */
  readonly coverage: number;
  /** Độ chính xác trên các ảnh đã trả lời; null nếu không trả lời ảnh nào. */
  readonly accuracy: number | null;
}

/** Chỉ chấp nhận dự đoán có độ tin cậy ≥ ngưỡng; còn lại trả lời "không chắc chắn". */
export function thresholdCurve(
  predictions: readonly { readonly confidence: number; readonly isCorrect: boolean }[],
  thresholds: readonly number[],
): ThresholdPoint[] {
  return thresholds.map((threshold) => {
    const kept = predictions.filter((p) => p.confidence >= threshold);
    const correct = kept.filter((p) => p.isCorrect).length;
    return {
      threshold,
      answered: kept.length,
      correct,
      coverage: predictions.length === 0 ? 0 : kept.length / predictions.length,
      accuracy: kept.length === 0 ? null : correct / kept.length,
    };
  });
}

export interface Bounds {
  readonly minX: number;
  readonly maxX: number;
  readonly minY: number;
  readonly maxY: number;
}

export interface DecisionGrid {
  readonly size: number;
  /** Lớp dự đoán tại tâm mỗi ô, theo hàng từ trên xuống (y giảm dần), cột từ trái sang. */
  readonly classes: Uint8Array;
  readonly confidence: Float32Array;
}

/** Tô vùng quyết định của một mô hình 2 chiều: tính dự đoán tại tâm từng ô của lưới size × size. */
export function decisionGrid(params: SoftmaxParams, bounds: Bounds, size: number): DecisionGrid {
  if (params.dim !== 2) throw new RangeError('Chỉ vẽ được ranh giới cho mô hình 2 chiều');
  const classes = new Uint8Array(size * size);
  const confidence = new Float32Array(size * size);
  const dx = (bounds.maxX - bounds.minX) / size;
  const dy = (bounds.maxY - bounds.minY) / size;
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const p = predictProba(params, [bounds.minX + (col + 0.5) * dx, bounds.maxY - (row + 0.5) * dy]);
      const best = argmax(p);
      classes[row * size + col] = best;
      confidence[row * size + col] = p[best]!;
    }
  }
  return { size, classes, confidence };
}
