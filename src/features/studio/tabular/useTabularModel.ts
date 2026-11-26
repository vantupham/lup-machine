import { useMemo, useState } from 'react';
import { hashText } from '@/core/data/fingerprint';
import type { TrialSetupLike } from '@/core/experiments/trial-diff';
import { evaluateTabular, trainTabular, type TrainedModel } from '@/core/tabular/models';
import type { PreparedData } from '@/core/tabular/prepare';
import type { TabularConfig } from '@/storage/schemas/tabular';
import type { StoredTable } from '@/storage/repositories/table-repository';
import { classificationTrial, regressionTrial } from '@/features/trials/trial-input';
import { useTrialLog } from '@/features/trials/useTrialLog';

interface TrainedState {
  /** Bảng và cấu hình lúc huấn luyện: khác khóa hiện tại thì mô hình đã cũ. */
  readonly key: string;
  readonly model: TrainedModel;
  readonly count: number;
}

/**
 * Mô hình của một dự án bảng số, dùng chung cho khối "Dạy máy trong 3 bước" và các bước 4–6:
 * huấn luyện ở đâu thì chỗ kia cũng thấy, và mỗi lần huấn luyện được ghi vào nhật ký thí nghiệm.
 */
export function useTabularModel(projectId: string, table: StoredTable | null, config: TabularConfig | null, data: PreparedData | null) {
  const [trained, setTrained] = useState<TrainedState | null>(null);
  const trialLog = useTrialLog(projectId);
  // mô hình chỉ còn hợp lệ khi dữ liệu và cấu hình không đổi kể từ lần huấn luyện
  const key = JSON.stringify([table?.updatedAt ?? null, config]);
  const current = trained && trained.key === key ? trained.model : null;
  const evaluation = useMemo(() => (current && data ? evaluateTabular(current, data) : null), [current, data]);
  /** Cài đặt và dữ liệu của lần huấn luyện kế tiếp (để so với lần trước trong nhật ký). */
  const trialSetup: TrialSetupLike | null =
    data && config && table
      ? {
          settings: { ...config.model, target: config.target, features: config.features.join(', ') },
          split: { testRatio: config.testRatio, seed: config.seed },
          data: { fingerprint: hashText(table.updatedAt), train: data.train.y.length, test: data.test.y.length, classNames: data.classNames },
        }
      : null;
  const canGuess = config?.task === 'classification' && (data?.test.y.length ?? 0) > 0;

  const train = () => {
    if (!data || !config) return;
    const model = trainTabular(data, config.model);
    setTrained((prev) => ({ key, model, count: (prev?.count ?? 0) + 1 }));
    if (!trialSetup) return;
    const result = evaluateTabular(model, data);
    void trialLog.record(
      result.task === 'classification'
        ? classificationTrial(trialSetup, { train: result.train.accuracy, test: result.test.accuracy }, result.test.confusion)
        : regressionTrial(trialSetup, { train: result.train.r2, test: result.test.r2 }),
      canGuess,
    );
  };

  /** Bỏ mô hình cũ (sau khi thay cả bảng dữ liệu). */
  const reset = () => setTrained(null);

  return { trained, current, evaluation, key, trialLog, trialSetup, canGuess, train, reset };
}

export type TabularModel = ReturnType<typeof useTabularModel>;
