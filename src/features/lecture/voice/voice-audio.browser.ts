import type { LectureTimeline } from '../script-timeline';

/** Tần số lấy mẫu của dải lời đọc trong video (chuẩn của AAC/Opus). */
export const NARRATION_SAMPLE_RATE = 48_000;

/** Giải mã một bản thu (Opus/AAC…) thành AudioBuffer. Sao chép dữ liệu vì decodeAudioData "lấy mất" ArrayBuffer. */
export async function decodeVoice(audio: ArrayBuffer): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(1, 1, NARRATION_SAMPLE_RATE);
  return ctx.decodeAudioData(audio.slice(0));
}

/**
 * Trộn giọng từng cảnh thành MỘT dải lời đọc dài bằng cả video: bản thu của cảnh i bắt đầu đúng lúc cảnh i bắt đầu.
 * Không có cảnh nào được thu thì trả null (video không lời).
 */
export async function mixNarration(timeline: LectureTimeline, voices: ReadonlyMap<number, AudioBuffer>): Promise<AudioBuffer | null> {
  if (voices.size === 0 || timeline.duration <= 0) return null;
  const length = Math.ceil(timeline.duration * NARRATION_SAMPLE_RATE);
  const ctx = new OfflineAudioContext(1, length, NARRATION_SAMPLE_RATE);
  for (const [index, buffer] of voices) {
    const scene = timeline.scenes[index];
    if (!scene) continue;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(scene.start);
  }
  return ctx.startRendering();
}

/** Cắt đoạn [from, to) giây của dải lời đọc thành một AudioBuffer mới (để đưa dần vào bộ mã hóa). */
export function sliceNarration(narration: AudioBuffer, from: number, to: number): AudioBuffer | null {
  const start = Math.max(0, Math.floor(from * narration.sampleRate));
  const end = Math.min(narration.length, Math.floor(to * narration.sampleRate));
  if (end <= start) return null;
  const chunk = new AudioBuffer({ length: end - start, numberOfChannels: 1, sampleRate: narration.sampleRate });
  chunk.copyToChannel(narration.getChannelData(0).subarray(start, end), 0);
  return chunk;
}
