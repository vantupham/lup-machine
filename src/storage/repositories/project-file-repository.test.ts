import { strToU8, unzipSync, zipSync } from 'fflate';
import { LupDatabase } from '../db';
import { fakeStoredJpeg } from '../../../tests/setup/fake-images';
import type { TabularConfig } from '../schemas/tabular';
import { datasetFingerprint } from '@/core/data/fingerprint';
import { createDexieProjectRepository } from './project-repository';
import { createDexieDatasetRepository } from './dataset-repository';
import { createDexieAudioRepository } from './audio-repository';
import { createDexiePoseRepository } from './pose-repository';
import { createDexieTableRepository } from './table-repository';
import { createDexieExperimentRepository } from './experiment-repository';
import { createDexieModelCardRepository } from './model-card-repository';
import { createDexieNotebookRepository } from './notebook-repository';
import { createDexieTrialRepository } from './trial-repository';
import { createDexieProjectFileRepository, projectFileName, ProjectFileError } from './project-file-repository';

let db: LupDatabase;
const repos = () => ({
  projects: createDexieProjectRepository(db),
  dataset: createDexieDatasetRepository(db),
  audio: createDexieAudioRepository(db),
  poses: createDexiePoseRepository(db),
  tables: createDexieTableRepository(db),
  experiments: createDexieExperimentRepository(db),
  cards: createDexieModelCardRepository(db),
  notebook: createDexieNotebookRepository(db),
  trials: createDexieTrialRepository(db),
  files: createDexieProjectFileRepository(db),
});

const jpeg = fakeStoredJpeg;

beforeEach(() => {
  db = new LupDatabase(`test-${crypto.randomUUID()}`);
});

afterEach(async () => {
  await db.delete();
});

describe('ProjectFileRepository', () => {
  test('tên tệp không dấu, đuôi .lup', () => {
    expect(projectFileName('Phân loại rác – 7A')).toBe('phan-loai-rac-7a.lup');
  });

  test('dự án ảnh: nhập thành dự án mới với đủ lớp, ảnh, ngăn và nhật ký chạy lại được', async () => {
    const r = repos();
    const project = await r.projects.create({ name: 'Rác thải', projectType: 'image' });
    const giay = await r.dataset.addClass(project.id, 'Giấy');
    const nhua = await r.dataset.addClass(project.id, 'Nhựa');
    await r.dataset.addSamples([
      { projectId: project.id, classId: giay.id, split: 'train', source: 'upload', image: jpeg(1) },
      { projectId: project.id, classId: nhua.id, split: 'test', source: 'webcam', image: jpeg(2) },
      { projectId: project.id, classId: nhua.id, split: 'train', source: 'upload', image: jpeg(3) },
    ]);
    const samples = await r.dataset.listSamples(project.id);
    const run = {
      projectId: project.id,
      options: { epochs: 3, learningRate: 0.01, batchSize: 8, seed: 7 },
      classNames: ['Giấy', 'Nhựa'],
      counts: { train: 2, test: 1 },
      metrics: [{ epoch: 1, trainLoss: 0.4, trainAccuracy: 1, testLoss: 0.5, testAccuracy: 1 }],
    };
    await r.experiments.addRun({ ...run, fingerprint: 'cu-khong-khop' });
    await r.experiments.addRun({ ...run, fingerprint: datasetFingerprint([giay.id, nhua.id], samples) });

    const exported = await r.files.exportProject(project.id);
    expect(exported.fileName).toBe('rac-thai.lup');
    const imported = await r.files.importProject(exported.bytes);

    expect(imported.id).not.toBe(project.id);
    expect(imported).toMatchObject({ name: 'Rác thải', projectType: 'image' });
    const classes = await r.dataset.listClasses(imported.id);
    expect(classes.map((c) => c.name)).toEqual(['Giấy', 'Nhựa']);
    const copied = await r.dataset.listSamples(imported.id);
    expect(copied.map((s) => [classes.findIndex((c) => c.id === s.classId), s.split, new Uint8Array(s.image.bytes).at(-1)])).toEqual([
      [0, 'train', 1],
      [1, 'test', 2],
      [1, 'train', 3],
    ]);
    const runs = await r.experiments.listRuns(imported.id);
    expect(runs.map((x) => x.number)).toEqual([2, 1]);
    expect(runs[0]?.fingerprint).toBe(datasetFingerprint(classes.map((c) => c.id), copied));
    expect(runs[1]?.fingerprint).toBe('cu-khong-khop');
    // dự án gốc không bị đụng tới
    expect(await r.dataset.listSamples(project.id)).toHaveLength(3);
  });

  test('thẻ mô hình đi theo tệp .lup', async () => {
    const r = repos();
    const project = await r.projects.create({ name: 'Có thẻ', projectType: 'text' });
    const card = { authors: 'Lan', purpose: 'Phân loại ý kiến', data: 'Phiếu khảo sát', performance: '80%', limitations: 'Câu mỉa mai', misuse: 'Đánh giá giáo viên' };
    await r.cards.save(project.id, card);
    const copy = await r.files.importProject((await r.files.exportProject(project.id)).bytes);
    expect(await r.cards.get(copy.id)).toMatchObject(card);
  });

  test('sổ tay ghi chép và điểm đoán trước đi theo tệp .lup', async () => {
    const r = repos();
    const project = await r.projects.create({ name: 'Có sổ tay', projectType: 'image' });
    await r.notebook.save(project.id, 'represent', 'Mèo nằm bên trái bản đồ');
    await r.experiments.addRun({
      projectId: project.id,
      fingerprint: 'abcd1234',
      options: { epochs: 2, learningRate: 0.001, batchSize: 16, seed: 42 },
      classNames: ['A', 'B'],
      counts: { train: 0, test: 0 },
      metrics: [{ epoch: 0, trainLoss: 0.7, trainAccuracy: 0.5, testLoss: 0.7, testAccuracy: 0.5 }],
      guess: { testAccuracy: 0.9 },
    }).then((saved) => r.experiments.setConclusion(saved.id, 'Máy học nhanh'));
    const copy = await r.files.importProject((await r.files.exportProject(project.id)).bytes);
    expect(await r.notebook.list(copy.id)).toEqual([{ step: 'represent', text: 'Mèo nằm bên trái bản đồ' }]);
    expect((await r.experiments.listRuns(copy.id))[0]?.guess).toEqual({ testAccuracy: 0.9 });
    expect((await r.experiments.listRuns(copy.id))[0]?.conclusion).toBe('Máy học nhanh');
  });

  test('nhật ký thí nghiệm của Studio văn bản đi theo tệp .lup', async () => {
    const r = repos();
    const project = await r.projects.create({ name: 'Căng tin', projectType: 'text' });
    const saved = await r.trials.add(project.id, {
      settings: { kind: 'naive-bayes', alpha: 1, maxN: 1 },
      split: { testRatio: 0.2, seed: 1 },
      data: { fingerprint: 'f1', train: 40, test: 10, classNames: ['khen', 'chê'] },
      metric: 'accuracy',
      scores: { train: 1, test: 0.9 },
      guess: 0.7,
    });
    await r.trials.setConclusion(saved.id, 'Naive Bayes đủ tốt');
    const copy = await r.files.importProject((await r.files.exportProject(project.id)).bytes);
    const [imported] = await r.trials.list(copy.id);
    expect(imported).toMatchObject({ number: 1, settings: { kind: 'naive-bayes', alpha: 1, maxN: 1 }, guess: 0.7, conclusion: 'Naive Bayes đủ tốt' });
  });

  test('dự án âm thanh và tư thế', async () => {
    const r = repos();
    const sound = await r.projects.create({ name: 'Âm thanh', projectType: 'audio' });
    const clap = await r.dataset.addClass(sound.id, 'Vỗ tay');
    const pcm = new Float32Array(16_000).fill(0.25);
    await r.audio.addClips([{ projectId: sound.id, classId: clap.id, source: 'microphone', samples: pcm }]);
    const soundCopy = await r.files.importProject((await r.files.exportProject(sound.id)).bytes);
    const clips = await r.audio.listClips(soundCopy.id);
    expect(clips).toHaveLength(1);
    expect(new Float32Array(clips[0]!.pcm)[100]).toBe(0.25);

    const pose = await r.projects.create({ name: 'Tư thế', projectType: 'pose' });
    const up = await r.dataset.addClass(pose.id, 'Giơ tay');
    const keypoints = Array.from({ length: 21 }, (_, i) => ({ x: i, y: i * 2, score: 0.9 }));
    await r.poses.addPoses([{ projectId: pose.id, classId: up.id, kind: 'hand', source: 'webcam', keypoints, width: 320, height: 240 }]);
    const poseCopy = await r.files.importProject((await r.files.exportProject(pose.id)).bytes);
    const copied = await r.poses.listPoses(poseCopy.id);
    expect(copied[0]).toMatchObject({ kind: 'hand', width: 320, height: 240 });
    expect(copied[0]?.keypoints).toEqual((await r.poses.listPoses(pose.id))[0]?.keypoints);
  });

  test('dự án bảng: giữ CSV, tệp mẫu và cấu hình', async () => {
    const r = repos();
    const project = await r.projects.create({ name: 'Chim cánh cụt', projectType: 'tabular' });
    await r.tables.saveTable({ projectId: project.id, csv: 'a,b,c\n1,2,x\n3,4,y\n', fileName: 'p.csv', sampleId: null });
    const config: TabularConfig = { target: 'c', features: ['a', 'b'], task: 'classification', testRatio: 0.2, seed: 3, model: { kind: 'tree', c: 1, maxDepth: 3, criterion: 'gini', k: 3 } };
    await r.tables.saveConfig(project.id, config);
    const copy = await r.files.importProject((await r.files.exportProject(project.id)).bytes);
    expect(await r.tables.get(copy.id)).toMatchObject({ csv: 'a,b,c\n1,2,x\n3,4,y\n', fileName: 'p.csv', sampleId: null, config });
  });

  test('tệp hỏng: báo lỗi và không tạo dự án dở dang', async () => {
    const r = repos();
    const project = await r.projects.create({ name: 'A', projectType: 'image' });
    const cls = await r.dataset.addClass(project.id, 'X');
    await r.dataset.addSamples([{ projectId: project.id, classId: cls.id, split: 'train', source: 'upload', image: jpeg(1) }]);
    const files = unzipSync((await r.files.exportProject(project.id)).bytes);
    files['samples/00001.jpg'] = strToU8('không phải ảnh');
    await expect(r.files.importProject(zipSync(files))).rejects.toThrow(ProjectFileError);
    expect(await r.projects.findAll()).toHaveLength(1);
  });

  test('xuất dự án không tồn tại thì báo lỗi', async () => {
    await expect(repos().files.exportProject('khong-co')).rejects.toThrow(/Không tìm thấy/);
  });
});
