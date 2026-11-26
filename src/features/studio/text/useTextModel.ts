import { useMemo, useState } from 'react';
import { hashText } from '@/core/data/fingerprint';
import type { TrialSetupLike } from '@/core/experiments/trial-diff';
import { evaluateText, trainText, type TextData, type TrainedText } from '@/core/text/text-model';
import type { TextConfig } from '@/storage/schemas/text';
import type { StoredTable } from '@/storage/repositories/table-repository';
import { classificationTrial } from '@/features/trials/trial-input';
import { useTrialLog } from '@/features/trials/useTrialLog';

interface TrainedState {
  /** Bảng và cấu hình lúc huấn luyện: khác khóa hiện tại thì mô hình đã cũ. */
  readonly key: string;
  readonly model: TrainedText;
  readonly count: number;
}

/**
 * Mô hình văn bản của một dự án, dùng chung cho khối "Dạy máy trong 3 bước" và các bước 4–6:
 * huấn luyện ở đâu thì chỗ kia cũng thấy, và mỗi lần huấn luyện được ghi vào nhật ký thí nghiệm.
 */
export function useTextModel(projectId: string, table: StoredTable | null, config: TextConfig | null, data: TextData | null) {
  const [trained, setTrained] = useState<TrainedState | null>(null);
  const trialLog = useTrialLog(projectId);
  const key = JSON.stringify([table?.updatedAt ?? null, config]);
  const current = trained && trained.key === key ? trained.model : null;
  const evaluation = useMemo(() => (current && data ? evaluateText(current, data) : null), [current, data]);
  /** Cài đặt và dữ liệu của lần huấn luyện kế tiếp (để so với lần trước trong nhật ký). */
  const trialSetup: TrialSetupLike | null =
    data && config && table
      ? {
          settings: { ...config.model, maxN: config.maxN },
          split: { testRatio: config.testRatio, seed: config.seed },
          data: {
            fingerprint: hashText(`${table.updatedAt}|${config.textColumn}|${config.labelColumn}`),
            train: data.train.y.length,
            test: data.test.y.length,
            classNames: data.classNames,
          },
        }
      : null;
  const canGuess = (data?.test.y.length ?? 0) > 0;

  const train = () => {
    if (!data || !config) return;
    const model = trainText(data, config.model);
    setTrained((prev) => ({ key, model, count: (prev?.count ?? 0) + 1 }));
    if (!trialSetup) return;
    const scores = evaluateText(model, data);
    void trialLog.record(classificationTrial(trialSetup, { train: scores.trainAccuracy, test: scores.testAccuracy }, scores.confusion), canGuess);
  };

  /** Bỏ mô hình cũ (sau khi thay cả bảng dữ liệu). */
  const reset = () => setTrained(null);

  return { trained, current, evaluation, key, trialLog, trialSetup, canGuess, train, reset };
}

export type TextModel = ReturnType<typeof useTextModel>;
