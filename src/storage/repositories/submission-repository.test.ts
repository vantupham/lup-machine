import { LupDatabase } from '../db';
import { createDexieSubmissionRepository, type SubmissionRepository } from './submission-repository';
import { CURRENT_FORMAT_VERSION } from '../schemas/manifest';
import type { Submission } from '../schemas/assignment';
import type { ProjectBundle } from '../project-file/bundle';
import { sampleAssignment } from '../../../tests/setup/sample-assignment';

const project: ProjectBundle = {
  manifest: { formatVersion: CURRENT_FORMAT_VERSION, appVersion: '0.1.0', projectType: 'image', name: 'Bài của An', createdAt: '2026-11-24T08:00:00.000Z' },
  classes: ['Giấy'],
  images: [],
  clips: [],
  poses: [],
  table: null,
  runs: [],
  modelCard: null,
  notes: [],
};

function submission(students: string, submittedAt = '2026-11-25T10:00:00.000Z'): Submission {
  return {
    assignment: sampleAssignment,
    submitter: { students, className: '7A' },
    answers: ['a', 'b'],
    submittedAt,
    includesData: false,
    summary: { projectType: 'image', classes: [], table: null, latestRun: null },
  };
}

let db: LupDatabase;
let repo: SubmissionRepository;
let n = 0;

beforeEach(() => {
  n = 0;
  db = new LupDatabase(`test-${crypto.randomUUID()}`);
  repo = createDexieSubmissionRepository(db, { now: () => '2026-11-26T08:00:00.000Z', newId: () => `s${++n}` });
});

afterEach(async () => {
  await db.delete();
});

describe('SubmissionRepository', () => {
  test('nhận bài nộp, điểm ban đầu chưa chấm', async () => {
    const { record, outcome } = await repo.add(submission('An'), project, 'an.lups');
    expect(outcome).toBe('added');
    expect(record).toMatchObject({ id: 's1', assignmentId: sampleAssignment.id, fileName: 'an.lups', grade: { scores: [null, null], comment: '' } });
    expect((await repo.listByAssignment(sampleAssignment.id)).map((r) => r.submission.submitter.students)).toEqual(['An']);
  });

  test('cùng học sinh nộp lại: thay bài cũ nhưng giữ điểm đã chấm; nộp bản cũ hơn thì bỏ qua', async () => {
    const first = await repo.add(submission('An'), project, 'an.lups');
    await repo.saveGrade(first.record.id, { scores: [3, 5], comment: 'Tốt' });
    const again = await repo.add(submission(' an ', '2026-11-25T12:00:00.000Z'), project, 'an-2.lups');
    expect(again.outcome).toBe('replaced');
    expect(again.record).toMatchObject({ id: first.record.id, fileName: 'an-2.lups', grade: { scores: [3, 5], comment: 'Tốt' } });
    const older = await repo.add(submission('An', '2026-11-24T12:00:00.000Z'), project, 'cu.lups');
    expect(older.outcome).toBe('older');
    expect(older.record.fileName).toBe('an-2.lups');
    expect(await repo.listByAssignment(sampleAssignment.id)).toHaveLength(1);
  });

  test('trùng tên nhưng khác lớp là hai học sinh khác nhau', async () => {
    await repo.add(submission('An'), project, 'an-7a.lups');
    const other = await repo.add({ ...submission('An'), submitter: { students: 'An', className: '7B' } }, project, 'an-7b.lups');
    expect(other.outcome).toBe('added');
    expect(await repo.listByAssignment(sampleAssignment.id)).toHaveLength(2);
  });

  test('nộp lại với rubric khác (giáo viên sửa đề): điểm cũ không còn đúng nên được xóa', async () => {
    const first = await repo.add(submission('An'), project, 'an.lups');
    await repo.saveGrade(first.record.id, { scores: [3, 5], comment: 'Tốt' });
    const rubric = [...sampleAssignment.rubric, { criterion: 'Trình bày', description: '', maxPoints: 2 }];
    const again = await repo.add({ ...submission('An', '2026-11-26T08:00:00.000Z'), assignment: { ...sampleAssignment, rubric } }, project, 'an-2.lups');
    expect(again.record.grade).toEqual({ scores: [null, null, null], comment: '' });
    expect((await repo.listAssignments())[0]?.assignment.rubric).toHaveLength(3);
  });

  test('dự án đầy đủ chỉ đọc khi cần; xóa bài nộp thì xóa cả dự án', async () => {
    const { record } = await repo.add(submission('An'), project, 'an.lups');
    expect(record.modelCard).toBeNull();
    expect((await repo.getProject(record.id))?.manifest.name).toBe('Bài của An');
    await repo.delete(record.id);
    expect(await repo.getProject(record.id)).toBeNull();
  });

  test('sắp xếp theo tên học sinh (tiếng Việt)', async () => {
    for (const name of ['Đức', 'Bình', 'An']) await repo.add(submission(name), project, `${name}.lups`);
    expect((await repo.listByAssignment(sampleAssignment.id)).map((r) => r.submission.submitter.students)).toEqual(['An', 'Bình', 'Đức']);
  });

  test('chấm điểm: kiểm tra theo rubric', async () => {
    const { record } = await repo.add(submission('An'), project, 'an.lups');
    await expect(repo.saveGrade(record.id, { scores: [5, 1], comment: '' })).rejects.toThrow(/điểm tối đa/);
    await expect(repo.saveGrade(record.id, { scores: [1], comment: '' })).rejects.toThrow();
    const saved = await repo.saveGrade(record.id, { scores: [2.5, null], comment: '  Cần thêm ảnh ' });
    expect(saved.grade).toEqual({ scores: [2.5, null], comment: 'Cần thêm ảnh' });
    await expect(repo.saveGrade('khong-co', { scores: [1, 1], comment: '' })).rejects.toThrow(/Không tìm thấy/);
  });

  test('danh sách bài tập đã nhận bài (mới nhận trước, cùng lúc thì theo tên); xóa bài và xóa cả bài tập', async () => {
    const { record } = await repo.add(submission('An'), project, 'an.lups');
    await repo.add({ ...submission('Bình'), assignment: { ...sampleAssignment, id: '11111111-2222-4333-8444-555555555555', title: 'Bài 2' } }, project, 'b.lups');
    expect((await repo.listAssignments()).map((a) => [a.assignment.title, a.count])).toEqual([
      ['Bài 2', 1],
      ['Phân loại rác bằng ảnh', 1],
    ]);
    await repo.delete(record.id);
    expect(await repo.listByAssignment(sampleAssignment.id)).toEqual([]);
    await repo.deleteAssignment('11111111-2222-4333-8444-555555555555');
    expect(await repo.listAssignments()).toEqual([]);
  });
});
