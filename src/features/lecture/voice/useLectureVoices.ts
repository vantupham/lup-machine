import { useCallback, useEffect, useRef, useState } from 'react';
import { useRepositories } from '@/storage/repository-context';
import type { LectureVoice, LectureVoiceLevel } from '@/storage/repositories/lecture-voice-repository';
import { getErrorMessage } from '@/ui/error-message';
import type { LectureScene } from '../lecture-script';
import type { RecordedVoice } from './useVoiceRecorder';
import { decodeVoice } from './voice-audio.browser';

export interface SceneVoice {
  readonly voice: LectureVoice;
  readonly buffer: AudioBuffer;
}

/** Lời của cảnh dùng để nhận ra "lời đã đổi sau khi thu". */
export function sceneText(scene: LectureScene): string {
  return scene.lines.map((line) => line.display).join(' ');
}

const EMPTY: ReadonlyMap<string, SceneVoice> = new Map();

interface Loaded {
  /** "dự án:mức" mà danh sách này thuộc về: đổi mức thì không dùng tạm giọng của mức cũ. */
  readonly key: string;
  readonly voices: ReadonlyMap<string, SceneVoice>;
  readonly skipped: number;
}

/** Giọng đã thu của dự án ở một mức chi tiết, đã giải mã sẵn để phát và trộn vào video. */
export function useLectureVoices(projectId: string, level: LectureVoiceLevel) {
  const repos = useRepositories();
  const key = `${projectId}:${level}`;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  /** Bản đã giải mã, theo cảnh + thời điểm thu: lưu một cảnh mới không phải giải mã lại cả bộ. */
  const decodedCache = useRef(new Map<string, AudioBuffer>());

  useEffect(() => {
    let isActive = true;
    (async () => {
      const list = await repos.lectureVoices.list(projectId, level);
      const results = await Promise.allSettled(
        list.map(async (voice) => {
          const cacheKey = `${key}:${voice.sceneId}:${voice.createdAt}`;
          const buffer = decodedCache.current.get(cacheKey) ?? (await decodeVoice(voice.audio));
          decodedCache.current.set(cacheKey, buffer);
          return [voice.sceneId, { voice, buffer }] as const;
        }),
      );
      // Một bản thu hỏng không được làm mất cả bộ: bỏ qua bản đó.
      const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      if (isActive) {
        setLoaded({ key, voices: new Map(ok), skipped: results.length - ok.length });
        setError(null);
      }
    })().catch((e: unknown) => {
      console.error('Không đọc được giọng đã thu', e);
      if (isActive) setError(getErrorMessage(e));
    });
    return () => {
      isActive = false;
    };
  }, [repos, projectId, level, key, version]);

  const save = useCallback(
    async (target: { readonly level: LectureVoiceLevel; readonly sceneId: string; readonly text: string }, recorded: RecordedVoice) => {
      await repos.lectureVoices.save({ projectId, level: target.level, sceneId: target.sceneId, audio: recorded.audio, mime: recorded.mime, duration: recorded.duration, text: target.text });
      setVersion((v) => v + 1);
    },
    [repos, projectId],
  );

  const remove = useCallback(
    async (sceneId: string) => {
      await repos.lectureVoices.remove(projectId, level, sceneId);
      setVersion((v) => v + 1);
    },
    [repos, projectId, level],
  );

  const isCurrent = loaded?.key === key;
  return {
    voices: isCurrent ? loaded.voices : EMPTY,
    isLoading: !isCurrent && error === null,
    skipped: isCurrent ? loaded.skipped : 0,
    error,
    save,
    remove,
  };
}
