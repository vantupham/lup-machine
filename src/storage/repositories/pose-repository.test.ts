import { synthesizePose } from '@/core/pose/synthetic-poses';
import { unpackKeypoints } from '@/core/pose/features';
import { LupDatabase } from '../db';
import { createDexieDatasetRepository } from './dataset-repository';
import { createDexiePoseRepository, MAX_POSES_PER_CLASS } from './pose-repository';
import { createDexieProjectRepository } from './project-repository';

async function setup() {
  const db = new LupDatabase(`pose-test-${crypto.randomUUID()}`);
  const projects = createDexieProjectRepository(db);
  const dataset = createDexieDatasetRepository(db);
  const poses = createDexiePoseRepository(db);
  const project = await projects.create({ name: 'Tư thế', projectType: 'pose' });
  const cls = await dataset.addClass(project.id, 'Giơ tay');
  return { projects, dataset, poses, project, cls };
}

const body = synthesizePose('body', 'arms-up', 1).keypoints;

describe('PoseRepository', () => {
  test('chỉ lưu tọa độ khớp; đọc lại đúng từng khớp', async () => {
    const { poses, project, cls } = await setup();
    await poses.addPoses([{ projectId: project.id, classId: cls.id, kind: 'body', source: 'webcam', keypoints: body, width: 640, height: 480 }]);
    const [saved] = await poses.listPoses(project.id);
    expect(saved).toMatchObject({ kind: 'body', width: 640, height: 480, seq: 0 });
    expect(unpackKeypoints(saved!.keypoints)).toEqual(body);
    expect(Object.keys(saved!)).not.toContain('image');
    await poses.deletePose(saved!.id);
    expect(await poses.listPoses(project.id)).toEqual([]);
  });

  test('từ chối sai số khớp, tọa độ không hợp lệ, lớp không tồn tại, vượt giới hạn', async () => {
    const { poses, project, cls } = await setup();
    const base = { projectId: project.id, classId: cls.id, kind: 'body' as const, source: 'upload' as const, width: 10, height: 10 };
    await expect(poses.addPoses([{ ...base, keypoints: body.slice(0, 5) }])).rejects.toThrow(RangeError);
    await expect(poses.addPoses([{ ...base, keypoints: body.map((k, i) => (i ? k : { ...k, x: Number.NaN })) }])).rejects.toThrow(RangeError);
    await expect(poses.addPoses([{ ...base, classId: 'khong-co', keypoints: body }])).rejects.toThrow(/Không tìm thấy lớp/);
    await expect(poses.addPoses(Array.from({ length: MAX_POSES_PER_CLASS + 1 }, () => ({ ...base, keypoints: body })))).rejects.toThrow(/tối đa/);
  });

  test('xóa lớp hoặc dự án thì xóa luôn mẫu tư thế', async () => {
    const { poses, dataset, projects, project, cls } = await setup();
    const other = await dataset.addClass(project.id, 'Dang tay');
    const base = { projectId: project.id, kind: 'body' as const, source: 'dataset' as const, keypoints: body, width: 10, height: 10 };
    await poses.addPoses([{ ...base, classId: cls.id }, { ...base, classId: other.id }]);
    await dataset.deleteClass(cls.id);
    expect((await poses.listPoses(project.id)).map((p) => p.classId)).toEqual([other.id]);
    await projects.delete(project.id);
    expect(await poses.listPoses(project.id)).toEqual([]);
  });
});
