import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VectorPrepareError } from '@/core/ml/vector-classifier';
import { keypointCount, type PoseKind } from '@/core/pose/features';
import type { ClassRecord, PoseSampleRecord } from '@/storage/db';
import { QuickLayout } from '@/features/studio/quick/QuickLayout';
import { VectorQuickTrain } from '@/features/studio/quick/VectorQuickTrain';
import type { VectorModel } from '@/features/studio/quick/useVectorModel';
import type { PoseDetection } from '../pose-io.browser';
import type { PoseData } from '../usePoseData';
import { PoseQuickClasses } from './PoseQuickClasses';
import { PoseQuickPreview } from './PoseQuickPreview';

interface PoseQuickWorkspaceProps {
  readonly kind: PoseKind;
  readonly kindLocked: boolean;
  readonly onKindChange: (kind: PoseKind) => void;
  readonly classes: readonly ClassRecord[];
  /** Các mẫu đúng loại (cơ thể / bàn tay) thuộc một nhóm còn tồn tại. */
  readonly poses: readonly PoseSampleRecord[];
  readonly actions: PoseData;
  readonly lab: VectorModel;
  /** Lý do chưa chia được dữ liệu (null nếu đã đủ). */
  readonly prepareError: VectorPrepareError | null;
}

/** Chế độ Khám phá của Studio tư thế: ghi tư thế → học → thử ngay, một camera dùng chung cho cột 1 và cột 3. */
export function PoseQuickWorkspace({ kind, kindLocked, onKindChange, classes, poses, actions, lab, prepareError }: PoseQuickWorkspaceProps) {
  const { t } = useTranslation();
  /** Khung xương mới nhất cho cột 3 (chỉ khối này vẽ lại theo camera, không phải cả trang). */
  const [detection, setDetection] = useState<PoseDetection | null>(null);
  const { noteDetection } = actions;
  const onDetection = useCallback(
    (d: PoseDetection) => {
      noteDetection(d);
      setDetection(d);
    },
    [noteDetection],
  );
  const notReady = prepareError ? t(`pose.prepareErrors.${prepareError.code}`, prepareError) : null;

  return (
    <QuickLayout lead={t('pose.quick.lead')} columns={[t('pose.quick.columns.data'), t('pose.quick.columns.train'), t('pose.quick.columns.preview')]}>
      <PoseQuickClasses kind={kind} kindLocked={kindLocked} onKindChange={onKindChange} classes={classes} poses={poses} actions={actions} onDetection={onDetection} />
      <VectorQuickTrain
        lab={lab}
        featuresLabel={t('pose.quick.features', { count: keypointCount(kind) * 2 })}
        featuresDetail={t('pose.quick.featuresDetail', { count: poses.length })}
        notReady={notReady}
        modelName={t(`pose.models.${lab.settings.kind}.name`)}
        trainHeadingId="pose-step-train"
      />
      <PoseQuickPreview
        kind={kind}
        model={lab.current}
        data={lab.data}
        camera={actions.camera}
        setCamera={actions.setCamera}
        liveDetection={actions.camera === 'quick' ? detection : null}
      />
    </QuickLayout>
  );
}
