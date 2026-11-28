import type { LectureVoiceRecord, LupDatabase } from '../db';

/** Một cảnh dài nhất ngần này giây (lời giảng mỗi cảnh chỉ vài câu). */
export const LECTURE_VOICE_MAX_SECONDS = 180;
/** Giới hạn dung lượng mỗi bản thu (Opus ~ 32 kbit/s: 3 phút ≈ 0,7 MB; chừa rộng cho trình duyệt dùng AAC). */
export const LECTURE_VOICE_MAX_BYTES = 8_000_000;

export type LectureVoiceLevel = 'explore' | 'expert';

export interface NewLectureVoice {
  readonly projectId: string;
  readonly level: LectureVoiceLevel;
  readonly sceneId: string;
  readonly audio: ArrayBuffer;
  readonly mime: string;
  /** Giây, đo bằng giải mã âm thanh thật. */
  readonly duration: number;
  /** Lời đọc của cảnh lúc thu (để biết lời đã đổi sau khi thu). */
  readonly text: string;
}

export type LectureVoice = Omit<LectureVoiceRecord, 'key'>;

/**
 * Giọng thu cho video bài giảng: chỉ lưu trên máy này (không vào tệp .lup, không gửi đi đâu),
 * mỗi dự án, mỗi mức chi tiết, mỗi cảnh một bản.
 */
export interface LectureVoiceRepository {
  list(projectId: string, level: LectureVoiceLevel): Promise<LectureVoice[]>;
  save(voice: NewLectureVoice): Promise<void>;
  remove(projectId: string, level: LectureVoiceLevel, sceneId: string): Promise<void>;
}

const keyOf = (level: string, sceneId: string) => `${level}:${sceneId}`;

function validate(voice: NewLectureVoice): void {
  if (!voice.mime.startsWith('audio/')) throw new Error(`Không phải tệp âm thanh: ${voice.mime}`);
  if (voice.audio.byteLength === 0) throw new Error('Bản thu rỗng');
  if (voice.audio.byteLength > LECTURE_VOICE_MAX_BYTES) throw new Error('Bản thu quá nặng');
  if (!Number.isFinite(voice.duration) || voice.duration <= 0 || voice.duration > LECTURE_VOICE_MAX_SECONDS) {
    throw new Error(`Thời lượng bản thu không hợp lệ: ${voice.duration}`);
  }
}

export function createDexieLectureVoiceRepository(db: LupDatabase, now: () => string = () => new Date().toISOString()): LectureVoiceRepository {
  return {
    async list(projectId, level) {
      const records = await db.lectureVoices.where('projectId').equals(projectId).toArray();
      return records
        .filter((r) => r.level === level)
        .map((r): LectureVoice => ({ projectId: r.projectId, level: r.level, sceneId: r.sceneId, audio: r.audio, mime: r.mime, duration: r.duration, text: r.text, createdAt: r.createdAt }))
        .sort((a, b) => a.sceneId.localeCompare(b.sceneId));
    },

    async save(voice) {
      validate(voice);
      await db.lectureVoices.put({ ...voice, key: keyOf(voice.level, voice.sceneId), createdAt: now() });
    },

    async remove(projectId, level, sceneId) {
      await db.lectureVoices.delete([projectId, keyOf(level, sceneId)]);
    },
  };
}
