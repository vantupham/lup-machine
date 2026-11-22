import Dexie, { type EntityTable } from 'dexie';
import type { ProjectType } from './schemas/project';

export interface ProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly projectType: ProjectType;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ClassRecord {
  readonly id: string;
  readonly projectId: string;
  readonly name: string;
  readonly order: number;
  readonly createdAt: string;
}

export type Split = 'train' | 'test';
export type SampleSource = 'upload' | 'webcam' | 'dataset';

/** Ảnh đã chuẩn hóa về 224×224 — chính là ảnh mô hình nhận được. */
export interface StoredImage {
  readonly bytes: ArrayBuffer;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
}

export interface SampleRecord {
  readonly id: string;
  readonly projectId: string;
  readonly classId: string;
  readonly split: Split;
  readonly source: SampleSource;
  readonly image: StoredImage;
  readonly createdAt: string;
}

export const DEFAULT_DB_NAME = 'lup-machine';

/** Cơ sở dữ liệu IndexedDB cục bộ. Dữ liệu chỉ nằm trên máy người dùng. */
export class LupDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>;
  classes!: EntityTable<ClassRecord, 'id'>;
  samples!: EntityTable<SampleRecord, 'id'>;

  constructor(name: string = DEFAULT_DB_NAME) {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt',
    });
    this.version(2).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
    });
  }
}
