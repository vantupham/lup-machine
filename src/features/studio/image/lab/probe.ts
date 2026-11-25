/** Bước ⑥ Sử dụng: dự đoán, giải thích bằng ví dụ và vị trí trên bản đồ cho một ảnh MỚI (không có trong dữ liệu). */
import { argmax, cosineSimilarity } from '@/core/ml/metrics';
import { fitPca2, projectPca } from '@/core/ml/pca';
import { predictProba, type SoftmaxParams } from '@/core/ml/softmax-regression';
import type { SampleRecord } from '@/storage/db';

/** Xác suất cao nhất dưới mức này thì giao diện nói rõ "mô hình chưa chắc chắn". */
export const UNCERTAIN_BELOW = 0.6;

export interface ProbePrediction {
  readonly predicted: number;
  readonly confidence: number;
  readonly isUncertain: boolean;
  readonly probabilities: Float64Array;
}

export function predictProbe(params: SoftmaxParams, vector: Float32Array): ProbePrediction {
  if (vector.length !== params.dim) {
    throw new Error(`Vector có ${vector.length} số chiều, mô hình cần ${params.dim}`);
  }
  const probabilities = predictProba(params, vector);
  const predicted = argmax(probabilities);
  const confidence = probabilities[predicted]!;
  return { predicted, confidence, isUncertain: confidence < UNCERTAIN_BELOW, probabilities };
}

export interface Neighbor {
  readonly sample: SampleRecord;
  readonly similarity: number;
}

/** "Giải thích bằng ví dụ": các ảnh Dạy có vector giống `target` nhất (độ tương đồng cosine). */
export function nearestTrainToVector(
  target: Float32Array,
  samples: readonly SampleRecord[],
  features: ReadonlyMap<string, Float32Array>,
  k: number,
  excludeId?: string,
): Neighbor[] {
  return samples
    .filter((s) => s.split === 'train' && s.id !== excludeId && features.has(s.id))
    .map((s) => ({ sample: s, similarity: cosineSimilarity(target, features.get(s.id)!) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}

export interface ProbeMap {
  readonly points: readonly (readonly [number, number])[];
  readonly explainedVarianceRatio: readonly [number, number];
  /** Chiếu một ảnh mới lên mặt phẳng đã khớp. */
  readonly project: (vector: Float32Array) => readonly [number, number];
}

/**
 * PCA khớp trên các ảnh ĐÃ CÓ (giống hệt bản đồ ở bước ③); ảnh mới chỉ được chiếu lên cùng mặt phẳng.
 * Ảnh mới không làm xê dịch bản đồ, nên chấm của nó di chuyển trên một nền đứng yên.
 * Khớp một lần, chiếu mỗi khung hình (chỉ là một phép nhân ma trận nhỏ).
 */
export function fitProbeMap(vectors: readonly Float32Array[]): ProbeMap | null {
  if (vectors.length < 2) return null;
  const model = fitPca2(vectors);
  return {
    points: vectors.map((v) => projectPca(model, v)),
    explainedVarianceRatio: [model.explainedVarianceRatio[0], model.explainedVarianceRatio[1]],
    project: (vector) => projectPca(model, vector),
  };
}
