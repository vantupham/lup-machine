import { z } from 'zod';
import type { LupDatabase, RunRecord } from '../db';
import { touchProjects } from './touch-project';
import type { RepositoryDeps } from './project-repository';

/** Giữ nhật ký gọn nhẹ: tối đa ngần này lần chạy mỗi dự án, lần cũ nhất bị xóa trước. */
export const MAX_RUNS_PER_PROJECT = 30;
export const RUN_CONCLUSION_MAX_LENGTH = 1000;

const conclusionSchema = z.string().trim().max(RUN_CONCLUSION_MAX_LENGTH);

const metricSchema = z.object({
  epoch: z.number().int().min(0),
  trainLoss: z.number().finite(),
  trainAccuracy: z.number().min(0).max(1),
  testLoss: z.number().finite().nullable(),
  testAccuracy: z.number().min(0).max(1).nullable(),
});

export const newRunSchema = z.object({
  projectId: z.string().min(1),
  fingerprint: z.string().min(1).max(64),
  options: z.object({
    epochs: z.number().int().min(1).max(500),
    learningRate: z.number().positive().max(1),
    batchSize: z.number().int().min(1).max(256),
    seed: z.number().int(),
  }),
  classNames: z.array(z.string()).min(2),
  counts: z.object({ train: z.number().int().min(0), test: z.number().int().min(0) }),
  metrics: z.array(metricSchema).min(1),
  /** Điểm Kiểm tra học sinh đoán trước khi huấn luyện (0–1). */
  guess: z.object({ testAccuracy: z.number().min(0).max(1) }).strict().optional(),
  /** Kết luận học sinh rút ra sau lần chạy (ghi sau khi chạy xong). */
  conclusion: conclusionSchema.min(1).optional(),
});

export type NewRunInput = z.infer<typeof newRunSchema>;

export interface ExperimentRepository {
  listRuns(projectId: string): Promise<RunRecord[]>;
  addRun(input: NewRunInput): Promise<RunRecord>;
  deleteRun(id: string): Promise<void>;
  /** Ghi kết luận của học sinh cho một lần chạy; chỉ còn khoảng trắng thì bỏ kết luận. */
  setConclusion(id: string, text: string): Promise<void>;
}

const defaultDeps: RepositoryDeps = {
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
};

export function createDexieExperimentRepository(db: LupDatabase, deps: RepositoryDeps = defaultDeps): ExperimentRepository {
  const listRuns = async (projectId: string) =>
    (await db.runs.where('projectId').equals(projectId).toArray()).sort((a, b) => b.number - a.number);

  return {
    listRuns,

    async addRun(input) {
      const valid = newRunSchema.parse(input);
      const record = await db.transaction('rw', db.runs, async () => {
        const existing = await listRuns(valid.projectId);
        const number = (existing[0]?.number ?? 0) + 1;
        const created: RunRecord = { ...valid, id: deps.newId(), number, createdAt: deps.now() };
        await db.runs.add(created);
        const overflow = existing.slice(MAX_RUNS_PER_PROJECT - 1);
        if (overflow.length > 0) await db.runs.bulkDelete(overflow.map((r) => r.id));
        return created;
      });
      await touchProjects(db, [record.projectId], record.createdAt);
      return record;
    },

    async setConclusion(id, text) {
      const conclusion = conclusionSchema.parse(text);
      const run = await db.runs.get(id);
      if (!run) throw new Error(`Không tìm thấy lần chạy: ${id}`);
      await db.runs.update(id, { conclusion: conclusion === '' ? undefined : conclusion });
      await touchProjects(db, [run.projectId], deps.now());
    },

    async deleteRun(id) {
      const projectId = (await db.runs.get(id))?.projectId;
      await db.runs.delete(id);
      await touchProjects(db, [projectId], deps.now());
    },
  };
}
