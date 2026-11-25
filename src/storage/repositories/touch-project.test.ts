import { AUDIO } from '@/core/audio/features';
import { synthesizePose } from '@/core/pose/synthetic-poses';
import { LupDatabase, type StoredImage } from '../db';
import { createDexieAudioRepository } from './audio-repository';
import { createDexieDatasetRepository } from './dataset-repository';
import { createDexieExperimentRepository } from './experiment-repository';
import { createDexiePoseRepository } from './pose-repository';
import { createDexieProjectRepository } from './project-repository';
import { createDexieTableRepository } from './table-repository';

/** Đồng hồ giả: mỗi lần gọi tăng 1 phút, để thấy rõ thao tác nào đã đẩy "Cập nhật" lên. */
function fakeClock() {
  let minute = 0;
  const at = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m)).toISOString();
  return { now: () => at(minute++), peek: () => at(minute - 1) };
}

async function setup() {
  const db = new LupDatabase(`touch-test-${crypto.randomUUID()}`);
  const clock = fakeClock();
  const deps = { now: clock.now, newId: () => crypto.randomUUID() };
  const projects = createDexieProjectRepository(db, deps);
  const repos = {
    dataset: createDexieDatasetRepository(db, deps),
    audio: createDexieAudioRepository(db, deps),
    poses: createDexiePoseRepository(db, deps),
    tables: createDexieTableRepository(db, clock.now),
    experiments: createDexieExperimentRepository(db, deps),
  };
  const updatedAt = async (id: string) => (await projects.findById(id))!.updatedAt;
  return { db, projects, ...repos, clock, updatedAt };
}

const image: StoredImage = { bytes: new ArrayBuffer(4), mime: 'image/png', width: 1, height: 1 };

describe('mọi thao tác sửa dữ liệu đều cập nhật thời điểm sửa của dự án', () => {
  test('lớp và ảnh: thêm, đổi tên, chia, xóa', async () => {
    const { projects, dataset, clock, updatedAt } = await setup();
    const project = await projects.create({ name: 'Ảnh', projectType: 'image' });
    const steps: (() => Promise<unknown>)[] = [];
    const cls = await dataset.addClass(project.id, 'Mèo');
    expect(await updatedAt(project.id)).toBe(clock.peek());

    const [sample] = await dataset.addSamples([{ projectId: project.id, classId: cls.id, split: 'train', source: 'upload', image }]);
    steps.push(
      () => dataset.renameClass(cls.id, 'Chó'),
      () => dataset.setSplits([{ id: sample!.id, split: 'test' }]),
      () => dataset.deleteSample(sample!.id),
      () => dataset.deleteClass(cls.id),
    );
    expect(await updatedAt(project.id)).toBe(clock.peek());
    for (const step of steps) {
      const before = await updatedAt(project.id);
      await step();
      expect(await updatedAt(project.id)).not.toBe(before);
      expect(await updatedAt(project.id)).toBe(clock.peek());
    }
  });

  test('âm thanh, tư thế, bảng số, lần huấn luyện', async () => {
    const { projects, dataset, audio, poses, tables, experiments, clock, updatedAt } = await setup();
    const project = await projects.create({ name: 'Nhiều loại', projectType: 'audio' });
    const cls = await dataset.addClass(project.id, 'Vỗ tay');

    const [clip] = await audio.addClips([{ projectId: project.id, classId: cls.id, source: 'microphone', samples: new Float32Array(AUDIO.clipSamples) }]);
    expect(await updatedAt(project.id)).toBe(clock.peek());
    await audio.deleteClip(clip!.id);
    expect(await updatedAt(project.id)).toBe(clock.peek());

    const keypoints = synthesizePose('body', 'arms-up', 1).keypoints;
    const [pose] = await poses.addPoses([{ projectId: project.id, classId: cls.id, kind: 'body', source: 'webcam', keypoints, width: 640, height: 480 }]);
    expect(await updatedAt(project.id)).toBe(clock.peek());
    await poses.deletePose(pose!.id);
    expect(await updatedAt(project.id)).toBe(clock.peek());

    await tables.saveTable({ projectId: project.id, csv: 'a,b\n1,2', fileName: 'x.csv', sampleId: null });
    expect(await updatedAt(project.id)).toBe(clock.peek());

    await experiments.addRun({
      projectId: project.id,
      fingerprint: 'f',
      options: { epochs: 1, learningRate: 0.01, batchSize: 8, seed: 1 },
      classNames: ['A', 'B'],
      counts: { train: 2, test: 0 },
      metrics: [{ epoch: 1, trainLoss: 0.5, trainAccuracy: 0.5, testLoss: null, testAccuracy: null }],
    });
    expect(await updatedAt(project.id)).toBe(clock.peek());
  });

  test('dự án vừa sửa đứng đầu danh sách', async () => {
    const { projects, dataset } = await setup();
    const older = await projects.create({ name: 'Cũ', projectType: 'image' });
    await projects.create({ name: 'Mới', projectType: 'image' });
    await dataset.addClass(older.id, 'Lớp A');
    expect((await projects.findAll()).map((p) => p.name)).toEqual(['Cũ', 'Mới']);
  });

  test('thao tác thất bại thì không đổi thời điểm sửa', async () => {
    const { projects, dataset, updatedAt } = await setup();
    const project = await projects.create({ name: 'Ảnh', projectType: 'image' });
    await dataset.addClass(project.id, 'Mèo');
    const before = await updatedAt(project.id);
    await expect(dataset.addClass(project.id, 'mèo')).rejects.toThrow();
    expect(await updatedAt(project.id)).toBe(before);
  });

  test('ghi thời điểm sửa thất bại thì thao tác chính vẫn thành công (tránh học sinh bấm lại, nhân đôi dữ liệu)', async () => {
    const { projects, dataset, db, updatedAt } = await setup();
    const project = await projects.create({ name: 'Ảnh', projectType: 'image' });
    const before = await updatedAt(project.id);
    vi.spyOn(db.projects, 'where').mockImplementation(() => {
      throw new Error('hết dung lượng');
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const cls = await dataset.addClass(project.id, 'Mèo');
    expect(cls.name).toBe('Mèo');
    vi.restoreAllMocks();
    expect(await updatedAt(project.id)).toBe(before);
  });

  test('xóa bảng và xóa một lần huấn luyện cũng tính là sửa', async () => {
    const { projects, tables, experiments, clock, updatedAt } = await setup();
    const project = await projects.create({ name: 'Bảng', projectType: 'tabular' });
    await tables.saveTable({ projectId: project.id, csv: 'a,b\n1,2', fileName: 'x.csv', sampleId: null });
    await tables.delete(project.id);
    expect(await updatedAt(project.id)).toBe(clock.peek());
    const run = await experiments.addRun({
      projectId: project.id,
      fingerprint: 'f',
      options: { epochs: 1, learningRate: 0.01, batchSize: 8, seed: 1 },
      classNames: ['A', 'B'],
      counts: { train: 2, test: 0 },
      metrics: [{ epoch: 1, trainLoss: 0.5, trainAccuracy: 0.5, testLoss: null, testAccuracy: null }],
    });
    const afterRun = await updatedAt(project.id);
    await experiments.deleteRun(run.id);
    expect(await updatedAt(project.id)).not.toBe(afterRun);
    expect(await updatedAt(project.id)).toBe(clock.peek());
  });
});
