import { LupDatabase } from '../db';
import { createDexieAssignmentRepository, type AssignmentRepository } from './assignment-repository';
import { createDexieProjectRepository } from './project-repository';
import { sampleAssignment } from '../../../tests/setup/sample-assignment';


let db: LupDatabase;
let repo: AssignmentRepository;

beforeEach(() => {
  db = new LupDatabase(`test-${crypto.randomUUID()}`);
  repo = createDexieAssignmentRepository(db, () => '2026-11-24T09:00:00.000Z');
});

afterEach(async () => {
  await db.delete();
});

describe('AssignmentRepository', () => {
  test('dự án không gắn bài tập thì trả về null', async () => {
    expect(await repo.get('p1')).toBeNull();
  });

  test('gắn bài tập, câu trả lời ban đầu rỗng đúng số câu hỏi', async () => {
    await repo.attach('p1', sampleAssignment);
    expect(await repo.get('p1')).toEqual({ projectId: 'p1', assignment: sampleAssignment, answers: ['', ''], updatedAt: '2026-11-24T09:00:00.000Z' });
  });

  test('lưu câu trả lời (cắt khoảng trắng), từ chối câu quá dài', async () => {
    await repo.attach('p1', sampleAssignment);
    await repo.saveAnswers('p1', ['  Giấy và nhựa ', 'Chụp thêm ảnh']);
    expect((await repo.get('p1'))?.answers).toEqual(['Giấy và nhựa', 'Chụp thêm ảnh']);
    await expect(repo.saveAnswers('p1', ['x'.repeat(2001), ''])).rejects.toThrow();
  });

  test('lưu câu trả lời cho dự án không có bài tập thì báo lỗi', async () => {
    await expect(repo.saveAnswers('p1', [])).rejects.toThrow(/không gắn với bài tập/);
  });

  test('từ chối bài tập không hợp lệ', async () => {
    await expect(repo.attach('p1', { ...sampleAssignment, rubric: [] })).rejects.toThrow();
  });

  test('dữ liệu hỏng thì coi như không có bài tập', async () => {
    await db.assignments.put({ projectId: 'p1', assignment: { title: 1 }, answers: [], updatedAt: 'x' });
    expect(await repo.get('p1')).toBeNull();
  });

  test('xóa dự án thì xóa luôn bài tập gắn kèm', async () => {
    const projects = createDexieProjectRepository(db);
    const project = await projects.create({ name: 'A', projectType: 'image' });
    await repo.attach(project.id, sampleAssignment);
    await projects.delete(project.id);
    expect(await repo.get(project.id)).toBeNull();
  });
});
