import type { LupDatabase, PoseSampleRecord, PoseSource } from '../db';
import { touchProjects } from './touch-project';
import { keypointCount, packKeypoints, type PoseKind } from '@/core/pose/features';
import type { Keypoint } from '@/core/pose/detectors';

/** Mỗi lớp tối đa ngần này mẫu (mỗi mẫu chỉ vài trăm byte). */
export const MAX_POSES_PER_CLASS = 300;

export interface NewPoseInput {
  readonly projectId: string;
  readonly classId: string;
  readonly kind: PoseKind;
  readonly source: PoseSource;
  readonly keypoints: readonly Keypoint[];
  readonly width: number;
  readonly height: number;
}

export interface PoseRepository {
  listPoses(projectId: string): Promise<PoseSampleRecord[]>;
  addPoses(inputs: readonly NewPoseInput[]): Promise<PoseSampleRecord[]>;
  deletePose(id: string): Promise<void>;
}

export function createDexiePoseRepository(
  db: LupDatabase,
  deps: { now: () => string; newId: () => string } = { now: () => new Date().toISOString(), newId: () => crypto.randomUUID() },
): PoseRepository {
  return {
    async listPoses(projectId) {
      return (await db.poseSamples.where('projectId').equals(projectId).toArray()).sort((a, b) => a.seq - b.seq);
    },

    async addPoses(inputs) {
      const records = await db.transaction('rw', db.classes, db.poseSamples, async () => {
        const incoming = new Map<string, number>();
        for (const input of inputs) {
          if (input.keypoints.length !== keypointCount(input.kind)) throw new RangeError(`Cần đúng ${keypointCount(input.kind)} khớp`);
          if (input.keypoints.some((k) => ![k.x, k.y, k.score].every(Number.isFinite))) throw new RangeError('Tọa độ khớp không hợp lệ');
          incoming.set(input.classId, (incoming.get(input.classId) ?? 0) + 1);
        }
        for (const [classId, added] of incoming) {
          if (!(await db.classes.get(classId))) throw new Error(`Không tìm thấy lớp: ${classId}`);
          const current = await db.poseSamples.where('classId').equals(classId).count();
          if (current + added > MAX_POSES_PER_CLASS) throw new Error(`Mỗi lớp có tối đa ${MAX_POSES_PER_CLASS} mẫu tư thế (hiện có ${current})`);
        }
        const existing = inputs[0] ? await db.poseSamples.where('projectId').equals(inputs[0].projectId).toArray() : [];
        let seq = existing.reduce((m, p) => Math.max(m, p.seq + 1), 0);
        const createdAt = deps.now();
        const created = inputs.map((input): PoseSampleRecord => ({
          id: deps.newId(),
          projectId: input.projectId,
          classId: input.classId,
          kind: input.kind,
          source: input.source,
          keypoints: packKeypoints(input.keypoints),
          width: input.width,
          height: input.height,
          createdAt,
          seq: seq++,
        }));
        await db.poseSamples.bulkAdd(created);
        return created;
      });
      await touchProjects(db, records.map((r) => r.projectId), records[0]?.createdAt ?? deps.now());
      return records;
    },

    async deletePose(id) {
      const projectId = (await db.poseSamples.get(id))?.projectId;
      await db.poseSamples.delete(id);
      await touchProjects(db, [projectId], deps.now());
    },
  };
}
