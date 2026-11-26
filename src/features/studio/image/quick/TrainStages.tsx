import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_TRAIN_OPTIONS } from '../lab/TrainSection';
import type { ImageLab } from '../lab/useImageLab';
import { Check, Circle, LoaderCircle, TriangleAlert } from '@/ui/icons';

/** Các chặng của "Huấn luyện nhanh", theo đúng thứ tự máy làm. */
const STAGES = ['model', 'vectors', 'learn', 'ready'] as const;
type Stage = (typeof STAGES)[number];
type StageState = 'pending' | 'active' | 'done' | 'error';

/** Chặng đang chạy (chỉ số trong STAGES); STAGES.length nghĩa là đã xong hết. */
function activeIndex(lab: ImageLab): number {
  if (lab.status.phase === 'loading-model') return 0;
  if (lab.status.phase === 'extracting' || lab.isQuickPreparing) return 1;
  if (lab.isTraining) return 2;
  return STAGES.length;
}

function hasError(lab: ImageLab): boolean {
  return lab.status.phase === 'error' || lab.notice?.kind === 'error';
}

interface TrainStagesProps {
  readonly lab: ImageLab;
}

/**
 * Dòng trạng thái từng chặng khi bấm "Huấn luyện nhanh": tải mô hình → biến ảnh thành vector →
 * học từng lượt (kèm % đúng) → sẵn sàng. Học sinh thấy máy đang làm gì thay vì chờ một nút quay.
 */
export function TrainStages({ lab }: TrainStagesProps) {
  const { t } = useTranslation();
  const current = activeIndex(lab);
  /** Chặng cuối cùng đã chạy: khi có lỗi, đánh dấu lỗi đúng chặng đó. */
  const [lastActive, setLastActive] = useState(0);
  // Cập nhật ngay trong lúc vẽ (mẫu "trạng thái suy ra từ props" của React), không cần effect.
  if (current < STAGES.length && current !== lastActive) setLastActive(current);
  const failedAt = hasError(lab) ? lastActive : null;

  const stateOf = (i: number): StageState => {
    if (failedAt !== null) return i < failedAt ? 'done' : i === failedAt ? 'error' : 'pending';
    if (i < current) return 'done';
    if (i === current) return 'active';
    // Chặng cuối "sẵn sàng" không có việc gì để chạy: xong khi các chặng trước xong.
    return current === STAGES.length ? 'done' : 'pending';
  };

  return (
    <ol aria-label={t('project.quick.stages.label')} className="space-y-1.5 text-sm">
      {STAGES.map((stage, i) => (
        <StageRow key={stage} stage={stage} state={stateOf(i)} lab={lab} />
      ))}
    </ol>
  );
}

const STATE_STYLE: Record<StageState, string> = {
  pending: 'text-muted',
  active: 'font-semibold text-ink',
  done: 'text-ink',
  error: 'font-semibold text-danger',
};

function StageRow({ stage, state, lab }: { readonly stage: Stage; readonly state: StageState; readonly lab: ImageLab }) {
  const { t } = useTranslation();
  const progress = state === 'active' ? stageProgress(stage, lab) : null;
  return (
    <li className={`flex gap-2 ${STATE_STYLE[state]}`}>
      <StageIcon state={state} />
      <div className="min-w-0 flex-1">
        <p>
          {t(`project.quick.stages.${stage}`)}
          <span className="sr-only"> ({t(`project.quick.stages.state.${state}`)})</span>
        </p>
        <StageDetail stage={stage} state={state} lab={lab} />
        {progress !== null && (
          <div aria-hidden="true" className="mt-1 h-1.5 overflow-hidden rounded-full bg-rule">
            <div
              className="h-full origin-left rounded-full bg-primary transition-transform duration-300"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        )}
      </div>
    </li>
  );
}

function StageIcon({ state }: { readonly state: StageState }) {
  if (state === 'done') return <Check className="mt-0.5 text-accent" />;
  if (state === 'active') return <LoaderCircle className="mt-0.5 animate-spin text-primary" />;
  if (state === 'error') return <TriangleAlert className="mt-0.5" />;
  return <Circle className="mt-0.5" />;
}

/** Tiến độ 0–1 của chặng đang chạy, null nếu chặng đó không đo được. */
function stageProgress(stage: Stage, lab: ImageLab): number | null {
  if (stage === 'vectors' && lab.status.phase === 'extracting' && lab.status.total > 0) return lab.status.done / lab.status.total;
  if (stage === 'learn') return Math.min(1, lab.snapshots.length / totalEpochs(lab));
  return null;
}

const totalEpochs = (lab: ImageLab) => lab.lastOptions?.epochs ?? DEFAULT_TRAIN_OPTIONS.epochs;

function StageDetail({ stage, state, lab }: { readonly stage: Stage; readonly state: StageState; readonly lab: ImageLab }) {
  const { t } = useTranslation();
  if (state !== 'active') return null;
  if (stage === 'vectors' && lab.status.phase === 'extracting') {
    return <p className="font-mono text-xs text-muted">{t('project.quick.stages.vectorsDetail', { done: lab.status.done, total: lab.status.total })}</p>;
  }
  const last = lab.snapshots.at(-1);
  if (stage === 'learn' && last) {
    return (
      <p className="font-mono text-xs text-muted">
        {t('project.quick.stages.learnDetail', {
          epoch: lab.snapshots.length,
          total: totalEpochs(lab),
          percent: Math.round(last.train.accuracy * 100),
        })}
      </p>
    );
  }
  return null;
}
