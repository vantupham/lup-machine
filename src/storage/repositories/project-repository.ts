import type { LupDatabase, ProjectRecord } from '../db';
import {
  createProjectSchema,
  updateProjectSchema,
  type CreateProjectInput,
  type UpdateProjectInput,
} from '../schemas/project';

/** Giao diện lưu trữ dự án. Logic nghiệp vụ chỉ phụ thuộc vào giao diện này. */
export interface ProjectRepository {
  findAll(): Promise<ProjectRecord[]>;
  findById(id: string): Promise<ProjectRecord | null>;
  create(input: CreateProjectInput): Promise<ProjectRecord>;
  update(id: string, patch: UpdateProjectInput): Promise<ProjectRecord>;
  delete(id: string): Promise<void>;
  deleteAll(): Promise<void>;
}

export interface RepositoryDeps {
  readonly now: () => string;
  readonly newId: () => string;
}

const defaultDeps: RepositoryDeps = {
  now: () => new Date().toISOString(),
  newId: () => crypto.randomUUID(),
};

export function createDexieProjectRepository(
  db: LupDatabase,
  deps: RepositoryDeps = defaultDeps,
): ProjectRepository {
  return {
    async findAll() {
      return db.projects.orderBy('updatedAt').reverse().toArray();
    },

    async findById(id) {
      return (await db.projects.get(id)) ?? null;
    },

    async create(input) {
      const valid = createProjectSchema.parse(input);
      const timestamp = deps.now();
      const record: ProjectRecord = {
        id: deps.newId(),
        ...valid,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.projects.add(record);
      return record;
    },

    async update(id, patch) {
      const valid = updateProjectSchema.parse(patch);
      return db.transaction('rw', db.projects, async () => {
        const existing = await db.projects.get(id);
        if (!existing) throw new Error(`Không tìm thấy dự án: ${id}`);
        const updated: ProjectRecord = {
          ...existing,
          name: valid.name ?? existing.name,
          updatedAt: deps.now(),
        };
        await db.projects.put(updated);
        return updated;
      });
    },

    async delete(id) {
      await db.transaction('rw', [db.projects, db.classes, db.samples, db.features, db.runs], async () => {
        await db.features.where('projectId').equals(id).delete();
        await db.runs.where('projectId').equals(id).delete();
        await db.samples.where('projectId').equals(id).delete();
        await db.classes.where('projectId').equals(id).delete();
        await db.projects.delete(id);
      });
    },

    async deleteAll() {
      await db.transaction('rw', [db.projects, db.classes, db.samples, db.features, db.runs], async () => {
        await Promise.all([db.runs.clear(), db.features.clear(), db.samples.clear(), db.classes.clear(), db.projects.clear()]);
      });
    },
  };
}
