import type { LupDatabase } from '../db';
import { NOTE_TEXT_MAX_LENGTH, noteStepSchema, type Note } from '../schemas/notebook';
import { touchProjects } from './touch-project';

/** Ghi chép của học sinh theo từng bước (mỗi dự án, mỗi bước một ghi chép). */
export interface NotebookRepository {
  /** Các ghi chép của dự án, xếp theo tên bước. */
  list(projectId: string): Promise<Note[]>;
  /** Lưu ghi chép của một bước; chỉ còn khoảng trắng thì xóa ghi chép đó. */
  save(projectId: string, step: string, text: string): Promise<void>;
}

export function createDexieNotebookRepository(db: LupDatabase, now: () => string = () => new Date().toISOString()): NotebookRepository {
  return {
    async list(projectId) {
      const records = await db.notes.where('projectId').equals(projectId).toArray();
      return records
        .map(({ step, text }) => ({ step, text }))
        .sort((a, b) => a.step.localeCompare(b.step));
    },

    async save(projectId, step, text) {
      const validStep = noteStepSchema.parse(step);
      const trimmed = text.trim();
      if (trimmed.length > NOTE_TEXT_MAX_LENGTH) throw new Error(`Ghi chép dài tối đa ${NOTE_TEXT_MAX_LENGTH} ký tự`);
      const at = now();
      if (trimmed === '') await db.notes.delete([projectId, validStep]);
      else await db.notes.put({ projectId, step: validStep, text: trimmed, updatedAt: at });
      await touchProjects(db, [projectId], at);
    },
  };
}
