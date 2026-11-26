import { useTranslation } from 'react-i18next';
import type { PoseKind } from '@/core/pose/features';
import type { ClassRecord, PoseSampleRecord } from '@/storage/db';
import { MAX_POSES_PER_CLASS } from '@/storage/repositories/pose-repository';
import { InlineClassName } from '@/features/studio/quick/InlineClassName';
import { Camera, ImageUp, Plus } from '@/ui/icons';
import type { PoseDetection } from '../pose-io.browser';
import { PoseCamera } from '../PoseCamera';
import { PoseKindPicker } from '../PoseDataSection';
import { BURST_COUNT, type PoseData } from '../usePoseData';

interface PoseQuickClassesProps {
  readonly kind: PoseKind;
  readonly kindLocked: boolean;
  readonly onKindChange: (kind: PoseKind) => void;
  readonly classes: readonly ClassRecord[];
  readonly poses: readonly PoseSampleRecord[];
  readonly actions: PoseData;
  /** Mỗi khung camera nhận dạng xong (để cột 3 đoán trực tiếp). */
  readonly onDetection: (detection: PoseDetection) => void;
}

/** Cột 1: một camera, mỗi nhóm một dòng gọn: đổi tên, ghi 1 / ghi liên tiếp, tải ảnh. */
export function PoseQuickClasses({ kind, kindLocked, onKindChange, classes, poses, actions, onDetection }: PoseQuickClassesProps) {
  const { t } = useTranslation();
  const { busy, countdown, camera } = actions;
  const cameraHere = camera === 'quick';

  return (
    <div className="space-y-3">
      {!kindLocked && <PoseKindPicker kind={kind} kindLocked={kindLocked} onKindChange={onKindChange} name="pose-kind-quick" />}
      {classes.length === 0 && (
        <div className="space-y-2">
          <p className="text-sm text-muted">{t('pose.data.empty')}</p>
          <button type="button" className="btn btn-primary text-sm" disabled={busy} onClick={() => void actions.loadSamples()}>
            {t(`pose.data.loadSamples.${kind}`)}
          </button>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost px-2.5 py-1 text-sm" aria-pressed={cameraHere} onClick={() => actions.setCamera(cameraHere ? null : 'quick')}>
          <Camera /> {cameraHere ? t('pose.data.cameraOff') : t('pose.data.cameraOn')}
        </button>
        {countdown !== null && (
          <span className="font-display text-2xl font-bold text-primary" role="status">
            {countdown > 0 ? countdown : t('pose.data.go')}
          </span>
        )}
      </div>
      {camera === 'details' && <p className="text-xs text-muted">{t('pose.quick.cameraElsewhere')}</p>}
      {cameraHere && (
        <div>
          <PoseCamera kind={kind} onDetection={onDetection} />
          {kind === 'hand' && <p className="mt-1 text-xs text-muted">{t('pose.data.handGuide')}</p>}
        </div>
      )}
      {classes.length > 0 && camera === null && <p className="text-xs text-muted">{t('pose.quick.needCamera')}</p>}

      {classes.map((cls, i) => {
        const count = poses.filter((p) => p.classId === cls.id).length;
        const isFull = count >= MAX_POSES_PER_CLASS;
        const cannotRecord = busy || camera === null || isFull;
        return (
          <div key={cls.id} role="group" aria-label={cls.name} className="border-t border-rule pt-3">
            <div className="flex items-center justify-between gap-2">
              <InlineClassName name={cls.name} markerIndex={i} onRename={(name) => actions.rename(cls.id, name)} />
              <span className="shrink-0 font-mono text-xs text-muted">{t('pose.data.poseCount', { n: count })}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost px-2.5 py-1 text-sm" disabled={cannotRecord} onClick={() => void actions.record(cls.id, 1)} aria-label={t('pose.quick.recordOne', { name: cls.name })}>
                {t('pose.quick.recordOneShort')}
              </button>
              <button
                type="button"
                className="btn btn-ghost px-2.5 py-1 text-sm"
                disabled={cannotRecord}
                onClick={() => void actions.record(cls.id, BURST_COUNT)}
                aria-label={t('pose.quick.recordBurst', { n: BURST_COUNT, name: cls.name })}
              >
                {t('pose.quick.recordBurstShort', { n: BURST_COUNT })}
              </button>
              <label className={`btn btn-ghost cursor-pointer px-2.5 py-1 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary ${busy || isFull ? 'pointer-events-none opacity-50' : ''}`}>
                <ImageUp /> {t('pose.quick.uploadShort')}
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  aria-label={t('pose.quick.upload', { name: cls.name })}
                  className="sr-only"
                  disabled={busy || isFull}
                  onChange={(e) => {
                    // Chép danh sách tệp TRƯỚC khi xóa giá trị ô chọn: FileList sẽ rỗng sau đó.
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length > 0) void actions.upload(cls.id, files);
                  }}
                />
              </label>
            </div>
          </div>
        );
      })}
      <button type="button" className="btn btn-ghost w-full justify-center border-dashed text-sm" disabled={busy} onClick={() => void actions.addClass()}>
        <Plus /> {t('audio.data.addClass')}
      </button>
      {actions.message && (
        <p role={actions.message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${actions.message.kind === 'error' ? 'text-danger' : 'text-accent'}`}>
          {actions.message.text}
        </p>
      )}
    </div>
  );
}
