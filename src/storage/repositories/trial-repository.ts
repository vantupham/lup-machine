import { z } from 'zod';
import type { LupDatabase, TrialRecord } from '../db';
import { MAX_TRIALS_PER_PROJECT, newTrialSchema, TRIAL_CONCLUSION_MAX_LENGTH, type NewTrialInput } from '../schemas/trial';
import type { RepositoryDeps } from './project-repository';
import { touchProjects } from './touch-project';

/** Nhật ký thí nghiệm của các Studio huấn luyện tức thì (âm thanh, tư thế, văn bản, bảng số). */
export interface TrialRepository {
  /** Các lần chạy của dự án, mới nhất trước. */
  list(projectId: string): Promise<TrialRecord[]>;
  add(projectId: string, input: NewTrialInput): Promise<TrialRecord>;
  /** Ghi kết luận cho một lần chạy; chỉ còn khoảng trắng thì bỏ kết luận. */
  setConclusion(id: string, text: string): Promise<void>;
}

const conclusionSchema = z.string().trim().max(TRIAL_CONCLUSION_MAX_LENGTH);

const defaultDeps: RepositoryDeps = {
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
};

export function createDexieTrialRepository(db: LupDatabase, deps: RepositoryDeps = defaultDeps): TrialRepository {
  const list = async (projectId: string) => (await db.trials.where('projectId').equals(projectId).toArray()).sort((a, b) => b.number - a.number);

  return {
    list,

    async add(projectId, input) {
      const valid = newTrialSchema.parse(input);
      const record = await db.transaction('rw', db.trials, async () => {
        const existing = await list(projectId);
        const created: TrialRecord = { ...valid, id: deps.newId(), projectId, number: (existing[0]?.number ?? 0) + 1, createdAt: deps.now() };
        await db.trials.add(created);
        const overflow = existing.slice(MAX_TRIALS_PER_PROJECT - 1);
        if (overflow.length > 0) await db.trials.bulkDelete(overflow.map((t) => t.id));
        return created;
      });
      await touchProjects(db, [projectId], record.createdAt);
      return record;
    },

    async setConclusion(id, text) {
      const conclusion = conclusionSchema.parse(text);
      const trial = await db.trials.get(id);
      if (!trial) throw new Error(`Không tìm thấy lần chạy: ${id}`);
      await db.trials.update(id, { conclusion: conclusion === '' ? undefined : conclusion });
      await touchProjects(db, [trial.projectId], deps.now());
    },
  };
}
