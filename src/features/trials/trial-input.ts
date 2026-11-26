import { perClassMetrics } from '@/core/ml/metrics';
import type { TrialSetupLike } from '@/core/experiments/trial-diff';
import type { NewTrialInput } from '@/storage/schemas/trial';

/** Lần chạy phân loại: điểm là độ chính xác, kèm tỉ lệ nhận ra từng lớp trên tập Kiểm tra. */
export function classificationTrial(
  setup: TrialSetupLike,
  scores: { readonly train: number | null; readonly test: number | null },
  testConfusion: readonly (readonly number[])[],
): Omit<NewTrialInput, 'guess'> {
  return {
    settings: { ...setup.settings },
    split: { ...setup.split },
    data: { ...setup.data, classNames: [...setup.data.classNames] },
    metric: 'accuracy',
    scores: { ...scores },
    ...(setup.data.test > 0 ? { classRecall: perClassMetrics(testConfusion).map((m) => m.recall) } : {}),
  };
}

/** Lần chạy hồi quy (dữ liệu bảng): điểm là R². */
export function regressionTrial(setup: TrialSetupLike, scores: { readonly train: number | null; readonly test: number | null }): Omit<NewTrialInput, 'guess'> {
  return {
    settings: { ...setup.settings },
    split: { ...setup.split },
    data: { ...setup.data, classNames: [...setup.data.classNames] },
    metric: 'r2',
    scores: { ...scores },
  };
}
