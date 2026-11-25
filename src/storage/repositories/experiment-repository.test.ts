import { LupDatabase } from '../db';
import { createDexieExperimentRepository, MAX_RUNS_PER_PROJECT, RUN_CONCLUSION_MAX_LENGTH, type NewRunInput } from './experiment-repository';
import { createDexieProjectRepository } from './project-repository';

let db: LupDatabase;
let counter = 0;

const run = (projectId = 'p1'): NewRunInput => ({
  projectId,
  fingerprint: 'abcd1234',
  options: { epochs: 2, learningRate: 0.001, batchSize: 16, seed: 42 },
  classNames: ['A', 'B'],
  counts: { train: 10, test: 2 },
  metrics: [
    { epoch: 0, trainLoss: 0.7, trainAccuracy: 0.5, testLoss: 0.7, testAccuracy: 0.5 },
    { epoch: 1, trainLoss: 0.3, trainAccuracy: 1, testLoss: null, testAccuracy: null },
  ],
});

beforeEach(() => {
  counter = 0;
  db = new LupDatabase(`exp-${crypto.randomUUID()}`);
});
afterEach(async () => db.delete());

const repo = () =>
  createDexieExperimentRepository(db, {
    now: () => new Date(Date.UTC(2026, 10, 22, 0, 0, counter)).toISOString(),
    newId: () => `run-${++counter}`,
  });

describe('ExperimentRepository', () => {
  test('lưu và liệt kê các lần chạy, mới nhất trước, đánh số thứ tự', async () => {
    const r = repo();
    await r.addRun(run());
    await r.addRun(run());
    await r.addRun(run('p2'));
    const runs = await r.listRuns('p1');
    expect(runs.map((x) => [x.id, x.number])).toEqual([
      ['run-2', 2],
      ['run-1', 1],
    ]);
    expect(runs[0]!.metrics[1]!.testAccuracy).toBeNull();
  });

  test('lưu điểm Kiểm tra học sinh đoán trước khi huấn luyện', async () => {
    const r = repo();
    await r.addRun({ ...run(), guess: { testAccuracy: 0.75 } });
    await r.addRun(run());
    const [plain, guessed] = await r.listRuns('p1');
    expect(guessed!.guess).toEqual({ testAccuracy: 0.75 });
    expect(plain!.guess).toBeUndefined();
    await expect(r.addRun({ ...run(), guess: { testAccuracy: 1.5 } })).rejects.toThrow();
  });

  test('từ chối dữ liệu không hợp lệ', async () => {
    await expect(repo().addRun({ ...run(), metrics: [] })).rejects.toThrow();
    await expect(repo().addRun({ ...run(), options: { ...run().options, epochs: 0 } })).rejects.toThrow();
  });

  test('ghi kết luận cho một lần chạy; xóa hết chữ thì bỏ kết luận', async () => {
    const r = repo();
    const saved = await r.addRun(run());
    await r.setConclusion(saved.id, '  Ít epoch hơn thì điểm Kiểm tra giảm  ');
    expect((await r.listRuns('p1'))[0]!.conclusion).toBe('Ít epoch hơn thì điểm Kiểm tra giảm');
    await r.setConclusion(saved.id, '   ');
    expect((await r.listRuns('p1'))[0]!.conclusion).toBeUndefined();
    await expect(r.setConclusion(saved.id, 'x'.repeat(RUN_CONCLUSION_MAX_LENGTH + 1))).rejects.toThrow();
    await expect(r.setConclusion('khong-co', 'x')).rejects.toThrow();
  });

  test('giữ tối đa số lần chạy mỗi dự án (xóa lần cũ nhất)', async () => {
    const r = repo();
    for (let i = 0; i < MAX_RUNS_PER_PROJECT + 2; i++) await r.addRun(run());
    const runs = await r.listRuns('p1');
    expect(runs).toHaveLength(MAX_RUNS_PER_PROJECT);
    expect(runs.at(-1)!.number).toBe(3);
  });

  test('xóa một lần chạy; xóa dự án thì xóa luôn nhật ký', async () => {
    const r = repo();
    const projects = createDexieProjectRepository(db);
    const p = await projects.create({ name: 'X', projectType: 'image' });
    const saved = await r.addRun(run(p.id));
    await r.addRun(run(p.id));
    await r.deleteRun(saved.id);
    expect(await r.listRuns(p.id)).toHaveLength(1);
    await projects.delete(p.id);
    expect(await r.listRuns(p.id)).toHaveLength(0);
  });
});
