import { strToU8 } from 'fflate';
import { LupDatabase } from '@/storage/db';
import { encodeSubmissionPackage, encodeAssignmentPackage } from '@/storage/classroom/package';
import { createDexieSubmissionRepository } from '@/storage/repositories/submission-repository';
import { CURRENT_FORMAT_VERSION } from '@/storage/schemas/manifest';
import type { Submission } from '@/storage/schemas/assignment';
import type { ProjectBundle } from '@/storage/project-file/bundle';
import { sampleAssignment } from '../../../tests/setup/sample-assignment';
import { classStats, gradeSheet, importSubmissionFiles, type SheetLabels } from './grading';

const meta = { appVersion: '0.1.0', createdAt: '2026-11-25T10:00:00.000Z' };
const project: ProjectBundle = {
  manifest: { formatVersion: CURRENT_FORMAT_VERSION, appVersion: '0.1.0', projectType: 'image', name: 'x', createdAt: meta.createdAt },
  classes: [],
  images: [],
  clips: [],
  poses: [],
  table: null,
  runs: [],
  modelCard: null,
  notes: [],
};

function submission(students: string, testAccuracy: number | null): Submission {
  return {
    assignment: sampleAssignment,
    submitter: { students, className: '7A' },
    answers: ['a', 'b'],
    submittedAt: '2026-11-25T10:00:00.000Z',
    includesData: students === 'An',
    summary: {
      projectType: 'image',
      classes: [],
      table: null,
      latestRun: testAccuracy === null ? null : { number: 1, epochs: 5, trainAccuracy: 1, testAccuracy, matchesData: false },
    },
  };
}

const labels: SheetLabels = {
  index: 'STT',
  students: 'Họ tên',
  className: 'Lớp',
  submittedAt: 'Nộp lúc',
  includesData: 'Kèm dữ liệu',
  accuracy: 'Độ chính xác (%)',
  total: 'Tổng',
  comment: 'Nhận xét',
  yes: 'Có',
  no: 'Không',
  formatDate: (iso) => iso.slice(0, 10),
};

let db: LupDatabase;
beforeEach(() => {
  db = new LupDatabase(`test-${crypto.randomUUID()}`);
});
afterEach(async () => {
  await db.delete();
});

describe('nhập nhiều bài nộp', () => {
  test('mỗi tệp báo kết quả riêng; tệp hỏng hoặc sai loại không ảnh hưởng tệp khác', async () => {
    const repo = createDexieSubmissionRepository(db);
    const results = await importSubmissionFiles(repo, [
      { name: 'an.lups', bytes: encodeSubmissionPackage({ submission: submission('An', 0.8), project }, meta) },
      { name: 'hong.lups', bytes: strToU8('hỏng') },
      { name: 'de.lupa', bytes: encodeAssignmentPackage({ assignment: sampleAssignment, starter: null }, meta) },
      { name: 'an-lai.lups', bytes: encodeSubmissionPackage({ submission: submission('An', 0.9), project }, meta) },
    ]);
    expect(results.map((r) => [r.fileName, r.outcome, r.students ?? null])).toEqual([
      ['an.lups', 'added', 'An'],
      ['hong.lups', 'error', null],
      ['de.lupa', 'error', null],
      ['an-lai.lups', 'replaced', 'An'],
    ]);
    expect(results[2]?.message).toMatch(/không phải bài nộp/);
    expect(await repo.listByAssignment(sampleAssignment.id)).toHaveLength(1);
  });
});

describe('thống kê lớp và bảng điểm', () => {
  async function stored() {
    const repo = createDexieSubmissionRepository(db);
    const a = await repo.add(submission('An', 0.875), project, 'a.lups');
    const b = await repo.add(submission('Bình', null), project, 'b.lups');
    await repo.add(submission('Chi', 0.5), project, 'c.lups');
    await repo.saveGrade(a.record.id, { scores: [4, 5], comment: 'Tốt' });
    await repo.saveGrade(b.record.id, { scores: [2, 4], comment: '' });
    return repo.listByAssignment(sampleAssignment.id);
  }

  test('đếm bài đã chấm, trung bình tổng điểm và độ chính xác', async () => {
    expect(classStats(await stored())).toEqual({ count: 3, graded: 2, averageTotal: 7.5, averageAccuracy: 0.6875 });
    expect(classStats([])).toEqual({ count: 0, graded: 0, averageTotal: null, averageAccuracy: null });
  });

  test('bảng điểm: cột theo rubric, chưa chấm đủ thì tổng để trống', async () => {
    const sheet = gradeSheet(sampleAssignment, await stored(), labels);
    expect(sheet.sheetName).toBe('Phân loại rác bằng ảnh');
    expect(sheet.header).toEqual(['STT', 'Họ tên', 'Lớp', 'Nộp lúc', 'Kèm dữ liệu', 'Độ chính xác (%)', 'Dữ liệu (/4)', 'Thẻ mô hình (/6)', 'Tổng (/10)', 'Nhận xét']);
    expect(sheet.rows).toEqual([
      [1, 'An', '7A', '2026-11-25', 'Có', 87, 4, 5, 9, 'Tốt'],
      [2, 'Bình', '7A', '2026-11-25', 'Không', null, 2, 4, 6, ''],
      [3, 'Chi', '7A', '2026-11-25', 'Không', 50, null, null, null, ''],
    ]);
    expect(sheet.widths).toHaveLength(sheet.header.length);
  });
});
