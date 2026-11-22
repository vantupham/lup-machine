import { LupDatabase } from '../db';
import {
  createDexieDatasetRepository,
  MAX_SAMPLES_PER_CLASS,
  type DatasetRepository,
  type NewSampleInput,
} from './dataset-repository';

let db: LupDatabase;
let repo: DatasetRepository;
let counter = 0;

const PROJECT = 'p1';

function image(): NewSampleInput['image'] {
  return { bytes: new Uint8Array([1, 2, 3]).buffer, mime: 'image/jpeg', width: 224, height: 224 };
}

beforeEach(() => {
  counter = 0;
  db = new LupDatabase(`ds-${crypto.randomUUID()}`);
  repo = createDexieDatasetRepository(db, {
    now: () => new Date(Date.UTC(2026, 10, 22, 0, 0, counter)).toISOString(),
    newId: () => `id-${++counter}`,
  });
});

afterEach(async () => {
  await db.delete();
});

describe('Lớp (class)', () => {
  test('thêm lớp theo thứ tự và liệt kê', async () => {
    await repo.addClass(PROJECT, 'Nhựa');
    await repo.addClass(PROJECT, 'Giấy');
    const classes = await repo.listClasses(PROJECT);
    expect(classes.map((c) => [c.name, c.order])).toEqual([
      ['Nhựa', 0],
      ['Giấy', 1],
    ]);
  });

  test('từ chối tên rỗng, quá dài hoặc trùng (không phân biệt hoa thường)', async () => {
    await repo.addClass(PROJECT, 'Nhựa');
    await expect(repo.addClass(PROJECT, '  ')).rejects.toThrow();
    await expect(repo.addClass(PROJECT, 'a'.repeat(41))).rejects.toThrow();
    await expect(repo.addClass(PROJECT, ' nhựa ')).rejects.toThrow(/đã có/i);
  });

  test('đổi tên lớp', async () => {
    const c = await repo.addClass(PROJECT, 'Cu');
    const renamed = await repo.renameClass(c.id, 'Mới');
    expect(renamed.name).toBe('Mới');
    expect(c.name).toBe('Cu');
  });

  test('xóa lớp thì xóa luôn các mẫu của lớp đó', async () => {
    const a = await repo.addClass(PROJECT, 'A');
    const b = await repo.addClass(PROJECT, 'B');
    await repo.addSamples([sampleFor(a.id), sampleFor(b.id)]);
    await repo.deleteClass(a.id);
    expect((await repo.listClasses(PROJECT)).map((c) => c.name)).toEqual(['B']);
    expect(await repo.listSamples(PROJECT)).toHaveLength(1);
  });

  test('các dự án tách biệt nhau', async () => {
    await repo.addClass(PROJECT, 'A');
    await repo.addClass('p2', 'A');
    expect(await repo.listClasses(PROJECT)).toHaveLength(1);
  });
});

function sampleFor(classId: string, split: 'train' | 'test' = 'train'): NewSampleInput {
  return { projectId: PROJECT, classId, split, source: 'upload', image: image() };
}

describe('Mẫu (sample)', () => {
  test('thêm nhiều mẫu và đọc lại đúng dữ liệu ảnh', async () => {
    const c = await repo.addClass(PROJECT, 'A');
    const added = await repo.addSamples([sampleFor(c.id), sampleFor(c.id, 'test')]);
    expect(added).toHaveLength(2);
    const samples = await repo.listSamples(PROJECT);
    expect(samples.map((s) => s.split).sort()).toEqual(['test', 'train']);
    expect(new Uint8Array(samples[0]!.image.bytes)).toEqual(new Uint8Array([1, 2, 3]));
  });

  test('thứ tự ảnh luôn đúng thứ tự thêm vào, kể cả khi cùng thời điểm (để kết quả tái lập giữa các máy)', async () => {
    const fixedClock = createDexieDatasetRepository(db, {
      now: () => '2026-11-22T00:00:00.000Z',
      newId: () => crypto.randomUUID(),
    });
    const c = await fixedClock.addClass(PROJECT, 'Cùng giờ');
    const inputs = Array.from({ length: 12 }, (_, i) => ({
      ...sampleFor(c.id),
      image: { ...image(), width: i + 1 },
    }));
    await fixedClock.addSamples(inputs);
    await fixedClock.addSamples([{ ...sampleFor(c.id), image: { ...image(), width: 99 } }]);
    const widths = (await fixedClock.listSamples(PROJECT)).map((s) => s.image.width);
    expect(widths).toEqual([...Array.from({ length: 12 }, (_, i) => i + 1), 99]);
  });

  test('đếm số mẫu theo lớp và theo tập', async () => {
    const a = await repo.addClass(PROJECT, 'A');
    const b = await repo.addClass(PROJECT, 'B');
    await repo.addSamples([sampleFor(a.id), sampleFor(a.id), sampleFor(a.id, 'test'), sampleFor(b.id)]);
    expect(await repo.countSamples(PROJECT)).toEqual({
      [a.id]: { train: 2, test: 1 },
      [b.id]: { train: 1, test: 0 },
    });
  });

  test('không vượt quá giới hạn số mẫu mỗi lớp', async () => {
    const c = await repo.addClass(PROJECT, 'A');
    const many = Array.from({ length: MAX_SAMPLES_PER_CLASS + 1 }, () => sampleFor(c.id));
    await expect(repo.addSamples(many)).rejects.toThrow(/tối đa/i);
    expect(await repo.listSamples(PROJECT)).toHaveLength(0);
  });

  test('từ chối mẫu thuộc lớp không tồn tại', async () => {
    await expect(repo.addSamples([sampleFor('khong-co')])).rejects.toThrow(/không tìm thấy lớp/i);
  });

  test('chuyển mẫu sang tập khác và xóa mẫu', async () => {
    const c = await repo.addClass(PROJECT, 'A');
    const [s] = await repo.addSamples([sampleFor(c.id)]);
    await repo.setSplits([{ id: s!.id, split: 'test' }]);
    expect((await repo.listSamples(PROJECT))[0]!.split).toBe('test');
    await repo.deleteSample(s!.id);
    expect(await repo.listSamples(PROJECT)).toHaveLength(0);
  });

  test('lưu và đọc vector đặc trưng theo mô hình', async () => {
    const c = await repo.addClass(PROJECT, 'A');
    const [s1, s2] = await repo.addSamples([sampleFor(c.id), sampleFor(c.id)]);
    await repo.putFeatures(PROJECT, 'm1', [{ sampleId: s1!.id, vector: Float32Array.from([1, 2, 3]) }]);
    const features = await repo.listFeatures(PROJECT, 'm1');
    expect(features.size).toBe(1);
    expect(Array.from(features.get(s1!.id)!)).toEqual([1, 2, 3]);
    expect(features.has(s2!.id)).toBe(false);
    expect((await repo.listFeatures(PROJECT, 'm2')).size).toBe(0);
  });

  test('xóa ảnh / xóa lớp thì xóa luôn vector đặc trưng', async () => {
    const a = await repo.addClass(PROJECT, 'A');
    const b = await repo.addClass(PROJECT, 'B');
    const [s1, s2] = await repo.addSamples([sampleFor(a.id), sampleFor(b.id)]);
    const vector = Float32Array.from([1]);
    await repo.putFeatures(PROJECT, 'm1', [
      { sampleId: s1!.id, vector },
      { sampleId: s2!.id, vector },
    ]);
    await repo.deleteSample(s1!.id);
    expect([...(await repo.listFeatures(PROJECT, 'm1')).keys()]).toEqual([s2!.id]);
    await repo.deleteClass(b.id);
    expect((await repo.listFeatures(PROJECT, 'm1')).size).toBe(0);
  });

  test('xóa toàn bộ dữ liệu của một dự án', async () => {
    const c = await repo.addClass(PROJECT, 'A');
    const [s] = await repo.addSamples([sampleFor(c.id)]);
    await repo.putFeatures(PROJECT, 'm1', [{ sampleId: s!.id, vector: Float32Array.from([1]) }]);
    await repo.deleteProjectData(PROJECT);
    expect((await repo.listFeatures(PROJECT, 'm1')).size).toBe(0);
    expect(await repo.listClasses(PROJECT)).toHaveLength(0);
    expect(await repo.listSamples(PROJECT)).toHaveLength(0);
  });
});
