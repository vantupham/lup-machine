import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowDown } from '@/ui/icons';
import { revealHeading } from './reveal-heading';
import { StageList, type StageView } from './StageList';
import { stageStates } from './stage-states';
import { usePacedStages } from './usePacedStages';

export interface QuickStage {
  readonly label: string;
  /** Số liệu của chặng (hiện khi chặng đã chạy tới); null nếu không có. */
  readonly detail: string | null;
}

interface PacedQuickTrainProps {
  /** Các chặng theo thứ tự; chặng cuối là chấm điểm (chỉ có số khi mô hình còn mới). */
  readonly stages: readonly QuickStage[];
  /** Chặng nào thực sự huấn luyện. */
  readonly trainStage: number;
  readonly onTrain: () => void;
  /** Có mô hình còn khớp dữ liệu và cài đặt hiện tại. */
  readonly hasModel: boolean;
  /** Đã huấn luyện nhưng dữ liệu / cài đặt đổi sau đó. */
  readonly isStale: boolean;
  /** Câu kết quả khi xong ("Xong. Máy đoán đúng …"); null nếu chưa có. */
  readonly result: string | null;
  /** Lý do chưa huấn luyện được (thiếu dữ liệu); null nếu đã đủ. */
  readonly notReady: string | null;
  /** Id tiêu đề bước 4 Huấn luyện, cho đường "mở nắp". */
  readonly trainHeadingId: string;
}

/**
 * Cột 2 của khối "Dạy máy trong 3 bước" cho các Studio học gần như tức thì (âm thanh, tư thế,
 * văn bản, bảng số): một nút huấn luyện, các chặng chạy lần lượt và mỗi chặng dừng ngắn.
 */
export function PacedQuickTrain({ stages, trainStage, onTrain, hasModel, isStale, result, notReady, trainHeadingId }: PacedQuickTrainProps) {
  const { t } = useTranslation();
  const paced = usePacedStages();
  const [hasStarted, setHasStarted] = useState(false);
  const { run } = paced;
  const current = run.phase === 'running' ? run.current : stages.length;
  const states = stageStates(stages.length, current, run.phase === 'error' ? run.failedAt : null);
  const last = stages.length - 1;
  // Chặng đã chạy qua mới hiện số liệu; chặng chấm điểm chỉ có số khi mô hình còn mới.
  const views: StageView[] = stages.map((stage, i) => ({
    key: String(i),
    label: stage.label,
    state: states[i] ?? 'pending',
    detail: states[i] === 'pending' || (i === last && !hasModel) ? null : stage.detail,
  }));
  const showStages = hasStarted && (paced.isRunning || run.phase === 'error' || !isStale);
  const isIdle = run.phase !== 'error' && !paced.isRunning;

  const start = () => {
    setHasStarted(true);
    void paced.start(stages.map((_, i) => (i === trainStage ? onTrain : () => undefined)));
  };

  return (
    <div className="space-y-3">
      <button type="button" className="btn btn-primary w-full justify-center py-3 text-base" disabled={notReady !== null || paced.isRunning} onClick={start}>
        {t('project.quick.train')}
      </button>
      {notReady && <p className="text-sm text-warning">{notReady}</p>}
      {showStages && <StageList stages={views} />}
      <p aria-live="polite" className="min-h-5 text-sm">
        {run.phase === 'error' && <span className="text-danger">{t('project.quick.error', { message: run.message })}</span>}
        {isIdle && isStale && <span className="text-warning">{t('project.quick.stale')}</span>}
        {isIdle && hasModel && result && <span className="font-medium text-accent">{result}</span>}
      </p>
      <button type="button" className="text-sm font-medium text-primary hover:underline" onClick={() => revealHeading(trainHeadingId)}>
        {t('project.quick.openLid')} <ArrowDown />
      </button>
    </div>
  );
}
