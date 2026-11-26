import type { ReactNode } from 'react';
import { predictVector, type TrainedVectorModel, type VectorData } from '@/core/ml/vector-classifier';
import type { FindingSample } from './StudioFindings';

/**
 * Mẫu Kiểm tra của bộ phân loại vector (âm thanh, tư thế) kèm độ tin của lớp được đoán;
 * `evidence` dựng phần xem được cho từng mẫu (nút nghe, khung xương…).
 */
export function vectorFindingSamples(
  trained: TrainedVectorModel,
  data: VectorData,
  evidence: (id: string, index: number) => ReactNode,
): FindingSample[] {
  return data.test.ids.map((id, i) => {
    const prediction = predictVector(trained, { raw: data.test.raw[i] as number[], scaled: data.test.xs[i] as number[] });
    return {
      id,
      actual: data.test.ys[i] as number,
      predicted: prediction.label,
      confidence: prediction.proba[prediction.label] ?? 0,
      evidence: evidence(id, i),
    };
  });
}
