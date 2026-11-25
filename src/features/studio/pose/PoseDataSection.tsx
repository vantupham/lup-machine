import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizationFrame, unpackKeypoints, type PoseKind } from '@/core/pose/features';
import { BODY_POSES, HAND_POSES, poseDataset } from '@/core/pose/synthetic-poses';
import { colorFor } from '@/features/studio/image/lab/class-style';
import type { ClassRecord, PoseSampleRecord } from '@/storage/db';
import type { DatasetRepository } from '@/storage/repositories/dataset-repository';
import { MAX_POSES_PER_CLASS, type PoseRepository } from '@/storage/repositories/pose-repository';
import { getErrorMessage } from '@/ui/error-message';
import { PoseCamera } from './PoseCamera';
import { grabFrame, imageFromFile, loadDetector, type PoseDetection } from './pose-io.browser';
import { Skeleton } from './Skeleton';
import { ClassMarker } from '@/ui/ClassMarker';
import { nextClassName } from '@/features/studio/next-class-name';
import { Plus, Trash2 } from '@/ui/icons';

const THUMBS_SHOWN = 12;
/** "Ghi liên tiếp": số mẫu và khoảng cách giữa hai mẫu; có 3 giây đếm ngược để kịp tạo dáng. */
const BURST_COUNT = 10;
const BURST_INTERVAL_MS = 300;
const COUNTDOWN_SECONDS = 3;
/** Bàn tay: chỉ ghi khi mô hình khá chắc có bàn tay trong khung. */
const MIN_HAND_SCORE = 0.5;

interface PoseDataSectionProps {
  readonly projectId: string;
  readonly kind: PoseKind;
  readonly kindLocked: boolean;
  readonly onKindChange: (kind: PoseKind) => void;
  readonly classes: readonly ClassRecord[];
  readonly poses: readonly PoseSampleRecord[];
  readonly dataset: DatasetRepository;
  readonly repo: PoseRepository;
  readonly onChanged: () => Promise<void>;
}

function usable(kind: PoseKind, d: PoseDetection): boolean {
  return normalizationFrame(kind, d.keypoints) !== null && (kind === 'body' || d.score >= MIN_HAND_SCORE);
}

const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

export function PoseDataSection({ projectId, kind, kindLocked, onKindChange, classes, poses, dataset, repo, onChanged }: PoseDataSectionProps) {
  const { t } = useTranslation();
  const [cameraOn, setCameraOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'info' | 'error'; text: string } | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const latest = useRef<PoseDetection | null>(null);

  const run = async (task: () => Promise<string | null>) => {
    setBusy(true);
    setMessage(null);
    try {
      const info = await task();
      await onChanged();
      if (info) setMessage({ kind: 'info', text: info });
    } catch (err: unknown) {
      setMessage({ kind: 'error', text: t('pose.data.error', { message: getErrorMessage(err) }) });
    } finally {
      setBusy(false);
      setCountdown(null);
    }
  };

  const save = (classId: string, source: 'webcam' | 'upload', detections: PoseDetection[]) =>
    repo.addPoses(detections.map((d) => ({ projectId, classId, kind, source, keypoints: d.keypoints, width: d.width, height: d.height })));

  const record = (classId: string, count: number) =>
    run(async () => {
      if (count > 1) {
        for (let s = COUNTDOWN_SECONDS; s > 0; s--) {
          setCountdown(s);
          await wait(1000);
        }
        setCountdown(0);
      }
      const taken: PoseDetection[] = [];
      let skipped = 0;
      for (let i = 0; i < count; i++) {
        const d = latest.current;
        if (d && usable(kind, d)) taken.push(d);
        else skipped++;
        if (i < count - 1) await wait(BURST_INTERVAL_MS);
      }
      if (taken.length > 0) await save(classId, 'webcam', taken);
      return t('pose.data.recorded', { n: taken.length, skipped });
    });

  const upload = (classId: string, files: readonly File[]) =>
    run(async () => {
      const detect = await loadDetector(kind);
      const found: PoseDetection[] = [];
      let skipped = 0;
      for (const file of files) {
        const frame = grabFrame(await imageFromFile(file), false);
        const d = frame ? await detect(frame) : null;
        if (d && usable(kind, d)) found.push(d);
        else skipped++;
      }
      if (found.length > 0) await save(classId, 'upload', found);
      return t('pose.data.uploaded', { n: found.length, skipped });
    });

  const loadSamples = () =>
    run(async () => {
      const names = (kind === 'body' ? BODY_POSES : HAND_POSES) as readonly string[];
      const ids: Record<string, string> = {};
      for (const pose of names) ids[pose] = (await dataset.addClass(projectId, t(`pose.samples.${pose}`))).id;
      await repo.addPoses(poseDataset(kind).map((p) => ({ projectId, classId: ids[p.pose] as string, kind, source: 'dataset' as const, keypoints: p.keypoints, width: 640, height: 480 })));
      return null;
    });

  /** Thêm "Nhóm n" (số tăng dần); đổi tên ngay trong ô tên của nhóm. */
  const addClass = () =>
    void run(async () => {
      await dataset.addClass(projectId, nextClassName(classes.map((c) => c.name), (n) => t('audio.data.defaultClass', { n })));
      return null;
    });

  return (
    <div className="space-y-4">
      <fieldset>
        <legend className="text-sm font-medium">{t('pose.data.kind')}</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {(['body', 'hand'] as const).map((k) => (
            <label key={k} className={`flex items-center gap-2 rounded border px-3 py-1.5 text-sm ${kind === k ? 'border-primary' : 'border-rule'} ${kindLocked ? 'opacity-60' : 'cursor-pointer'}`}>
              <input type="radio" name="pose-kind" checked={kind === k} disabled={kindLocked} onChange={() => onKindChange(k)} />
              {t(`pose.kinds.${k}`)}
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted">{t(kindLocked ? 'pose.data.kindLocked' : `pose.data.kindHint.${kind}`)}</p>
      </fieldset>

      {classes.length === 0 && (
        <div className="lab-card space-y-2 p-4">
          <p className="text-muted">{t('pose.data.empty')}</p>
          <button type="button" className="btn btn-primary text-sm" disabled={busy} onClick={() => void loadSamples()}>{t(`pose.data.loadSamples.${kind}`)}</button>
          <p className="text-xs text-muted">{t('pose.data.samplesNote')}</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-ghost text-sm" onClick={() => setCameraOn(!cameraOn)}>{cameraOn ? t('pose.data.cameraOff') : t('pose.data.cameraOn')}</button>
        {countdown !== null && <span className="font-display text-2xl font-bold text-primary" role="status">{countdown > 0 ? countdown : t('pose.data.go')}</span>}
      </div>
      {cameraOn && (
        <div className="max-w-xl">
          <PoseCamera kind={kind} onDetection={(d) => (latest.current = d)} />
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
                  onRename={(name) => void run(async () => (await dataset.renameClass(cls.id, name), null))}
                />
                <span className="font-mono text-xs text-muted" data-testid={`pose-count-${i}`}>{t('pose.data.poseCount', { n: mine.length })}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary text-sm" disabled={busy || !cameraOn || full} onClick={() => void record(cls.id, 1)}>{t('pose.data.recordOne')}</button>
                <button type="button" className="btn btn-ghost text-sm" disabled={busy || !cameraOn || full} onClick={() => void record(cls.id, BURST_COUNT)}>{t('pose.data.recordBurst', { n: BURST_COUNT })}</button>
                <label className={`btn btn-ghost cursor-pointer text-sm ${busy || full ? 'pointer-events-none opacity-50' : ''}`}>
                  {t('pose.data.upload')}
                  <input type="file" accept="image/*" multiple className="sr-only" disabled={busy || full} onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    // chép ra mảng TRƯỚC khi đặt lại ô chọn tệp: FileList sẽ bị xóa theo
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length) void upload(cls.id, files);
                  }} />
                </label>
                <button
                  type="button"
                  className="ml-auto rounded p-1.5 text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                  aria-label={t('audio.data.deleteClassAria', { name: cls.name })}
                  title={t('audio.data.deleteClass')}
                  onClick={() => {
                    if (window.confirm(t('pose.data.confirmDeleteClass', { name: cls.name }))) void run(async () => (await dataset.deleteClass(cls.id), null));
                  }}
                >
                  <Trash2 />
                </button>
              </div>
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {mine.slice(-THUMBS_SHOWN).map((p) => (
                  <li key={p.id} className="group relative">
                    <Skeleton kind={p.kind} keypoints={unpackKeypoints(p.keypoints)} width={p.width} height={p.height} label={t('pose.data.thumb', { name: cls.name })} color={colorFor(i)} />
                    <button type="button" className="absolute top-0 right-0 hidden rounded bg-danger px-1 text-xs text-white group-hover:block group-focus-within:block" aria-label={t('pose.data.deletePose')} onClick={() => void run(async () => (await repo.deletePose(p.id), null))}>×</button>
                  </li>
                ))}
              </ul>
              {mine.length > THUMBS_SHOWN && <p className="text-xs text-muted">{t('audio.data.moreClips', { n: mine.length - THUMBS_SHOWN })}</p>}
            </li>
          );
        })}
      </ul>
      <button type="button" className="btn btn-ghost text-sm" disabled={busy} onClick={addClass}>
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
