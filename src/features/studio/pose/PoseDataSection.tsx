import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { unpackKeypoints, type PoseKind } from '@/core/pose/features';
import { colorFor } from '@/features/studio/image/lab/class-style';
import type { ClassRecord, PoseSampleRecord } from '@/storage/db';
import { MAX_POSES_PER_CLASS } from '@/storage/repositories/pose-repository';
import { PoseCamera } from './PoseCamera';
import { Skeleton } from './Skeleton';
import { ClassMarker } from '@/ui/ClassMarker';
import { Plus, Trash2 } from '@/ui/icons';
import { BURST_COUNT, type PoseData } from './usePoseData';

const THUMBS_SHOWN = 12;

interface PoseDataSectionProps {
  readonly kind: PoseKind;
  readonly kindLocked: boolean;
  readonly onKindChange: (kind: PoseKind) => void;
  readonly classes: readonly ClassRecord[];
  readonly poses: readonly PoseSampleRecord[];
  /** Thao tác dữ liệu và camera dùng chung với khối "Dạy máy trong 3 bước". */
  readonly actions: PoseData;
}

interface PoseKindPickerProps {
  readonly kind: PoseKind;
  readonly kindLocked: boolean;
  readonly onKindChange: (kind: PoseKind) => void;
  /** Tên nhóm ô chọn (mỗi nơi trên trang một tên riêng). */
  readonly name?: string;
}

/** Chọn cơ thể / bàn tay; khóa lại khi dự án đã có mẫu. */
export function PoseKindPicker({ kind, kindLocked, onKindChange, name = 'pose-kind' }: PoseKindPickerProps) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="text-sm font-medium">{t('pose.data.kind')}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {(['body', 'hand'] as const).map((k) => (
          <label key={k} className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm ${kind === k ? 'border-primary' : 'border-rule'} ${kindLocked ? 'opacity-60' : 'cursor-pointer'}`}>
            <input type="radio" name={name} checked={kind === k} disabled={kindLocked} onChange={() => onKindChange(k)} />
            {t(`pose.kinds.${k}`)}
          </label>
        ))}
      </div>
      <p className="mt-1 text-xs text-muted">{t(kindLocked ? 'pose.data.kindLocked' : `pose.data.kindHint.${kind}`)}</p>
    </fieldset>
  );
}

export function PoseDataSection({ kind, kindLocked, onKindChange, classes, poses, actions }: PoseDataSectionProps) {
  const { t } = useTranslation();
  const { busy, countdown, message } = actions;
  const cameraHere = actions.camera === 'details';
  const canRecord = actions.camera !== null;

  return (
    <div className="space-y-4">
      <PoseKindPicker kind={kind} kindLocked={kindLocked} onKindChange={onKindChange} />

      {classes.length === 0 && (
        <div className="lab-card space-y-2 p-4">
          <p className="text-muted">{t('pose.data.empty')}</p>
          <button type="button" className="btn btn-primary text-sm" disabled={busy} onClick={() => void actions.loadSamples()}>{t(`pose.data.loadSamples.${kind}`)}</button>
          <p className="text-xs text-muted">{t('pose.data.samplesNote')}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost text-sm" onClick={() => actions.setCamera(cameraHere ? null : 'details')}>{cameraHere ? t('pose.data.cameraOff') : t('pose.data.cameraOn')}</button>
        {countdown !== null && <span className="font-display text-2xl font-bold text-primary" role="status">{countdown > 0 ? countdown : t('pose.data.go')}</span>}
      </div>
      {cameraHere && (
        <div className="max-w-xl">
          <PoseCamera kind={kind} onDetection={actions.noteDetection} />
          {kind === 'hand' && <p className="mt-1 text-xs text-muted">{t('pose.data.handGuide')}</p>}
        </div>
      )}

      <ul className="grid gap-4 md:grid-cols-2">
        {classes.map((cls, i) => {
          const mine = poses.filter((p) => p.classId === cls.id);
          const full = mine.length >= MAX_POSES_PER_CLASS;
          return (
            <li key={cls.id} className="lab-card space-y-3 p-4">
              <div className="flex items-center gap-2">
                <ClassMarker index={i} />
                <GroupNameInput
                  key={cls.name}
                  name={cls.name}
                  label={t('audio.data.className', { n: i + 1 })}
                  onRename={(name) => void actions.rename(cls.id, name)}
                />
                <span className="font-mono text-xs text-muted" data-testid={`pose-count-${i}`}>{t('pose.data.poseCount', { n: mine.length })}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary text-sm" disabled={busy || !canRecord || full} onClick={() => void actions.record(cls.id, 1)}>{t('pose.data.recordOne')}</button>
                <button type="button" className="btn btn-ghost text-sm" disabled={busy || !canRecord || full} onClick={() => void actions.record(cls.id, BURST_COUNT)}>{t('pose.data.recordBurst', { n: BURST_COUNT })}</button>
                <label className={`btn btn-ghost cursor-pointer text-sm ${busy || full ? 'pointer-events-none opacity-50' : ''}`}>
                  {t('pose.data.upload')}
                  <input type="file" accept="image/*" multiple className="sr-only" disabled={busy || full} onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    // chép ra mảng TRƯỚC khi đặt lại ô chọn tệp: FileList sẽ bị xóa theo
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length) void actions.upload(cls.id, files);
                  }} />
                </label>
                <button
                  type="button"
                  className="ml-auto rounded p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  aria-label={t('audio.data.deleteClassAria', { name: cls.name })}
                  title={t('audio.data.deleteClass')}
                  onClick={() => {
                    if (window.confirm(t('pose.data.confirmDeleteClass', { name: cls.name }))) void actions.deleteClass(cls.id);
                  }}
                >
                  <Trash2 />
                </button>
              </div>
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {mine.slice(-THUMBS_SHOWN).map((p) => (
                  <li key={p.id} className="group relative">
                    <Skeleton kind={p.kind} keypoints={unpackKeypoints(p.keypoints)} width={p.width} height={p.height} label={t('pose.data.thumb', { name: cls.name })} color={colorFor(i)} />
                    <button type="button" className="absolute top-0 right-0 hidden rounded bg-danger px-1 text-xs text-danger-ink group-hover:block group-focus-within:block" aria-label={t('pose.data.deletePose')} onClick={() => void actions.deletePose(p.id)}>×</button>
                  </li>
                ))}
              </ul>
              {mine.length > THUMBS_SHOWN && <p className="text-xs text-muted">{t('audio.data.moreClips', { n: mine.length - THUMBS_SHOWN })}</p>}
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-ghost text-sm" disabled={busy} onClick={() => void actions.addClass()}>
        <Plus /> {t('audio.data.addClass')}
      </button>
      {message && <p role={message.kind === 'error' ? 'alert' : 'status'} className={`text-sm ${message.kind === 'error' ? 'text-danger' : 'text-accent'}`}>{message.text}</p>}
      <p className="text-xs text-muted">{t('pose.data.privacy')}</p>
    </div>
  );
}

interface GroupNameInputProps {
  readonly name: string;
  readonly label: string;
  readonly onRename: (name: string) => void;
}

/** Tên nhóm sửa được ngay tại chỗ: rời ô (hoặc Enter) là lưu, để trống thì giữ tên cũ. */
function GroupNameInput({ name, label, onRename }: GroupNameInputProps) {
  const [draft, setDraft] = useState(name);
  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) onRename(next);
    else setDraft(name);
  };
  return (
    <input
      aria-label={label}
      value={draft}
      maxLength={40}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-2 py-1 font-semibold hover:border-rule focus:border-rule focus:bg-paper"
    />
  );
}
