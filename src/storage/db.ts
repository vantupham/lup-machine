import Dexie, { type EntityTable } from 'dexie';
import type { ProjectType } from './schemas/project';

export interface ProjectRecord {
  readonly id: string;
  readonly name: string;
  readonly projectType: ProjectType;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const DEFAULT_DB_NAME = 'lup-machine';

/** Cơ sở dữ liệu IndexedDB cục bộ. Dữ liệu chỉ nằm trên máy người dùng. */
export class LupDatabase extends Dexie {
  projects!: EntityTable<ProjectRecord, 'id'>;

  constructor(name: string = DEFAULT_DB_NAME) {
    super(name);
    this.version(1).stores({
      projects: 'id, updatedAt',
    });
  }
}
