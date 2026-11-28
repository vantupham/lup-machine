import { useEffect, useMemo, useState } from 'react';
import { getErrorMessage } from '@/ui/error-message';
import type { AspectRatio, LectureLevel, LectureScene, LectureScript } from '../lecture-script';
import { buildTimeline, lineSecondsWithVoices, type LectureTimeline } from '../script-timeline';
import { sceneText, useLectureVoices, type SceneVoice } from './useLectureVoices';
import { useVoiceRecorder, type RecordingTarget } from './useVoiceRecorder';
import { mixNarration } from './voice-audio.browser';

const NO_VOICES: ReadonlyMap<string, SceneVoice> = new Map();

/** Chốt lúc bắt đầu thu: lưu đúng mức chi tiết và đúng lời đã đọc, dù sau đó người dùng đổi lựa chọn. */
interface VoiceTarget extends RecordingTarget {
  readonly level: LectureLevel;
  readonly text: string;
}

type Mixed = { readonly timeline: LectureTimeline; readonly buffer: AudioBuffer | null } | { readonly timeline: LectureTimeline; readonly error: string };

/**
 * Giọng đọc của video: bản thu từng cảnh (lưu trên máy), mốc thời gian theo độ dài bản thu thật,
 * và một dải lời đọc đã trộn sẵn cho phần xem trước và tệp xuất ra.
 */
export function useLectureNarration(projectId: string, level: LectureLevel, script: LectureScript | null, aspect: AspectRatio, useVoice: boolean) {
  const voices = useLectureVoices(projectId, level);
  const recorder = useVoiceRecorder<VoiceTarget>(voices.save);
  const active = useVoice ? voices.voices : NO_VOICES;

  const timeline = useMemo<LectureTimeline | null>(() => {
    if (!script) return null;
    const recorded = script.scenes.map((s) => active.get(s.id)?.buffer.duration ?? null);
    const hasAny = recorded.some((d) => d !== null);
    return buildTimeline(script, aspect, hasAny ? lineSecondsWithVoices(script, recorded) : undefined);
  }, [script, aspect, active]);

  /** Chỉ cảnh có trong kịch bản hiện tại mới được trộn (bản thu của cảnh đã bị bỏ thì không tính). */
  const byIndex = useMemo(() => {
    const map = new Map<number, AudioBuffer>();
    script?.scenes.forEach((scene, i) => {
      const voice = active.get(scene.id);
      if (voice) map.set(i, voice.buffer);
    });
    return map;
  }, [script, active]);

  const [mixed, setMixed] = useState<Mixed | null>(null);
  useEffect(() => {
    if (!timeline) return;
    let isActive = true;
    mixNarration(timeline, byIndex).then(
      (buffer) => isActive && setMixed({ timeline, buffer }),
      (e: unknown) => {
        console.error('Không trộn được giọng đọc', e);
        if (isActive) setMixed({ timeline, error: getErrorMessage(e) });
      },
    );
    return () => {
      isActive = false;
    };
  }, [timeline, byIndex]);

  const current = mixed && mixed.timeline === timeline ? mixed : null;
  const narration = current && 'buffer' in current ? current.buffer : null;
  const mixError = current && 'error' in current ? current.error : null;
  const voicedScenes = byIndex.size;
  /** Đang tải bản thu hoặc đang trộn: tạm chưa xuất (tránh xuất nhầm video không lời). */
  const isPreparing = useVoice && (voices.isLoading || (voicedScenes > 0 && current === null));

  return {
    voices: voices.voices,
    voicesError: voices.error ?? mixError,
    skippedVoices: voices.skipped,
    recorder: recorder.state,
    record: (scene: LectureScene) => void recorder.start({ sceneId: scene.id, level, text: sceneText(scene) }),
    stop: recorder.stop,
    remove: (scene: LectureScene) => void voices.remove(scene.id).catch((e: unknown) => console.error('Không xóa được bản thu', e)),
    timeline,
    narration: mixError ? null : narration,
    isPreparing,
    voicedScenes: mixError ? 0 : voicedScenes,
  };
}
