import { createDexieProjectRepository, type ProjectRepository } from './project-repository';
import { LupDatabase } from '../db';

let db: LupDatabase;
let repo: ProjectRepository;
let tick = 0;

beforeEach(async () => {
  tick = 0;
  db = new LupDatabase(`test-${crypto.randomUUID()}`);
  repo = createDexieProjectRepository(db, {
    now: () => new Date(Date.UTC(2026, 10, 22, 10, 0, tick++)).toISOString(),
    newId: () => `id-${tick}`,
  });
});

afterEach(async () => {
  await db.delete();
});

describe('ProjectRepository', () => {
  test('tạo dự án mới với id và thời gian', async () => {
    const project = await repo.create({ name: 'Phân loại rác', projectType: 'image' });
    expect(project).toEqual({
      id: 'id-1',
      name: 'Phân loại rác',
      projectType: 'image',
      createdAt: '2026-11-22T10:00:00.000Z',
      updatedAt: '2026-11-22T10:00:00.000Z',
    });
  });

  test('cắt khoảng trắng và từ chối tên không hợp lệ', async () => {
    const project = await repo.create({ name: '  Rác  ', projectType: 'image' });
    expect(project.name).toBe('Rác');
    await expect(repo.create({ name: '   ', projectType: 'image' })).rejects.toThrow();
  });

  test('findById trả về null khi không tồn tại', async () => {
    expect(await repo.findById('khong-co')).toBeNull();
  });

  test('findAll sắp xếp theo lần cập nhật mới nhất', async () => {
    const a = await repo.create({ name: 'A', projectType: 'image' });
    await repo.create({ name: 'B', projectType: 'image' });
    await repo.update(a.id, { name: 'A2' });
    const names = (await repo.findAll()).map((p) => p.name);
    expect(names).toEqual(['A2', 'B']);
  });

  test('update trả về bản ghi mới, không sửa đối tượng cũ', async () => {
    const original = await repo.create({ name: 'Cũ', projectType: 'image' });
    const updated = await repo.update(original.id, { name: 'Mới' });
    expect(original.name).toBe('Cũ');
    expect(updated.name).toBe('Mới');
    expect(updated.createdAt).toBe(original.createdAt);
    expect(updated.updatedAt > original.updatedAt).toBe(true);
  });

  test('update dự án không tồn tại thì báo lỗi', async () => {
    await expect(repo.update('khong-co', { name: 'X' })).rejects.toThrow(/không tìm thấy/i);
  });

  test('xóa dự án thì xóa luôn lớp và ảnh của dự án đó (không để sót dữ liệu)', async () => {
    const keep = await repo.create({ name: 'Giữ', projectType: 'image' });
    const drop = await repo.create({ name: 'Xóa', projectType: 'image' });
    const image = { bytes: new ArrayBuffer(1), mime: 'image/jpeg', width: 224, height: 224 };
    const base = { order: 0, createdAt: 'x' };
    await db.classes.bulkAdd([
      { id: 'c-keep', projectId: keep.id, name: 'A', ...base },
      { id: 'c-drop', projectId: drop.id, name: 'A', ...base },
    ]);
    const sample = { split: 'train', source: 'upload', image, createdAt: 'x' } as const;
    await db.samples.bulkAdd([
      { id: 's-keep', projectId: keep.id, classId: 'c-keep', ...sample },
      { id: 's-drop', projectId: drop.id, classId: 'c-drop', ...sample },
    ]);

    await repo.delete(drop.id);
    expect((await db.classes.toArray()).map((c) => c.id)).toEqual(['c-keep']);
    expect((await db.samples.toArray()).map((s) => s.id)).toEqual(['s-keep']);

    await repo.deleteAll();
    expect(await db.classes.count()).toBe(0);
    expect(await db.samples.count()).toBe(0);
  });

  test('delete và deleteAll', async () => {
    const a = await repo.create({ name: 'A', projectType: 'image' });
    await repo.create({ name: 'B', projectType: 'image' });
    await repo.delete(a.id);
    expect(await repo.findAll()).toHaveLength(1);
    await repo.deleteAll();
    expect(await repo.findAll()).toHaveLength(0);
  });
});
