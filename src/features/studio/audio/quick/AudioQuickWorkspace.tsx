import { useTranslation } from 'react-i18next';
import type { VectorPrepareError } from '@/core/ml/vector-classifier';
import type { AudioClipRecord, ClassRecord } from '@/storage/db';
import { QuickLayout } from '@/features/studio/quick/QuickLayout';
import { VectorQuickTrain } from '@/features/studio/quick/VectorQuickTrain';
import type { VectorModel } from '@/features/studio/quick/useVectorModel';
import type { AudioData } from '../useAudioData';
import { AudioQuickClasses } from './AudioQuickClasses';
import { AudioQuickPreview } from './AudioQuickPreview';

interface AudioQuickWorkspaceProps {
  readonly classes: readonly ClassRecord[];
  /** Các đoạn thuộc một nhóm còn tồn tại. */
  readonly clips: readonly AudioClipRecord[];
  readonly actions: AudioData;
  readonly lab: VectorModel;
  /** Lý do chưa chia được dữ liệu (null nếu đã đủ). */
  readonly prepareError: VectorPrepareError | null;
}

/** Chế độ Khám phá của Studio âm thanh: thu tiếng → học → nghe thử trên một màn hình. */
export function AudioQuickWorkspace({ classes, clips, actions, lab, prepareError }: AudioQuickWorkspaceProps) {
  const { t } = useTranslation();
  const notReady = prepareError ? t(`audio.prepareErrors.${prepareError.code}`, prepareError) : null;
  return (
    <QuickLayout lead={t('audio.quick.lead')} columns={[t('audio.quick.columns.data'), t('audio.quick.columns.train'), t('audio.quick.columns.preview')]}>
      <AudioQuickClasses classes={classes} clips={clips} actions={actions} />
      <VectorQuickTrain
        lab={lab}
        featuresLabel={t('audio.quick.features')}
        featuresDetail={t('audio.quick.featuresDetail', { count: clips.length })}
        notReady={notReady}
        modelName={t(`audio.models.${lab.settings.kind}.name`)}
        trainHeadingId="audio-step-train"
      />
      <AudioQuickPreview model={lab.current} data={lab.data} />
    </QuickLayout>
  );
}
