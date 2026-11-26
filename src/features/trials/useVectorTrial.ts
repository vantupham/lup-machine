import { evaluateVectors, type TrainedVectorModel, type VectorData, type VectorModelSettings } from '@/core/ml/vector-classifier';
import type { TrialSetupLike } from '@/core/experiments/trial-diff';
import { classificationTrial } from './trial-input';
import { useTrialLog, type TrialLog } from './useTrialLog';

/** Phần dữ liệu và cách chia của một lần chạy (trang dự án biết); cài đặt mô hình do ModelLab thêm vào. */
export type TrialBase = Omit<TrialSetupLike, 'settings'>;

export interface VectorTrial<Setup extends TrialSetupLike | null> {
  readonly log: TrialLog;
  readonly setup: Setup;
  readonly canGuess: boolean;
  readonly recordTrained: (model: TrainedVectorModel) => void;
}

/** Nhật ký thí nghiệm cho Studio âm thanh và tư thế (bộ phân loại vector: hồi quy logistic hoặc k-NN). */
export function useVectorTrial(projectId: string, base: TrialBase, settings: VectorModelSettings, data: VectorData): VectorTrial<TrialSetupLike>;
/** Chưa đủ dữ liệu (base / data là null): vẫn đọc được nhật ký, chưa ghi được lần chạy nào. */
export function useVectorTrial(projectId: string, base: TrialBase | null, settings: VectorModelSettings, data: VectorData | null): VectorTrial<TrialSetupLike | null>;
export function useVectorTrial(projectId: string, base: TrialBase | null, settings: VectorModelSettings, data: VectorData | null): VectorTrial<TrialSetupLike | null> {
  const log = useTrialLog(projectId);
  const setup: TrialSetupLike | null = base ? { ...base, settings: { ...settings } } : null;
  const canGuess = (base?.data.test ?? 0) > 0;
  const recordTrained = (model: TrainedVectorModel) => {
    if (!setup || !data) return;
    const result = evaluateVectors(model, data);
    void log.record(classificationTrial(setup, { train: result.trainAccuracy, test: result.testAccuracy }, result.confusion), canGuess);
  };
  return { log, setup, canGuess, recordTrained };
}
