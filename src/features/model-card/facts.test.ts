import { createTestRepository } from '../../../tests/setup/render';
import { fakeStoredJpeg } from '../../../tests/setup/fake-images';
import { datasetFingerprint } from '@/core/data/fingerprint';
import { loadModelCardFacts } from './facts';

describe('loadModelCardFacts', () => {
  test('dự án ảnh: số ảnh mỗi lớp theo ngăn và lần huấn luyện gần nhất', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'Rác', projectType: 'image' });
    const giay = await r.dataset.addClass(project.id, 'Giấy');
    const nhua = await r.dataset.addClass(project.id, 'Nhựa');
    await r.dataset.addSamples([
      { projectId: project.id, classId: giay.id, split: 'train', source: 'upload', image: fakeStoredJpeg(1) },
      { projectId: project.id, classId: giay.id, split: 'test', source: 'upload', image: fakeStoredJpeg(2) },
    ]);
    const run = {
      projectId: project.id,
      fingerprint: datasetFingerprint([giay.id, nhua.id], await r.dataset.listSamples(project.id)),
      options: { epochs: 20, learningRate: 0.01, batchSize: 8, seed: 1 },
      classNames: ['Giấy', 'Nhựa'],
      counts: { train: 1, test: 1 },
    };
    await r.experiments.addRun({ ...run, metrics: [{ epoch: 1, trainLoss: 1, trainAccuracy: 0.5, testLoss: 1, testAccuracy: 0.5 }] });
    await r.experiments.addRun({
      ...run,
      metrics: [
        { epoch: 1, trainLoss: 1, trainAccuracy: 0.5, testLoss: 1, testAccuracy: 0.5 },
        { epoch: 2, trainLoss: 0.2, trainAccuracy: 1, testLoss: 0.4, testAccuracy: 0.875 },
      ],
    });

    expect(await loadModelCardFacts(r, project)).toEqual({
      projectType: 'image',
      classes: [
        { name: 'Giấy', count: 2, train: 1, test: 1 },
        { name: 'Nhựa', count: 0, train: 0, test: 0 },
      ],
      table: null,
      latestRun: { number: 2, epochs: 20, trainAccuracy: 1, testAccuracy: 0.875, matchesData: true },
    });
    // thêm ảnh sau khi huấn luyện → số liệu của lần chạy không còn khớp dữ liệu
    await r.dataset.addSamples([{ projectId: project.id, classId: nhua.id, split: 'train', source: 'upload', image: fakeStoredJpeg(3) }]);
    expect((await loadModelCardFacts(r, project)).latestRun?.matchesData).toBe(false);
  });

  test('dự án âm thanh và tư thế: đếm mẫu mỗi nhóm', async () => {
    const r = createTestRepository();
    const sound = await r.repository.create({ name: 'Âm', projectType: 'audio' });
    const clap = await r.dataset.addClass(sound.id, 'Vỗ tay');
    await r.dataset.addClass(sound.id, 'Huýt sáo');
    await r.audio.addClips([1, 2].map(() => ({ projectId: sound.id, classId: clap.id, source: 'microphone' as const, samples: new Float32Array(16_000) })));
    const facts = await loadModelCardFacts(r, sound);
    expect(facts.classes).toEqual([
      { name: 'Vỗ tay', count: 2, train: null, test: null },
      { name: 'Huýt sáo', count: 0, train: null, test: null },
    ]);
    expect(facts.latestRun).toBeNull();

    const pose = await r.repository.create({ name: 'Dáng', projectType: 'pose' });
    await r.dataset.addClass(pose.id, 'Đứng');
    expect((await loadModelCardFacts(r, pose)).classes).toEqual([{ name: 'Đứng', count: 0, train: null, test: null }]);
  });

  test('dự án bảng: số dòng và cột; chưa có bảng thì null', async () => {
    const r = createTestRepository();
    const project = await r.repository.create({ name: 'Bảng', projectType: 'tabular' });
    expect((await loadModelCardFacts(r, project)).table).toBeNull();
    await r.tables.saveTable({ projectId: project.id, csv: 'a,b,c\n1,2,3\n4,5,6\n', fileName: 'x.csv', sampleId: null });
    expect(await loadModelCardFacts(r, project)).toEqual({ projectType: 'tabular', classes: [], table: { rows: 2, columns: 3 }, latestRun: null });
  });
});
