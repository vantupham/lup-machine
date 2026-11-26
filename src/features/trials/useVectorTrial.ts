import { evaluateVectors, type TrainedVectorModel, type VectorData, type VectorModelSettings } from '@/core/ml/vector-classifier';
import type { TrialSetupLike } from '@/core/experiments/trial-diff';
import { classificationTrial } from './trial-input';
import { useTrialLog } from './useTrialLog';

/** Phần dữ liệu và cách chia của một lần chạy (trang dự án biết); cài đặt mô hình do ModelLab thêm vào. */
export type TrialBase = Omit<TrialSetupLike, 'settings'>;

/** Nhật ký thí nghiệm cho Studio âm thanh và tư thế (bộ phân loại vector: hồi quy logistic hoặc k-NN). */
export function useVectorTrial(projectId: string, base: TrialBase, settings: VectorModelSettings, data: VectorData) {
  const log = useTrialLog(projectId);
  const setup: TrialSetupLike = { ...base, settings: { ...settings } };
  const canGuess = base.data.test > 0;
  const recordTrained = (model: TrainedVectorModel) => {
    const result = evaluateVectors(model, data);
    void log.record(classificationTrial(setup, { train: result.trainAccuracy, test: result.testAccuracy }, result.confusion), canGuess);
  };
  return { log, setup, canGuess, recordTrained };
}
