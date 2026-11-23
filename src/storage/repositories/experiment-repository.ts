import { z } from 'zod';
import type { LupDatabase, RunRecord } from '../db';
import type { RepositoryDeps } from './project-repository';

/** Giữ nhật ký gọn nhẹ: tối đa ngần này lần chạy mỗi dự án, lần cũ nhất bị xóa trước. */
export const MAX_RUNS_PER_PROJECT = 30;

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
});

export type NewRunInput = z.infer<typeof newRunSchema>;

export interface ExperimentRepository {
  listRuns(projectId: string): Promise<RunRecord[]>;
  addRun(input: NewRunInput): Promise<RunRecord>;
  deleteRun(id: string): Promise<void>;
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
      return db.transaction('rw', db.runs, async () => {
        const existing = await listRuns(valid.projectId);
        const number = (existing[0]?.number ?? 0) + 1;
        const record: RunRecord = { ...valid, id: deps.newId(), number, createdAt: deps.now() };
        await db.runs.add(record);
        const overflow = existing.slice(MAX_RUNS_PER_PROJECT - 1);
        if (overflow.length > 0) await db.runs.bulkDelete(overflow.map((r) => r.id));
        return record;
      });
    },

    async deleteRun(id) {
      await db.runs.delete(id);
    },
  };
}
