import { useMemo, useState } from 'react';
import { evaluateVectors, trainVectorModel, type TrainedVectorModel, type VectorData, type VectorModelSettings } from '@/core/ml/vector-classifier';
import { useVectorTrial, type TrialBase } from '@/features/trials/useVectorTrial';

export const DEFAULT_VECTOR_SETTINGS: VectorModelSettings = { kind: 'logistic', c: 1, k: 3 };

interface TrainedState {
  /** Dữ liệu và cài đặt lúc huấn luyện: khác khóa hiện tại thì mô hình đã cũ. */
  readonly key: string;
  readonly model: TrainedVectorModel;
  readonly count: number;
}

/**
 * Mô hình vector (hồi quy logistic hoặc k-NN) của một dự án âm thanh / tư thế, dùng chung cho
 * khối "Dạy máy trong 3 bước" và các bước 4–6: huấn luyện ở đâu thì chỗ kia cũng thấy.
 */
export function useVectorModel(projectId: string, trialBase: TrialBase | null, data: VectorData | null, dataKey: string) {
  const [settings, setSettings] = useState<VectorModelSettings>(DEFAULT_VECTOR_SETTINGS);
  const [trained, setTrained] = useState<TrainedState | null>(null);
  const key = JSON.stringify([dataKey, settings]);
  const current = data && trained?.key === key ? trained.model : null;
  const evaluation = useMemo(() => (current && data ? evaluateVectors(current, data) : null), [current, data]);
  const trial = useVectorTrial(projectId, trialBase, settings, data);

  /** Huấn luyện với cài đặt hiện tại (gần như tức thì) và ghi vào nhật ký. Trả về null nếu chưa đủ dữ liệu. */
  const train = (): TrainedVectorModel | null => {
    if (!data) return null;
    const model = trainVectorModel(data, settings);
    setTrained((prev) => ({ key, model, count: (prev?.count ?? 0) + 1 }));
    trial.recordTrained(model);
    return model;
  };

  return { settings, setSettings, trained, current, evaluation, key, data, trial, train };
}

export type VectorModel = ReturnType<typeof useVectorModel>;
