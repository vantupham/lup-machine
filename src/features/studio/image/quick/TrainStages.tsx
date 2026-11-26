import { useState } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StageList, type StageState } from '@/features/studio/quick/StageList';
import { stageStates } from '@/features/studio/quick/stage-states';
import { DEFAULT_TRAIN_OPTIONS } from '../lab/TrainSection';
import type { ImageLab } from '../lab/useImageLab';

/** Các chặng của "Huấn luyện nhanh", theo đúng thứ tự máy làm. */
const STAGES = ['model', 'vectors', 'learn', 'ready'] as const;
type Stage = (typeof STAGES)[number];

/** Chặng đang chạy (chỉ số trong STAGES); STAGES.length nghĩa là đã xong hết. */
function activeIndex(lab: ImageLab): number {
  if (lab.status.phase === 'loading-model') return 0;
  if (lab.status.phase === 'extracting' || lab.isQuickPreparing) return 1;
  if (lab.isTraining) return 2;
  return STAGES.length;
}

const hasError = (lab: ImageLab) => lab.status.phase === 'error' || lab.notice?.kind === 'error';
const totalEpochs = (lab: ImageLab) => lab.lastOptions?.epochs ?? DEFAULT_TRAIN_OPTIONS.epochs;

/**
 * Dòng trạng thái từng chặng khi bấm "Huấn luyện nhanh": tải mô hình → biến ảnh thành vector →
 * học từng lượt (kèm % đúng) → sẵn sàng. Học sinh thấy máy đang làm gì thay vì chờ một nút quay.
 */
export function TrainStages({ lab }: { readonly lab: ImageLab }) {
  const { t } = useTranslation();
  const current = activeIndex(lab);
  /** Chặng cuối cùng đã chạy: khi có lỗi, đánh dấu lỗi đúng chặng đó. */
  const [lastActive, setLastActive] = useState(0);
  // Cập nhật ngay trong lúc vẽ (mẫu "trạng thái suy ra từ props" của React), không cần effect.
  if (current < STAGES.length && current !== lastActive) setLastActive(current);
  const states = stageStates(STAGES.length, current, hasError(lab) ? lastActive : null);

  return (
    <StageList
      stages={STAGES.map((stage, i) => ({
        key: stage,
        label: t(`project.quick.stages.${stage}`),
        state: states[i] as StageState,
        detail: states[i] === 'active' ? detailOf(stage, lab, t) : null,
        progress: states[i] === 'active' ? progressOf(stage, lab) : null,
      }))}
    />
  );
}

function progressOf(stage: Stage, lab: ImageLab): number | null {
  if (stage === 'vectors' && lab.status.phase === 'extracting' && lab.status.total > 0) return lab.status.done / lab.status.total;
  if (stage === 'learn') return Math.min(1, lab.snapshots.length / totalEpochs(lab));
  return null;
}

function detailOf(stage: Stage, lab: ImageLab, t: TFunction): string | null {
  if (stage === 'vectors' && lab.status.phase === 'extracting') return t('project.quick.stages.vectorsDetail', { done: lab.status.done, total: lab.status.total });
  const last = lab.snapshots.at(-1);
  if (stage === 'learn' && last) {
    return t('project.quick.stages.learnDetail', { epoch: lab.snapshots.length, total: totalEpochs(lab), percent: Math.round(last.train.accuracy * 100) });
  }
  return null;
}
