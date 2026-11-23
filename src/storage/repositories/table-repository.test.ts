import { LupDatabase } from '../db';
import type { TabularConfig } from '../schemas/tabular';
import { createDexieProjectRepository } from './project-repository';
import { createDexieTableRepository } from './table-repository';

const CONFIG: TabularConfig = {
  target: 'Loài',
  features: ['Dài mỏ (mm)'],
  task: 'classification',
  testRatio: 0.2,
  seed: 1,
  model: { kind: 'tree', c: 1, maxDepth: 3, criterion: 'gini', k: 5 },
};

function setup() {
  const db = new LupDatabase(`table-test-${crypto.randomUUID()}`);
  return { db, tables: createDexieTableRepository(db, () => '2026-11-23T00:00:00.000Z'), projects: createDexieProjectRepository(db) };
}

describe('TableRepository', () => {
  test('lưu bảng rồi đọc lại; chưa có cấu hình', async () => {
    const { tables } = setup();
    await tables.saveTable({ projectId: 'p1', csv: 'a,b\n1,2', fileName: 'du-lieu.csv', sampleId: null });
    expect(await tables.get('p1')).toEqual({
      projectId: 'p1', csv: 'a,b\n1,2', fileName: 'du-lieu.csv', sampleId: null, config: null, updatedAt: '2026-11-23T00:00:00.000Z',
    });
    expect(await tables.get('khong-co')).toBeNull();
  });

  test('lưu cấu hình; thay bảng mới thì cấu hình cũ bị xóa', async () => {
    const { tables } = setup();
    await tables.saveTable({ projectId: 'p1', csv: 'a\n1', fileName: 'x.csv', sampleId: 'iris' });
    await tables.saveConfig('p1', CONFIG);
    expect((await tables.get('p1'))?.config).toEqual(CONFIG);
    await tables.saveTable({ projectId: 'p1', csv: 'b\n2', fileName: 'y.csv', sampleId: null });
    expect((await tables.get('p1'))?.config).toBeNull();
  });

  test('cấu hình hỏng trong cơ sở dữ liệu được bỏ qua khi đọc', async () => {
    const { db, tables } = setup();
    await db.dataTables.put({ projectId: 'p1', csv: 'a\n1', fileName: 'x', sampleId: null, config: { target: 5 }, updatedAt: 'x' });
    expect((await tables.get('p1'))?.config).toBeNull();
  });

  test('từ chối cấu hình không hợp lệ, dự án chưa có bảng hoặc tệp quá lớn', async () => {
    const { tables } = setup();
    await expect(tables.saveConfig('p1', CONFIG)).rejects.toThrow(RangeError);
    await tables.saveTable({ projectId: 'p1', csv: 'a\n1', fileName: 'x', sampleId: null });
    await expect(tables.saveConfig('p1', { ...CONFIG, testRatio: 0.9 })).rejects.toThrow(RangeError);
    await expect(tables.saveTable({ projectId: 'p1', csv: 'x'.repeat(2_000_001), fileName: 'x', sampleId: null })).rejects.toThrow(RangeError);
  });

  test('xóa dự án thì xóa luôn bảng dữ liệu', async () => {
    const { tables, projects } = setup();
    const project = await projects.create({ name: 'Chim cánh cụt', projectType: 'tabular' });
    await tables.saveTable({ projectId: project.id, csv: 'a\n1', fileName: 'x', sampleId: null });
    await projects.delete(project.id);
    expect(await tables.get(project.id)).toBeNull();
    await tables.saveTable({ projectId: 'p2', csv: 'a\n1', fileName: 'x', sampleId: null });
    await projects.deleteAll();
    expect(await tables.get('p2')).toBeNull();
    await tables.delete('p2');
  });
});
