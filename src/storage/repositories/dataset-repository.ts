import { z } from 'zod';
import type { ClassRecord, LupDatabase, SampleRecord, SampleSource, Split, StoredImage } from '../db';
import type { RepositoryDeps } from './project-repository';

/** Giới hạn để máy phòng tin cấu hình thấp vẫn chạy mượt. */
export const MAX_SAMPLES_PER_CLASS = 300;
export const CLASS_NAME_MAX_LENGTH = 40;

const classNameSchema = z.string().trim().min(1).max(CLASS_NAME_MAX_LENGTH);

export interface NewSampleInput {
  readonly projectId: string;
  readonly classId: string;
  readonly split: Split;
  readonly source: SampleSource;
  readonly image: StoredImage;
}

export type SplitCounts = Record<string, { train: number; test: number }>;

export interface DatasetRepository {
  listClasses(projectId: string): Promise<ClassRecord[]>;
  addClass(projectId: string, name: string): Promise<ClassRecord>;
  renameClass(classId: string, name: string): Promise<ClassRecord>;
  deleteClass(classId: string): Promise<void>;
  listSamples(projectId: string): Promise<SampleRecord[]>;
  addSamples(inputs: readonly NewSampleInput[]): Promise<SampleRecord[]>;
  setSplits(changes: readonly { id: string; split: Split }[]): Promise<void>;
  deleteSample(sampleId: string): Promise<void>;
  countSamples(projectId: string): Promise<SplitCounts>;
  deleteProjectData(projectId: string): Promise<void>;
  listFeatures(projectId: string, modelId: string): Promise<Map<string, Float32Array>>;
  putFeatures(
    projectId: string,
    modelId: string,
    items: readonly { sampleId: string; vector: Float32Array }[],
  ): Promise<void>;
}

const defaultDeps: RepositoryDeps = {
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
};

function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('vi') === b.trim().toLocaleLowerCase('vi');
}

export function createDexieDatasetRepository(
  db: LupDatabase,
  deps: RepositoryDeps = defaultDeps,
): DatasetRepository {
  const listClasses = async (projectId: string) =>
    (await db.classes.where('projectId').equals(projectId).toArray()).sort((a, b) => a.order - b.order);

  const assertUniqueName = async (projectId: string, name: string, exceptId?: string) => {
    const existing = await listClasses(projectId);
    if (existing.some((c) => c.id !== exceptId && sameName(c.name, name))) {
      throw new Error(`Lớp "${name}" đã có trong dự án`);
    }
  };

  return {
    listClasses,

    async addClass(projectId, rawName) {
      const name = classNameSchema.parse(rawName);
      return db.transaction('rw', db.classes, async () => {
        await assertUniqueName(projectId, name);
        const existing = await listClasses(projectId);
        const order = existing.reduce((max, c) => Math.max(max, c.order + 1), 0);
        const record: ClassRecord = { id: deps.newId(), projectId, name, order, createdAt: deps.now() };
        await db.classes.add(record);
        return record;
      });
    },

    async renameClass(classId, rawName) {
      const name = classNameSchema.parse(rawName);
      return db.transaction('rw', db.classes, async () => {
        const existing = await db.classes.get(classId);
        if (!existing) throw new Error(`Không tìm thấy lớp: ${classId}`);
        await assertUniqueName(existing.projectId, name, classId);
        const updated: ClassRecord = { ...existing, name };
        await db.classes.put(updated);
        return updated;
      });
    },

    async deleteClass(classId) {
      await db.transaction('rw', [db.classes, db.samples, db.features], async () => {
        const sampleIds = (await db.samples.where('classId').equals(classId).primaryKeys()) as string[];
        await db.features.where('sampleId').anyOf(sampleIds).delete();
        await db.samples.bulkDelete(sampleIds);
        await db.classes.delete(classId);
      });
    },

    async listSamples(projectId) {
      const samples = await db.samples.where('projectId').equals(projectId).toArray();
      return samples.sort(compareSamples);
    },

    async addSamples(inputs) {
      return db.transaction('rw', db.classes, db.samples, async () => {
        await assertCapacity(db, inputs);
        const createdAt = deps.now();
        const nextSeq = await nextSeqByProject(db, inputs);
        const records = inputs.map((input): SampleRecord => {
          const seq = nextSeq.get(input.projectId) ?? 0;
          nextSeq.set(input.projectId, seq + 1);
          return { ...input, id: deps.newId(), createdAt, seq };
        });
        await db.samples.bulkAdd(records);
        return records;
      });
    },

    async setSplits(changes) {
      await db.transaction('rw', db.samples, async () => {
        for (const { id, split } of changes) await db.samples.update(id, { split });
      });
    },

    async deleteSample(sampleId) {
      await db.transaction('rw', db.samples, db.features, async () => {
        await db.features.where('sampleId').equals(sampleId).delete();
        await db.samples.delete(sampleId);
      });
    },

    async countSamples(projectId) {
      const counts: SplitCounts = {};
      for (const c of await listClasses(projectId)) counts[c.id] = { train: 0, test: 0 };
      await db.samples
        .where('projectId')
        .equals(projectId)
        .each((s) => {
          const entry = counts[s.classId];
          if (entry) counts[s.classId] = { ...entry, [s.split]: entry[s.split] + 1 };
        });
      return counts;
    },

    async deleteProjectData(projectId) {
      await db.transaction('rw', [db.classes, db.samples, db.features], async () => {
        await db.features.where('projectId').equals(projectId).delete();
        await db.samples.where('projectId').equals(projectId).delete();
        await db.classes.where('projectId').equals(projectId).delete();
      });
    },

    async listFeatures(projectId, modelId) {
      const records = await db.features.where('projectId').equals(projectId).toArray();
      return new Map(
        records.filter((r) => r.modelId === modelId).map((r) => [r.sampleId, new Float32Array(r.vector)]),
      );
    },

    async putFeatures(projectId, modelId, items) {
      await db.features.bulkPut(
        items.map(({ sampleId, vector }) => ({
          sampleId,
          modelId,
          projectId,
          vector: vector.buffer.slice(vector.byteOffset, vector.byteOffset + vector.byteLength) as ArrayBuffer,
        })),
      );
    },
  };
}

/** seq tiếp theo của mỗi dự án = seq lớn nhất hiện có + 1 (tăng liên tục, không đánh lại theo lô). */
async function nextSeqByProject(db: LupDatabase, inputs: readonly NewSampleInput[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const projectId of new Set(inputs.map((i) => i.projectId))) {
    let max = -1;
    await db.samples.where('projectId').equals(projectId).each((s) => {
      max = Math.max(max, s.seq ?? -1);
    });
    result.set(projectId, max + 1);
  }
  return result;
}

/** Thứ tự ổn định: thời điểm thêm → số thứ tự seq → id. */
function compareSamples(a: SampleRecord, b: SampleRecord): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1;
  const bySeq = (a.seq ?? 0) - (b.seq ?? 0);
  if (bySeq !== 0) return bySeq;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

async function assertCapacity(db: LupDatabase, inputs: readonly NewSampleInput[]): Promise<void> {
  const incoming = new Map<string, number>();
  for (const input of inputs) incoming.set(input.classId, (incoming.get(input.classId) ?? 0) + 1);
  for (const [classId, added] of incoming) {
    if (!(await db.classes.get(classId))) throw new Error(`Không tìm thấy lớp: ${classId}`);
    const current = await db.samples.where('classId').equals(classId).count();
    if (current + added > MAX_SAMPLES_PER_CLASS) {
      throw new Error(`Mỗi lớp có tối đa ${MAX_SAMPLES_PER_CLASS} ảnh (hiện có ${current})`);
    }
  }
}
