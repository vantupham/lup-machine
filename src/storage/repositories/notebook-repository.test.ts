import { LupDatabase } from '../db';
import { createDexieNotebookRepository } from './notebook-repository';
import { createDexieProjectRepository } from './project-repository';
import { NOTE_TEXT_MAX_LENGTH } from '../schemas/notebook';

function setup() {
  const db = new LupDatabase(`notebook-${crypto.randomUUID()}`);
  let tick = 0;
  const now = () => `2026-11-25T00:00:${String(tick++).padStart(2, '0')}.000Z`;
  return { db, notes: createDexieNotebookRepository(db, now), projects: createDexieProjectRepository(db) };
}

describe('sổ tay ghi chép theo bước', () => {
  test('ghi chép của từng bước lưu riêng, ghi lại thì thay nội dung cũ', async () => {
    const { db, notes, projects } = setup();
    const p = await projects.create({ name: 'Mèo chó', projectType: 'image' });

    await notes.save(p.id, 'represent', 'Mèo và chó nằm lẫn vào nhau');
    await notes.save(p.id, 'evaluate', 'Hay nhầm mèo đen');
    await notes.save(p.id, 'represent', 'Mèo nằm bên trái');

    expect(await notes.list(p.id)).toEqual([
      { step: 'evaluate', text: 'Hay nhầm mèo đen' },
      { step: 'represent', text: 'Mèo nằm bên trái' },
    ]);
    await db.delete();
  });

  test('xóa hết chữ thì bỏ ghi chép của bước đó', async () => {
    const { db, notes, projects } = setup();
    const p = await projects.create({ name: 'A', projectType: 'image' });
    await notes.save(p.id, 'data', 'Có 20 ảnh');
    await notes.save(p.id, 'data', '   ');
    expect(await notes.list(p.id)).toEqual([]);
    await db.delete();
  });

  test('ghi chép làm dự án thành "vừa sửa"', async () => {
    const { db, notes, projects } = setup();
    const p = await projects.create({ name: 'A', projectType: 'image' });
    await notes.save(p.id, 'data', 'Có 20 ảnh');
    expect((await db.projects.get(p.id))?.updatedAt).not.toBe(p.updatedAt);
    await db.delete();
  });

  test('từ chối ghi chép quá dài hoặc tên bước lạ', async () => {
    const { db, notes, projects } = setup();
    const p = await projects.create({ name: 'A', projectType: 'image' });
    await expect(notes.save(p.id, 'data', 'a'.repeat(NOTE_TEXT_MAX_LENGTH + 1))).rejects.toThrow();
    await expect(notes.save(p.id, 'Bước 1!', 'x')).rejects.toThrow();
    await db.delete();
  });

  test('xóa dự án thì xóa luôn ghi chép', async () => {
    const { db, notes, projects } = setup();
    const p = await projects.create({ name: 'A', projectType: 'image' });
    await notes.save(p.id, 'data', 'Có 20 ảnh');
    await projects.delete(p.id);
    expect(await db.notes.count()).toBe(0);
    await db.delete();
  });
});
