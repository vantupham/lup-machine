import type { SheetInput } from '@/core/export/xlsx';
import type { AddOutcome, StoredSubmission, SubmissionRepository } from '@/storage/repositories/submission-repository';
import { rubricTotal, type Assignment } from '@/storage/schemas/assignment';
import { gradeTotal, isGraded } from '@/storage/schemas/grade';
import { getErrorMessage } from '@/ui/error-message';
import { floorPercent } from '@/core/percent';

export interface ImportResult {
  readonly fileName: string;
  readonly outcome: AddOutcome | 'error';
  readonly students?: string;
  readonly message?: string;
}

/** Nhập nhiều tệp .lups: mỗi tệp kiểm tra riêng, tệp hỏng không làm hỏng các tệp còn lại. */
export async function importSubmissionFiles(
  repo: SubmissionRepository,
  files: readonly { readonly name: string; readonly bytes: Uint8Array }[],
): Promise<ImportResult[]> {
  const { decodeSubmissionPackage } = await import('@/storage/classroom/package');
  const results: ImportResult[] = [];
  for (const file of files) {
    try {
      const { submission, project } = decodeSubmissionPackage(file.bytes);
      const { outcome } = await repo.add(submission, project, file.name);
      results.push({ fileName: file.name, outcome, students: submission.submitter.students });
    } catch (error: unknown) {
      results.push({ fileName: file.name, outcome: 'error', message: getErrorMessage(error) });
    }
  }
  return results;
}

/** Độ chính xác trên ngăn Kiểm tra của lần huấn luyện gần nhất (chỉ dự án ảnh có số này), 0–1. */
export function testAccuracy(s: StoredSubmission): number | null {
  return s.submission.summary.latestRun?.testAccuracy ?? null;
}

export interface ClassStats {
  readonly count: number;
  readonly graded: number;
  /** Trung bình tổng điểm của các bài đã chấm đủ. */
  readonly averageTotal: number | null;
  readonly averageAccuracy: number | null;
}

function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;
}

export function classStats(submissions: readonly StoredSubmission[]): ClassStats {
  const totals = submissions.map((s) => gradeTotal(s.grade)).filter((t): t is number => t !== null);
  const accuracies = submissions.map(testAccuracy).filter((a): a is number => a !== null);
  return {
    count: submissions.length,
    graded: submissions.filter((s) => isGraded(s.grade)).length,
    averageTotal: mean(totals),
    averageAccuracy: mean(accuracies),
  };
}

export interface SheetLabels {
  readonly index: string;
  readonly students: string;
  readonly className: string;
  readonly submittedAt: string;
  readonly includesData: string;
  readonly accuracy: string;
  readonly total: string;
  readonly comment: string;
  readonly yes: string;
  readonly no: string;
  readonly formatDate: (iso: string) => string;
}

/** Bảng điểm cả lớp để xuất Excel: mỗi học sinh một dòng, mỗi tiêu chí rubric một cột. */
export function gradeSheet(assignment: Assignment, submissions: readonly StoredSubmission[], labels: SheetLabels): SheetInput {
  const criteria = assignment.rubric.map((c) => `${c.criterion} (/${c.maxPoints})`);
  const header = [
    labels.index,
    labels.students,
    labels.className,
    labels.submittedAt,
    labels.includesData,
    labels.accuracy,
    ...criteria,
    `${labels.total} (/${rubricTotal(assignment.rubric)})`,
    labels.comment,
  ];
  const rows = submissions.map((s, i) => {
    const accuracy = testAccuracy(s);
    return [
      i + 1,
      s.submission.submitter.students,
      s.submission.submitter.className,
      labels.formatDate(s.submission.submittedAt),
      s.submission.includesData ? labels.yes : labels.no,
      accuracy === null ? null : floorPercent(accuracy),
      ...s.grade.scores,
      gradeTotal(s.grade),
      s.grade.comment,
    ];
  });
  const widths = [5, 28, 8, 18, 10, 12, ...criteria.map((c) => Math.min(30, Math.max(10, c.length))), 10, 40];
  return { sheetName: assignment.title, header, rows, widths };
}
