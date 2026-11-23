import type { LupDatabase, TableRecord } from '../db';
import { CSV_LIMITS } from '@/core/tabular/csv';
import { parseTabularConfig, type TabularConfig } from '../schemas/tabular';
import { parseTextConfig, type TextConfig } from '../schemas/text';

/** Cấu hình của dự án dữ liệu bảng hoặc dự án văn bản (cùng lưu bảng CSV). */
export type TableProjectConfig = TabularConfig | TextConfig;

export function parseTableProjectConfig(input: unknown): TableProjectConfig | null {
  return parseTextConfig(input) ?? parseTabularConfig(input);
}

export function isTextConfig(config: TableProjectConfig | null): config is TextConfig {
  return config !== null && 'kind' in config && config.kind === 'text';
}

export function isTabularConfig(config: TableProjectConfig | null): config is TabularConfig {
  return config !== null && !isTextConfig(config);
}

export const TABLE_FILE_NAME_MAX_LENGTH = 120;

export interface SaveTableInput {
  readonly projectId: string;
  readonly csv: string;
  readonly fileName: string;
  /** Mã bộ dữ liệu mẫu (để hiện ghi công), null nếu học sinh tự tải lên. */
  readonly sampleId: string | null;
}

export interface StoredTable {
  readonly projectId: string;
  readonly csv: string;
  readonly fileName: string;
  readonly sampleId: string | null;
  readonly config: TableProjectConfig | null;
  readonly updatedAt: string;
}

/** Bảng dữ liệu (CSV gốc) và cấu hình của một dự án dữ liệu bảng hoặc văn bản; mỗi dự án một bảng. */
export interface TableRepository {
  get(projectId: string): Promise<StoredTable | null>;
  /** Thay bảng dữ liệu; cấu hình cũ bị xóa vì các cột có thể đã khác. */
  saveTable(input: SaveTableInput): Promise<StoredTable>;
  saveConfig(projectId: string, config: TableProjectConfig): Promise<void>;
  delete(projectId: string): Promise<void>;
}

function toStored(record: TableRecord): StoredTable {
  return { ...record, config: parseTableProjectConfig(record.config) };
}

export function createDexieTableRepository(db: LupDatabase, now: () => string = () => new Date().toISOString()): TableRepository {
  return {
    async get(projectId) {
      const record = await db.dataTables.get(projectId);
      return record ? toStored(record) : null;
    },

    async saveTable({ projectId, csv, fileName, sampleId }) {
      if (csv.length > CSV_LIMITS.maxChars) throw new RangeError('Tệp CSV quá lớn');
      const record: TableRecord = {
        projectId,
        csv,
        fileName: fileName.slice(0, TABLE_FILE_NAME_MAX_LENGTH),
        sampleId,
        config: null,
        updatedAt: now(),
      };
      await db.dataTables.put(record);
      return toStored(record);
    },

    async saveConfig(projectId, config) {
      const parsed = parseTableProjectConfig(config);
      if (!parsed) throw new RangeError('Cấu hình không hợp lệ');
      const updated = await db.dataTables.update(projectId, { config: parsed, updatedAt: now() });
      if (updated === 0) throw new RangeError('Dự án chưa có bảng dữ liệu');
    },

    async delete(projectId) {
      await db.dataTables.delete(projectId);
    },
  };
}
