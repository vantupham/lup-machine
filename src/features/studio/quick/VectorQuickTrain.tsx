import { useTranslation } from 'react-i18next';
import { PacedQuickTrain } from './PacedQuickTrain';
import { accuracyScore } from './score-text';
import type { VectorModel } from './useVectorModel';

interface VectorQuickTrainProps {
  readonly lab: VectorModel;
  /** Chặng đầu, riêng của từng Studio, ví dụ "Biến âm thanh thành 160 số". */
  readonly featuresLabel: string;
  /** Số liệu của chặng đầu, ví dụ "48 đoạn". */
  readonly featuresDetail: string;
  /** Lý do chưa huấn luyện được (thiếu dữ liệu); null nếu đã đủ. */
  readonly notReady: string | null;
  /** Tên mô hình đang chọn, ví dụ "Hồi quy logistic". */
  readonly modelName: string;
  /** Id tiêu đề bước 4 Huấn luyện, cho đường "mở nắp". */
  readonly trainHeadingId: string;
}

/** Cột 2 cho Studio âm thanh / tư thế: đặc trưng → chia dữ liệu → học → chấm điểm. */
export function VectorQuickTrain({ lab, featuresLabel, featuresDetail, notReady, modelName, trainHeadingId }: VectorQuickTrainProps) {
  const { t } = useTranslation();
  const { data, evaluation } = lab;
  const score = evaluation ? accuracyScore(t, evaluation.testAccuracy, evaluation.trainAccuracy) : null;

  return (
    <PacedQuickTrain
      stages={[
        { label: featuresLabel, detail: featuresDetail },
        { label: t('project.quick.vector.split'), detail: data ? t('project.quick.vector.splitDetail', { train: data.train.ys.length, test: data.test.ys.length }) : null },
        { label: t('project.quick.vector.learn', { model: modelName }), detail: null },
        { label: t('project.quick.vector.score'), detail: score?.detail ?? null },
      ]}
      trainStage={2}
      onTrain={() => void lab.train()}
      hasModel={lab.current !== null}
      isStale={lab.trained !== null && lab.current === null}
      result={score?.result ?? null}
      notReady={notReady}
      trainHeadingId={trainHeadingId}
    />
  );
}
