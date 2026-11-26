import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { fitClip } from '@/core/audio/features';
import { SOUND_KINDS, soundDataset } from '@/core/audio/synthetic-sounds';
import type { AudioSource, ClassRecord } from '@/storage/db';
import type { AudioRepository } from '@/storage/repositories/audio-repository';
import type { DatasetRepository } from '@/storage/repositories/dataset-repository';
import { getErrorMessage } from '@/ui/error-message';
import { nextClassName } from '@/features/studio/next-class-name';
import { decodeAudioFile, isAudioSupported, recordClip } from './audio-io.browser';

/** Thu dư một chút để không hụt phần đầu / cuối âm thanh; sau đó cắt về đúng 1 giây quanh chỗ có tiếng. */
export const RECORD_SECONDS = 1.5;

interface AudioDataOptions {
  readonly projectId: string;
  readonly classes: readonly ClassRecord[];
  readonly dataset: DatasetRepository;
  readonly audio: AudioRepository;
  readonly onChanged: () => Promise<void>;
}

/**
 * Thu, tải, đổi tên, xóa âm thanh và nhóm của một dự án. Dùng chung cho khối "Dạy máy trong 3 bước"
 * và bước 1, để cả hai cùng biết đang thu cho nhóm nào.
 */
export function useAudioData({ projectId, classes, dataset, audio, onChanged }: AudioDataOptions) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recordingClass, setRecordingClass] = useState<{ id: string; analyser: AnalyserNode } | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);
  const isSupported = isAudioSupported();

  useEffect(() => () => cancelRef.current?.(), []);

  /** Chạy một thao tác, báo lỗi nếu có; trả về true nếu xong. */
  const run = async (task: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await task();
      await onChanged();
      return true;
    } catch (err: unknown) {
      setError(t('audio.data.error', { message: getErrorMessage(err) }));
      return false;
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

  /** Thêm "Nhóm n" (số tăng dần, không trùng tên đã có). */
  const addClass = () => run(() => dataset.addClass(projectId, nextClassName(classes.map((c) => c.name), (n) => t('audio.data.defaultClass', { n }))));

  const rename = (classId: string, name: string) => run(() => dataset.renameClass(classId, name));
  const deleteClass = (classId: string) => run(() => dataset.deleteClass(classId));
  const deleteClip = (clipId: string) => run(() => audio.deleteClip(clipId));

  return { busy, error, recordingClass, isSupported, record, upload, loadSamples, addClass, rename, deleteClass, deleteClip };
}

export type AudioData = ReturnType<typeof useAudioData>;
