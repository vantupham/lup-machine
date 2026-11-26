import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown } from '@/ui/icons';
import { revealHeading } from './reveal-heading';
import { StageList, type StageView } from './StageList';
import { stageStates } from './stage-states';
import { usePacedStages } from './usePacedStages';
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

/**
 * Cột 2 cho Studio âm thanh / tư thế: một nút huấn luyện với các chặng chạy lần lượt
 * (đặc trưng → chia dữ liệu → học → chấm điểm). Máy học gần như tức thì nên mỗi chặng dừng ngắn.
 */
export function VectorQuickTrain({ lab, featuresLabel, featuresDetail, notReady, modelName, trainHeadingId }: VectorQuickTrainProps) {
  const { t } = useTranslation();
  const paced = usePacedStages();
  const [hasStarted, setHasStarted] = useState(false);
  const { data, evaluation } = lab;
  const accuracy = evaluation ? (evaluation.testAccuracy ?? evaluation.trainAccuracy) : null;
  const split = t(evaluation?.testAccuracy == null ? 'project.quick.vector.splitTrain' : 'project.quick.vector.splitTest');
  const percent = accuracy === null ? null : Math.round(accuracy * 100);
  const isStale = lab.trained !== null && lab.current === null;

  const labels = [featuresLabel, t('project.quick.vector.split'), t('project.quick.vector.learn', { model: modelName }), t('project.quick.vector.score')];
  const details: readonly (string | null)[] = [
    featuresDetail,
    data ? t('project.quick.vector.splitDetail', { train: data.train.ys.length, test: data.test.ys.length }) : null,
    null,
    percent === null ? null : t('project.quick.vector.scoreDetail', { percent, split }),
  ];
  const { run } = paced;
  const current = run.phase === 'running' ? run.current : labels.length;
  const states = stageStates(labels.length, current, run.phase === 'error' ? run.failedAt : null);
  // Chặng đã chạy qua mới hiện số liệu; chặng chấm điểm chỉ có số khi mô hình còn mới.
  const stages: StageView[] = labels.map((label, i) => ({
    key: String(i),
    label,
    state: states[i] ?? 'pending',
    detail: states[i] === 'pending' || (i === 3 && lab.current === null) ? null : details[i] ?? null,
  }));
  const showStages = hasStarted && (paced.isRunning || run.phase === 'error' || !isStale);

  const start = () => {
    setHasStarted(true);
    void paced.start([() => undefined, () => undefined, () => void lab.train(), () => undefined]);
  };

  return (
    <div className="space-y-3">
      <button type="button" className="btn btn-primary w-full justify-center py-3 text-base" disabled={notReady !== null || paced.isRunning} onClick={start}>
        {t('project.quick.train')}
      </button>
      {notReady && <p className="text-sm text-warning">{notReady}</p>}
      {showStages && <StageList stages={stages} />}
      <p aria-live="polite" className="min-h-5 text-sm">
        {run.phase === 'error' && <span className="text-danger">{t('project.quick.error', { message: run.message })}</span>}
        {run.phase !== 'error' && !paced.isRunning && isStale && <span className="text-warning">{t('project.quick.stale')}</span>}
        {run.phase !== 'error' && !paced.isRunning && lab.current && percent !== null && (
          <span className="font-medium text-accent">{t('project.quick.vector.done', { percent, split })}</span>
        )}
      </p>
      <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => revealHeading(trainHeadingId)}>
        {t('project.quick.openLid')} <ArrowDown />
      </button>
    </div>
  );
}
