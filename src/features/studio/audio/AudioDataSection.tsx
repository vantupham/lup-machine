import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { fitClip } from '@/core/audio/features';
import { SOUND_KINDS, soundDataset } from '@/core/audio/synthetic-sounds';
import type { AudioClipRecord, AudioSource, ClassRecord } from '@/storage/db';
import { clipSamples, MAX_CLIPS_PER_CLASS, type AudioRepository } from '@/storage/repositories/audio-repository';
import type { DatasetRepository } from '@/storage/repositories/dataset-repository';
import { ExactBadge } from '@/ui/ExactBadge';
import { getErrorMessage } from '@/ui/error-message';
import { decodeAudioFile, isAudioSupported, playClip, recordClip } from './audio-io.browser';
import { Waveform } from './viz';
import { ClassMarker } from '@/ui/ClassMarker';

/** Thu dư một chút để không hụt phần đầu / cuối âm thanh; sau đó cắt về đúng 1 giây quanh chỗ có tiếng. */
const RECORD_SECONDS = 1.5;
const THUMBS_SHOWN = 12;
const LIVE_BARS = 48;

interface AudioDataSectionProps {
  readonly projectId: string;
  readonly classes: readonly ClassRecord[];
  readonly clips: readonly AudioClipRecord[];
  readonly dataset: DatasetRepository;
  readonly audio: AudioRepository;
  readonly onChanged: () => Promise<void>;
}

/** Phổ trực tiếp của trình duyệt khi đang thu (minh họa). */
function LiveSpectrum({ analyser }: { readonly analyser: AnalyserNode }) {
  const { t } = useTranslation();
  const [bars, setBars] = useState<number[]>(() => new Array<number>(LIVE_BARS).fill(0));
  useEffect(() => {
    const data = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const per = Math.floor(data.length / 2 / LIVE_BARS); // chỉ vẽ nửa dưới: tới khoảng 1/4 tần số lấy mẫu
      setBars(Array.from({ length: LIVE_BARS }, (_, i) => (data[i * per] ?? 0) / 255));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [analyser]);
  return (
    <div className="space-y-1">
      <ExactBadge kind="approximate" label={t('audio.live.badge')} hint={t('audio.live.hint')} />
      <svg viewBox={`0 0 ${LIVE_BARS * 4} 40`} className="h-10 w-full" aria-hidden="true">
        {bars.map((v, i) => <rect key={i} x={i * 4} y={40 - v * 40} width={3} height={v * 40} fill="var(--color-accent)" />)}
      </svg>
    </div>
  );
}

function ClassCard({ cls, index, clips, onRecord, onUpload, onDelete, onRename, onDeleteClass, busy, recording }: {
  readonly cls: ClassRecord;
  readonly index: number;
  readonly clips: readonly AudioClipRecord[];
  readonly onRecord: () => void;
  readonly onUpload: (files: readonly File[]) => void;
  readonly onDelete: (clip: AudioClipRecord) => void;
  readonly onRename: (name: string) => void;
  readonly onDeleteClass: () => void;
  readonly busy: boolean;
  readonly recording: AnalyserNode | null;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(cls.name);
  const full = clips.length >= MAX_CLIPS_PER_CLASS;
  return (
    <li className="lab-card space-y-3 p-4">
      <div className="flex items-center gap-2">
        <ClassMarker index={index} />
        <input
          aria-label={t('audio.data.className', { n: index + 1 })}
          value={name}
          maxLength={40}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== cls.name && onRename(name.trim())}
          className="flex-1 rounded border border-rule bg-paper px-2 py-1 font-semibold"
        />
        <span className="font-mono text-xs text-muted" data-testid={`clip-count-${index}`}>{t('audio.data.clipCount', { n: clips.length })}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary text-sm" disabled={busy || full} onClick={onRecord}>
          {recording ? t('audio.data.recording') : t('audio.data.record')}
        </button>
        <label className={`btn btn-ghost cursor-pointer text-sm ${busy || full ? 'pointer-events-none opacity-50' : ''}`}>
          {t('audio.data.upload')}
          <input
            type="file"
            accept="audio/*,.wav,.mp3,.ogg,.m4a,.webm"
            multiple
            className="sr-only"
            disabled={busy || full}
            onChange={(e: ChangeEvent<HTMLInputElement>) => {
              // chép ra mảng TRƯỚC khi đặt lại ô chọn tệp: FileList sẽ bị xóa theo
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (files.length) onUpload(files);
            }}
          />
        </label>
        <button type="button" className="btn btn-ghost ml-auto text-xs" onClick={onDeleteClass}>{t('audio.data.deleteClass')}</button>
      </div>
      {recording && <LiveSpectrum analyser={recording} />}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {clips.slice(-THUMBS_SHOWN).map((clip, i) => (
          <li key={clip.id} className="group relative">
            <button type="button" className="block w-full" onClick={() => playClip(clipSamples(clip))} aria-label={t('audio.data.play', { n: clips.length - Math.min(THUMBS_SHOWN, clips.length) + i + 1 })}>
              <Waveform samples={clipSamples(clip)} label="" height={36} />
            </button>
            <button
              type="button"
              className="absolute top-0 right-0 hidden rounded bg-danger px-1 text-xs text-white group-hover:block group-focus-within:block"
              aria-label={t('audio.data.deleteClip')}
              onClick={() => onDelete(clip)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      {clips.length > THUMBS_SHOWN && <p className="text-xs text-muted">{t('audio.data.moreClips', { n: clips.length - THUMBS_SHOWN })}</p>}
    </li>
  );
}

export function AudioDataSection({ projectId, classes, clips, dataset, audio, onChanged }: AudioDataSectionProps) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingClass, setRecordingClass] = useState<{ id: string; analyser: AnalyserNode } | null>(null);
  const [newClass, setNewClass] = useState('');
  const cancelRef = useRef<(() => void) | null>(null);
  const supported = isAudioSupported();

  useEffect(() => () => cancelRef.current?.(), []);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      await onChanged();
    } catch (err: unknown) {
      setError(t('audio.data.error', { message: getErrorMessage(err) }));
    } finally {
      setBusy(false);
    }
  };

  const add = (classId: string, source: AudioSource, signals: Float32Array[]) =>
    audio.addClips(signals.map((s) => ({ projectId, classId, source, samples: fitClip(s) })));

  const record = (classId: string) =>
    run(async () => {
      const rec = await recordClip(RECORD_SECONDS);
      cancelRef.current = rec.cancel;
      setRecordingClass({ id: classId, analyser: rec.analyser });
      try {
        await add(classId, 'microphone', [await rec.result]);
      } finally {
        setRecordingClass(null);
        cancelRef.current = null;
      }
    });

  const upload = (classId: string, files: readonly File[]) =>
    run(async () => {
      const signals: Float32Array[] = [];
      for (const file of files) signals.push(await decodeAudioFile(file));
      await add(classId, 'upload', signals);
    });

  const loadSamples = () =>
    run(async () => {
      const created: Record<string, string> = {};
      for (const kind of SOUND_KINDS) created[kind] = (await dataset.addClass(projectId, t(`audio.samples.${kind}`))).id;
      await audio.addClips(soundDataset(1).map((s) => ({ projectId, classId: created[s.kind] as string, source: 'dataset' as const, samples: s.signal })));
    });

  const addClass = (event: FormEvent) => {
    event.preventDefault();
    const name = newClass.trim();
    if (!name) return;
    void run(async () => {
      await dataset.addClass(projectId, name);
      setNewClass('');
    });
  };

  return (
    <div className="space-y-4">
      {!supported && <p role="alert" className="text-sm text-warning">{t('audio.data.unsupported')}</p>}
      {classes.length === 0 && (
        <div className="lab-card space-y-2 p-4">
          <p className="text-muted">{t('audio.data.empty')}</p>
          <button type="button" className="btn btn-primary text-sm" disabled={busy} onClick={() => void loadSamples()}>{t('audio.data.loadSamples')}</button>
          <p className="text-xs text-muted">{t('audio.data.samplesNote')}</p>
        </div>
      )}
      <ul className="grid gap-4 md:grid-cols-2">
        {classes.map((cls, i) => (
          <ClassCard
            key={cls.id}
            cls={cls}
            index={i}
            clips={clips.filter((c) => c.classId === cls.id)}
            busy={busy || !supported}
            recording={recordingClass?.id === cls.id ? recordingClass.analyser : null}
            onRecord={() => void record(cls.id)}
            onUpload={(files) => void upload(cls.id, files)}
            onDelete={(clip) => void run(() => audio.deleteClip(clip.id))}
            onRename={(name) => void run(async () => void (await dataset.renameClass(cls.id, name)))}
            onDeleteClass={() => {
              if (window.confirm(t('audio.data.confirmDeleteClass', { name: cls.name }))) void run(() => dataset.deleteClass(cls.id));
            }}
          />
        ))}
      </ul>
      <form onSubmit={addClass} className="flex flex-wrap items-end gap-2">
        <label className="text-sm font-medium">
          {t('audio.data.newClass')}
          <input value={newClass} onChange={(e) => setNewClass(e.target.value)} maxLength={40} className="mt-1 block rounded border border-rule bg-paper px-2 py-1" />
        </label>
        <button type="submit" className="btn btn-ghost text-sm" disabled={busy || newClass.trim() === ''}>{t('audio.data.addClass')}</button>
      </form>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <p className="text-xs text-muted">{t('audio.data.privacy')}</p>
    </div>
  );
}
