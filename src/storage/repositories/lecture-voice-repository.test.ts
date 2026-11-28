import 'fake-indexeddb/auto';
import { LupDatabase } from '../db';
import { createDexieLectureVoiceRepository, LECTURE_VOICE_MAX_BYTES, LECTURE_VOICE_MAX_SECONDS } from './lecture-voice-repository';
import { createDexieProjectRepository } from './project-repository';

let db: LupDatabase;
let n = 0;

beforeEach(async () => {
  db = new LupDatabase(`voice-test-${++n}`);
  await db.open();
});

afterEach(async () => {
  db.close();
  await db.delete();
});

const audio = (bytes = 16) => new Uint8Array(bytes).buffer;

describe('LectureVoiceRepository', () => {
  test('lưu, đọc lại theo dự án và mức chi tiết; thu lại thì thay bản cũ', async () => {
    const repo = createDexieLectureVoiceRepository(db, () => '2026-11-28T00:00:00.000Z');
    await repo.save({ projectId: 'p1', level: 'explore', sceneId: 'title', audio: audio(), mime: 'audio/webm', duration: 4.2, text: 'Xin chào.' });
    await repo.save({ projectId: 'p1', level: 'explore', sceneId: 'data', audio: audio(), mime: 'audio/webm', duration: 7, text: 'Dữ liệu.' });
    await repo.save({ projectId: 'p1', level: 'expert', sceneId: 'title', audio: audio(), mime: 'audio/webm', duration: 5, text: 'Xin chào.' });
    await repo.save({ projectId: 'p2', level: 'explore', sceneId: 'title', audio: audio(), mime: 'audio/webm', duration: 3, text: 'Khác.' });
    await repo.save({ projectId: 'p1', level: 'explore', sceneId: 'title', audio: audio(), mime: 'audio/webm', duration: 6.5, text: 'Xin chào lại.' });

    const list = await repo.list('p1', 'explore');
    expect(list.map((v) => [v.sceneId, v.duration, v.text])).toEqual([
      ['data', 7, 'Dữ liệu.'],
      ['title', 6.5, 'Xin chào lại.'],
    ]);
    expect(list[0]?.createdAt).toBe('2026-11-28T00:00:00.000Z');
  });

  test('xóa một bản thu', async () => {
    const repo = createDexieLectureVoiceRepository(db);
    await repo.save({ projectId: 'p1', level: 'explore', sceneId: 'title', audio: audio(), mime: 'audio/webm', duration: 4, text: 'a' });
    await repo.remove('p1', 'explore', 'title');
    expect(await repo.list('p1', 'explore')).toEqual([]);
  });

  test('từ chối bản thu rỗng, quá dài, quá nặng hoặc thời lượng không hợp lệ', async () => {
    const repo = createDexieLectureVoiceRepository(db);
    const base = { projectId: 'p1', level: 'explore' as const, sceneId: 'title' as const, mime: 'audio/webm', text: 'a' };
    await expect(repo.save({ ...base, audio: audio(0), duration: 2 })).rejects.toThrow();
    await expect(repo.save({ ...base, audio: audio(), duration: Number.NaN })).rejects.toThrow();
    await expect(repo.save({ ...base, audio: audio(), duration: LECTURE_VOICE_MAX_SECONDS + 1 })).rejects.toThrow();
    await expect(repo.save({ ...base, audio: audio(LECTURE_VOICE_MAX_BYTES + 1), duration: 2 })).rejects.toThrow();
    await expect(repo.save({ ...base, mime: 'text/html', audio: audio(), duration: 2 })).rejects.toThrow();
  });

  test('xóa dự án thì xóa luôn giọng đã thu', async () => {
    const projects = createDexieProjectRepository(db);
    const voices = createDexieLectureVoiceRepository(db);
    const project = await projects.create({ name: 'Lá đậu', projectType: 'image' });
    await voices.save({ projectId: project.id, level: 'explore', sceneId: 'title', audio: audio(), mime: 'audio/webm', duration: 3, text: 'a' });
    await projects.delete(project.id);
    expect(await db.lectureVoices.count()).toBe(0);
  });
});
