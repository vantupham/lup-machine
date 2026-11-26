import { LupDatabase } from '../db';
import { MAX_TRIALS_PER_PROJECT, TRIAL_CONCLUSION_MAX_LENGTH, type NewTrialInput } from '../schemas/trial';
import { createDexieProjectRepository } from './project-repository';
import { createDexieTrialRepository } from './trial-repository';

let db: LupDatabase;
let counter = 0;

const trial = (c = 1): NewTrialInput => ({
  settings: { kind: 'logistic', c },
  split: { testRatio: 0.2, seed: 1 },
  data: { fingerprint: 'f1', train: 16, test: 4, classNames: ['Vỗ tay', 'Huýt sáo'] },
  metric: 'accuracy',
  scores: { train: 1, test: 0.75 },
  classRecall: [1, 0.5],
});

beforeEach(() => {
  counter = 0;
  db = new LupDatabase(`trial-${crypto.randomUUID()}`);
});
afterEach(async () => db.delete());

const repo = () =>
  createDexieTrialRepository(db, {
    now: () => new Date(Date.UTC(2026, 10, 26, 0, 0, counter)).toISOString(),
    newId: () => `trial-${++counter}`,
  });

describe('nhật ký thí nghiệm của các Studio huấn luyện tức thì', () => {
  test('lưu, đánh số tăng dần, mới nhất trước; mỗi dự án một nhật ký', async () => {
    const r = repo();
    await r.add('p1', trial());
    await r.add('p1', { ...trial(10), guess: 0.9 });
    await r.add('p2', trial());
    const list = await r.list('p1');
    expect(list.map((x) => [x.number, x.settings.c, x.guess])).toEqual([
      [2, 10, 0.9],
      [1, 1, undefined],
    ]);
  });

  test('ghi kết luận; xóa hết chữ thì bỏ kết luận; từ chối kết luận quá dài', async () => {
    const r = repo();
    const saved = await r.add('p1', trial());
    await r.setConclusion(saved.id, '  C lớn hơn thì điểm Kiểm tra giảm ');
    expect((await r.list('p1'))[0]!.conclusion).toBe('C lớn hơn thì điểm Kiểm tra giảm');
    await r.setConclusion(saved.id, '');
    expect((await r.list('p1'))[0]!.conclusion).toBeUndefined();
    await expect(r.setConclusion(saved.id, 'x'.repeat(TRIAL_CONCLUSION_MAX_LENGTH + 1))).rejects.toThrow();
  });

  test('giữ tối đa số lần chạy mỗi dự án', async () => {
    const r = repo();
    for (let i = 0; i < MAX_TRIALS_PER_PROJECT + 2; i++) await r.add('p1', trial());
    const list = await r.list('p1');
    expect(list).toHaveLength(MAX_TRIALS_PER_PROJECT);
    expect(list.at(-1)!.number).toBe(3);
  });

  test('từ chối dữ liệu sai: điểm đoán ngoài 0–1, tên cài đặt lạ', async () => {
    const r = repo();
    await expect(r.add('p1', { ...trial(), guess: 1.2 })).rejects.toThrow();
    await expect(r.add('p1', { ...trial(), settings: { 'bad key!': 1 } })).rejects.toThrow();
  });

  test('xóa dự án thì xóa luôn nhật ký', async () => {
    const projects = createDexieProjectRepository(db);
    const p = await projects.create({ name: 'Âm thanh', projectType: 'audio' });
    await repo().add(p.id, trial());
    await projects.delete(p.id);
    expect(await db.trials.count()).toBe(0);
  });
});
