import type { LupDatabase, ModelCardRecord } from '../db';
import { modelCardFieldsSchema, parseModelCardFields, type ModelCardFields } from '../schemas/model-card';

export type ModelCard = ModelCardFields & { readonly projectId: string; readonly updatedAt: string };

/** Thẻ mô hình của mỗi dự án (một dự án một thẻ). */
export interface ModelCardRepository {
  get(projectId: string): Promise<ModelCard | null>;
  save(projectId: string, fields: ModelCardFields): Promise<ModelCard>;
}

export function createDexieModelCardRepository(db: LupDatabase, now: () => string = () => new Date().toISOString()): ModelCardRepository {
  return {
    async get(projectId) {
      const record = await db.modelCards.get(projectId);
      if (!record) return null;
      // Dữ liệu cũ hoặc hỏng thì coi như chưa có thẻ, không làm hỏng trang.
      const fields = parseModelCardFields(record.fields);
      return fields ? { ...fields, projectId, updatedAt: record.updatedAt } : null;
    },

    async save(projectId, input) {
      const fields = modelCardFieldsSchema.parse(input);
      const record: ModelCardRecord = { projectId, fields, updatedAt: now() };
      await db.modelCards.put(record);
      return { ...fields, projectId, updatedAt: record.updatedAt };
    },
  };
}
