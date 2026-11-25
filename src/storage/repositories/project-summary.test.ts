import { AUDIO } from '@/core/audio/features';
import { LupDatabase, type StoredImage } from '../db';
import { createDexieAudioRepository } from './audio-repository';
import { createDexieDatasetRepository } from './dataset-repository';
import { createDexieExperimentRepository } from './experiment-repository';
import { createDexieProjectRepository } from './project-repository';
import { createDexieTableRepository } from './table-repository';

function setup() {
  const db = new LupDatabase(`summary-test-${crypto.randomUUID()}`);
  return {
    projects: createDexieProjectRepository(db),
    dataset: createDexieDatasetRepository(db),
    audio: createDexieAudioRepository(db),
    tables: createDexieTableRepository(db),
    experiments: createDexieExperimentRepository(db),
  };
}

const imageOf = (mark: number): StoredImage => ({ bytes: new Uint8Array([mark]).buffer, mime: 'image/png', width: 1, height: 1 });

describe('tóm tắt dự án cho thẻ trong danh sách', () => {
  test('dự án ảnh: số lớp, số ảnh, một ảnh đại diện cho từng lớp theo thứ tự lớp, số lần huấn luyện', async () => {
    const { projects, dataset, experiments } = setup();
    const project = await projects.create({ name: 'Rác', projectType: 'image' });
    const paper = await dataset.addClass(project.id, 'Giấy');
    const plastic = await dataset.addClass(project.id, 'Nhựa');
    await dataset.addClass(project.id, 'Trống');
    await dataset.addSamples([
      { projectId: project.id, classId: plastic.id, split: 'train', source: 'upload', image: imageOf(2) },
      { projectId: project.id, classId: paper.id, split: 'train', source: 'upload', image: imageOf(1) },
      { projectId: project.id, classId: paper.id, split: 'test', source: 'upload', image: imageOf(3) },
    ]);
    await experiments.addRun({
      projectId: project.id,
      fingerprint: 'f',
      options: { epochs: 1, learningRate: 0.01, batchSize: 8, seed: 1 },
      classNames: ['Giấy', 'Nhựa'],
      counts: { train: 2, test: 1 },
      metrics: [{ epoch: 1, trainLoss: 0.5, trainAccuracy: 0.5, testLoss: null, testAccuracy: null }],
    });

    const summary = await projects.summarize((await projects.findById(project.id))!);
    expect(summary).toMatchObject({ classCount: 3, itemCount: 3, runCount: 1, hasTable: false });
    const marks = summary.thumbnails.map((img) => new Uint8Array(img.bytes)[0]);
    expect(marks).toHaveLength(2);
    expect([1, 3]).toContain(marks[0]);
    expect(marks[1]).toBe(2);
  });

  test('dự án âm thanh đếm đoạn âm thanh, không có ảnh thu nhỏ', async () => {
    const { projects, dataset, audio } = setup();
    const project = await projects.create({ name: 'Âm', projectType: 'audio' });
    const cls = await dataset.addClass(project.id, 'Vỗ tay');
    await audio.addClips([1, 2].map(() => ({ projectId: project.id, classId: cls.id, source: 'microphone' as const, samples: new Float32Array(AUDIO.clipSamples) })));
    expect(await projects.summarize(project)).toEqual({ classCount: 1, itemCount: 2, runCount: 0, hasTable: false, thumbnails: [] });
  });

  test('dự án bảng: biết đã có bảng hay chưa', async () => {
    const { projects, tables } = setup();
    const project = await projects.create({ name: 'Bảng', projectType: 'tabular' });
    expect((await projects.summarize(project)).hasTable).toBe(false);
    await tables.saveTable({ projectId: project.id, csv: 'a,b\n1,2', fileName: 'x.csv', sampleId: null });
    expect(await projects.summarize(project)).toEqual({ classCount: 0, itemCount: 0, runCount: 0, hasTable: true, thumbnails: [] });
  });

  test('chỉ lấy tối đa 4 ảnh thu nhỏ', async () => {
    const { projects, dataset } = setup();
    const project = await projects.create({ name: 'Nhiều lớp', projectType: 'image' });
    for (let i = 0; i < 6; i++) {
      const cls = await dataset.addClass(project.id, `Lớp ${i}`);
      await dataset.addSamples([{ projectId: project.id, classId: cls.id, split: 'train', source: 'upload', image: imageOf(i) }]);
    }
    expect((await projects.summarize(project)).thumbnails).toHaveLength(4);
  });
});
