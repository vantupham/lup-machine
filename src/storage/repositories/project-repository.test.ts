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

  test('delete và deleteAll', async () => {
    const a = await repo.create({ name: 'A', projectType: 'image' });
    await repo.create({ name: 'B', projectType: 'image' });
    await repo.delete(a.id);
    expect(await repo.findAll()).toHaveLength(1);
    await repo.deleteAll();
    expect(await repo.findAll()).toHaveLength(0);
  });
});
