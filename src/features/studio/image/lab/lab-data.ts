import { argmax, cosineSimilarity } from '@/core/ml/metrics';
import { predictProba, type SoftmaxParams } from '@/core/ml/softmax-regression';
import type { ClassRecord, SampleRecord } from '@/storage/db';
import type { TrainingData } from './useTraining';

export type TrainingReadiness =
  | { readonly readiness: 'need-features' }
  | { readonly readiness: 'need-classes' }
  | {
      readonly readiness: 'ready';
      readonly data: TrainingData;
      readonly trainSamples: SampleRecord[];
      readonly testSamples: SampleRecord[];
    };

const MIN_TRAINABLE_CLASSES = 2;

/** Dựng tập Dạy / Kiểm tra cho bộ phân loại: nhãn = vị trí của lớp trong danh sách lớp. */
export function buildTrainingData(
  classes: readonly ClassRecord[],
  samples: readonly SampleRecord[],
  features: ReadonlyMap<string, Float32Array>,
): TrainingReadiness {
  if (samples.some((s) => !features.has(s.id))) return { readiness: 'need-features' };
  const labelOf = new Map(classes.map((c, i) => [c.id, i]));
  const usable = samples.filter((s) => labelOf.has(s.classId));
  const trainSamples = usable.filter((s) => s.split === 'train');
  const testSamples = usable.filter((s) => s.split === 'test');
  if (new Set(trainSamples.map((s) => s.classId)).size < MIN_TRAINABLE_CLASSES) return { readiness: 'need-classes' };

  const toVectors = (list: SampleRecord[]) => ({
    xs: list.map((s) => features.get(s.id)!),
    ys: list.map((s) => labelOf.get(s.classId)!),
  });
  return {
    readiness: 'ready',
    data: { train: toVectors(trainSamples), test: testSamples.length > 0 ? toVectors(testSamples) : null },
    trainSamples,
    testSamples,
  };
}

export interface SamplePrediction {
  readonly predicted: number;
  readonly actual: number;
  readonly isCorrect: boolean;
  readonly probabilities: Float64Array;
}

export function predictSamples(
  params: SoftmaxParams,
  classes: readonly ClassRecord[],
  samples: readonly SampleRecord[],
  features: ReadonlyMap<string, Float32Array>,
): Map<string, SamplePrediction> {
  const labelOf = new Map(classes.map((c, i) => [c.id, i]));
  const result = new Map<string, SamplePrediction>();
  for (const s of samples) {
    const vector = features.get(s.id);
    const actual = labelOf.get(s.classId);
    if (!vector || actual === undefined || vector.length !== params.dim) continue;
    const probabilities = predictProba(params, vector);
    const predicted = argmax(probabilities);
    result.set(s.id, { predicted, actual, isCorrect: predicted === actual, probabilities });
  }
  return result;
}

export interface Neighbor {
  readonly sample: SampleRecord;
  readonly similarity: number;
}

/** "Giải thích bằng ví dụ": các ảnh Dạy có vector đặc trưng giống nhất (độ tương đồng cosine). */
export function nearestTrainSamples(
  sampleId: string,
  samples: readonly SampleRecord[],
  features: ReadonlyMap<string, Float32Array>,
  k: number,
): Neighbor[] {
  const target = features.get(sampleId);
  if (!target) return [];
  return samples
    .filter((s) => s.split === 'train' && s.id !== sampleId && features.has(s.id))
    .map((s) => ({ sample: s, similarity: cosineSimilarity(target, features.get(s.id)!) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}
