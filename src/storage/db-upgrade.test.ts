import Dexie from 'dexie';
import { LupDatabase } from './db';

describe('nâng cấp cơ sở dữ liệu', () => {
  test('máy đang dùng phiên bản 7 mở bản mới: dữ liệu cũ còn nguyên, có thêm bảng thẻ mô hình và bài tập', async () => {
    const name = `upgrade-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(7).stores({
      projects: 'id, updatedAt',
      classes: 'id, projectId',
      samples: 'id, projectId, classId',
      features: '[sampleId+modelId], sampleId, projectId',
      runs: 'id, projectId',
      dataTables: 'projectId',
      audioClips: 'id, projectId, classId',
      poseSamples: 'id, projectId, classId',
    });
    await old.table('projects').add({ id: 'p1', name: 'Cũ', projectType: 'image', createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z' });
    await old.table('classes').add({ id: 'c1', projectId: 'p1', name: 'Mèo', order: 0, createdAt: '2026-11-01T00:00:00.000Z' });
    old.close();

    const db = new LupDatabase(name);
    expect(await db.projects.get('p1')).toMatchObject({ name: 'Cũ' });
    expect(await db.classes.where('projectId').equals('p1').count()).toBe(1);
    await db.modelCards.put({ projectId: 'p1', fields: {}, updatedAt: '2026-11-23T00:00:00.000Z' });
    expect(await db.modelCards.count()).toBe(1);
    expect(db.verno).toBe(9);
    await db.delete();
  });
});
