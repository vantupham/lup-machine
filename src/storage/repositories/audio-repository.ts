import type { AudioClipRecord, AudioSource, LupDatabase } from '../db';
import { AUDIO } from '@/core/audio/features';

/** Mỗi lớp tối đa ngần này đoạn (mỗi đoạn 64 KB). */
export const MAX_CLIPS_PER_CLASS = 100;

export interface NewClipInput {
  readonly projectId: string;
  readonly classId: string;
  readonly source: AudioSource;
  /** Đúng 1 giây, 16 kHz. */
  readonly samples: Float32Array;
}

export interface AudioRepository {
  listClips(projectId: string): Promise<AudioClipRecord[]>;
  addClips(inputs: readonly NewClipInput[]): Promise<AudioClipRecord[]>;
  deleteClip(clipId: string): Promise<void>;
}

export function clipSamples(record: AudioClipRecord): Float32Array {
  return new Float32Array(record.pcm);
}

export function createDexieAudioRepository(
  db: LupDatabase,
  deps: { now: () => string; newId: () => string } = { now: () => new Date().toISOString(), newId: () => crypto.randomUUID() },
): AudioRepository {
  return {
    async listClips(projectId) {
      const clips = await db.audioClips.where('projectId').equals(projectId).toArray();
      return clips.sort((a, b) => a.seq - b.seq);
    },

    async addClips(inputs) {
      return db.transaction('rw', db.classes, db.audioClips, async () => {
        const incoming = new Map<string, number>();
        for (const input of inputs) {
          if (input.samples.length !== AUDIO.clipSamples) throw new RangeError(`Đoạn âm thanh phải dài đúng ${AUDIO.clipSamples} mẫu`);
          incoming.set(input.classId, (incoming.get(input.classId) ?? 0) + 1);
        }
        for (const [classId, added] of incoming) {
          if (!(await db.classes.get(classId))) throw new Error(`Không tìm thấy lớp: ${classId}`);
          const current = await db.audioClips.where('classId').equals(classId).count();
          if (current + added > MAX_CLIPS_PER_CLASS) throw new Error(`Mỗi lớp có tối đa ${MAX_CLIPS_PER_CLASS} đoạn âm thanh (hiện có ${current})`);
        }
        const existing = inputs[0] ? await db.audioClips.where('projectId').equals(inputs[0].projectId).toArray() : [];
        let seq = existing.reduce((m, c) => Math.max(m, c.seq + 1), 0);
        const createdAt = deps.now();
        const records = inputs.map((input): AudioClipRecord => ({
          id: deps.newId(),
          projectId: input.projectId,
          classId: input.classId,
          source: input.source,
          pcm: input.samples.buffer.slice(input.samples.byteOffset, input.samples.byteOffset + input.samples.byteLength) as ArrayBuffer,
          createdAt,
          seq: seq++,
        }));
        await db.audioClips.bulkAdd(records);
        return records;
      });
    },

    async deleteClip(clipId) {
      await db.audioClips.delete(clipId);
    },
  };
}
